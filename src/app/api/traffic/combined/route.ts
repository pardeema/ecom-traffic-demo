// src/app/api/traffic/combined/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficLogs } from '@/utils/traffic-logger';
import { TrafficLog } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // Get the time window duration in minutes (default to 5 mins)
    const timeWindowMinutes = url.searchParams.get('timeWindow') ?
      parseInt(url.searchParams.get('timeWindow') as string, 10) : 5;

    // Validate timeWindowMinutes
    if (isNaN(timeWindowMinutes) || timeWindowMinutes <= 0) {
      return NextResponse.json({ message: 'Invalid timeWindow parameter' }, { status: 400 });
    }

    // Calculate the timestamp for the start of the window (in milliseconds)
    const now = Date.now();
    const sinceTimestampMs = now - (timeWindowMinutes * 60 * 1000);

    // Get initial data in a single fetch
    const initialLimit = 50; // Reduced from potential higher values
    const allTraffic: TrafficLog[] = await getTrafficLogs({
      since: sinceTimestampMs,
      limit: initialLimit
    });

    // Pre-process the data on the server side
    const loginTraffic = allTraffic.filter(log => log.endpoint === '/api/auth/login');
    const checkoutTraffic = allTraffic.filter(log => log.endpoint === '/api/checkout');

    // Get the most recent logs
    const recentTraffic = [...allTraffic].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 10);

    // Generate time buckets for the chart
    const timeBuckets = generateTimeBuckets(timeWindowMinutes);
    const loginBuckets = fillBuckets(timeBuckets, loginTraffic);
    const checkoutBuckets = fillBuckets(timeBuckets, checkoutTraffic);

    const response = NextResponse.json({
      login: loginTraffic,
      checkout: checkoutTraffic,
      recent: recentTraffic,
      timestamp: new Date().toISOString(),
      // Add time bucket data for charts
      chart: {
        labels: timeBuckets.labels,
        loginData: loginBuckets,
        checkoutData: checkoutBuckets
      }
    });

    // Short cache time to reduce load
    response.headers.set('Cache-Control', 'max-age=4');

    return response;

  } catch (error) {
    console.error('Error retrieving combined traffic data:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate time buckets for the chart
 */
function generateTimeBuckets(timeWindowMinutes: number) {
  const buckets: { labels: string[], timestamps: Date[] } = {
    labels: [],
    timestamps: []
  };
  
  const now = new Date();
  const bucketCount = timeWindowMinutes * 2; // 30-second buckets
  const bucketInterval = 30 * 1000; // 30 seconds in milliseconds
  
  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketTime = new Date(now.getTime() - i * bucketInterval);
    const hours = bucketTime.getHours().toString().padStart(2, '0');
    const minutes = bucketTime.getMinutes().toString().padStart(2, '0');
    const seconds = bucketTime.getSeconds() < 30 ? '00' : '30';
    
    buckets.labels.push(`${hours}:${minutes}:${seconds}`);
    buckets.timestamps.push(bucketTime);
  }
  
  return buckets;
}

/**
 * Fill buckets with log data
 */
function fillBuckets(buckets: { labels: string[], timestamps: Date[] }, logs: TrafficLog[]) {
  const data = new Array(buckets.timestamps.length).fill(0);
  
  logs.forEach(log => {
    const logTime = new Date(log.timestamp);
    
    for (let i = 0; i < buckets.timestamps.length - 1; i++) {
      if (logTime >= buckets.timestamps[i] && logTime < buckets.timestamps[i + 1]) {
        data[i]++;
        break;
      }
    }
    
    // Check the last bucket
    if (logTime >= buckets.timestamps[buckets.timestamps.length - 1]) {
      data[buckets.timestamps.length - 1]++;
    }
  });
  
  return data;
}