# Vercel Setup - Step-by-Step Guide

## 🚀 Step 1: Deploy Your Project to Vercel

### 1.1 Push Code to GitHub (if not already done)

```bash
git add .
git commit -m "Add Edge Functions and Cron jobs"
git push
```

### 1.2 Import to Vercel

1. **Go to:** https://vercel.com
2. **Sign up/Login** (use GitHub to connect)
3. **Click:** "Add New Project"
4. **Import:** Select your `prop-market` repository
5. **Configure:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `.next` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)
6. **Click:** "Deploy" (don't add env vars yet - we'll do that next)

**Wait ~2 minutes** for the first deployment to complete.

---

## ⚙️ Step 2: Add Environment Variables

### 2.1 Go to Environment Variables

1. In Vercel Dashboard, click on your **project**
2. Go to **Settings** → **Environment Variables**
3. Click **"Add New"** for each variable below

### 2.2 Required Environment Variables

Add these **one by one**:

#### **Database Connection:**
```
Name: DATABASE_URL
Value: postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require
Environment: Production, Preview, Development (select all)
```

```
Name: PGSSLMODE
Value: require
Environment: Production, Preview, Development (select all)
```

#### **Supabase Auth:**
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://iphqnpapflhznzsaqkah.supabase.co
Environment: Production, Preview, Development (select all)
```

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Your anon key from Supabase Dashboard → Settings → API]
Environment: Production, Preview, Development (select all)
```

```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Your service role key from Supabase Dashboard → Settings → API]
⚠️ WARNING: Keep this secret! Never expose in frontend code.
Environment: Production, Preview, Development (select all)
```

#### **Cron Job Security:**
```
Name: CRON_SECRET
Value: [Generate a random secret: openssl rand -hex 32]
Environment: Production, Preview, Development (select all)
```

**To generate CRON_SECRET:**
```bash
openssl rand -hex 32
```
Copy the output and paste it as the value.

### 2.3 Optional Environment Variables

If you're using these features, add them too:

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

```
Name: KALSHI_ACCESS_KEY
Value: [Your Kalshi API key]
Environment: Production, Preview, Development
```

```
Name: KALSHI_PRIVATE_KEY
Value: [Your Kalshi private key]
Environment: Production, Preview, Development
```

### 2.4 Save and Redeploy

After adding all variables:
1. **Click:** "Save" for each variable
2. **Go to:** Deployments tab
3. **Click:** "..." (three dots) on the latest deployment
4. **Click:** "Redeploy"
5. **Wait** for redeployment to complete (~2 minutes)

---

## ✅ Step 3: Verify Cron Jobs Are Active

### 3.1 Check Cron Jobs in Vercel

1. In Vercel Dashboard → Your Project
2. Go to **Settings** → **Cron Jobs**
3. You should see:
   - **`/api/cron/drawdown-check`** - Every 2 minutes (`*/2 * * * *`)
   - **`/api/cron/midnight-reset`** - Daily at 4 AM UTC (`0 4 * * *`)

### 3.2 Test Cron Jobs Manually

After deployment, test the cron endpoints:

```bash
# Replace YOUR_APP_URL with your Vercel URL
# Replace YOUR_CRON_SECRET with the secret you set

# Test drawdown check
curl https://your-app.vercel.app/api/cron/drawdown-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test midnight reset
curl https://your-app.vercel.app/api/cron/midnight-reset \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Response:**
```json
{
  "success": true,
  "source": "edge-function",
  "checked": 5,
  "closed": 0,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## 🧪 Step 4: Test Your Deployment

### 4.1 Test the App

1. **Visit your Vercel URL:** `https://your-app.vercel.app`
2. **Test Authentication:**
   - Sign up with a new account
   - Login
   - Logout
3. **Test Dashboard:**
   - View markets
   - Check positions
   - Verify P&L calculations
4. **Test Trading:**
   - Open a position
   - Close a position
   - Verify balance updates

### 4.2 Monitor Cron Jobs

1. **Vercel Dashboard** → **Deployments** → **Functions**
2. **Check logs** for cron job executions
3. **Look for:**
   - `[Cron] Risk check complete` messages
   - `[Midnight Reset]` messages
   - Any errors

---

## 🔍 Step 5: Verify Edge Function Integration

### 5.1 Check Edge Function is Being Called

The cron job should call your Supabase Edge Function first, then fall back to the API route if needed.

**Check Vercel logs for:**
```
[Cron] Risk check complete (Edge Function): X checked, Y closed
```

If you see `(API fallback)` instead, the Edge Function might not be accessible. Check:
- `NEXT_PUBLIC_SUPABASE_URL` is correct
- `SUPABASE_SERVICE_ROLE_KEY` is correct
- Edge Function is deployed (check Supabase Dashboard)

### 5.2 Verify Edge Function Deployment

1. **Go to:** https://supabase.com/dashboard/project/iphqnpapflhznzsaqkah/functions
2. **Verify:** `risk-engine` function is listed and shows "Deployed"
3. **Check logs:** Click on the function to see execution logs

---

## 📊 Step 6: Monitor Everything

### 6.1 Vercel Monitoring

- **Deployments:** Check build status
- **Functions:** View API route logs
- **Cron Jobs:** See execution history
- **Analytics:** Track usage (Pro plan)

### 6.2 Supabase Monitoring

- **Edge Functions:** https://supabase.com/dashboard/project/iphqnpapflhznzsaqkah/functions
- **Database:** Check query performance
- **Logs:** View function execution logs

---

## 🐛 Troubleshooting

### Issue: "Cron jobs not running"

**Fix:**
1. Check `vercel.json` is in the root directory
2. Verify cron paths match your API routes
3. Check Vercel Dashboard → Cron Jobs shows them
4. Ensure `CRON_SECRET` is set correctly

### Issue: "Edge Function not being called"

**Fix:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Check `SUPABASE_SERVICE_ROLE_KEY` is set
3. Verify Edge Function is deployed in Supabase
4. Check Vercel logs for error messages

### Issue: "Database connection errors"

**Fix:**
1. Verify `DATABASE_URL` is correct
2. Check Supabase project is active
3. Verify IP allowlist (if enabled)
4. Check `PGSSLMODE=require` is set

### Issue: "Build fails"

**Fix:**
1. Check build logs in Vercel Dashboard
2. Verify all dependencies in `package.json`
3. Check for TypeScript errors
4. Ensure `next.config.ts` is valid

---

## ✅ Checklist

Before considering deployment complete:

- [ ] Code pushed to GitHub
- [ ] Project imported to Vercel
- [ ] All environment variables added
- [ ] App redeployed with env vars
- [ ] Cron jobs visible in Vercel Dashboard
- [ ] App loads at Vercel URL
- [ ] Authentication works
- [ ] Trading works
- [ ] Cron jobs executing (check logs)
- [ ] Edge Function being called (check logs)

---

## 🎯 Summary

**What You've Set Up:**

1. ✅ **Vercel Deployment** - Next.js app live
2. ✅ **Cron Jobs** - Risk engine runs every 2 minutes, midnight reset daily
3. ✅ **Edge Function** - Risk engine deployed to Supabase
4. ✅ **Environment Variables** - All secrets configured
5. ✅ **Monitoring** - Logs and dashboards ready

**Everything is automated now!** The risk engine will run every 2 minutes, and the midnight reset will run daily at 4 AM UTC.

---

**Last Updated:** Today
**Status:** ✅ Ready for Production
