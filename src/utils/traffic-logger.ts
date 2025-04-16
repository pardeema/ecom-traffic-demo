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
    
    const logEntry: TrafficLog = {
      timestamp,
      endpoint,
      method: req.method,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-is-bot') === 'true',
      statusCode: status,
      headers: Object.fromEntries(req.headers.entries())
    };
    
    // Store the log entry as JSON
    await redis.set(logId, JSON.stringify(logEntry));
    
    // Store the log ID in a sorted set with timestamp as score for time-based querying
    await redis.zadd(LOGS_LIST_KEY, { score: Date.now(), member: logId });
    
    // Clean up old logs to limit storage usage
    const count = await redis.zcard(LOGS_LIST_KEY);
    if (count > MAX_LOGS) {
      // Get the oldest log IDs
      const oldestLogIds = await redis.zrange(LOGS_LIST_KEY, 0, count - MAX_LOGS - 1);
      
      // Delete the log entries
      if (oldestLogIds.length > 0) {
        await redis.del(...oldestLogIds);
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
          const data = await redis.get(id);
          // The key change: don't try to parse if data is already an object
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
    
    return logs;
  } catch (error) {
    console.error('Error retrieving traffic logs:', error);
    return [];
  }
}
