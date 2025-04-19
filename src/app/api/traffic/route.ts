// src/app/api/traffic/route.ts - Fixed timeWindow type error
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TrafficLog } from '@/types';
import { getTrafficLogs } from '@/utils/traffic-logger'; // Import the updated function

export async function GET(req: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');
    const timeWindowMinutesStr = url.searchParams.get('timeWindow');
    const method = url.searchParams.get('method');
    const isBot = url.searchParams.get('isBot') === 'true' ? true :
                 url.searchParams.get('isBot') === 'false' ? false : undefined;

    let timeWindowMinutes: number | undefined = undefined;
    let sinceTimestampMs: number | undefined = undefined;

    // Parse and calculate 'since' timestamp if timeWindow is provided
    if (timeWindowMinutesStr) {
        timeWindowMinutes = parseInt(timeWindowMinutesStr, 10);
        if (isNaN(timeWindowMinutes) || timeWindowMinutes <= 0) {
            return NextResponse.json({ message: 'Invalid timeWindow parameter' }, { status: 400 });
        }
        // Calculate the timestamp for the start of the window (in milliseconds)
        sinceTimestampMs = Date.now() - (timeWindowMinutes * 60 * 1000);
    }

    // Check environment
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Fetch logs from Redis using the optimized function
      const logs = await getTrafficLogs({
        endpoint: endpoint ?? undefined,
        since: sinceTimestampMs, // Use calculated 'since' timestamp
        method: method ?? undefined,
        isBot: isBot,
        // Add limit if needed, e.g., getTrafficLogs({ ..., limit: 1000 })
      });
      const response = NextResponse.json(logs);
      // Optional: Set cache headers if desired for this endpoint
      // response.headers.set('Cache-Control', 'max-age=10'); // Example: Cache for 10 seconds
      return response;

    } else {
      // --- Development Environment: File-based storage ---
      const logFilePath = path.join(process.cwd(), 'src/data/traffic.json');

      if (!fs.existsSync(logFilePath)) {
        return NextResponse.json([]);
      }

      const logsData = fs.readFileSync(logFilePath, 'utf8');
      let logs: TrafficLog[] = [];
       try {
           logs = JSON.parse(logsData);
       } catch (e) {
           console.error("Error parsing traffic.json:", e);
           return NextResponse.json({ message: "Error reading development logs" }, { status: 500 });
       }


      // Apply filters (keep existing dev logic)
      if (endpoint) {
        logs = logs.filter(log => log.endpoint === endpoint);
      }

      // Use the original timeWindowMinutes for filtering in dev mode
      if (timeWindowMinutes) {
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() - timeWindowMinutes);
        logs = logs.filter(log => new Date(log.timestamp) >= cutoffTime);
      }

      if (method) {
        logs = logs.filter(log => log.method === method);
      }

      if (isBot !== undefined) {
        logs = logs.filter(log => log.isBot === isBot);
      }

      // Sort logs newest first for consistency
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return NextResponse.json(logs);
    }
  } catch (error) {
    console.error('Error retrieving traffic logs:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
