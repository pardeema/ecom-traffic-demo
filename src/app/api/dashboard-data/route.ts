// src/app/api/dashboard-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDashboardTrafficCounts } from '@/utils/traffic-logger'; // Import the new function

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // --- Parameters for the dashboard view ---
    // How many minutes of data to show (e.g., ?windowMinutes=10)
    const windowMinutes = parseInt(url.searchParams.get('windowMinutes') || '10', 10);
    // What aggregation interval to use, in seconds (e.g., ?intervalSeconds=60 for 1 minute bars)
    const intervalSeconds = parseInt(url.searchParams.get('intervalSeconds') || '60', 10);

    if (isNaN(windowMinutes) || windowMinutes <= 0 || isNaN(intervalSeconds) || intervalSeconds <= 0) {
        return NextResponse.json({ message: 'Invalid windowMinutes or intervalSeconds parameter' }, { status: 400 });
    }

    // Calculate time window in seconds
    const nowSeconds = Math.floor(Date.now() / 1000);
    const startTimeSeconds = nowSeconds - (windowMinutes * 60);
    // Ensure we align the start time to the interval for cleaner buckets
    const alignedStartTimeSeconds = Math.floor(startTimeSeconds / intervalSeconds) * intervalSeconds;

    // --- Fetch aggregated data ---
    const dashboardData = await getDashboardTrafficCounts({
      // Fetch slightly more than requested window to ensure the current interval is populated
      startTimeSeconds: alignedStartTimeSeconds,
      endTimeSeconds: nowSeconds,
      intervalSeconds: intervalSeconds,
    });

    const response = NextResponse.json(dashboardData);

    // --- Cache Control ---
    // Prevent caching or set a very short cache duration
    response.headers.set('Cache-Control', 'no-store');
    // Or maybe cache for a few seconds less than the poll interval
    // response.headers.set('Cache-Control', 'max-age=4'); // Example: Cache for 4 seconds if polling is 5s

    return response;

  } catch (error) {
    console.error('Error retrieving dashboard data:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
