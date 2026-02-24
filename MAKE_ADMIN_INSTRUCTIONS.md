# How to Make Yourself Admin

## Your Email: `Bentradeceo@gmail.com`

## Method 1: Using the Script (Easiest) ⭐

1. **Open your terminal** in the project directory

2. **Run the script:**
   ```bash
   node scripts/make-admin.js Bentradeceo@gmail.com
   ```

3. **Done!** You should see:
   ```
   ✅ Success! User is now an admin
   ```

4. **Access the admin panel:**
   - Go to: `http://localhost:3000/admin`
   - Or click "Admin" in the navigation bar (it will appear automatically)

---

## Method 2: Direct SQL (If script doesn't work)

### Option A: Using psql (PostgreSQL command line)

1. **Connect to your database:**
   ```bash
   psql -h your-host -U your-username -d your-database
   ```

2. **Run this SQL command:**
   ```sql
   UPDATE users 
   SET role = 'admin', updated_at = NOW() 
   WHERE email = 'Bentradeceo@gmail.com';
   ```

3. **Verify it worked:**
   ```sql
   SELECT id, email, role FROM users WHERE email = 'Bentradeceo@gmail.com';
   ```

### Option B: Using a Database GUI (pgAdmin, DBeaver, etc.)

1. **Connect to your database**

2. **Open a SQL query window**

3. **Run this SQL:**
   ```sql
   UPDATE users 
   SET role = 'admin', updated_at = NOW() 
   WHERE email = 'Bentradeceo@gmail.com';
   ```

4. **Verify:**
   ```sql
   SELECT id, email, role FROM users WHERE email = 'Bentradeceo@gmail.com';
   ```
   You should see `role = 'admin'`

---

## Method 3: Using Supabase Dashboard (If using Supabase)

1. **Go to your Supabase project dashboard**

2. **Navigate to:** Table Editor → `users` table

3. **Find your row** (search for `Bentradeceo@gmail.com`)

4. **Edit the `role` field** and change it to `admin`

5. **Save**

---

## Verification

After making yourself admin:

1. **Log out and log back in** (to refresh your session)

2. **Check the navigation bar** - you should see an "Admin" link

3. **Go to:** `http://localhost:3000/admin`

4. **You should see the admin panel** with Users, Trades, and Challenges tabs

---

## Troubleshooting

### "User not found" error
- Make sure you've signed up and logged in at least once
- The user must exist in the `users` table first
- Check your email spelling (case-insensitive, but double-check)

### "Cannot access admin panel" after making admin
- **Log out and log back in** - this refreshes your session
- Clear browser cookies and try again
- Check that the `role` field was actually updated in the database

### Script doesn't work
- Make sure you're in the project root directory
- Check that your database connection is configured in `.env.local`
- Try Method 2 (Direct SQL) instead

---

## Quick Copy-Paste SQL

```sql
-- Make yourself admin
UPDATE users 
SET role = 'admin', updated_at = NOW() 
WHERE email = 'Bentradeceo@gmail.com';

-- Verify (should show role = 'admin')
SELECT id, email, role, created_at 
FROM users 
WHERE email = 'Bentradeceo@gmail.com';
```

---

## Need Help?

If none of these methods work, check:
1. Your database connection settings in `.env.local`
2. That the `users` table exists and has a `role` column
3. That your email is exactly `Bentradeceo@gmail.com` (check for typos)
