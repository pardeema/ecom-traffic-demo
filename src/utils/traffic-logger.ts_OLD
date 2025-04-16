// src/utils/traffic-logger.ts
import fs from 'fs';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';
import { TrafficLog } from '@/types';

export async function logTrafficRequest(
  req: NextApiRequest, 
  endpoint: string, 
  res: NextApiResponse
): Promise<TrafficLog | null> {
  try {
    // Create a log entry
    const logEntry: TrafficLog = {
      timestamp: new Date().toISOString(),
      endpoint,
      method: req.method || 'UNKNOWN',
      ip: ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress) || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      // This flag would be set by your bot protection solution
      isBot: req.headers['x-is-bot'] === 'true',
      // Additional useful headers
      headers: {
        host: req.headers.host,
        origin: req.headers.origin,
        referer: req.headers.referer,
      }
    };
    
    // Capture status code from response
    const originalEnd = res.end;
    res.end = function(chunk?: any) {
      logEntry.statusCode = res.statusCode;
      saveLogEntry(logEntry);
      return originalEnd.apply(this, arguments);
    };
    
    // For requests that might not call res.end
    res.on('finish', function() {
      if (!logEntry.statusCode) {
        logEntry.statusCode = res.statusCode;
        saveLogEntry(logEntry);
      }
    });
    
    return logEntry;
  } catch (error) {
    console.error('Error logging traffic:', error);
    // Don't let logging errors affect the API functionality
    return null;
  }
}

async function saveLogEntry(logEntry: TrafficLog): Promise<void> {
  try {
    // Path to traffic log file
    const logFilePath = path.join(process.cwd(), 'src/data/traffic.json');
    
    // Create directory if it doesn't exist
    const dir = path.dirname(logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Read existing logs
    let logs: TrafficLog[] = [];
    if (fs.existsSync(logFilePath)) {
      const logsData = fs.readFileSync(logFilePath, 'utf8');
      try {
        logs = JSON.parse(logsData);
      } catch (e) {
        // If file is corrupted, start with empty array
        logs = [];
      }
    }
    
    // Add new log entry
    logs.push(logEntry);
    
    // Keep only the last 1000 entries to prevent the file from growing too large
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // Save logs back to file
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving traffic log:', error);
  }
}

export async function getTrafficLogs(options: {
  endpoint?: string;
  timeWindow?: number;
  method?: string;
  isBot?: boolean;
} = {}): Promise<TrafficLog[]> {
  try {
    // Path to traffic log file
    const logFilePath = path.join(process.cwd(), 'src/data/traffic.json');
    
    // If file doesn't exist, return empty array
    if (!fs.existsSync(logFilePath)) {
      return [];
    }
    
    // Read and parse logs
    const logsData = fs.readFileSync(logFilePath, 'utf8');
    let logs: TrafficLog[] = JSON.parse(logsData);
    
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
    console.error('Error reading traffic logs:', error);
    return [];
  }
}
