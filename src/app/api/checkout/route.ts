// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { CartItem, ShippingAddress } from '@/types';

interface CheckoutBody {
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
}

// Function to log traffic (same as in login route)
async function logTraffic(req: NextRequest, status: number) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: '/api/checkout',
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
    const body: CheckoutBody = await req.json();
    
    // Validate request body
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      await logTraffic(req, 400);
      return NextResponse.json(
        { message: 'Cart items are required' }, 
        { status: 400 }
      );
    }
    
    if (!body.shippingAddress) {
      await logTraffic(req, 400);
      return NextResponse.json(
        { message: 'Shipping address is required' }, 
        { status: 400 }
      );
    }
    
    if (!body.paymentMethod) {
      await logTraffic(req, 400);
      return NextResponse.json(
        { message: 'Payment method is required' }, 
        { status: 400 }
      );
    }
    
    // In a real application, you would:
    // 1. Process the payment
    // 2. Create an order in the database
    // 3. Send confirmation email
    // 4. Update inventory
    
    // For this demo, we'll just simulate a delay and return success
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a fake order ID
    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    await logTraffic(req, 200);
    return NextResponse.json({
      message: 'Order placed successfully',
      order: {
        id: orderId,
        items: body.items,
        shippingAddress: body.shippingAddress,
        paymentMethod: body.paymentMethod,
        total: body.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        status: 'processing',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    await logTraffic(req, 500);
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
