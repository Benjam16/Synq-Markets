# Enable Trigger - Permission Workaround

## 🚨 Problem

You're getting: `ERROR: 42501: must be owner of table users`

This happens because `auth.users` is a system table managed by Supabase Auth, and regular database users don't have permission to modify triggers on it.

---

## ✅ Solution Options

### Option 1: Use Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard** → Your Project
2. **Click "Database"** in the left sidebar
3. **Click "Triggers"** (or look for trigger management)
4. **Find** `on_auth_user_created` trigger
5. **Enable it** using the toggle/button

**Note:** If you don't see a Triggers section, try Option 2.

---

### Option 2: Contact Supabase Support

If you can't enable it through the dashboard:

1. Go to **Supabase Dashboard** → **Support**
2. Ask them to enable the trigger: `on_auth_user_created` on `auth.users` table
3. They can do it with elevated permissions

---

### Option 3: Workaround - Make API Route Handle It

Since the trigger is disabled, we can make the API route more robust to handle user creation. The current code already tries to create users, but we can improve error handling.

**The current flow:**
1. User signs up → Supabase Auth user created ✅
2. Trigger should create database user → ❌ (disabled)
3. User tries to purchase challenge → API tries to create user → Sometimes fails

**Better approach:** The API route already handles this, but we can add retry logic and better error messages.

---

### Option 4: Recreate Trigger with Proper Permissions

If you have database admin access, you can drop and recreate the trigger:

```sql
-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate with proper permissions
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
```

**Note:** This still requires elevated permissions.

---

## 🎯 Recommended: Use Option 1 (Dashboard)

The easiest way is to use Supabase Dashboard if they have a trigger management UI. If not, Option 3 (workaround) is the most practical since it doesn't require special permissions.

---

## 📝 Current Status

- ✅ Trigger exists: `on_auth_user_created`
- ❌ Trigger status: DISABLED (`tgenabled = 0`)
- ❌ Permission: Can't enable directly (need owner/admin)

**Next step:** Try Supabase Dashboard first, then use workaround if needed.
