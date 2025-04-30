// src/app/api/traffic/incremental/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficLogs } from '@/utils/traffic-logger';
import { TrafficLog } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const lastTimestampStr = url.searchParams.get('since');
    let lastTimestampMs: number | undefined = undefined;

    // Parse and validate timestamp
    if (lastTimestampStr) {
      lastTimestampMs = parseInt(lastTimestampStr, 10);
      if (isNaN(lastTimestampMs)) {
        return NextResponse.json({ message: 'Invalid since timestamp format' }, { status: 400 });
      }
    }

    // Default to 30 logs per incremental fetch (reduced from 100)
    const limit = 30;

    // Fetch only logs newer than the lastTimestampMs
    const newLogs: TrafficLog[] = await getTrafficLogs({
      since: lastTimestampMs,
      limit: limit,
    });

    // Determine the timestamp of the newest log for next polling
    let latestLogTimestampMs: number = lastTimestampMs || Date.now();
    if (newLogs.length > 0) {
      latestLogTimestampMs = Math.max(
        latestLogTimestampMs,
        new Date(newLogs[0].timestamp).getTime()
      );
    }

    // Add a small buffer to the timestamp to avoid getting the same logs again
    const nextSinceTimestamp = latestLogTimestampMs + 1;

    // Split logs by endpoint for easier processing on client
    const loginLogs = newLogs.filter(log => log.endpoint === '/api/auth/login');
    const checkoutLogs = newLogs.filter(log => log.endpoint === '/api/checkout');

    const response = NextResponse.json({
      login: loginLogs,
      checkout: checkoutLogs,
      all: newLogs,
      latestTimestamp: nextSinceTimestamp,
      serverTime: Date.now() // Send server time for sync
    });

    // Prevent caching
    response.headers.set('Cache-Control', 'no-store');

    return response;

  } catch (error) {
    console.error('Error retrieving incremental traffic data:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}