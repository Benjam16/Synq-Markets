# Quick Admin Setup for Bentradeceo@gmail.com

## ⚡ FASTEST METHOD: Run This Command

Open your terminal in the project root and run:

```bash
node scripts/make-admin.js Bentradeceo@gmail.com
```

That's it! Then log out and log back in, and you'll see the "Admin" link in the navigation.

---

## 📋 Alternative: Direct SQL Command

If the script doesn't work, run this SQL directly in your database:

```sql
UPDATE users 
SET role = 'admin', updated_at = NOW() 
WHERE email = 'Bentradeceo@gmail.com';
```

Then verify it worked:

```sql
SELECT id, email, role FROM users WHERE email = 'Bentradeceo@gmail.com';
```

You should see `role = 'admin'`

---

## 🔍 How to Run SQL

### Option 1: Using psql (PostgreSQL CLI)
```bash
psql $DATABASE_URL
```
Then paste the SQL command above.

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project
2. Click "SQL Editor"
3. Paste the SQL command
4. Click "Run"

### Option 3: Using a Database GUI
- pgAdmin, DBeaver, TablePlus, etc.
- Connect to your database
- Run the SQL command

---

## ✅ After Making Yourself Admin

1. **Log out** of your account
2. **Log back in** (this refreshes your session)
3. **Look for "Admin" link** in the navigation bar
4. **Go to:** `http://localhost:3000/admin`

---

## 🐛 Troubleshooting

**"User not found" error?**
- Make sure you've signed up and logged in at least once
- Your email must exist in the `users` table

**Still can't access admin panel?**
- Log out and log back in
- Clear browser cookies
- Check that `role = 'admin'` in the database

**Script doesn't work?**
- Make sure `DATABASE_URL` is in your `.env.local` file
- Try the direct SQL method instead
