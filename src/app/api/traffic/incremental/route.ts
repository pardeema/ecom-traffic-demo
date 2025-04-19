// src/app/api/traffic/incremental/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficLogs } from '@/utils/traffic-logger'; // Import the updated function
import { TrafficLog } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Get the 'since' parameter (timestamp in milliseconds)
    const lastTimestampStr = url.searchParams.get('since');
    const lastTimestampMs = lastTimestampStr ? parseInt(lastTimestampStr, 10) : undefined;

    // Validate timestamp if provided
    if (lastTimestampStr && isNaN(lastTimestampMs)) {
        return NextResponse.json({ message: 'Invalid since timestamp' }, { status: 400 });
    }

    // Define a limit for safety, e.g., max 100 logs per incremental fetch
    const limit = 100;

    // Fetch only logs newer than the lastTimestampMs using the optimized function
    const newLogs: TrafficLog[] = await getTrafficLogs({
      since: lastTimestampMs, // Pass the timestamp in milliseconds
      limit: limit,
      // Add other filters if needed (e.g., endpoint, method) based on query params
      // endpoint: url.searchParams.get('endpoint') || undefined,
      // method: url.searchParams.get('method') || undefined,
    });

    // Determine the timestamp of the newest log fetched (if any)
    let latestLogTimestampMs: number | null = null;
    if (newLogs.length > 0) {
      // Logs are sorted newest first by getTrafficLogs
      latestLogTimestampMs = new Date(newLogs[0].timestamp).getTime();
    }

    // If no new logs, use the 'since' value provided by the client for the next request
    const nextSinceTimestamp = latestLogTimestampMs ?? lastTimestampMs ?? Date.now();

    const response = NextResponse.json({
      logs: newLogs, // Send only the newly fetched logs
      // Send the timestamp (in ms) of the latest log received in this batch.
      // The client should use this value + 1ms for the *next* 'since' query param.
      latestTimestamp: nextSinceTimestamp
    });

    // Optional: Add cache control headers if appropriate
    response.headers.set('Cache-Control', 'no-store'); // Prevent caching of incremental updates

    return response;

  } catch (error) {
    console.error('Error retrieving incremental traffic data:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

