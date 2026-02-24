# Correct DATABASE_URL for Vercel

## ✅ Use This Connection String

Based on your Supabase setup, use this format:

```
postgresql://postgres:Pl0xk012Benjam@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require
```

**OR** if the pooler works better (recommended for Vercel):

```
postgresql://postgres.iphqnpapflhznzsaqkah:Pl0xk012Benjam@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
```

## 🎯 Steps to Fix

### Option 1: Use Direct Connection (from Supabase Dashboard)

1. Go to **Supabase Dashboard** → **Settings** → **Database**
2. Scroll to **"Connection string"**
3. Select **"Direct connection"** tab
4. Select **"URI"** format
5. **Replace `[YOUR-PASSWORD]`** with: `Pl0xk012Benjam`
6. Copy the entire string
7. Add `?sslmode=require` at the end if it's not there

### Option 2: Use Connection Pooler (Recommended for Vercel)

1. Go to **Supabase Dashboard** → **Settings** → **Database**
2. Scroll to **"Connection string"**
3. Select **"Connection Pooler"** tab
4. Select **"URI"** format
5. **Replace `[YOUR-PASSWORD]`** with: `Pl0xk012Benjam`
6. Copy the entire string

## 📝 Update Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Find `DATABASE_URL`
3. **Paste the complete connection string** (with password filled in)
4. Make sure **ALL environments** are checked (Production, Preview, Development)
5. Click **Save**
6. **Redeploy** your project

## ⚠️ Important

- **Don't use `[YOUR-PASSWORD]` placeholder** - replace it with your actual password
- **Copy the entire string** from Supabase - don't try to construct it manually
- **Make sure `PGSSLMODE=require`** is set in Vercel environment variables (if using direct connection)

## 🔍 Which One to Use?

- **Direct Connection (port 5432)**: Simpler, but may have connection limits
- **Connection Pooler (port 6543)**: Better for serverless/Vercel, handles many connections

**Recommendation:** Try the **Connection Pooler** first, as it's optimized for serverless environments like Vercel.
