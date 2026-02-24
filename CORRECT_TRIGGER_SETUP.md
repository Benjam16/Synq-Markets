# Correct Trigger Setup - Step by Step

## ❌ Why Gemini's Solution is Wrong

**Gemini suggested:**
- Creates `user_accounts` table (doesn't exist in your schema)
- Auto-creates challenge subscriptions (users should PURCHASE challenges)
- Gives everyone $100k automatically (not your business model)

**Your actual flow:**
1. User signs up → Creates Supabase Auth user
2. Trigger creates user in `users` table ✅
3. User PURCHASES challenge → Creates `challenge_subscriptions` row
4. User can then trade

---

## ✅ Correct Solution

### Step 1: Use the Correct Trigger Function

The correct function already exists in `db/supabase_migrations.sql`. Here's what it should do:

```sql
-- This creates a user in the users table (NOT a challenge subscription)
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
  SET supabase_user_id = COALESCE(users.supabase_user_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**What this does:**
- ✅ Creates user in `users` table when they sign up
- ✅ Links Supabase Auth user ID to database user
- ✅ Does NOT create challenge subscriptions (users purchase those)
- ✅ Handles duplicate emails gracefully

---

### Step 2: Enable the Trigger (Permission Issue)

Since you can't enable it directly due to permissions, here are your options:

#### Option A: Contact Supabase Support (Recommended)

1. Go to Supabase Dashboard → Support
2. Ask them to run:
   ```sql
   ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
   ```
3. They have the permissions to do this

#### Option B: Use Supabase Dashboard

1. Go to Supabase Dashboard → Database → Triggers
2. Find `on_auth_user_created`
3. Enable it using the UI

#### Option C: Workaround - API Route Handles It

Since the trigger is disabled, your API route (`/api/user`) already handles user creation. The error might be happening because of race conditions or duplicate key errors.

---

## 🔧 Step-by-Step: Fix the "Create User Error"

### Current Problem

1. User signs up → Supabase Auth user created ✅
2. Trigger should create `users` row → ❌ (trigger disabled)
3. User tries to purchase challenge → API tries to create user → Sometimes fails

### Solution: Improve API Route Error Handling

The API route already tries to create users, but we can make it more robust:

**Current code in `/app/api/user/route.ts`:**
- Checks if user exists
- Creates user if doesn't exist
- But might fail on race conditions or duplicate keys

**Improvements needed:**
1. Add retry logic (wait for trigger, then retry)
2. Better error handling for duplicate keys
3. Use UPSERT pattern more robustly

---

## 📋 Complete Setup Steps

### Step 1: Verify Trigger Function Exists

Run in Supabase SQL Editor:
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

**Expected:** Should return the function definition

**If empty:** Run the function creation SQL from `db/supabase_migrations.sql` (lines 23-37)

---

### Step 2: Verify Trigger Exists

Run in Supabase SQL Editor:
```sql
SELECT 
  tgname as trigger_name,
  CASE tgenabled
    WHEN 0 THEN 'DISABLED'
    WHEN 1 THEN 'ENABLED'
  END as status
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

**Current status:** DISABLED (you saw this)

---

### Step 3: Enable Trigger (Choose One Method)

**Method 1: Supabase Support**
- Contact them to enable the trigger

**Method 2: Supabase Dashboard**
- Use UI if available

**Method 3: Workaround**
- Improve API route to handle disabled trigger gracefully

---

### Step 4: Test the Flow

1. **Sign up a new user:**
   - Go to `/login`
   - Click "Sign up"
   - Create account

2. **Check if user was created:**
   - Go to Supabase Dashboard → Table Editor → `users`
   - Should see new user

3. **Test challenge purchase:**
   - Go to `/challenges`
   - Click "Purchase Challenge"
   - Should work without "Failed to create user" error

---

## 🎯 For Different Account Sizes

**Important:** Users DON'T automatically get accounts. They PURCHASE challenges.

**The flow:**
1. User signs up → Gets entry in `users` table (no account yet)
2. User goes to `/challenges` page
3. User selects tier (Scout, Analyst, Strategist, Whale)
4. User clicks "Purchase Challenge"
5. System creates `challenge_subscriptions` row with selected tier's account size

**Account sizes are determined by:**
- The `account_tiers` table (Scout = $10k, Analyst = $25k, Strategist = $50k, Whale = $100k)
- User's choice when purchasing
- NOT by the trigger

---

## ✅ Summary

**Correct approach:**
- ✅ Trigger creates user in `users` table
- ✅ User purchases challenge → Creates `challenge_subscriptions`
- ✅ Account size based on tier they purchase

**Wrong approach (Gemini's):**
- ❌ Auto-creates challenge subscriptions
- ❌ Gives everyone $100k
- ❌ Uses wrong table names

**Next step:** Enable the trigger (contact Supabase support) OR improve API route error handling.
