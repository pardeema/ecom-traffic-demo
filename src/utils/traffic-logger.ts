// src/utils/traffic-logger.ts
import { NextRequest } from 'next/server';
import { redis } from './redis-client';
import { TrafficLog } from '@/types';

// --- Redis Constants ---
const LOG_PREFIX = 'traffic:log:';
const LOGS_LIST_KEY = 'traffic:logs';
const MAX_LOGS = 1000;

/**
 * Log traffic data to Redis (Write operations - Using Sequential Commands)
 */
export async function logTraffic(req: NextRequest, endpoint: string, status: number): Promise<void> {
  console.log(`+++ ENTERING logTraffic function for ${endpoint} with status ${status} +++`);
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

    // --- Perform Redis Write Operations Sequentially ---
    const jsonData = JSON.stringify(fullLogEntry);
    console.log(`Writing to Redis key ${logId} with score ${score}, data: ${jsonData.substring(0, 100)}...`);

    // 1. Set the log entry data
    console.log(`Attempting Redis SET for ${logId}`);
    const setResult = await redis.set(logId, jsonData, { ex: 1800 }); // Keep expiration for now
    console.log(`Redis SET Result for ${logId}:`, setResult); // Should be 'OK'

    // 2. Add the ID to the sorted set
    console.log(`Attempting Redis ZADD for ${logId} with score ${score}`);
    const zaddResult = await redis.zadd(LOGS_LIST_KEY, { score: score, member: logId });
    console.log(`Redis ZADD Result for ${logId}:`, zaddResult); // Should be 1 if added, 0 if updated

    // 3. Trim the sorted set
    console.log(`Attempting Redis ZREMRANGEBYRANK for ${LOGS_LIST_KEY}`);
    const zremResult = await redis.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));
    console.log(`Redis ZREMRANGEBYRANK Result:`, zremResult); // Number of elements removed

  } catch (error) {
    console.error(`!!! ERROR in logTraffic function for ${endpoint} !!!`, error);
  }
}

/**
 * Get historical traffic logs (Optimized & Robust Parsing)
 * NO CHANGES HERE - Keep the version that inspects mget results
 */
export async function getTrafficLogs(options: {
  endpoint?: string;
  method?: string;
  isBot?: boolean;
  since?: number;
  limit?: number;
} = {}): Promise<TrafficLog[]> {
    console.log(`--- ENTERING getTrafficLogs function with options:`, options);
    try {
        let logIds: string[] = [];
        const minScore: number = options.since ? options.since + 1 : 0;
        const maxScore: number = Number.MAX_SAFE_INTEGER;

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

        // Inspect raw mget results
        if (logData && logData.length > 0) {
            console.log(`Inspecting first item from mget: Type = ${typeof logData[0]}, Value =`, logData[0]);
            if (typeof logData[0] !== 'string' && logData[0] !== null && typeof (logData[0] as any).toString === 'function') {
                 console.log(`Inspecting first item from mget (as string):`, (logData[0] as any).toString());
            }
        }

        // Filter/Parse Logic (keep robust version)
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

        // Filtering Logic
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

        // Sorting Logic
        const sortedLogs = filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        console.log(`Returning ${sortedLogs.length} sorted logs from getTrafficLogs.`);
        return sortedLogs;

    } catch (error) {
        console.error('!!! ERROR retrieving traffic logs !!!', error);
        return [];
    }
}
