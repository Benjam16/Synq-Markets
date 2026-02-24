# Complete Vercel Setup Guide - Fresh Project

## 🚀 Step 1: Create New Vercel Project

### 1.1 Go to Vercel
1. Visit **https://vercel.com**
2. **Sign up/Login** (use GitHub to connect)
3. Click **"Add New Project"**

### 1.2 Import Repository
1. **Import Git Repository:** Select your `prop-market` GitHub repository
2. **Project Name:** `prop-market` (or your preferred name)
3. **Framework Preset:** Next.js (auto-detected)
4. **Root Directory:** `./` (default)
5. **Build Command:** `npm run build` (auto-detected)
6. **Output Directory:** `.next` (auto-detected)
7. **Install Command:** `npm install` (auto-detected)

### 1.3 Initial Deploy
1. **Click:** "Deploy" (don't add env vars yet)
2. **Wait:** ~2 minutes for first deployment
3. **Note:** This will fail without env vars, that's expected

---

## ⚙️ Step 2: Add ALL Environment Variables

### 2.1 Navigate to Environment Variables

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Click **"Add New"** for each variable below

### 2.2 REQUIRED Environment Variables

Add these **one by one**. For each variable:
- **Environment:** Select **ALL** (Production, Preview, Development)
- **Click:** "Save"

#### **1. Database Connection**
```
Name: DATABASE_URL
Value: postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require
Environment: Production, Preview, Development
```

**Where to get:**
- Supabase Dashboard → Settings → Database → Connection String (URI format)
- Replace `YOUR_PASSWORD` with your actual database password

```
Name: PGSSLMODE
Value: require
Environment: Production, Preview, Development
```

#### **2. Supabase Authentication**
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://iphqnpapflhznzsaqkah.supabase.co
Environment: Production, Preview, Development
```

**Where to get:**
- Supabase Dashboard → Settings → API → Project URL

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Your anon/public key]
Environment: Production, Preview, Development
```

**Where to get:**
- Supabase Dashboard → Settings → API → anon public key

```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Your service_role key - KEEP SECRET!]
Environment: Production, Preview, Development
```

**Where to get:**
- Supabase Dashboard → Settings → API → service_role key (secret)
- ⚠️ **WARNING:** Never expose this in frontend code!

#### **3. Cron Job Security**
```
Name: CRON_SECRET
Value: [Generate random secret]
Environment: Production, Preview, Development
```

**Generate secret:**
```bash
openssl rand -hex 32
```

Copy the output and paste as the value.

---

### 2.3 OPTIONAL Environment Variables

Add these only if you're using these features:

#### **Sentry (Error Tracking) - Optional**
```
Name: NEXT_PUBLIC_SENTRY_DSN
Value: [Your Sentry DSN]
Environment: Production, Preview, Development
```

```
Name: SENTRY_ORG
Value: [Your Sentry org slug]
Environment: Production, Preview, Development
```

```
Name: SENTRY_PROJECT
Value: [Your Sentry project slug]
Environment: Production, Preview, Development
```

**Where to get:**
- Sentry Dashboard → Settings → Client Keys (DSN)
- Sentry Dashboard → Settings → Organization Settings (org slug)
- Sentry Dashboard → Project Settings (project slug)

#### **Kalshi API (Market Data) - Optional**
```
Name: KALSHI_ACCESS_KEY
Value: [Your Kalshi access key]
Environment: Production, Preview, Development
```

```
Name: KALSHI_PRIVATE_KEY
Value: [Your Kalshi private key in PEM format]
Environment: Production, Preview, Development
```

**Where to get:**
- Kalshi Dashboard → API Keys

#### **Polymarket API - Optional**
```
Name: POLYMARKET_API_KEY
Value: [Your Polymarket API key]
Environment: Production, Preview, Development
```

**Where to get:**
- Polymarket API Dashboard

---

## 🔄 Step 3: Redeploy with Environment Variables

After adding all environment variables:

1. Go to **Deployments** tab
2. Click **"..."** (three dots) on the latest deployment
3. Click **"Redeploy"**
4. **OR** click **"Deploy"** button at top right
5. Select **"Production"** environment
6. **Uncheck:** "Use existing Build Cache" (to force fresh build)
7. Click **"Redeploy"**
8. **Wait:** ~2-3 minutes for deployment

---

## ✅ Step 4: Verify Deployment

### 4.1 Check Build Status

1. Go to **Deployments** tab
2. Latest deployment should show **"Ready"** (green checkmark)
3. Click on deployment to view **Build Logs**
4. Should see: `✓ Compiled successfully`

### 4.2 Test Your Site

1. **Visit your Vercel URL:** `https://your-app.vercel.app`
2. **Should see:** Landing page (not 404)
3. **Test features:**
   - Sign up / Login
   - View dashboard
   - Browse markets
   - Make a trade (if configured)

---

## 📋 Complete Environment Variables Checklist

### ✅ Required (Must Have):
- [ ] `DATABASE_URL`
- [ ] `PGSSLMODE`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `CRON_SECRET`

### ⚠️ Optional (Nice to Have):
- [ ] `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `SENTRY_ORG`
- [ ] `SENTRY_PROJECT`
- [ ] `KALSHI_ACCESS_KEY`
- [ ] `KALSHI_PRIVATE_KEY`
- [ ] `POLYMARKET_API_KEY`

---

## 🔍 Step 5: Get Your Supabase Credentials

### 5.1 Supabase Project URL
1. Go to: **https://supabase.com/dashboard/project/iphqnpapflhznzsaqkah**
2. Click **Settings** → **API**
3. Copy **Project URL:** `https://iphqnpapflhznzsaqkah.supabase.co`

### 5.2 Supabase Keys
1. Same page: **Settings** → **API**
2. Copy **anon public key** (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Copy **service_role key** (for `SUPABASE_SERVICE_ROLE_KEY`)
   - ⚠️ This is a secret key - keep it secure!

### 5.3 Database Connection String
1. Go to: **Settings** → **Database**
2. Scroll to **Connection String**
3. Select **URI** tab
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your actual database password
6. Use this for `DATABASE_URL`

---

## 🎯 Quick Reference: All Environment Variables

Copy-paste ready format:

```bash
# ============================================
# REQUIRED - Copy these to Vercel
# ============================================

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require
PGSSLMODE=require
NEXT_PUBLIC_SUPABASE_URL=https://iphqnpapflhznzsaqkah.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
CRON_SECRET=your-generated-secret-here

# ============================================
# OPTIONAL - Add if using these features
# ============================================

# Sentry (Error Tracking)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug

# Kalshi API
KALSHI_ACCESS_KEY=your-kalshi-access-key
KALSHI_PRIVATE_KEY=your-kalshi-private-key-pem

# Polymarket API
POLYMARKET_API_KEY=your-polymarket-api-key
```

---

## 🐛 Troubleshooting

### Issue: "Build fails with DATABASE_URL error"
**Fix:** Make sure `DATABASE_URL` is set correctly and includes your password

### Issue: "404 error after deployment"
**Fix:** 
1. Check build logs for errors
2. Verify all required env vars are set
3. Make sure you redeployed after adding env vars

### Issue: "Authentication not working"
**Fix:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
3. Ensure Supabase Auth is enabled in Supabase Dashboard

### Issue: "Cron jobs not working"
**Fix:**
1. Verify `CRON_SECRET` is set
2. Check API routes exist: `/api/cron/drawdown-check` and `/api/cron/midnight-reset`
3. Note: Cron jobs are currently disabled in `vercel.json` for Hobby plan

---

## 📝 Summary

**What You Need:**
1. ✅ Vercel account (Hobby plan works)
2. ✅ GitHub repository with your code
3. ✅ Supabase project credentials
4. ✅ All environment variables listed above

**Setup Time:** ~10-15 minutes

**After Setup:**
- ✅ App deployed
- ✅ Authentication working
- ✅ Database connected
- ✅ Ready for users

---

**Last Updated:** Today
**Status:** ✅ Complete Setup Guide
