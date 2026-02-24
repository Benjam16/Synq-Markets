# Supabase Quick Setup - What's Left

## ✅ What You've Already Done
- Created Supabase project
- Created database schema (from `db/schema.sql`)
- Seeded database with tiers

## 🎯 What's Left (3 Steps)

### Step 1: Add Supabase User ID Column (2 minutes)

**In Supabase SQL Editor**, run:

```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_id 
ON users(supabase_user_id) 
WHERE supabase_user_id IS NOT NULL;
```

Or run the complete migration file:
- Open `db/supabase_migrations.sql`
- Copy all contents
- Paste into Supabase SQL Editor
- Click "Run"

---

### Step 2: Enable Email/Password Auth (1 minute)

1. Supabase Dashboard → **Authentication** → **Providers**
2. Click **Email**
3. Toggle **Enable Email provider** to **ON**
4. Click **Save**

---

### Step 3: Add Credentials to `.env.local` (2 minutes)

1. Supabase Dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key

3. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
   ```

4. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

---

## ✅ Test It

1. Go to `http://localhost:3000/login`
2. Click "Sign up"
3. Create account
4. Sign in
5. Should redirect to dashboard

**That's it!** 🎉

---

## 📋 Full Details

See `SUPABASE_SETUP_STEPS.md` for complete guide with troubleshooting.

