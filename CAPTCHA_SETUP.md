# CAPTCHA Login Setup Guide

This guide explains how to set up the CAPTCHA-protected login feature using Cloudflare Turnstile.

## Features

- **CAPTCHA Protection**: Uses Cloudflare Turnstile for bot protection
- **Separate Endpoint**: `/api/auth/captcha-login` for CAPTCHA-protected login
- **New Login Page**: `/captcha-login` with CAPTCHA verification
- **Traffic Logging**: All CAPTCHA login attempts are logged for monitoring

## Setup Instructions

### 1. Cloudflare Turnstile Configuration

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a new site
3. Choose "Managed" challenge type
4. Add your domain(s)
5. Copy the Site Key and Secret Key

### 2. Environment Variables

Create a `.env.local` file in your project root with:

```bash
# Cloudflare Turnstile CAPTCHA Configuration
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
TURNSTILE_SECRET_KEY=your_secret_key_here
```

### 3. For Development/Testing

You can use these test keys for development:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

## Usage

### Regular Login
- **URL**: `/login`
- **Endpoint**: `/api/auth/login`
- **Protection**: None

### CAPTCHA Login
- **URL**: `/captcha-login`
- **Endpoint**: `/api/auth/captcha-login`
- **Protection**: Cloudflare Turnstile CAPTCHA

## Demo Credentials

Both login forms use the same credentials:
- **Email**: user@example.com

## Cost Considerations

Cloudflare Turnstile is **free** for:
- Up to 1 million requests per month
- Unlimited domains
- All challenge types

This makes it an ideal low-cost solution for CAPTCHA protection.

## Security Features

1. **CAPTCHA Verification**: Server-side validation of CAPTCHA tokens
2. **IP Tracking**: Client IP is sent to Cloudflare for verification
3. **Token Expiration**: CAPTCHA tokens expire automatically
4. **Error Handling**: Proper error responses for invalid CAPTCHA
5. **Traffic Logging**: All attempts are logged for monitoring

## Files Created

- `src/app/captcha-login/page.tsx` - CAPTCHA login page
- `src/components/CaptchaLoginForm.tsx` - CAPTCHA login form component
- `src/app/api/auth/captcha-login/route.ts` - CAPTCHA login API endpoint

## Testing

1. Start the development server: `npm run dev`
2. Navigate to `/captcha-login`
3. Complete the CAPTCHA challenge
4. Use demo credentials to log in
5. Check the traffic logs to see the CAPTCHA verification attempts 
