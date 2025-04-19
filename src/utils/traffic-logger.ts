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
  // --- ADDED: Log entry into this function ---
  console.log(`+++ ENTERING logTraffic function for ${endpoint} with status ${status} +++`);
  // --- End Added Log ---

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
    console.log(`Attempting Redis write for logId: ${logId}`); // Log before write
    const pipe = redis.pipeline();
    pipe.set(logId, JSON.stringify(fullLogEntry), { ex: 1800 });
    pipe.zadd(LOGS_LIST_KEY, { score: score, member: logId });
    pipe.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));
    const results = await pipe.exec();
    console.log(`Redis pipeline results for ${logId}:`, results); // Log results

  } catch (error) {
    // Log specific errors during traffic logging
    // --- MODIFIED: Make error log more prominent ---
    console.error(`!!! ERROR in logTraffic function for ${endpoint} !!!`, error);
    // --- End Modified Log ---
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
    // --- ADDED: Log entry into this function ---
    console.log(`--- ENTERING getTrafficLogs function with options:`, options);
    // --- End Added Log ---
    try {
        let logIds: string[] = [];
        const minScore: number = options.since ? options.since + 1 : 0;
        const maxScore: number = Number.MAX_SAFE_INTEGER;

        // Log parameters being used for zrange
        console.log(`Querying Redis zrange with: key=${LOGS_LIST_KEY}, minScore=${minScore}, maxScore=${maxScore}`);

        logIds = await redis.zrange(LOGS_LIST_KEY, minScore, maxScore, {
            byScore: true,
        });

        console.log(`Redis zrange returned ${logIds.length} IDs.`);

        if (options.limit && logIds.length > options.limit) {
            console.log(`Limiting log IDs from ${logIds.length} to ${options.limit}`);
            logIds = logIds.slice(-options.limit);
        }

        if (logIds.length === 0) {
            console.log(`No log IDs found for the given range. Returning empty array.`);
            return [];
        }

        console.log(`Attempting Redis mget for ${logIds.length} IDs.`);
        const logData = await redis.mget(...logIds);
        console.log(`Redis mget returned data (length: ${logData?.length ?? 0}). Filtering and parsing...`);


        // Filter out nulls AND non-strings, then safely parse JSON
        const logs: TrafficLog[] = logData
            .filter((data): data is string => typeof data === 'string')
            .map((data: string, index: number): TrafficLog | null => {
                try {
                    return JSON.parse(data) as TrafficLog;
                } catch (parseError) {
                    console.error(`Failed to parse log entry at index ${index} (ID: ${logIds[index] || 'unknown'}):`, parseError);
                    console.error('Problematic data string:', data);
                    return null;
                }
            })
            .filter((log): log is TrafficLog => log !== null);

        console.log(`Successfully parsed ${logs.length} log entries.`);

        // Apply remaining filters (endpoint, method, isBot) after fetching/parsing
        let filteredLogs = logs;
        // Add logging for filtering steps if needed
        // ...

        // Return logs sorted newest first
        const sortedLogs = filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        console.log(`Returning ${sortedLogs.length} sorted logs from getTrafficLogs.`);
        return sortedLogs;


    } catch (error) {
        // Log errors during the retrieval process
        console.error('!!! ERROR retrieving traffic logs !!!', error);
        return []; // Return empty array on error
    }
}
