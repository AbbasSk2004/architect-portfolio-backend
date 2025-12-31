# CORS Configuration Guide

## Overview

The backend supports multiple frontend origins for both local development and production deployments.

## Automatic Configuration

### Local Backend (Development)
- **Automatically allows**: `http://localhost:3000`
- **Purpose**: Local frontend development

### Render Backend (Production)
- **Automatically allows**:
  - `http://localhost:3000` (for local testing)
  - `https://architecture-portfolio-mu.vercel.app` (Vercel frontend)
- **Purpose**: Support both local testing and production frontend

## Environment Variables

### `FRONTEND_URLS` (Recommended)
Comma-separated list of allowed frontend URLs:
```env
FRONTEND_URLS=https://your-frontend.vercel.app,https://another-domain.com
```

### `FRONTEND_URL` (Legacy Support)
Single frontend URL (for backward compatibility):
```env
FRONTEND_URL=https://your-frontend.vercel.app
```

## Configuration Examples

### Local Development
```env
# .env (local backend)
NODE_ENV=development
# localhost:3000 is automatically allowed
```

### Production (Render)
```env
# Environment variables in Render dashboard
NODE_ENV=production
FRONTEND_URLS=https://architecture-portfolio-mu.vercel.app
```

## How It Works

1. **Local Backend**: Always allows `http://localhost:3000`
2. **Production Backend**: 
   - Allows `http://localhost:3000` (for testing)
   - Allows `https://architecture-portfolio-mu.vercel.app` (Vercel frontend)
   - Allows any URLs specified in `FRONTEND_URLS`

## Testing CORS

### Check Allowed Origins
When the server starts, it logs all allowed origins:
```
🌐 Allowed CORS origins: http://localhost:3000, https://architecture-portfolio-mu.vercel.app
```

### Test from Browser Console
```javascript
fetch('https://architect-portfolio-backend-5bow.onrender.com/api/testimonials')
  .then(r => r.json())
  .then(console.log)
```

If CORS is configured correctly, the request will succeed.

## Troubleshooting

### CORS Error: "Not allowed by CORS"
1. Check if your frontend URL is in the allowed origins list
2. Verify `FRONTEND_URLS` environment variable is set correctly
3. Check server logs for blocked origins

### Local Frontend Can't Connect to Render Backend
- This is expected! Local frontend should connect to local backend
- Or set `NEXT_PUBLIC_API_URL` in frontend `.env.local` to override

### Production Frontend Can't Connect
1. Ensure `FRONTEND_URLS` includes your Vercel URL
2. Check that `NODE_ENV=production` is set
3. Verify the frontend URL matches exactly (including https://)

