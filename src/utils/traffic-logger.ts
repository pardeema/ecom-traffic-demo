// src/utils/traffic-logger.ts
import { NextRequest } from 'next/server';
import { redis } from './redis-client'; // Use the standard Redis client
import { TrafficLog } from '@/types';

// --- Redis Constants ---
const LOG_PREFIX = 'traffic:log:';
const LOGS_LIST_KEY = 'traffic:logs'; // Sorted Set key
const MAX_LOGS = 1000; // Max logs to keep in the sorted set history

/**
 * Log traffic data to Redis (Write operations)
 */
export async function logTraffic(req: NextRequest, endpoint: string, status: number): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const logId = `${LOG_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const score = Date.now(); // Use milliseconds timestamp as score for the sorted set

    // --- Get Client IP (Keep your existing logic) ---
    const getClientIp = (request: NextRequest): string => {
        let chosenIp = 'unknown';
        const cfIp = request.headers.get('cf-connecting-ip');
        if (cfIp) return cfIp;
        const realIp = request.headers.get('x-real-ip');
        if (realIp) return realIp;
        const xff = request.headers.get('x-forwarded-for');
        if (xff) {
            const ips = xff.split(',').map(ip => ip.trim());
            if (ips.length > 0 && ips[0]) return ips[0];
        }
        return chosenIp;
    };
    const clientIp = getClientIp(req);
    // --- End Helper Function ---

    // Prepare the full log entry
    const fullLogEntry: TrafficLog = {
      timestamp,
      endpoint,
      method: req.method,
      ip: clientIp,
      realIp: clientIp,
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-kasada-classification') === 'bad-bot',
      statusCode: status,
      headers: Object.fromEntries(req.headers.entries())
    };

    // --- Perform Redis Write Operations ---
    // Use a pipeline for atomic operations or Promise.allSettled if atomicity isn't critical
    const pipe = redis.pipeline();
    // a) Store the full log entry with expiration
    pipe.set(logId, JSON.stringify(fullLogEntry), { ex: 1800 }); // e.g., 30-minute expiration
    // b) Add log ID to the sorted set with timestamp score
    pipe.zadd(LOGS_LIST_KEY, { score: score, member: logId });
    // c) Trim the sorted set to keep only the latest MAX_LOGS entries
    pipe.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1)); // Remove items beyond MAX_LOGS count
    // d) Optionally, trim associated log entries (more complex, requires getting keys to delete)
    //    For simplicity, we rely on the `set` expiration (step a) to clean up old entries.

    await pipe.exec();

  } catch (error) {
    console.error('Error logging traffic:', error);
  }
}

/**
 * Get historical traffic logs (Optimized for initial load and incremental polling)
 * Uses ZRANGE BYSCORE and MGET to fetch logs efficiently.
 */
export async function getTrafficLogs(options: {
  endpoint?: string;
  method?: string;
  isBot?: boolean;
  since?: number; // Timestamp in milliseconds (exclusive)
  limit?: number; // Max number of logs to return
} = {}): Promise<TrafficLog[]> {
    try {
        let logIds: string[] = [];

        // Define the score range for ZRANGE
        // Fetch logs with score > options.since up to +infinity
        // We add a small epsilon (1ms) to 'since' to make it exclusive
        const minScore = options.since ? `(${options.since}` : '-inf'; // Exclusive range using '('
        const maxScore = '+inf';

        // Fetch IDs using ZRANGE BYSCORE, ordered by score (time) ascending
        // We fetch ascending to easily get the latest timestamp later if needed,
        // but will reverse for the final output if newest-first is desired.
        logIds = await redis.zrange(LOGS_LIST_KEY, minScore, maxScore, {
            byScore: true,
            // Note: ZRANGE doesn't directly support limit with BYSCORE in all clients/versions easily.
            // We might fetch more IDs than needed and limit later, or use ZREVRANGE with limit if always newest-first.
            // Let's fetch all matching scores and limit in code for now.
            // Alternatively, use ZREVRANGE with limit if only newest N are needed.
        });

        // Apply limit if specified, taking the newest ones (last N elements)
        if (options.limit && logIds.length > options.limit) {
            logIds = logIds.slice(-options.limit);
        }

        if (logIds.length === 0) {
            return [];
        }

        // Use MGET to fetch log details for the retrieved IDs (single READ operation)
        const logData = await redis.mget(...logIds);

        // Filter out nulls (if logs expired between ZRANGE and MGET) and parse
        let logs = logData
            .filter((data): data is string => data !== null)
            .map(data => JSON.parse(data) as TrafficLog);

        // Apply remaining filters (endpoint, method, isBot) after fetching
        if (options.endpoint) {
            logs = logs.filter(log => log.endpoint === options.endpoint);
        }
        if (options.method) {
            logs = logs.filter(log => log.method === options.method);
        }
        if (options.isBot !== undefined) {
            logs = logs.filter(log => log.isBot === options.isBot);
        }

        // Return logs sorted newest first
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } catch (error) {
        console.error('Error retrieving traffic logs:', error);
        return [];
    }
}
