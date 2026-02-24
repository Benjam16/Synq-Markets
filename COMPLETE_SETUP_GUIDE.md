# Complete Setup Guide - Get Everything Running

Follow these steps in order to get your platform fully operational.

---

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ Node.js 18+ installed
- ✅ Python 3.8+ installed
- ✅ A Supabase account (free tier works)
- ✅ Git (to clone if needed)

---

## Step 1: Install Dependencies

```bash
cd /Users/oneilbenjamin/prop-market
npm install
```

This installs all Node.js dependencies including Next.js, React, Supabase client, etc.

---

## Step 2: Set Up Supabase Project

### 2.1 Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: `prop-market` (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait 2-3 minutes for project to initialize

### 2.2 Get Database Connection String

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Copy the **URI** connection string (looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your actual database password

### 2.3 Get Supabase Auth Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

---

## Step 3: Set Up Database Schema

### 3.1 Enable Required Extension

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New query"
3. Run this:
   ```sql
   CREATE EXTENSION IF NOT EXISTS citext;
   ```
4. Click "Run" (or press Cmd+Enter)

### 3.2 Create Database Tables

1. Still in SQL Editor, click "New query"
2. Open `db/schema.sql` from your project
3. Copy **ALL** contents
4. Paste into SQL Editor
5. Click "Run"
6. You should see "Success. No rows returned"

✅ **Verify**: Go to **Table Editor** - you should see tables:
- `account_tiers`
- `users`
- `challenge_subscriptions`
- `simulated_trades`
- `market_price_cache`
- etc.

---

## Step 4: Configure Environment Variables

### 4.1 Create `.env.local` File

In your project root, create `.env.local`:

```bash
cd /Users/oneilbenjamin/prop-market
touch .env.local
```

### 4.2 Add Environment Variables

Open `.env.local` and add:

```bash
# Database Connection (from Step 2.2)
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
PGSSLMODE=require

# Supabase Auth (from Step 2.3)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"

# Optional: Kalshi API (for real market data)
# KALSHI_ACCESS_KEY="your-key"
# KALSHI_PRIVATE_KEY="your-private-key-pem"
```

**Replace:**
- `YOUR_PASSWORD` with your actual database password
- `xxxxx.supabase.co` with your actual Supabase project URL
- `your-anon-key-here` with your actual anon key

---

## Step 5: Enable Supabase Authentication

### 5.1 Enable Email/Password Auth

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Email** provider
3. Click to expand
4. Toggle **Enable Email provider** to ON
5. Leave other settings as default
6. Click "Save"

### 5.2 (Optional) Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize if desired (or leave defaults)
3. The default templates work fine for testing

---

## Step 6: Seed Database with Initial Data

### 6.1 Seed Challenge Tiers

Run the seed script to create tiers and a demo user:

```bash
cd /Users/oneilbenjamin/prop-market
npm run seed
```

**Expected output:**
```
Seed complete. User: demo@prop.local Password: (set externally)
```

✅ **Verify**: 
- Go to Supabase **Table Editor** → `account_tiers`
- You should see 5 tiers (Scout, Analyst, Strategist, Whale, VIP)

---

## Step 7: Start the Development Server

```bash
npm run dev
```

You should see:
```
▲ Next.js 16.1.0
- Local:        http://localhost:3000
```

### 7.1 Test the Application

1. Open browser to `http://localhost:3000`
2. You should see the landing page with live ticker
3. Click "Get Started" or "Sign In"
4. You should see the login page

---

## Step 8: Create Your First User Account

### 8.1 Sign Up

1. On the login page, click "Don't have an account? Sign up"
2. Enter:
   - **Email**: `test@example.com` (or your email)
   - **Password**: `password123` (or any password, min 6 chars)
3. Click "Create Account"
4. You should see: "Account created! Please check your email to verify your account."

### 8.2 Verify Email (if required)

- Check your email for verification link
- Click the link to verify
- Or in Supabase Dashboard → **Authentication** → **Users**, manually verify the user

### 8.3 Sign In

1. Go back to login page
2. Enter your email and password
3. Click "Sign In"
4. You should be redirected to `/dashboard`
5. You should see the **Welcome screen** (no active challenge yet)

---

## Step 9: Purchase Your First Challenge

### 9.1 Go to Challenges Page

1. Click "Challenges" in the sidebar (or go to `/challenges`)
2. You should see 4 challenge tiers

### 9.2 Purchase a Challenge

1. Click "Purchase Challenge" on any tier (e.g., "The Scout" - $49)
2. **Note**: Currently this doesn't process payment (will be added later)
3. You should see "Challenge purchased successfully!"
4. You'll be redirected to dashboard
5. Dashboard should now show your challenge with starting balance

---

## Step 10: Test Trading

### 10.1 View Markets

1. On dashboard, scroll to "Active Markets" section
2. You should see market cards (may show demo data if no worker running)

### 10.2 Make a Trade

1. Click on a market card
2. Click "Buy YES" or "Buy NO"
3. You should see a toast notification
4. Position should appear in "Open Positions" table
5. Cash balance should decrease

### 10.3 Close a Position

1. In "Open Positions" table, click "Close" on any position
2. Position should disappear
3. Cash balance should increase

---

## Step 11: Set Up Market Data Worker (Optional but Recommended)

This fetches real market prices from Kalshi/Polymarket.

### 11.1 Install Python Dependencies

```bash
python3 -m pip install -r requirements.txt
```

### 11.2 (Optional) Set Up Kalshi API Keys

If you have Kalshi API keys:

1. Edit `.env.local` and add:
   ```bash
   KALSHI_ACCESS_KEY="your-access-key"
   KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   ```

2. Or use the provided script:
   ```bash
   source scripts/set_kalshi_env.sh
   ```

**Note**: If you don't have Kalshi keys, the worker will still work but only fetch Polymarket data (public API).

### 11.3 Start Market Data Worker

Open a **new terminal window**:

```bash
cd /Users/oneilbenjamin/prop-market
export $(grep -v '^#' .env.local | xargs)
python3 scripts/market_data_worker.py
```

**Expected output:**
```
✅ Database connection pool initialized
Starting REST API polling for Kalshi and Polymarket...
```

The worker will:
- Fetch market data every 30 seconds
- Update `market_price_cache` table
- Keep running until you stop it (Ctrl+C)

**Keep this terminal running** while you use the app.

---

## Step 12: Set Up Background Workers (Production)

For production, you'll want these running automatically.

### 12.1 Drawdown Monitor (Every Minute)

This checks if any challenges have exceeded drawdown limits.

**Option A: Manual Test**
```bash
export $(grep -v '^#' .env.local | xargs)
python3 scripts/drawdown_monitor.py
```

**Option B: Cron Job (Production)**
```bash
crontab -e
```

Add:
```bash
* * * * * cd /path/to/prop-market && export $(grep -v '^#' .env.local | xargs) && python3 scripts/drawdown_monitor.py
```

### 12.2 Midnight Reset (Daily at Midnight EST)

This resets daily balances and creates snapshots.

**Option A: Manual Test**
```bash
export $(grep -v '^#' .env.local | xargs)
python3 scripts/midnight_reset.py
```

**Option B: Cron Job (Production)**
```bash
0 0 * * * TZ=America/New_York cd /path/to/prop-market && export $(grep -v '^#' .env.local | xargs) && python3 scripts/midnight_reset.py
```

---

## Step 13: Verify Everything Works

### 13.1 Test Checklist

- [ ] Landing page loads
- [ ] Can sign up new user
- [ ] Can sign in
- [ ] Dashboard shows welcome screen (if no challenge)
- [ ] Can purchase challenge
- [ ] Dashboard shows challenge data after purchase
- [ ] Can view markets
- [ ] Can buy positions
- [ ] Positions appear in table
- [ ] Can close positions
- [ ] Drawdown bars update
- [ ] Leaderboard shows (may be empty)

### 13.2 Common Issues & Fixes

**Issue: "Supabase URL is required" error**
- ✅ Fix: Make sure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ Restart dev server after adding env vars

**Issue: "No active challenge subscription"**
- ✅ Fix: Purchase a challenge from `/challenges` page
- ✅ Make sure you're signed in

**Issue: Markets show demo data**
- ✅ Fix: Start the market data worker (Step 11)
- ✅ Wait 30 seconds for first data fetch

**Issue: Can't sign up**
- ✅ Fix: Check Supabase Dashboard → Authentication → Providers → Email is enabled
- ✅ Check email verification settings

**Issue: Database connection error**
- ✅ Fix: Verify `DATABASE_URL` in `.env.local` is correct
- ✅ Check password doesn't have special characters that need URL encoding
- ✅ Make sure `PGSSLMODE=require` is set

---

## Step 14: Production Deployment (When Ready)

### 14.1 Deploy Next.js App

**Vercel (Recommended):**
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy

**Other Options:**
- Render
- Railway
- AWS Amplify

### 14.2 Deploy Workers

**Option A: Separate Server/VM**
- Set up a Linux server (AWS EC2, DigitalOcean, etc.)
- Install Python dependencies
- Set up cron jobs
- Keep workers running 24/7

**Option B: Serverless Functions**
- Convert workers to serverless functions
- Use Vercel Cron or AWS Lambda
- Schedule with cron expressions

### 14.3 Environment Variables in Production

Make sure to add all `.env.local` variables to your hosting platform:
- `DATABASE_URL`
- `PGSSLMODE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `KALSHI_ACCESS_KEY` (if using)
- `KALSHI_PRIVATE_KEY` (if using)

---

## 🎉 You're All Set!

Your platform should now be fully operational. Here's what you have:

✅ **Working:**
- User authentication
- Challenge purchase
- Trading (buy/close positions)
- Real-time dashboard
- Risk monitoring
- Market data (if worker running)

**Next Steps:**
1. Test the full user flow
2. Set up payment processing (Stripe)
3. Deploy to production
4. Set up monitoring

---

## 📞 Quick Reference

**Start Dev Server:**
```bash
npm run dev
```

**Start Market Worker:**
```bash
export $(grep -v '^#' .env.local | xargs)
python3 scripts/market_data_worker.py
```

**Seed Database:**
```bash
npm run seed
```

**Check Logs:**
- Next.js: Terminal where `npm run dev` is running
- Workers: Terminal where Python script is running
- Database: Supabase Dashboard → Logs

---

## 🆘 Need Help?

If something doesn't work:
1. Check the error message in terminal/browser console
2. Verify all environment variables are set
3. Check Supabase Dashboard for database/auth issues
4. Review the `PLATFORM_STATUS.md` for known issues

Good luck! 🚀

