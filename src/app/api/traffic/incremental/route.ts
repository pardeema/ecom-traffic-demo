// src/app/api/traffic/incremental/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficLogs } from '@/utils/traffic-logger'; // Import the updated function
import { TrafficLog } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Get the 'since' parameter (timestamp string)
    const lastTimestampStr = url.searchParams.get('since');
    let lastTimestampMs: number | undefined = undefined; // Initialize

    // Parse and validate the timestamp only if the parameter exists
    if (lastTimestampStr) {
        // Attempt parsing
        lastTimestampMs = parseInt(lastTimestampStr, 10);
        // Validate the *result* of parsing. isNaN checks if the parsing failed.
        if (isNaN(lastTimestampMs)) {
            // Handle invalid number format if 'since' was provided but wasn't a valid number
            return NextResponse.json({ message: 'Invalid since timestamp format' }, { status: 400 });
        }
    }
    // Now, lastTimestampMs is either a valid number or undefined (if 'since' wasn't provided)

    // Define a limit for safety, e.g., max 100 logs per incremental fetch
    const limit = 100;

    // Fetch only logs newer than the lastTimestampMs using the optimized function
    // Pass lastTimestampMs (which can be undefined for the initial fetch)
    const newLogs: TrafficLog[] = await getTrafficLogs({
      since: lastTimestampMs, // Pass the timestamp in milliseconds (or undefined)
      limit: limit,
      // Add other filters if needed (e.g., endpoint, method) based on query params
      // endpoint: url.searchParams.get('endpoint') || undefined,
      // method: url.searchParams.get('method') || undefined,
    });

    // Determine the timestamp of the newest log fetched (if any)
    let latestLogTimestampMs: number | null = null;
    if (newLogs.length > 0) {
      // Logs should be sorted newest first by getTrafficLogs
      latestLogTimestampMs = new Date(newLogs[0].timestamp).getTime();
    }

    // Determine the timestamp to send back to the client for the next 'since' query.
    // If new logs were found, use the latest timestamp from those logs.
    // If no new logs were found, reuse the timestamp the client sent (if any).
    // If it was the initial fetch (no 'since'), use the current time.
    const nextSinceTimestamp = latestLogTimestampMs ?? lastTimestampMs ?? Date.now();


    const response = NextResponse.json({
      logs: newLogs, // Send only the newly fetched logs
      // Send the timestamp (in ms) that the client should use for the *next* 'since' query param.
      latestTimestamp: nextSinceTimestamp
    });

    // Prevent caching of incremental updates
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
