// src/app/api/auth/captcha-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { User } from '@/types';
import { logTraffic as logTrafficToRedis } from '@/utils/traffic-logger';
import { logTraffic as logTrafficToFile } from '@/utils/file-traffic-logger';

// Use Redis in production, file-based in development
const isProduction = process.env.NODE_ENV === 'production';
// Determine which logging function to use based on environment
const logTraffic = isProduction ? logTrafficToRedis : logTrafficToFile;

// Define the expected request body structure
interface CaptchaLoginBody {
  email: string;
  password: string;
  captchaToken: string;
}

// Function to verify Cloudflare Turnstile token
async function verifyTurnstileToken(token: string, remoteIp: string): Promise<boolean> {
  try {
    const secretKey = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'; // Default test key
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: remoteIp,
      }),
    });

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const endpointPath = '/api/auth/captcha-login'; // Define endpoint path for logging

  try {
    const body: CaptchaLoginBody = await req.json();

    // --- Validate request body ---
    if (!body.email || !body.password || !body.captchaToken) {
      // Log the attempt before returning error
      console.log(`Calling logTraffic for endpoint: ${endpointPath} with status: 400 (Bad Request - Missing fields)`);
      await logTraffic(req, endpointPath, 400);
      return NextResponse.json(
        { message: 'Email, password, and CAPTCHA token are required' },
        { status: 400 }
      );
    }

    // --- Verify CAPTCHA token ---
    const clientIp = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    '127.0.0.1';
    
    const isCaptchaValid = await verifyTurnstileToken(body.captchaToken, clientIp);
    
    if (!isCaptchaValid) {
      // Log the failed CAPTCHA verification
      console.log(`Calling logTraffic for endpoint: ${endpointPath} with status: 400 (Bad Request - Invalid CAPTCHA)`);
      await logTraffic(req, endpointPath, 400);
      return NextResponse.json(
        { message: 'CAPTCHA verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // --- Load users data (Consider moving this to a database in a real app) ---
    const usersFilePath = path.join(process.cwd(), 'src/data/users.json');
    let users: User[] = [];

    if (fs.existsSync(usersFilePath)) {
      const usersData = fs.readFileSync(usersFilePath, 'utf8');
      try {
          users = JSON.parse(usersData);
      } catch (e) {
          console.error("Error parsing users.json:", e);
          // Log the attempt before returning error
          console.log(`Calling logTraffic for endpoint: ${endpointPath} with status: 500 (Server Error - User data parse failed)`);
          await logTraffic(req, endpointPath, 500); // Log internal server error
          return NextResponse.json({ message: 'Error reading user data' }, { status: 500 });
      }
    } else {
      // Handle case where users file doesn't exist (optional)
      console.warn("users.json not found. Proceeding without user data.");
       // Log the attempt before returning error
       console.log(`Calling logTraffic for endpoint: ${endpointPath} with status: 401 (Unauthorized - No user data)`);
      await logTraffic(req, endpointPath, 401); // Log as unauthorized since no users can match
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // --- Find user ---
    const user = users.find(u => u.email === body.email);

    // --- Check credentials ---
    // IMPORTANT: In a real application, NEVER store plain text passwords. Use bcrypt.compare().
    if (!user || (user as any).password !== body.password) {
      // Log the failed login attempt
      console.log(`Calling logTraffic for endpoint: ${endpointPath} with status: 401 (Unauthorized - Invalid credentials)`);
      await logTraffic(req, endpointPath, 401);
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // --- Successful Login ---
    // Remove password before sending user data in response
    const { password, ...userWithoutPassword } = user as any;

    // Log the successful login attempt
    console.log(`Calling logTraffic for endpoint: ${endpointPath} with status: 200 (OK - CAPTCHA Login successful)`);
    await logTraffic(req, endpointPath, 200);
    return NextResponse.json({
      message: 'Login successful',
      user: userWithoutPassword
    });

  } catch (error) {
    // --- Handle unexpected errors ---
    console.error('CAPTCHA Login error:', error);
    // Log the internal server error attempt
    console.log(`Calling logTraffic for endpoint: ${endpointPath} with status: 500 (Server Error - Catch block)`);
    // Avoid awaiting logTraffic in catch block if it might also throw, log best-effort
    logTraffic(req, endpointPath, 500).catch(logErr => console.error("Failed to log error traffic:", logErr));
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 