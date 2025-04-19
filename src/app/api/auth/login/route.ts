// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { User } from '@/types';
import { logTraffic as logTrafficToRedis } from '@/utils/traffic-logger';
import { logTraffic as logTrafficToFile } from '@/utils/file-traffic-logger';

// Use Redis in production, file-based in development
const isProduction = process.env.NODE_ENV === 'production';
const logTraffic = isProduction ? logTrafficToRedis : logTrafficToFile;


interface LoginBody {
  email: string;
  password: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: LoginBody = await req.json();
    
    // Validate request body
    if (!body.email || !body.password) {
      await logTraffic(req, '/api/auth/login', 400);
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
        { id: 1, name: 'Demo User', email: 'user@example.com', password: 'K4sad@!' },
        { id: 2, name: 'Admin User', email: 'admin@example.com', password: 'K4sad@!' }
      ] as any; // Using 'any' to include password which we'll remove before returning
    }
    
    // Find user
    const user = users.find(u => u.email === body.email);
    
    // Check if user exists and password matches (in a real app, use bcrypt)
    if (!user || (user as any).password !== body.password) {
      console.log('Calling logTraffic for endpoint:', endpoint, 'with status:', status);
      await logTraffic(req, '/api/auth/login', 401);
      return NextResponse.json(
        { message: 'Invalid email or password' }, 
        { status: 401 }
      );
    }
    
    // Remove password before sending response
    const { password, ...userWithoutPassword } = user as any;
    
    await logTraffic(req, '/api/auth/login', 200);
    return NextResponse.json({
      message: 'Login successful',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    await logTraffic(req, '/api/auth/login', 500);
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}