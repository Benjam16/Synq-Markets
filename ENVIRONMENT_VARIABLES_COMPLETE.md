# Complete Environment Variables List for Vercel

## 🚨 REQUIRED - Must Have These

Add these to **Vercel Dashboard → Settings → Environment Variables**:

### 1. Database Connection

```
Name: DATABASE_URL
Value: postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require
Environment: Production, Preview, Development (select ALL)
```

**Where to get:**
- Supabase Dashboard → Settings → Database → Connection String (URI format)
- Replace `YOUR_PASSWORD` with your actual database password

```
Name: PGSSLMODE
Value: require
Environment: Production, Preview, Development (select ALL)
```

---

### 2. Supabase Authentication

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://iphqnpapflhznzsaqkah.supabase.co
Environment: Production, Preview, Development (select ALL)
```

**Where to get:**
- Supabase Dashboard → Settings → API → Project URL

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Your anon/public key from Supabase]
Environment: Production, Preview, Development (select ALL)
```

**Where to get:**
- Supabase Dashboard → Settings → API → Project API keys → `anon` `public` key

```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Your service role key from Supabase]
Environment: Production, Preview, Development (select ALL)
⚠️ WARNING: Keep this secret! Never expose in frontend code.
```

**Where to get:**
- Supabase Dashboard → Settings → API → Project API keys → `service_role` `secret` key

---

### 3. Cron Jobs Security

```
Name: CRON_SECRET
Value: [Generate a random secret string - at least 32 characters]
Environment: Production, Preview, Development (select ALL)
```

**How to generate:**
- Use: `openssl rand -base64 32` or any random string generator
- Example: `a7f3b9c2d4e5f6g7h8i9j0k1l2m3n4o5p6`

**Purpose:** Secures your cron job endpoints from unauthorized access

---

## ✅ OPTIONAL - Add If Using These Features

### 4. Sentry Error Tracking (Optional)

```
Name: NEXT_PUBLIC_SENTRY_DSN
Value: [Your Sentry DSN]
Environment: Production, Preview, Development (select ALL)
```

```
Name: SENTRY_ORG
Value: [Your Sentry organization slug]
Environment: Production, Preview, Development (select ALL)
```

```
Name: SENTRY_PROJECT
Value: [Your Sentry project slug]
Environment: Production, Preview, Development (select ALL)
```

**Where to get:**
- Sentry Dashboard → Settings → Projects → Your Project → Client Keys (DSN)
- Sentry Dashboard → Settings → Organization → Organization slug
- Sentry Dashboard → Settings → Projects → Project slug

**Note:** If you don't have Sentry, you can skip these. The app will work without them.

---

### 5. Kalshi API (Optional - for real market data)

```
Name: KALSHI_ACCESS_KEY
Value: [Your Kalshi access key UUID]
Environment: Production, Preview, Development (select ALL)
```

```
Name: KALSHI_PRIVATE_KEY
Value: [Your Kalshi private key in PEM format]
Environment: Production, Preview, Development (select ALL)
```

**Where to get:**
- Kalshi API Dashboard → API Keys
- Generate new key pair if needed

**Note:** Only needed if you're using real Kalshi market data. The app works with mock data without these.

---

### 6. Polymarket API (Optional)

```
Name: POLYMARKET_API_KEY
Value: [Your Polymarket API key]
Environment: Production, Preview, Development (select ALL)
```

**Where to get:**
- Polymarket API Dashboard

**Note:** Only needed if you're using Polymarket market data.

---

### 7. News API (Optional)

```
Name: NEWSAPI_KEY
Value: [Your NewsAPI key]
Environment: Production, Preview, Development (select ALL)
```

**Where to get:**
- https://newsapi.org/ → Get API Key

**Note:** Only needed if you want real news feed. The app works without it.

---

## 📋 Quick Copy-Paste Format

Copy this format and fill in your values:

```bash
# ============================================
# REQUIRED - Must Have
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

# News API
NEWSAPI_KEY=your-newsapi-key
```

---

## 🎯 Step-by-Step: How to Add in Vercel

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com
   - Select your project

2. **Navigate to Environment Variables**
   - Click **Settings** → **Environment Variables**

3. **Add Each Variable**
   - Click **"Add New"**
   - Enter **Name** (e.g., `DATABASE_URL`)
   - Enter **Value** (your actual value)
   - Select **Environment**: Check all boxes (Production, Preview, Development)
   - Click **"Save"**

4. **Repeat for Each Variable**
   - Add all 6 required variables first
   - Then add optional ones if needed

5. **Redeploy**
   - After adding all variables, go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**
   - Wait 2-3 minutes

---

## ✅ Verification Checklist

After adding all variables, verify:

- [ ] `DATABASE_URL` is set correctly (includes password)
- [ ] `PGSSLMODE=require` is set
- [ ] `NEXT_PUBLIC_SUPABASE_URL` matches your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (service role, not anon key)
- [ ] `CRON_SECRET` is set (random string)
- [ ] All variables have **ALL environments** selected (Production, Preview, Development)
- [ ] You've redeployed after adding variables

---

## 🐛 Common Issues

### "Build fails with DATABASE_URL error"
- **Fix:** Check that `DATABASE_URL` includes your password and is in correct format
- **Format:** `postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require`

### "Authentication not working"
- **Fix:** Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- **Check:** Supabase Dashboard → Settings → API

### "Cron jobs not working"
- **Fix:** Verify `CRON_SECRET` is set and matches in your cron route code
- **Note:** Cron jobs may be disabled in `vercel.json` for Hobby plan

### "404 error after deployment"
- **Fix:** 
  1. Check build logs for errors
  2. Verify all required env vars are set
  3. Make sure you redeployed after adding env vars

---

## 📝 Summary

**Minimum Required (6 variables):**
1. `DATABASE_URL`
2. `PGSSLMODE`
3. `NEXT_PUBLIC_SUPABASE_URL`
4. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. `SUPABASE_SERVICE_ROLE_KEY`
6. `CRON_SECRET`

**Total Setup Time:** ~5-10 minutes

**After Setup:**
- ✅ App deployed and working
- ✅ Authentication working
- ✅ Database connected
- ✅ Cron jobs secured
