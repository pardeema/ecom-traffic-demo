// src/utils/file-traffic-logger.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TrafficLog } from '@/types';

export async function logTraffic(req: NextRequest, endpoint: string, status: number) {
  try {
    // Helper function to get the client IP from headers
    const getClientIp = (request: NextRequest): string => {
      let chosenIp = 'unknown'; // Default value

      // 1. Check for Cloudflare's header first
      const cfIp = request.headers.get('cf-connecting-ip');
      if (cfIp) {
        chosenIp = cfIp;
        console.log(`[getClientIp Debug] Using CF-Connecting-IP: ${chosenIp}`);
        return chosenIp;
      }

      // 2. Check for X-Real-IP (potentially set by CF worker, might be overwritten)
      const realIp = request.headers.get('x-real-ip'); 
      if (realIp) {
        chosenIp = realIp;
        console.log(`[getClientIp Debug] Using X-Real-IP: ${chosenIp}`);
        return chosenIp;
      }

      // 3. Fallback to X-Forwarded-For (parsing first IP as last resort)
      const xff = request.headers.get('x-forwarded-for');
      console.log(`[getClientIp Debug] Raw XFF header: ${xff}`); 
      if (xff) {
        // Split by comma, trimming whitespace around IPs
        const ips = xff.split(',').map(ip => ip.trim());
        console.log(`[getClientIp Debug] Split IPs: ${JSON.stringify(ips)}`);
        
        if (ips.length > 0 && ips[0]) {
           chosenIp = ips[0]; // Use the first IP from XFF
           console.log(`[getClientIp Debug] Using first IP from XFF: ${chosenIp}`);
           return chosenIp;
        }
      }
      
      console.log(`[getClientIp Debug] No suitable IP header found, returning 'unknown'`);
      return chosenIp; // Returns 'unknown' if no header found
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
