// src/app/api/traffic/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TrafficLog } from '@/types';

export async function GET(req: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');
    const timeWindow = url.searchParams.get('timeWindow') ? 
      parseInt(url.searchParams.get('timeWindow') as string) : undefined;
    const method = url.searchParams.get('method');
    const isBot = url.searchParams.get('isBot') === 'true' ? true : 
                 url.searchParams.get('isBot') === 'false' ? false : undefined;
    
    // Path to traffic log file
    const logFilePath = path.join(process.cwd(), 'src/data/traffic.json');
    
    // If file doesn't exist, return empty array
    if (!fs.existsSync(logFilePath)) {
      return NextResponse.json([]);
    }
    
    // Read and parse logs
    const logsData = fs.readFileSync(logFilePath, 'utf8');
    let logs: TrafficLog[] = JSON.parse(logsData);
    
    // Apply filters
    if (endpoint) {
      logs = logs.filter(log => log.endpoint === endpoint);
    }
    
    if (timeWindow) {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - timeWindow);
      logs = logs.filter(log => new Date(log.timestamp) >= cutoffTime);
    }
    
    if (method) {
      logs = logs.filter(log => log.method === method);
    }
    
    if (isBot !== undefined) {
      logs = logs.filter(log => log.isBot === isBot);
    }
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error retrieving traffic logs:', error);
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
