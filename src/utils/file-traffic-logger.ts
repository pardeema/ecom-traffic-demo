// src/utils/file-traffic-logger.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TrafficLog } from '@/types';

export async function logTraffic(req: NextRequest, endpoint: string, status: number) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: endpoint,
      method: req.method,
      ip: req.headers.get('x-real-ip') || 'unknown', // JUST use x-real-ip
      realIp: req.headers.get('x-real-ip') || 'unknown', // Add a dedicated field
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-is-bot') === 'true',
      statusCode: status,
      headers: Object.fromEntries(req.headers.entries())
    };

    // Path to traffic log file
    const logFilePath = path.join(process.cwd(), 'src/data/traffic.json');
    
    // Create directory if it doesn't exist
    const dir = path.dirname(logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Read existing logs
    let logs = [];
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
    
    // Keep only the last 1000 entries
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // Save logs back to file
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error logging traffic:', error);
  }
}
