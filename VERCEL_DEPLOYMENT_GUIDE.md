# Vercel Deployment Guide - Live Demo Setup

## ✅ Yes, Vercel Works Perfectly!

Vercel is **ideal** for deploying your Next.js app. Here's everything you need to know.

---

## 🚀 Quick Deployment (5 Minutes)

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create a GitHub repo and push
git remote add origin https://github.com/yourusername/prop-market.git
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to **https://vercel.com** and sign up/login
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js settings
5. Click **"Deploy"**

**That's it!** Your app will be live in ~2 minutes.

---

## ⚙️ Required Environment Variables

After deployment, add these in **Vercel Dashboard → Settings → Environment Variables**:

### **Required (Must Have):**

```bash
# Database Connection (Supabase)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require
PGSSLMODE=require

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### **Optional (Nice to Have):**

```bash
# Sentry (Error Tracking) - Optional
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug

# Kalshi API (for real market data) - Optional
KALSHI_ACCESS_KEY=your-key
KALSHI_PRIVATE_KEY=your-private-key-pem

# Polymarket API - Optional
POLYMARKET_API_KEY=your-key
```

### **How to Add Environment Variables:**

1. Go to **Vercel Dashboard** → Your Project → **Settings**
2. Click **"Environment Variables"**
3. Add each variable:
   - **Name:** `DATABASE_URL`
   - **Value:** Your connection string
   - **Environment:** Select all (Production, Preview, Development)
4. Click **"Save"**
5. **Redeploy** your app (Vercel will auto-redeploy when you add env vars)

---

## 📋 Pre-Deployment Checklist

### ✅ Before Deploying:

- [ ] **Database Setup Complete**
  - [ ] Supabase project created
  - [ ] Database schema run (`db/schema.sql`)
  - [ ] Database seeded (tiers, demo data)
  - [ ] Test connection works

- [ ] **Supabase Auth Configured**
  - [ ] Email/Password auth enabled
  - [ ] Have your project URL and keys ready

- [ ] **Environment Variables Ready**
  - [ ] All variables listed above
  - [ ] Tested locally with `.env.local`

- [ ] **Code Ready**
  - [ ] No hardcoded secrets
  - [ ] All features tested locally
  - [ ] Build succeeds (`npm run build`)

---

## 🗄️ Database Setup (Supabase)

### If Not Already Set Up:

1. **Create Supabase Project:**
   - Go to **https://supabase.com**
   - Create new project
   - Wait for database to provision (~2 minutes)

2. **Run Database Schema:**
   - Go to **SQL Editor** in Supabase Dashboard
   - Run: `CREATE EXTENSION IF NOT EXISTS citext;`
   - Copy/paste contents of `db/schema.sql`
   - Click **"Run"**

3. **Seed Database:**
   - Run migrations if any (check `db/` folder)
   - Seed tiers: `npm run seed` (locally, or run SQL manually)

4. **Get Connection String:**
   - Go to **Settings** → **Database**
   - Copy **Connection String** (URI format)
   - Use this for `DATABASE_URL`

---

## 🔧 Background Workers (The Tricky Part)

### ⚠️ Important: Vercel Limitations

**Vercel Serverless Functions:**
- ✅ Perfect for API routes (already working)
- ✅ Auto-scales
- ✅ Free tier: 100GB-hours/month

**Background Workers (Python Scripts):**
- ❌ **Cannot run long-running processes** on Vercel
- ❌ Python workers need separate hosting

### **Solution: Separate Worker Hosting**

You have **3 options** for background workers:

#### **Option 1: Railway (Recommended - Easiest)**
- **Cost:** Free tier available, then ~$5/month
- **Setup:** 5 minutes
- **Perfect for:** Python workers

**Steps:**
1. Go to **https://railway.app**
2. Create new project
3. Deploy from GitHub (select your repo)
4. Add environment variables
5. Set start command: `python3 scripts/market_data_worker.py`
6. Done!

#### **Option 2: Render (Free Tier Available)**
- **Cost:** Free tier (spins down after inactivity)
- **Setup:** 10 minutes
- **Good for:** Background workers

**Steps:**
1. Go to **https://render.com**
2. Create new **Background Worker**
3. Connect GitHub repo
4. Set build/start commands
5. Add environment variables

#### **Option 3: VPS (Most Control)**
- **Cost:** $5-10/month (DigitalOcean, Linode, etc.)
- **Setup:** 30 minutes
- **Best for:** Full control, multiple workers

**Steps:**
1. Create VPS instance
2. Install Python, Node.js
3. Clone repo
4. Set up systemd services for workers
5. Configure cron jobs

---

## 🎯 What Works on Vercel vs What Needs Separate Hosting

### ✅ **Works Perfectly on Vercel:**

- ✅ Next.js app (frontend + API routes)
- ✅ Database connections (Supabase)
- ✅ Authentication (Supabase Auth)
- ✅ API endpoints (`/api/*`)
- ✅ Static assets
- ✅ Server-side rendering
- ✅ Edge functions (if needed)

### ⚠️ **Needs Separate Hosting:**

- ⚠️ **Market Data Worker** (`scripts/market_data_worker.py`)
  - Long-running process
  - Needs to run 24/7
  - **Solution:** Railway, Render, or VPS

- ⚠️ **Drawdown Monitor** (`scripts/drawdown_monitor.py`)
  - Scheduled job
  - **Solution:** Vercel Cron (if converted to API route) OR separate hosting

- ⚠️ **Midnight Reset** (`scripts/midnight_reset.py`)
  - Scheduled job
  - **Solution:** Vercel Cron (if converted to API route) OR separate hosting

---

## 🔄 Converting Python Workers to Vercel Cron Jobs

### **Option: Convert to API Routes + Vercel Cron**

You can convert Python workers to Next.js API routes and use Vercel Cron:

#### **Example: Drawdown Monitor as API Route**

```typescript
// app/api/cron/drawdown-check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Verify cron secret (security)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run drawdown check logic
  // (Convert Python logic to TypeScript)
  
  return NextResponse.json({ success: true });
}
```

#### **Vercel Cron Configuration**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/drawdown-check",
      "schedule": "*/2 * * * *"
    },
    {
      "path": "/api/cron/midnight-reset",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Pros:**
- ✅ Everything in one place
- ✅ No separate hosting needed
- ✅ Free on Vercel

**Cons:**
- ⚠️ Need to rewrite Python → TypeScript
- ⚠️ Market worker still needs separate hosting (long-running)

---

## 📝 Step-by-Step Deployment

### **Phase 1: Deploy Next.js App (Vercel)**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Deploy to Vercel:**
   - Import GitHub repo
   - Auto-detects Next.js
   - Add environment variables
   - Deploy

3. **Test:**
   - Visit your Vercel URL
   - Test login/signup
   - Test dashboard
   - Test trading

### **Phase 2: Set Up Background Workers (Railway/Render)**

1. **Deploy Market Worker:**
   - Create Railway/Render project
   - Connect GitHub repo
   - Set start command: `python3 scripts/market_data_worker.py`
   - Add environment variables
   - Deploy

2. **Deploy Other Workers (Optional):**
   - Drawdown monitor
   - Midnight reset
   - Or convert to Vercel Cron

### **Phase 3: Configure Cron Jobs (If Using Separate Hosting)**

If using VPS or separate hosting:

```bash
# Add to crontab
crontab -e

# Drawdown check every 2 minutes
*/2 * * * * cd /path/to/prop-market && python3 scripts/drawdown_monitor.py

# Midnight reset daily
0 0 * * * cd /path/to/prop-market && python3 scripts/midnight_reset.py
```

---

## 🎯 Recommended Architecture for Demo

### **Simple Setup (Easiest):**

```
┌─────────────────┐
│   Vercel        │  ← Next.js App (Frontend + API)
│   (Free)        │
└─────────────────┘
         │
         ├──→ Supabase (Database + Auth)
         │
┌─────────────────┐
│   Railway       │  ← Market Data Worker
│   ($5/month)    │
└─────────────────┘
```

**Total Cost:** ~$5/month (Railway) + Supabase free tier

### **Advanced Setup (More Control):**

```
┌─────────────────┐
│   Vercel        │  ← Next.js App
│   (Free)        │
└─────────────────┘
         │
         ├──→ Supabase
         │
┌─────────────────┐
│   VPS           │  ← All Workers + Cron
│   ($10/month)   │
└─────────────────┘
```

**Total Cost:** ~$10/month (VPS) + Supabase free tier

---

## 🔒 Security Checklist

Before going live:

- [ ] **Environment Variables:**
  - [ ] All secrets in Vercel env vars (not in code)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` is secure (admin access)
  - [ ] Database password is strong

- [ ] **Database:**
  - [ ] Row Level Security (RLS) enabled in Supabase
  - [ ] API keys are restricted
  - [ ] Connection string uses SSL

- [ ] **API Routes:**
  - [ ] Authentication checks on all routes
  - [ ] Rate limiting (consider adding)
  - [ ] Input validation

- [ ] **CORS:**
  - [ ] Configured for your domain only
  - [ ] No wildcard CORS

---

## 🧪 Testing Your Deployment

### **1. Test Authentication:**
- [ ] Sign up works
- [ ] Login works
- [ ] Logout works
- [ ] Protected routes redirect

### **2. Test Trading:**
- [ ] Can view markets
- [ ] Can buy positions
- [ ] Can close positions
- [ ] Balance updates correctly

### **3. Test Dashboard:**
- [ ] Dashboard loads
- [ ] Positions show correctly
- [ ] P&L calculates correctly
- [ ] Charts render

### **4. Test Workers (If Deployed):**
- [ ] Market data updates
- [ ] Prices refresh
- [ ] Risk checks run

---

## 🐛 Common Issues & Fixes

### **Issue: "Database connection error"**
**Fix:**
- Check `DATABASE_URL` is correct
- Verify Supabase project is active
- Check IP allowlist in Supabase (if enabled)

### **Issue: "Authentication not working"**
**Fix:**
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check Supabase Auth is enabled
- Verify email templates are configured

### **Issue: "Build fails on Vercel"**
**Fix:**
- Check build logs in Vercel dashboard
- Verify all dependencies in `package.json`
- Check for TypeScript errors
- Ensure `next.config.ts` is valid

### **Issue: "Markets not loading"**
**Fix:**
- Check if market worker is running (if using)
- Verify API keys are set (Kalshi/Polymarket)
- Check network tab for API errors

---

## 📊 Vercel Pricing

### **Free Tier (Hobby):**
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ 100GB-hours serverless function execution
- ✅ Perfect for demos/testing

### **Pro Tier ($20/month):**
- ✅ Everything in Free
- ✅ More bandwidth (1TB)
- ✅ More function execution
- ✅ Team collaboration
- ✅ Better analytics

**For demo/testing:** Free tier is **perfect**!

---

## 🚀 Quick Start Commands

### **Local Testing:**
```bash
# Test build
npm run build

# Test production build locally
npm start
```

### **Deploy to Vercel:**
```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

---

## 📚 Additional Resources

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Supabase Docs:** https://supabase.com/docs
- **Railway Docs:** https://docs.railway.app

---

## ✅ Summary

**Yes, Vercel works perfectly!** Here's what you need:

1. ✅ **Vercel** - Next.js app (free tier works)
2. ✅ **Supabase** - Database + Auth (free tier works)
3. ⚠️ **Railway/Render/VPS** - Background workers (~$5-10/month)

**Total Setup Time:** ~30 minutes
**Monthly Cost:** $0-10 (depending on worker hosting)

**Ready to deploy?** Just push to GitHub and import to Vercel!

---

**Last Updated:** Today
**Status:** ✅ Ready for Production Deployment
