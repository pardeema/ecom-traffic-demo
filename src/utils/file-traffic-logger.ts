// src/utils/file-traffic-logger.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TrafficLog } from '@/types';

export async function logTraffic(req: NextRequest, endpoint: string, status: number) {
  try {
    // Helper function to get the client IP from headers
    const getClientIp = (request: NextRequest): string => {
      // 1. Prioritize the X-Real-IP set by the Cloudflare Worker
      const realIp = request.headers.get('x-real-ip'); // Header names are case-insensitive
      if (realIp) {
        console.log(`[getClientIp Debug] Using X-Real-IP: ${realIp}`);
        return realIp;
      }

      // 2. Fallback to X-Forwarded-For (using previous logic, e.g., first IP if needed)
      const xff = request.headers.get('x-forwarded-for');
      console.log(`[getClientIp Debug] Raw XFF header: ${xff}`); 
      if (xff) {
        const ips = xff.split(',').map(ip => ip.trim());
        console.log(`[getClientIp Debug] Split IPs: ${JSON.stringify(ips)}`);
        // Adjust logic here if you still need something specific from XFF as a fallback
        const chosenIp = ips[0] || 'unknown'; // Example: fallback to first XFF IP
        console.log(`[getClientIp Debug] Chosen IP from XFF: ${chosenIp}`);
        return chosenIp;
      }
      
      console.log(`[getClientIp Debug] No suitable IP header found, returning 'unknown'`);
      return 'unknown'; 
    };

    const clientIp = getClientIp(req);

    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: endpoint,
      method: req.method,
      ip: clientIp, // Use the extracted client IP
      realIp: clientIp, // Store it in realIp as well for the frontend
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-kasada-classification') === 'bad-bot', // Ensure this header name is correct
      statusCode: status,
      headers: Object.fromEntries(req.headers.entries())
    };

    // Path to traffic log file
    const logFilePath = path.join(process.cwd(), 'src/data/traffic.json');
    
    // Create directory if it doesn't exist
    const dir = path.dirname(logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Read existing logs
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      const logsData = fs.readFileSync(logFilePath, 'utf8');
      try {
        logs = JSON.parse(logsData);
      } catch (e) {
        // If file is corrupted, start with empty array
        logs = [];
      }
    }
    
    // Add new log entry
    logs.push(logEntry);
    
    // Keep only the last 1000 entries
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    // Save logs back to file
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error logging traffic:', error);
  }
}
