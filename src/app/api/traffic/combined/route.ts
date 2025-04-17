// src/app/api/traffic/combined/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTrafficLogs } from '@/utils/traffic-logger';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const timeWindow = url.searchParams.get('timeWindow') ? 
      parseInt(url.searchParams.get('timeWindow') as string) : 5;
    
    // Fetch all traffic data in one operation
    const allTraffic = await getTrafficLogs({
      timeWindow
    });
    
    // Process the data on the server side to reduce client work
    const loginTraffic = allTraffic.filter(log => log.endpoint === '/api/auth/login');
    const checkoutTraffic = allTraffic.filter(log => log.endpoint === '/api/checkout');
    const recentTraffic = allTraffic.slice(-10).reverse(); // Last 10 entries
    
    // Return all metrics in a single response
    const response = NextResponse.json({
      login: loginTraffic,
      checkout: checkoutTraffic,
      recent: recentTraffic,
      timestamp: new Date().toISOString()
    });
    
    // Add cache control header to enable browser caching
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
