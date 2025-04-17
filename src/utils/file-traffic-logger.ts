// src/utils/file-traffic-logger.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { TrafficLog } from '@/types';

export async function logTraffic(req: NextRequest, endpoint: string, status: number) {
  try {
    // Helper function to get the client IP from headers
    const getClientIp = (request: NextRequest): string => {
      const xff = request.headers.get('x-forwarded-for');
      console.log(`[getClientIp Debug] Raw XFF header: ${xff}`); // Log the raw header

      if (xff) {
        // Split by comma, trimming whitespace around IPs
        const ips = xff.split(',').map(ip => ip.trim());
        console.log(`[getClientIp Debug] Split IPs: ${JSON.stringify(ips)}`); // Log the array of IPs

        let chosenIp = 'unknown'; // Default value

        // Check if there is a second IP address (index 1)
        if (ips.length > 1 && ips[1]) {
          chosenIp = ips[1]; // Return the second IP
        }
        // Fallback to the first IP if there's only one
        else if (ips.length > 0 && ips[0]) {
          chosenIp = ips[0]; 
        }
        
        console.log(`[getClientIp Debug] Chosen IP: ${chosenIp}`); // Log the chosen IP
        return chosenIp;
      }
      
      // Fallback if XFF is not present or empty
      console.log(`[getClientIp Debug] XFF header not found or empty, returning 'unknown'`);
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
