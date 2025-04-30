// src/utils/traffic-logger.ts
import { NextRequest } from 'next/server';
import { redis } from './redis-client';
import { TrafficLog } from '@/types';

// --- Redis Constants ---
const LOG_PREFIX = 'traffic:log:';
const LOGS_LIST_KEY = 'traffic:logs';
const MAX_LOGS = 200;

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
    
    // Create minimal log entry
    const logEntry: TrafficLog = {
      timestamp,
      endpoint,
      method: req.method,
      ip: clientIp,
      realIp: clientIp,
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-kasada-classification') === 'bad-bot',
      statusCode: status,
      headers: {
        'user-agent': req.headers.get('user-agent') || '',
        'referer': req.headers.get('referer') || '',
      }
    };
    
    // Store log data
    await redis.set(logId, JSON.stringify(logEntry), { ex: 3600 });
    
    // Add to sorted set
    await redis.zadd(LOGS_LIST_KEY, { score: timestampMs, member: logId });
    
    // Occasionally trim old logs (10% of requests)
    if (Math.random() < 0.1) {
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
 * Get traffic logs with optimized fetching
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
    
    // Get recent log IDs (newest first)
    const logIds = await redis.zrange(LOGS_LIST_KEY, 0, limit * 2, { rev: true }) as string[];
    
    if (!logIds || logIds.length === 0) {
      return [];
    }
    
    // Fetch logs one by one to avoid mget type issues
    // This is not as efficient but will work with the Upstash client
    const logs: TrafficLog[] = [];
    const fetchLimit = Math.min(logIds.length, limit * 2);
    
    for (let i = 0; i < fetchLimit; i++) {
      const logId = logIds[i];
      const logData = await redis.get(logId);
      
      if (logData) {
        try {
          const log = JSON.parse(logData as string) as TrafficLog;
          const logTimestamp = new Date(log.timestamp).getTime();
          
          // Skip logs older than 'since'
          if (since > 0 && logTimestamp <= since) {
            continue;
          }
          
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
            
            // Stop once we have enough logs
            if (logs.length >= limit) {
              break;
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
 * Get the latest log timestamp
 */
export async function getLatestLogTimestamp(): Promise<number> {
  try {
    const newestIds = await redis.zrange(LOGS_LIST_KEY, -1, -1) as string[];
    const newestId = newestIds[0];
    
    if (!newestId) {
      return Date.now();
    }
    
    // Extract timestamp from log ID
    const parts = newestId.split('-');
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1]);
      if (!isNaN(timestamp)) {
        return timestamp;
      }
    }
    
    return Date.now();
  } catch (error) {
    console.error('Error getting latest log timestamp:', error);
    return Date.now();
  }
}