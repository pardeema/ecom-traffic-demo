// src/utils/traffic-logger.ts
import { NextRequest } from 'next/server';
import { redis } from './redis-client';
import { TrafficLog } from '@/types';

// --- Redis Constants ---
const LOG_PREFIX = 'traffic:log:';
const LOGS_LIST_KEY = 'traffic:logs';
const MAX_LOGS = 1000; // Max detailed logs to keep

// --- NEW: Dashboard Counter Constants ---
const DASHBOARD_COUNTER_PREFIX = 'dashboard:count:';
const COUNTER_GRANULARITY_SECONDS = 1; // Store counts per second
const COUNTER_EXPIRY_SECONDS = 15 * 60; // Keep counters for 15 minutes

// --- Helper Function to get Client IP (Keep Existing) ---
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
// --- End Helper Function ---

/**
 * Log traffic data to Redis (Write operations)
 * - Stores full log details (limited history)
 * - Increments dashboard counters (efficient aggregation)
 */
export async function logTraffic(req: NextRequest, endpoint: string, status: number): Promise<void> {
  try {
    const now = new Date();
    const timestamp = now.toISOString();
    const timestampSeconds = Math.floor(now.getTime() / 1000); // For counter key

    // --- Prepare Full Log Entry (Existing Logic) ---
    const logId = `${LOG_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const score = Date.now(); // For sorted set
    const clientIp = getClientIp(req);
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
    const jsonData = JSON.stringify(fullLogEntry);

    // --- Prepare Dashboard Counter Update (New Logic) ---
    // Only count relevant endpoints for the dashboard
    if (endpoint === '/api/auth/login' || endpoint === '/api/checkout') {
        const bucketTimestamp = Math.floor(timestampSeconds / COUNTER_GRANULARITY_SECONDS) * COUNTER_GRANULARITY_SECONDS;
        const counterKey = `${DASHBOARD_COUNTER_PREFIX}${endpoint}:${bucketTimestamp}`;

        // --- Perform Redis Write Operations ---
        const pipeline = redis.pipeline();

        // 1. Increment the counter for the specific second
        pipeline.incr(counterKey);
        // 2. Set expiry for the counter key *only if it's newly created* (INCR returns 1 if new)
        //    Alternatively, simpler: always set expiry (slightly more writes, but handles edge cases)
        pipeline.expire(counterKey, COUNTER_EXPIRY_SECONDS);

        // 3. Store the full log entry (Existing)
        pipeline.set(logId, jsonData, { ex: 1800 }); // Keep full log for 30 mins
        // 4. Add log ID to the sorted set (Existing)
        pipeline.zadd(LOGS_LIST_KEY, { score: score, member: logId });
        // 5. Trim the sorted set of full logs (Existing)
        pipeline.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));

        // Execute all commands in a single transaction
        await pipeline.exec();

    } else {
        // For endpoints not tracked on the dashboard, just store the full log
        const pipeline = redis.pipeline();
        pipeline.set(logId, jsonData, { ex: 1800 });
        pipeline.zadd(LOGS_LIST_KEY, { score: score, member: logId });
        pipeline.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));
        await pipeline.exec();
    }

  } catch (error) {
    console.error(`!!! ERROR in logTraffic function for ${endpoint} !!!`, error);
  }
}

/**
 * Get *historical* traffic logs (for detailed analysis, NOT dashboard)
 * (Keep existing implementation for fetching detailed logs if needed elsewhere)
 */
export async function getTrafficLogs(options: {
  endpoint?: string;
  method?: string;
  isBot?: boolean;
  since?: number; // Expects timestamp in milliseconds
  limit?: number;
} = {}): Promise<TrafficLog[]> {
    // console.log(`--- ENTERING getTrafficLogs function with options:`, options);
    try {
        let logIds: string[] = [];
        // Adjust minScore calculation if needed based on how 'since' is used
        const minScore: number = options.since ? options.since + 1 : 0; // Use ms timestamp directly for score
        const maxScore: number = Number.MAX_SAFE_INTEGER;

        // Fetch log IDs from the sorted set based on score (timestamp)
        logIds = await redis.zrange(LOGS_LIST_KEY, minScore, maxScore, {
            byScore: true,
        });

        // Apply limit *after* fetching relevant IDs if necessary
        if (options.limit && logIds.length > options.limit) {
            logIds = logIds.slice(-options.limit); // Get the newest ones if limited
        }

        if (logIds.length === 0) {
            // console.log("No log IDs found for the given criteria.");
            return [];
        }

        // Fetch full log data using MGET
        const logData: (unknown | null)[] = await redis.mget(...logIds);
        // console.log(`Retrieved ${logData.length} items via mget.`);

        // Process and filter fetched data
        const logs: TrafficLog[] = logData
            .filter((data): data is Record<string, unknown> => data !== null && typeof data === 'object')
            .map((data: Record<string, unknown>): TrafficLog => data as unknown as TrafficLog)
            .filter(log => {
                 // Apply post-fetch filters
                 let keep = true;
                 if (options.endpoint && log.endpoint !== options.endpoint) keep = false;
                 if (options.method && log.method !== options.method) keep = false;
                 if (options.isBot !== undefined && log.isBot !== options.isBot) keep = false;
                 return keep;
             });

        // Sort logs newest first
        const sortedLogs = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // console.log(`Returning ${sortedLogs.length} sorted logs from getTrafficLogs.`);
        return sortedLogs;

    } catch (error) {
        console.error('!!! ERROR retrieving detailed traffic logs !!!', error);
        return [];
    }
}

// --- NEW: Function specifically for dashboard data ---
interface DashboardDataPoint {
    timestamp: number; // Unix timestamp (seconds) for the start of the interval
    loginCount: number;
    checkoutCount: number;
}

/**
 * Fetches aggregated traffic counts for the dashboard.
 */
export async function getDashboardTrafficCounts(options: {
    startTimeSeconds: number; // Unix timestamp (seconds) for the start of the overall window
    endTimeSeconds: number;   // Unix timestamp (seconds) for the end of the overall window
    intervalSeconds: number;  // Desired interval for aggregation (e.g., 60 for 1 minute)
}): Promise<DashboardDataPoint[]> {
    const { startTimeSeconds, endTimeSeconds, intervalSeconds } = options;
    const results: DashboardDataPoint[] = [];

    try {
        const loginKeys: string[] = [];
        const checkoutKeys: string[] = [];

        // Generate all the 1-second granularity keys we might need within the window
        for (let ts = startTimeSeconds; ts <= endTimeSeconds; ts += COUNTER_GRANULARITY_SECONDS) {
            const bucketTimestamp = Math.floor(ts / COUNTER_GRANULARITY_SECONDS) * COUNTER_GRANULARITY_SECONDS;
            loginKeys.push(`${DASHBOARD_COUNTER_PREFIX}/api/auth/login:${bucketTimestamp}`);
            checkoutKeys.push(`${DASHBOARD_COUNTER_PREFIX}/api/checkout:${bucketTimestamp}`);
        }

        // Fetch all counts in one go using MGET
        const allKeys = [...loginKeys, ...checkoutKeys];
        if (allKeys.length === 0) return [];

        const counts = await redis.mget<number[]>(...allKeys);

        // Create a map for easy lookup: key -> count
        const countMap = new Map<string, number>();
        allKeys.forEach((key, index) => {
            countMap.set(key, counts[index] ?? 0); // Use 0 if key doesn't exist (no traffic in that second)
        });

        // Aggregate into the desired intervals
        for (let intervalStart = startTimeSeconds; intervalStart < endTimeSeconds; intervalStart += intervalSeconds) {
            let loginSum = 0;
            let checkoutSum = 0;
            const intervalEnd = intervalStart + intervalSeconds;

            // Sum the 1-second counts within this interval
            for (let ts = intervalStart; ts < intervalEnd; ts += COUNTER_GRANULARITY_SECONDS) {
                 const bucketTimestamp = Math.floor(ts / COUNTER_GRANULARITY_SECONDS) * COUNTER_GRANULARITY_SECONDS;
                 loginSum += countMap.get(`${DASHBOARD_COUNTER_PREFIX}/api/auth/login:${bucketTimestamp}`) ?? 0;
                 checkoutSum += countMap.get(`${DASHBOARD_COUNTER_PREFIX}/api/checkout:${bucketTimestamp}`) ?? 0;
            }

            results.push({
                timestamp: intervalStart, // Timestamp for the beginning of the interval
                loginCount: loginSum,
                checkoutCount: checkoutSum,
            });
        }

        return results;

    } catch (error) {
        console.error('!!! ERROR retrieving dashboard traffic counts !!!', error);
        return []; // Return empty array on error
    }
}