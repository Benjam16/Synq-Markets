# Supabase Connection Fix

## Issue
"Failed to fetch" error when trying to login or create account.

## Root Cause
The Supabase URL in your `.env.local` file cannot be resolved. This typically means:
1. The Supabase project doesn't exist or was deleted
2. The project is paused (free tier projects pause after inactivity)
3. The URL is incorrect

## Solution

### Step 1: Verify Your Supabase Project
1. Go to https://supabase.com
2. Log in to your account
3. Check if your project `iphqnpapflhznzsaqkah` exists and is active
4. If the project is paused, click "Restore project" or create a new one

### Step 2: Get Correct Credentials
1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the **Project URL** (should look like `https://xxxxx.supabase.co`)
3. Copy the **anon/public** key

### Step 3: Update .env.local
Update your `.env.local` file with the correct values:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-actual-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-actual-anon-key"
```

### Step 4: Restart Dev Server
After updating `.env.local`, you MUST restart your Next.js dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 5: Test Connection
Try logging in again. If you still get errors, check:
- Browser console for detailed error messages
- Network tab to see the actual request/response
- That your Supabase project has Authentication enabled

## Alternative: Create New Supabase Project
If your project doesn't exist:

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in project details
4. Wait for project to be created
5. Copy the new Project URL and anon key
6. Update `.env.local` with new values
7. Restart dev server

