// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CartItem, ShippingAddress } from '@/types';
import { logTraffic as logTrafficToRedis } from '@/utils/traffic-logger';
import { logTraffic as logTrafficToFile } from '@/utils/file-traffic-logger';

// Use Redis in production, file-based in development
const isProduction = process.env.NODE_ENV === 'production';
const logTraffic = isProduction ? logTrafficToRedis : logTrafficToFile;

interface CheckoutBody {
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckoutBody = await req.json();
    
    // Validate request body
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      await logTraffic(req, '/api/checkout', 400);
      return NextResponse.json(
        { message: 'Cart items are required' }, 
        { status: 400 }
      );
    }
    
    if (!body.shippingAddress) {
      await logTraffic(req, '/api/checkout', 400);
      return NextResponse.json(
        { message: 'Shipping address is required' }, 
        { status: 400 }
      );
    }
    
    if (!body.paymentMethod) {
      await logTraffic(req, '/api/checkout', 400);
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
    
    await logTraffic(req, '/api/checkout', 200);
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
    await logTraffic(req, '/api/checkout', 500);
    return NextResponse.json(
      { message: 'Internal server error' }, 
      { status: 500 }
    );
  }
}