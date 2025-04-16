// src/utils/redis-client.ts
import { Redis } from '@upstash/redis'

// Initialize Redis client using environment variables
// These will be automatically set by Vercel when you connect Upstash
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})
