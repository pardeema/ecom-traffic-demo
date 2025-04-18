// src/app/api/traffic/incremental/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficLogs } from '@/utils/traffic-logger';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const timeWindow = url.searchParams.get('timeWindow') ? 
      parseInt(url.searchParams.get('timeWindow') as string) : 5;
    const lastTimestamp = url.searchParams.get('since') || null;
    
    // Fetch only logs newer than the lastTimestamp
    // If no lastTimestamp is provided, get logs within the timeWindow
    const allTraffic = await getTrafficLogs({
      timeWindow,
      since: lastTimestamp ? new Date(lastTimestamp) : undefined
    });
    
    // Split traffic by endpoint
    const loginTraffic = allTraffic.filter(log => log.endpoint === '/api/auth/login');
    const checkoutTraffic = allTraffic.filter(log => log.endpoint === '/api/checkout');
    
    // Get most recent logs for the table
    const recentTraffic = allTraffic.slice(-10).reverse();
    
    // Find the most recent timestamp from the logs
    const newestTimestamp = allTraffic.length > 0 
      ? Math.max(...allTraffic.map(log => new Date(log.timestamp).getTime()))
      : Date.now();
    
    const response = NextResponse.json({
      login: loginTraffic,
      checkout: checkoutTraffic,
      recent: recentTraffic,
      timestamp: new Date(newestTimestamp).toISOString()
    });
    
    // Enable caching
    response.headers.set('Cache-Control', 'max-age=4');
    
    return response;
  } catch (error) {
    console.error('Error retrieving incremental traffic data:', error);
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
