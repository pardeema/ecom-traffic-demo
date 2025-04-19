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
    const pipe = redis.pipeline();
    pipe.set(logId, JSON.stringify(fullLogEntry), { ex: 1800 });
    pipe.zadd(LOGS_LIST_KEY, { score: score, member: logId });
    pipe.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));
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
  since?: number; // Timestamp in milliseconds (exclusive lower bound)
  limit?: number; // Max number of logs to return
} = {}): Promise<TrafficLog[]> {
    try {
        let logIds: string[] = [];

        // --- Define the score range for ZRANGE ---
        // We want scores *strictly greater than* options.since.
        // Pass numbers directly to zrange. Add 1ms to 'since' to make the range effectively exclusive.
        // Use 0 as the minimum score if 'since' is not provided (start of epoch time).
        const minScore: number = options.since ? options.since + 1 : 0;
        // Use a very large number instead of '+inf' string for max score to satisfy stricter types.
        const maxScore: number = Number.MAX_SAFE_INTEGER;

        // Fetch IDs using ZRANGE BYSCORE, ordered by score (time) ascending
        // Pass numeric minScore and numeric maxScore
        logIds = await redis.zrange(LOGS_LIST_KEY, minScore, maxScore, {
            byScore: true,
        });

        // Apply limit if specified, taking the newest ones (last N elements from ascending fetch)
        if (options.limit && logIds.length > options.limit) {
            // Since fetched ascending, the newest are at the end.
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
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new D ate(a.timestamp).getTime());

    } catch (error) {
        console.error('Error retrieving traffic logs:', error);
        return [];
    }
}
