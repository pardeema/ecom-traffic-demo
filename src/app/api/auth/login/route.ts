// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { User } from '@/types';

interface LoginBody {
  email: string;
  password: string;
}

// Function to log traffic
async function logTraffic(req: NextRequest, status: number) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: '/api/auth/login',
      method: req.method,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      isBot: req.headers.get('x-is-bot') === 'true',
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

export async function POST(req: NextRequest) {
  try {
    const body: LoginBody = await req.json();
    
    // Validate request body
    if (!body.email || !body.password) {
      await logTraffic(req, 400);
      return NextResponse.json(
        { message: 'Email and password are required' }, 
        { status: 400 }
      );
    }
    
    // Load users data
    const usersFilePath = path.join(process.cwd(), 'src/data/users.json');
    let users: User[] = [];
    
    if (fs.existsSync(usersFilePath)) {
      const usersData = fs.readFileSync(usersFilePath, 'utf8');
      users = JSON.parse(usersData);
    } else {
      // Create initial users if file doesn't exist
      users = [
        { id: 1, name: 'Demo User', email: 'user@example.com', password: 'password123' },
        { id: 2, name: 'Admin User', email: 'admin@example.com', password: 'admin123' }
      ] as any; // Using 'any' to include password which we'll remove before returning
      
      // Save to file
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
    }
    
    // Find user
    const user = users.find(u => u.email === body.email);
    
    // Check if user exists and password matches (in a real app, use bcrypt)
    if (!user || (user as any).password !== body.password) {
      await logTraffic(req, 401);
      return NextResponse.json(
        { message: 'Invalid email or password' }, 
        { status: 401 }
      );
    }
    
    // Remove password before sending response
    const { password, ...userWithoutPassword } = user as any;
    
    await logTraffic(req, 200);
    return NextResponse.json({
      message: 'Login successful',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    await logTraffic(req, 500);
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
