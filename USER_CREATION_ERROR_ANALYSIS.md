# User Creation Error - Brainstorming Analysis

## 🔍 Current Flow Analysis

### Flow 1: User Signs Up
1. User goes to `/login` page
2. Clicks "Sign up"
3. Enters email/password
4. Calls `supabase.auth.signUp()` → Creates Supabase Auth user
5. **NO automatic database user creation in code** - relies on trigger
6. Redirects to dashboard

### Flow 2: User Purchases Challenge
1. User is logged in (Supabase Auth user exists)
2. Goes to `/challenges` page
3. Clicks "Purchase Challenge"
4. Code tries to GET `/api/user?email=...`
5. If 404 (user doesn't exist), tries POST `/api/user` to create
6. **"Failed to create user" error happens here**

---

## 🚨 Potential Root Causes

### Issue #1: Supabase Trigger Not Set Up ⚠️ **MOST LIKELY**

**Problem:**
- The database trigger `on_auth_user_created` might not be created
- Or the trigger function `handle_new_user()` might not exist
- This means when user signs up, no database user is created automatically

**How to Check:**
1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```
3. If empty, trigger doesn't exist

**How to Fix:**
- Run the migration: `db/supabase_migrations.sql` in Supabase SQL Editor
- Specifically, run the trigger creation part:
  ```sql
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  ```

---

### Issue #2: Trigger Function Permission Error

**Problem:**
- The trigger function `handle_new_user()` uses `SECURITY DEFINER`
- But it might not have permission to INSERT into `public.users` table
- Or it might not have access to `auth.users` table

**How to Check:**
1. Check Supabase logs for trigger errors
2. Go to Supabase Dashboard → Logs → Database Logs
3. Look for errors when a user signs up

**How to Fix:**
- Grant necessary permissions:
  ```sql
  GRANT INSERT ON public.users TO postgres;
  GRANT SELECT ON auth.users TO postgres;
  ```

---

### Issue #3: Race Condition

**Problem:**
- User signs up → Supabase Auth user created
- User immediately tries to purchase challenge
- Trigger hasn't finished creating database user yet
- API route tries to create user → fails because trigger is also trying to create it
- Or: API route checks for user → doesn't exist yet → tries to create → conflict

**Timeline:**
```
T+0ms:  User clicks "Sign up"
T+100ms: Supabase Auth user created
T+100ms: Trigger fires (async)
T+150ms: User redirected to dashboard
T+200ms: User clicks "Purchase Challenge"
T+250ms: API checks for user → Not found (trigger still running)
T+300ms: API tries to INSERT user
T+350ms: Trigger tries to INSERT user → CONFLICT!
```

**How to Check:**
- Check if error is "duplicate key" or "unique constraint violation"
- Check timing - does it work if you wait a few seconds?

**How to Fix:**
- Add retry logic with delay in `/app/challenges/page.tsx`
- Or use UPSERT in API route (INSERT ... ON CONFLICT DO NOTHING)

---

### Issue #4: Email Case Sensitivity Mismatch

**Problem:**
- Database uses `CITEXT` (case-insensitive)
- But Supabase Auth might store email in different case
- Trigger tries to insert with one case, API tries with another
- Or: User exists with different case, lookup fails

**Example:**
- Supabase Auth: `User@Example.com`
- Database lookup: `user@example.com`
- Should match (CITEXT), but might not in some queries

**How to Check:**
- Check if emails in `auth.users` match case with `users` table
- Run: `SELECT email FROM auth.users UNION SELECT email FROM users;`

**How to Fix:**
- Use `LOWER()` in all email comparisons (already done in some places)
- Ensure trigger uses `LOWER(NEW.email)`

---

### Issue #5: Database Connection Issues

**Problem:**
- `DATABASE_URL` might be incorrect in Vercel
- Or database might be paused/restoring
- API route can't connect to database

**How to Check:**
- Check Vercel runtime logs for database connection errors
- Test database connection manually

**How to Fix:**
- Verify `DATABASE_URL` in Vercel environment variables
- Check Supabase project status (not paused)

---

### Issue #6: Missing SUPABASE_SERVICE_ROLE_KEY

**Problem:**
- The API route doesn't use service role key (it's not needed for basic INSERT)
- But if RLS is enabled, it might block inserts
- Or if trigger needs service role permissions

**How to Check:**
- Check if RLS is enabled on `users` table
- Check Vercel env vars for `SUPABASE_SERVICE_ROLE_KEY`

**How to Fix:**
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- Disable RLS on `users` table (if using direct PostgreSQL connection)

---

### Issue #7: Trigger Function Error (Silent Failure)

**Problem:**
- Trigger function `handle_new_user()` might be throwing an error
- But error is silently caught/ignored
- User is created in Auth but not in database

**How to Check:**
1. Go to Supabase Dashboard → Logs → Database Logs
2. Look for errors when user signs up
3. Check for function errors

**How to Fix:**
- Fix the trigger function
- Add better error handling
- Check function exists: `SELECT * FROM pg_proc WHERE proname = 'handle_new_user';`

---

### Issue #8: Email Already Exists (Different User)

**Problem:**
- User tries to sign up with email that already exists in `users` table
- But doesn't exist in `auth.users` (maybe from old data)
- Signup creates auth user, trigger tries to insert → conflict
- API route also tries to insert → conflict

**How to Check:**
- Check if email exists in `users` but not in `auth.users`
- Run: `SELECT email FROM users WHERE email NOT IN (SELECT email FROM auth.users);`

**How to Fix:**
- Clean up orphaned users
- Or: Update trigger to handle this case better

---

## 🎯 Most Likely Issues (Ranked)

1. **#1: Supabase Trigger Not Set Up** (90% likely)
   - Trigger doesn't exist → No auto user creation → API route fails

2. **#3: Race Condition** (70% likely)
   - User signs up → immediately tries to purchase → trigger hasn't run yet

3. **#7: Trigger Function Error** (50% likely)
   - Trigger exists but fails silently → No user created

4. **#5: Database Connection** (30% likely)
   - DATABASE_URL wrong or database paused

5. **#4: Email Case Sensitivity** (20% likely)
   - Less likely since using CITEXT

---

## 🔧 Quick Diagnostic Steps

### Step 1: Check if Trigger Exists
```sql
-- Run in Supabase SQL Editor
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';
```

**Expected:** Should return 1 row
**If empty:** Trigger doesn't exist → **This is your problem!**

---

### Step 2: Check if Function Exists
```sql
-- Run in Supabase SQL Editor
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

**Expected:** Should return function definition
**If empty:** Function doesn't exist → **This is your problem!**

---

### Step 3: Test Trigger Manually
```sql
-- Create a test auth user (if you have permission)
-- Then check if user was created in users table
SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
```

**Expected:** Should see recently created users
**If not:** Trigger not working → **This is your problem!**

---

### Step 4: Check Database Logs
1. Go to Supabase Dashboard → Logs → Database Logs
2. Sign up a new user
3. Look for errors in logs

**Expected:** No errors
**If errors:** See error message → **This tells you the problem!**

---

### Step 5: Check Vercel Runtime Logs
1. Go to Vercel Dashboard → Your Project → Logs
2. Try to purchase a challenge
3. Look for "Failed to create user" error
4. Check the full error message

**Expected:** Should see detailed error
**If generic:** Check database connection

---

## ✅ Recommended Fix (Without Breaking Anything)

**If trigger doesn't exist:**
1. Go to Supabase SQL Editor
2. Run `db/supabase_migrations.sql` (the trigger part)
3. Test signup again

**If trigger exists but fails:**
1. Check Supabase logs for errors
2. Fix the trigger function based on error
3. Test signup again

**If race condition:**
1. Add small delay in challenge purchase flow
2. Or: Use UPSERT in API route (INSERT ... ON CONFLICT DO NOTHING)

---

## 📝 Summary

**Most likely:** Supabase trigger is not set up, so users aren't auto-created when they sign up.

**Quick test:** Sign up a user, then check Supabase Table Editor → `users` table. If user doesn't exist, trigger is not working.

**Quick fix:** Run the trigger creation SQL from `db/supabase_migrations.sql` in Supabase SQL Editor.
