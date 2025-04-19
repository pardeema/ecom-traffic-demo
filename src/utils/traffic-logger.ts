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
 * NO CHANGES HERE - Keep the sequential version
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
    const setResult = await redis.set(logId, jsonData, { ex: 1800 });
    console.log(`Redis SET Result for ${logId}:`, setResult);

    // 2. Add the ID to the sorted set
    console.log(`Attempting Redis ZADD for ${logId} with score ${score}`);
    const zaddResult = await redis.zadd(LOGS_LIST_KEY, { score: score, member: logId });
    console.log(`Redis ZADD Result for ${logId}:`, zaddResult);

    // 3. Trim the sorted set
    console.log(`Attempting Redis ZREMRANGEBYRANK for ${LOGS_LIST_KEY}`);
    const zremResult = await redis.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));
    console.log(`Redis ZREMRANGEBYRANK Result:`, zremResult);

  } catch (error) {
    console.error(`!!! ERROR in logTraffic function for ${endpoint} !!!`, error);
  }
}

/**
 * Get historical traffic logs (TESTING WITH redis.get)
 */
export async function getTrafficLogs(options: {
  endpoint?: string;
  method?: string;
  isBot?: boolean;
  since?: number;
  limit?: number; // Limit still used for slicing IDs if needed later
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

        // --- MODIFIED: Test with GET on the latest ID only ---
        let logs: TrafficLog[] = [];
        if (logIds.length > 0) {
            // Get the ID of the newest log found by zrange (last item since it's ascending)
            const latestLogId = logIds[logIds.length - 1];
            console.log(`Attempting Redis GET for latest ID: ${latestLogId}`);
            // Use redis.get() which might return string | null | Buffer depending on client/config
            const singleLogData: string | null | Record<string, unknown> | Buffer = await redis.get(latestLogId);

            console.log(`Redis GET result for ${latestLogId}: Type = ${typeof singleLogData}, Value =`, singleLogData);

            if (typeof singleLogData === 'string') {
                 console.log(`Data for ${latestLogId} is a string. Attempting parse...`);
                 try {
                    const parsedLog = JSON.parse(singleLogData) as TrafficLog;
                    logs.push(parsedLog); // Add the single parsed log
                    console.log(`Successfully parsed log for ${latestLogId}`);
                 } catch (parseError) {
                    console.error(`Failed to parse log entry (ID: ${latestLogId}):`, parseError);
                    console.error('Problematic data string:', singleLogData);
                 }
            } else if (singleLogData === null) {
                 console.log(`Data for ${latestLogId} returned null from GET.`);
            } else {
                 console.log(`Data for ${latestLogId} is not a string or null.`);
                 // Optional: Handle buffer case if necessary
                 // if (Buffer.isBuffer(singleLogData)) { ... }
            }
        } else {
             console.log(`No log IDs found for the given range. Returning empty array.`);
             return []; // Return early if zrange found nothing
        }
        // --- End Modification ---


        // Apply remaining filters (endpoint, method, isBot) to the potentially single log entry
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

        // No need to sort if we only fetched one item
        console.log(`Returning ${filteredLogs.length} logs from getTrafficLogs (after GET test).`);
        return filteredLogs;

    } catch (error) {
        console.error('!!! ERROR retrieving traffic logs !!!', error);
        return [];
    }
}
