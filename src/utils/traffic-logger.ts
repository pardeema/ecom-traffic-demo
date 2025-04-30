// src/utils/traffic-logger.ts
import { NextRequest } from 'next/server';
import { redis } from './redis-client';
import { TrafficLog } from '@/types';

// --- Redis Constants ---
const LOG_PREFIX = 'traffic:log:';
const LOGS_LIST_KEY = 'traffic:logs';
const MAX_LOGS = 200; // Reduced from 1000 to save Redis space

/**
 * Log traffic data to Redis with optimized storage
 */
export async function logTraffic(req: NextRequest, endpoint: string, status: number): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const timestampMs = Date.now();
    const logId = `${LOG_PREFIX}${timestampMs}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Get client IP
    const clientIp = getClientIp(req);
    
    // Create minimal log entry with only essential data
    const logEntry: TrafficLog = {
      timestamp,
      endpoint,
      method: req.method,
      ip: clientIp,
      realIp: clientIp,
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-kasada-classification') === 'bad-bot',
      statusCode: status,
      // Minimize stored headers to save space
      headers: {
        'user-agent': req.headers.get('user-agent') || '',
        'referer': req.headers.get('referer') || '',
      }
    };
    
    // Single set operation for the log entry
    await redis.set(logId, JSON.stringify(logEntry), { ex: 3600 }); // 1 hour expiry
    
    // Add to sorted set for time ordering
    await redis.zadd(LOGS_LIST_KEY, { score: timestampMs, member: logId });
    
    // Trim old logs occasionally (not every request to save operations)
    // We'll do this probabilistically to reduce the number of operations
    if (Math.random() < 0.1) { // 10% chance to trim on each request
      await redis.zremrangebyrank(LOGS_LIST_KEY, 0, -(MAX_LOGS + 1));
    }
    
  } catch (error) {
    console.error('Error logging traffic:', error);
  }
}

/**
 * Helper function to get client IP
 */
function getClientIp(req: NextRequest): string {
  let chosenIp = 'unknown';
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }
  
  return chosenIp;
}

/**
 * Optimized method to get traffic logs
 * - Uses Redis commands compatible with Upstash client
 * - Retrieves minimal data for specified time window
 */
export async function getTrafficLogs(options: {
  endpoint?: string;
  method?: string;
  isBot?: boolean;
  since?: number;
  limit?: number;
} = {}): Promise<TrafficLog[]> {
  try {
    const { endpoint, method, isBot, since = 0, limit = 100 } = options;
    
    // Get log IDs in time range (newest first)
    // Using zrange with the correct options for Upstash Redis client
    const logIds = await redis.zrange(
      LOGS_LIST_KEY,
      since > 0 ? since.toString() : '-inf',
      '+inf',
      {
        byScore: true,
        rev: true,
        count: limit * 2 // Fetch extra to account for filtering
      }
    );
    
    if (!logIds || logIds.length === 0) {
      return [];
    }
    
    // Fetch log data in a single mget operation
    const logData = await redis.mget(...logIds);
    
    // Parse and filter logs
    const logs: TrafficLog[] = [];
    
    for (let i = 0; i < logData.length; i++) {
      if (logData[i]) {
        try {
          const log = JSON.parse(logData[i] as string) as TrafficLog;
          
          // Apply filters
          let include = true;
          
          if (endpoint && log.endpoint !== endpoint) {
            include = false;
          }
          
          if (include && method && log.method !== method) {
            include = false;
          }
          
          if (include && isBot !== undefined && log.isBot !== isBot) {
            include = false;
          }
          
          if (include) {
            logs.push(log);
            
            if (logs.length >= limit) {
              break; // Stop once we have enough logs
            }
          }
        } catch (e) {
          console.error('Error parsing log data:', e);
        }
      }
    }
    
    return logs;
  } catch (error) {
    console.error('Error getting traffic logs:', error);
    return [];
  }
}

/**
 * Get the latest timestamp from the log set
 * This helps optimize polling by only fetching newer logs
 */
export async function getLatestLogTimestamp(): Promise<number> {
  try {
    // Get the newest log ID
    const [newestId] = await redis.zrange(LOGS_LIST_KEY, -1, -1);
    
    if (!newestId) {
      return Date.now(); // Default to current time if no logs exist
    }
    
    // Extract timestamp from log ID
    const timestamp = newestId.split('-')[1];
    return parseInt(timestamp) || Date.now();
    
  } catch (error) {
    console.error('Error getting latest log timestamp:', error);
    return Date.now();
  }
}