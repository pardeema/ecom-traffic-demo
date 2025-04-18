// src/utils/traffic-logger.ts
import { NextRequest } from 'next/server';
import { redis } from './redis-client';
import { TrafficLog } from '@/types';

// Key prefix for logs
const LOG_PREFIX = 'traffic:log:';
// Key for the list of all log IDs
const LOGS_LIST_KEY = 'traffic:logs';
// Maximum number of logs to keep
const MAX_LOGS = 1000;

/**
 * Log traffic data to Redis
 */
export async function logTraffic(req: NextRequest, endpoint: string, status: number): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const logId = `${LOG_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Helper function to get the client IP from headers
    const getClientIp = (request: NextRequest): string => {
      let chosenIp = 'unknown'; // Default value

      // 1. Check for Cloudflare's header first
      const cfIp = request.headers.get('cf-connecting-ip');
      if (cfIp) {
        chosenIp = cfIp;
        console.log(`[getClientIp Debug] Using CF-Connecting-IP: ${chosenIp}`);
        return chosenIp;
      }

      // 2. Check for X-Real-IP (potentially set by CF worker, might be overwritten)
      const realIp = request.headers.get('x-real-ip'); 
      if (realIp) {
        chosenIp = realIp;
        console.log(`[getClientIp Debug] Using X-Real-IP: ${chosenIp}`);
        return chosenIp;
      }

      // 3. Fallback to X-Forwarded-For (parsing first IP as last resort)
      const xff = request.headers.get('x-forwarded-for');
      console.log(`[getClientIp Debug] Raw XFF header: ${xff}`); 
      if (xff) {
        // Split by comma, trimming whitespace around IPs
        const ips = xff.split(',').map(ip => ip.trim());
        console.log(`[getClientIp Debug] Split IPs: ${JSON.stringify(ips)}`);
        
        if (ips.length > 0 && ips[0]) {
           chosenIp = ips[0]; // Use the first IP from XFF
           console.log(`[getClientIp Debug] Using first IP from XFF: ${chosenIp}`);
           return chosenIp;
        }
      }
      
      console.log(`[getClientIp Debug] No suitable IP header found, returning 'unknown'`);
      return chosenIp; // Returns 'unknown' if no header found
    };

    const clientIp = getClientIp(req);

    const logEntry: TrafficLog = {
      timestamp,
      endpoint,
      method: req.method,
      ip: clientIp, // Use the extracted client IP
      realIp: clientIp, // Store it in realIp as well for the frontend
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-kasada-classification') === 'bad-bot', // Make sure this header name is correct for your bot detection
      statusCode: status,
      headers: Object.fromEntries(req.headers.entries()) // Keep storing all headers for debugging if needed
    };

    // Store the log entry as JSON
    await redis.set(logId, JSON.stringify(logEntry), { ex: 1800 }); // 30-minute expiration
    
    // Store the log ID in a sorted set with timestamp as score for time-based querying
    await redis.zadd(LOGS_LIST_KEY, { score: Date.now(), member: logId });
    
    // Clean up old logs to limit storage usage
    const count = await redis.zcard(LOGS_LIST_KEY);
    if (count > MAX_LOGS) {
      // Get the oldest log IDs
      const oldestLogIds = await redis.zrange(LOGS_LIST_KEY, 0, count - MAX_LOGS - 1);
      
      // Delete the log entries
      if (oldestLogIds.length > 0) {
        await redis.del(...(oldestLogIds as string[]));
      }
      
      // Remove the IDs from the sorted set
      await redis.zremrangebyrank(LOGS_LIST_KEY, 0, count - MAX_LOGS - 1);
    }
  } catch (error) {
    console.error('Error logging traffic:', error);
  }
}

/**
 * Get traffic logs with optional filtering
 */
export async function getTrafficLogs(options: {
  endpoint?: string;
  timeWindow?: number;
  method?: string;
  isBot?: boolean;
  since?: Date;
} = {}): Promise<TrafficLog[]> {
  try {
    // Get all log IDs, sorted by time (newest first)
    const logIds = await redis.zrange(LOGS_LIST_KEY, 0, -1, { rev: true });
    
    if (logIds.length === 0) {
      return [];
    }
    
    // Get all log entries
    const logEntries = await Promise.all(
      logIds.map(async (id) => {
        try {
          const data = await redis.get(id as string);
          return data ? (typeof data === 'string' ? JSON.parse(data) : data) as TrafficLog : null;
        } catch (error) {
          console.error(`Error retrieving log ${id}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any null entries
    let logs = logEntries.filter((log): log is TrafficLog => log !== null);
    
    // Apply filters
    if (options.endpoint) {
      logs = logs.filter(log => log.endpoint === options.endpoint);
    }
    
    if (options.timeWindow) {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - options.timeWindow);
      logs = logs.filter(log => new Date(log.timestamp) >= cutoffTime);
    }
    
    if (options.method) {
      logs = logs.filter(log => log.method === options.method);
    }
    
    if (options.isBot !== undefined) {
      logs = logs.filter(log => log.isBot === options.isBot);
    }
    
    // Add timestamp filtering
    if (options.since) {
      logs = logs.filter(log => new Date(log.timestamp) > options.since!);
    }

    return logs;
  } catch (error) {
    console.error('Error retrieving traffic logs:', error);
    return [];
  }
}
