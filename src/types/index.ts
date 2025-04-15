// src/types/index.ts

// Product types
export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  quantity?: number;
}

// User types
export interface User {
  id: number;
  name: string;
  email: string;
}

// Cart types
export interface CartItem extends Product {
  quantity: number;
}

// Traffic log types
export interface TrafficLog {
  timestamp: string;
  endpoint: string;
  method: string;
  ip: string;
  userAgent: string;
  isBot: boolean;
  statusCode?: number;
  headers: {
    [key: string]: string | string[] | undefined;
  };
}

// Checkout types
export interface ShippingAddress {
  name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  total: number;
  status: string;
  createdAt: string;
}
