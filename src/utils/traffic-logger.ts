// src/utils/traffic-logger.ts
import { NextRequest } from 'next/server';
import { redis } from './redis-client';
import { TrafficLog } from '@/types';

// --- Redis Constants ---
const LOG_PREFIX = 'traffic:log:';
const LOGS_LIST_KEY = 'traffic:logs';
const MAX_LOGS = 1000;

/**
 * Log traffic data to Redis (Write operations)
 */
export async function logTraffic(req: NextRequest, endpoint: string, status: number): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const logId = `${LOG_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const score = Date.now();

    // --- Get Client IP ---
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
    // Ensure the value being set is definitely a stringified JSON
    pipe.set(logId, JSON.stringify(fullLogEntry), { ex: 1800 });
    pipe.zadd(LOGS_LIST_KEY, { score: score, member: logId });
    pipe.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));
    await pipe.exec();

  } catch (error) {
    // Log specific errors during traffic logging
    console.error(`Error logging traffic for ${endpoint}:`, error);
  }
}

/**
 * Get historical traffic logs (Optimized & Robust Parsing)
 */
export async function getTrafficLogs(options: {
  endpoint?: string;
  method?: string;
  isBot?: boolean;
  since?: number;
  limit?: number;
} = {}): Promise<TrafficLog[]> {
    try {
        let logIds: string[] = [];
        const minScore: number = options.since ? options.since + 1 : 0;
        const maxScore: number = Number.MAX_SAFE_INTEGER;

        logIds = await redis.zrange(LOGS_LIST_KEY, minScore, maxScore, {
            byScore: true,
        });

        if (options.limit && logIds.length > options.limit) {
            logIds = logIds.slice(-options.limit);
        }

        if (logIds.length === 0) {
            return [];
        }

        const logData = await redis.mget(...logIds);

        // Filter out nulls AND non-strings, then safely parse JSON
        const logs: TrafficLog[] = logData
            // 1. Ensure the item is actually a string before trying to parse
            .filter((data): data is string => typeof data === 'string')
            // 2. Map and parse, catching errors for individual entries
            .map((data: string, index: number): TrafficLog | null => {
                try {
                    // Attempt to parse the string data
                    return JSON.parse(data) as TrafficLog;
                } catch (parseError) {
                    // Log the problematic data and the error
                    console.error(`Failed to parse log entry at index ${index} (ID: ${logIds[index] || 'unknown'}):`, parseError);
                    console.error('Problematic data string:', data); // Log the bad string
                    // Return null for entries that fail parsing
                    return null;
                }
            })
            // 3. Filter out any entries that failed parsing (became null)
            .filter((log): log is TrafficLog => log !== null);


        // Apply remaining filters (endpoint, method, isBot) after fetching/parsing
        let filteredLogs = logs;
        if (options.endpoint) {
            filteredLogs = filteredLogs.filter(log => log.endpoint === options.endpoint);
        }
        if (options.method) {
            filteredLogs = filteredLogs.filter(log => log.method === options.method);
        }
        if (options.isBot !== undefined) {
            filteredLogs = filteredLogs.filter(log => log.isBot === options.isBot);
        }

        // Return logs sorted newest first
        return filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } catch (error) {
        // Log errors during the retrieval process
        console.error('Error retrieving traffic logs:', error);
        return []; // Return empty array on error
    }
}
