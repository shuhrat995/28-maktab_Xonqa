# Railway Deploy Guide

This backend is ready to deploy to Railway after you log in and connect a project.

## 1. Login and initialize

```bash
cd backend
npm install -g @railway/cli
railway login
railway init
```

## 2. Add PostgreSQL

```bash
railway add -p postgresql
```

`DATABASE_URL` is created automatically by Railway. Do not set it manually if you use the Railway PostgreSQL plugin.

## 3. Required Railway variables

The safest option is syncing from your current local `backend/.env` so you do not accidentally reuse old compromised secrets:

```bash
npm run railway:sync-env
```

This skips `DATABASE_URL` because Railway creates it automatically when PostgreSQL is attached.

If you prefer manual entry, set these in Railway using the values from your current local `backend/.env`:

```bash
railway variables set NODE_ENV=production
railway variables set PORT=3001

railway variables set JWT_SECRET="<your-jwt-secret>"
railway variables set JWT_REFRESH_SECRET="<your-jwt-refresh-secret>"
railway variables set JWT_EXPIRES_IN=7d
railway variables set JWT_REFRESH_EXPIRES_IN=30d

railway variables set ADMIN_USERNAME="school_director_2024"
railway variables set ADMIN_PASSWORD="<your-admin-password>"

railway variables set SESSION_SECRET="<your-session-secret>"
railway variables set AUTH_COOKIE_NAME="admin_auth"
railway variables set COOKIE_SECURE=true
railway variables set COOKIE_HTTP_ONLY=true
railway variables set COOKIE_SAME_SITE=strict

railway variables set FRONTEND_URL="https://your-school.pages.dev"
railway variables set CORS_ORIGINS="https://your-school.pages.dev"
railway variables set ALLOWED_ORIGINS="https://your-school.pages.dev"

railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
railway variables set AUTH_RATE_LIMIT_WINDOW_MS=900000
railway variables set AUTH_RATE_LIMIT_MAX_REQUESTS=5

railway variables set MAX_UPLOAD_SIZE_BYTES=10485760
railway variables set MAX_IMAGE_SIZE_KB=500
railway variables set MAX_TEXT_LENGTH=2500
railway variables set UPLOAD_DIR="./uploads"
railway variables set ALLOWED_IMAGE_TYPES="image/jpeg,image/png,image/webp,image/jpg"

railway variables set LOG_LEVEL=error
railway variables set REQUEST_LOGGING=false
railway variables set ERROR_LOGGING=true
```

## 4. Run migration

```bash
railway run npm run migrate
```

## 5. Deploy backend

```bash
railway up
railway logs
railway domain
```

Health check:

```bash
curl https://your-backend.up.railway.app/api/health
```

## 6. Frontend production variables

Create your frontend production env from `.env.production.example`:

```env
BACKEND_ORIGIN=https://your-backend.up.railway.app
VITE_APP_NAME=State School
VITE_APP_URL=https://28-maktab-xonqa.vercel.app
```

The Vercel deployment proxies `/api/*` to `BACKEND_ORIGIN`, so the browser never calls `localhost:3001` in production. If you still use `VITE_API_URL` or `VITE_API_ORIGIN`, the proxy can also read them as a fallback.

## 7. Cloudflare Pages

Build locally:

```bash
npm run build
```

Upload the root `dist` folder to Cloudflare Pages and set:

```env
VITE_API_ORIGIN=https://your-backend.up.railway.app
VITE_APP_NAME=State School
VITE_APP_URL=https://your-school.pages.dev
```

## 8. After custom domain setup

Update these Railway variables and redeploy:

```bash
railway variables set FRONTEND_URL="https://your-domain.uz"
railway variables set CORS_ORIGINS="https://your-domain.uz"
railway variables set ALLOWED_ORIGINS="https://your-domain.uz"
railway up
```
