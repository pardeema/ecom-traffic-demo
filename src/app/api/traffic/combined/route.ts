// src/app/api/traffic/combined/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficLogs } from '@/utils/traffic-logger'; // Import the updated function
import { TrafficLog } from '@/types'; // Assuming TrafficLog type is defined

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // Get the time window duration in minutes from query params (default to 5 mins)
    const timeWindowMinutes = url.searchParams.get('timeWindow') ?
      parseInt(url.searchParams.get('timeWindow') as string, 10) : 5;

    // Validate timeWindowMinutes
    if (isNaN(timeWindowMinutes) || timeWindowMinutes <= 0) {
        return NextResponse.json({ message: 'Invalid timeWindow parameter' }, { status: 400 });
    }

    // Calculate the timestamp for the start of the window (in milliseconds)
    const now = Date.now();
    const sinceTimestampMs = now - (timeWindowMinutes * 60 * 1000);

    // Fetch all traffic data since the calculated timestamp
    // getTrafficLogs now expects 'since' as a millisecond timestamp
    const allTraffic: TrafficLog[] = await getTrafficLogs({
      since: sinceTimestampMs,
      // You might want to add a limit here as well, depending on expected volume
      // limit: 500 // Example limit
    });

    // Process the data on the server side to reduce client work
    const loginTraffic = allTraffic.filter(log => log.endpoint === '/api/auth/login');
    const checkoutTraffic = allTraffic.filter(log => log.endpoint === '/api/checkout');

    // Get the most recent logs (e.g., last 10) from the fetched data
    // Ensure logs are sorted newest first if not already guaranteed by getTrafficLogs
    const sortedTraffic = allTraffic.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentTraffic = sortedTraffic.slice(0, 10); // Get the actual 10 newest within the window

    // Return all metrics in a single response
    const response = NextResponse.json({
      login: loginTraffic,
      checkout: checkoutTraffic,
      recent: recentTraffic,
      // Use the current time as the timestamp for the response generation
      // Note: This is different from the latest log timestamp used in the incremental endpoint
      timestamp: new Date().toISOString()
    });

    // Add cache control header to enable browser caching (adjust as needed)
    response.headers.set('Cache-Control', 'max-age=4'); // Cache for 4 seconds

    return response;

  } catch (error) {
    console.error('Error retrieving combined traffic data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

