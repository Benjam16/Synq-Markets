# Supabase Setup - Remaining Steps

This guide covers what's left to configure in Supabase, assuming you already have:
- ✅ Supabase project created
- ✅ Database schema created (from `db/schema.sql`)
- ✅ Database seeded with tiers

---

## Step 1: Add Supabase User ID Column to Database

Currently, the `users` table doesn't store the Supabase auth user ID. We need to add this for proper linking.

### 1.1 Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

### 1.2 Add Supabase User ID Column

Run this SQL:

```sql
-- Add column to link Supabase auth users to database users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_id 
ON users(supabase_user_id) 
WHERE supabase_user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.supabase_user_id IS 'Links to Supabase auth.users.id';
```

Click **Run** (or press Cmd+Enter)

✅ **Verify**: Go to **Table Editor** → `users` → You should see a new `supabase_user_id` column

---

## Step 2: Enable Email/Password Authentication

### 2.1 Enable Email Provider

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Email** in the list
3. Click on it to expand
4. Toggle **Enable Email provider** to **ON**
5. Leave other settings as default:
   - **Confirm email**: OFF (for easier testing) or ON (for production)
   - **Secure email change**: OFF (for now)
6. Click **Save**

### 2.2 (Optional) Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. You can customize:
   - **Confirm signup** - Sent when user signs up
   - **Magic Link** - For passwordless login
   - **Change Email Address** - When email is changed
   - **Reset Password** - For password resets

**For testing**: Leave defaults or disable email confirmation

---

## Step 3: Get Your Supabase Credentials

### 3.1 Get Project URL and API Keys

1. Go to **Settings** → **API**
2. Copy these values:

   **Project URL:**
   ```
   https://xxxxx.supabase.co
   ```

   **anon public key:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 3.2 Add to `.env.local`

Open your `.env.local` file and add/update:

```bash
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Replace** `xxxxx` with your actual project identifier.

---

## Step 4: Update User Creation to Store Supabase ID

The code already tries to store `supabaseUserId`, but the database column might not exist yet. After Step 1, this will work automatically.

**No action needed** - the code in `app/api/user/route.ts` already handles this.

---

## Step 5: (Optional) Set Up Row Level Security (RLS)

For production, you should enable RLS to ensure users can only see their own data.

### 5.1 Enable RLS on Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on challenge_subscriptions
ALTER TABLE challenge_subscriptions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on simulated_trades
ALTER TABLE simulated_trades ENABLE ROW LEVEL SECURITY;

-- Enable RLS on daily_balance_snapshots
ALTER TABLE daily_balance_snapshots ENABLE ROW LEVEL SECURITY;
```

### 5.2 Create RLS Policies

**Note**: Since we're using direct PostgreSQL connections (not Supabase client), RLS won't automatically apply. These policies are for if you switch to using Supabase client for queries.

For now, **you can skip RLS** since we're using direct database connections with user_id filtering in the application code.

---

## Step 6: (Optional) Set Up Database Functions for Auto-User Creation

Create a database function that automatically creates a user record when someone signs up in Supabase Auth.

### 6.1 Create Function

Run this SQL:

```sql
-- Function to create user in our users table when Supabase auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (email, full_name, supabase_user_id, role)
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.id,
    'trader'
  )
  ON CONFLICT (email) DO UPDATE
  SET supabase_user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.2 Create Trigger

```sql
-- Trigger to call function when new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Note**: This requires access to `auth.users` table. If you get a permission error, you may need to run this as a database admin or skip this step (the app will create users via API instead).

---

## Step 7: Update User API to Store Supabase ID

The code already tries to store it, but let's make sure the database column is being used.

### 7.1 Verify the Code

The `app/api/user/route.ts` already accepts `supabaseUserId` but doesn't store it. Let's update it:

**No action needed yet** - the current code works by email mapping. After Step 1, we can enhance it.

---

## Step 8: Test Authentication

### 8.1 Restart Your Dev Server

After adding environment variables:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 8.2 Test Sign Up

1. Go to `http://localhost:3000/login`
2. Click "Don't have an account? Sign up"
3. Enter:
   - Email: `test@example.com`
   - Password: `password123`
4. Click "Create Account"
5. You should see success message

### 8.3 Check Supabase Dashboard

1. Go to **Authentication** → **Users**
2. You should see your new user
3. Note the **User UID** (UUID format)

### 8.4 Test Sign In

1. Go back to login page
2. Enter your credentials
3. Click "Sign In"
4. You should be redirected to dashboard

### 8.5 Verify User Created in Database

1. Go to **Table Editor** → `users`
2. You should see a row with your email
3. The `supabase_user_id` column should be populated (if trigger is set up) or NULL (if using API)

---

## Step 9: (Optional) Configure Email Settings

### 9.1 SMTP Settings (For Production)

If you want to send real emails:

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider (SendGrid, Mailgun, etc.)
3. Or use Supabase's built-in email (limited on free tier)

**For testing**: You can disable email confirmation in **Authentication** → **Providers** → **Email** → **Confirm email: OFF**

---

## Step 10: Verify Everything Works

### 10.1 Complete Test Flow

1. ✅ Sign up new user
2. ✅ Check user appears in Supabase Auth
3. ✅ Check user appears in database `users` table
4. ✅ Sign in successfully
5. ✅ Dashboard loads (may show welcome screen)
6. ✅ Purchase challenge works
7. ✅ Dashboard shows challenge data

### 10.2 Check Environment Variables

Make sure `.env.local` has:

```bash
# Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
PGSSLMODE=require

# Supabase Auth (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
```

---

## 🎯 Quick Checklist

- [ ] Added `supabase_user_id` column to `users` table (Step 1)
- [ ] Enabled Email/Password authentication (Step 2)
- [ ] Added Supabase credentials to `.env.local` (Step 3)
- [ ] Restarted dev server after adding env vars
- [ ] Tested sign up
- [ ] Tested sign in
- [ ] Verified user appears in database

---

## 🐛 Troubleshooting

**"Supabase URL is required" error:**
- ✅ Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ Restart dev server after adding env vars
- ✅ Make sure no typos in variable names

**"Email already registered" but can't sign in:**
- ✅ Check **Authentication** → **Users** in Supabase
- ✅ Try resetting password
- ✅ Or delete user and recreate

**User created in Auth but not in database:**
- ✅ This is normal - user is created via API on first dashboard visit
- ✅ Check browser console for errors
- ✅ Verify `/api/user` endpoint is working

**Can't sign up:**
- ✅ Check Email provider is enabled in Supabase
- ✅ Check email confirmation settings
- ✅ Try a different email address

---

## ✅ You're Done!

Once you complete Steps 1-3, authentication should work. The remaining steps are optional enhancements.

**Minimum Required:**
1. Add `supabase_user_id` column (Step 1)
2. Enable Email auth (Step 2)
3. Add credentials to `.env.local` (Step 3)
4. Restart dev server

That's it! 🎉

