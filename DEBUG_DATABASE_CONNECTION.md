# Debug Database Connection - "Failed to Create User" Error

## 🔍 Quick Diagnosis Steps

### Step 1: Check Vercel Environment Variables

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Find `DATABASE_URL`
3. **Verify it matches exactly** with your `.env.local`:
   ```
   postgresql://postgres.iphqnpapflhznzsaqkah:Pl0xk012Benjam@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
   ```

**Common Issues:**
- ❌ Missing `DATABASE_URL` entirely
- ❌ Wrong password (not URL-encoded)
- ❌ Wrong hostname
- ❌ Missing port `:6543`
- ❌ Environment not selected (must check Production, Preview, Development)

### Step 2: Check Vercel Logs

1. Go to **Vercel Dashboard** → Your Project → **Logs**
2. Try to purchase a challenge
3. Look for errors in the logs
4. Find the line that says `[User API] Error creating user:`
5. Check the error code:
   - `28P01` = Password authentication failed
   - `ECONNREFUSED` = Can't connect to database
   - `ENOTFOUND` = Hostname not found

### Step 3: Verify Connection String Format

Your connection string should be:
```
postgresql://postgres.iphqnpapflhznzsaqkah:Pl0xk012Benjam@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
```

**Breakdown:**
- Protocol: `postgresql://`
- Username: `postgres.iphqnpapflhznzsaqkah` (for pooler)
- Password: `Pl0xk012Benjam` (no special characters, no encoding needed)
- Host: `aws-1-ap-southeast-2.pooler.supabase.com`
- Port: `6543` (pooler port)
- Database: `postgres`

### Step 4: Test Connection String

If you want to test locally, run:
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.query('SELECT NOW()').then(r => {
  console.log('✅ Connected!', r.rows[0]);
  process.exit(0);
}).catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
"
```

## 🚨 Most Common Issues

### Issue 1: Password Authentication Failed (28P01)

**Error:** `password authentication failed for user "postgres"`

**Causes:**
- Wrong password in Vercel
- Password not URL-encoded correctly
- Using wrong username format

**Fix:**
1. Go to Supabase Dashboard → Settings → Database
2. Get the **Connection Pooler** connection string (not direct connection)
3. Copy the **exact** connection string
4. Paste into Vercel `DATABASE_URL`
5. Make sure password is URL-encoded (special characters like `!@#` become `%21%40%23`)

### Issue 2: Connection Refused (ECONNREFUSED)

**Error:** `connect ECONNREFUSED`

**Causes:**
- Wrong hostname
- Wrong port
- Database paused (free tier)

**Fix:**
1. Check Supabase Dashboard → Project is active (not paused)
2. Verify hostname matches: `aws-1-ap-southeast-2.pooler.supabase.com`
3. Verify port is `6543` (pooler) not `5432` (direct)

### Issue 3: Hostname Not Found (ENOTFOUND)

**Error:** `getaddrinfo ENOTFOUND`

**Causes:**
- Typo in hostname
- Wrong region/endpoint

**Fix:**
1. Get connection string from Supabase Dashboard
2. Copy hostname exactly as shown

## ✅ Quick Fix Checklist

- [ ] `DATABASE_URL` exists in Vercel environment variables
- [ ] `DATABASE_URL` matches your `.env.local` exactly
- [ ] Password is URL-encoded (special chars like `!` become `%21`)
- [ ] Using pooler connection (port 6543, not 5432)
- [ ] Environment selected: Production, Preview, Development (all checked)
- [ ] Redeployed after adding/changing `DATABASE_URL`
- [ ] Supabase project is active (not paused)

## 🔧 If Still Not Working

1. **Check Vercel Logs** for the exact error message
2. **Copy the error code** (e.g., `28P01`, `ECONNREFUSED`)
3. **Verify DATABASE_URL** in Vercel matches Supabase Dashboard exactly
4. **Try direct connection** instead of pooler (port 5432) to test
5. **Contact Supabase Support** if database is paused or inaccessible

## 📝 Next Steps

After fixing `DATABASE_URL` in Vercel:
1. **Redeploy** your Vercel project
2. **Wait 2-3 minutes** for deployment
3. **Test** challenge purchase again
4. **Check logs** if it still fails
