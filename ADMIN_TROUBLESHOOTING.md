# Admin Panel Troubleshooting

## Quick Fixes

### 1. Log Out and Log Back In
**Most Common Solution:**
- Click the logout button
- Log back in with your email
- The admin link should appear in the navigation

### 2. Verify Your Role in Database
Run this SQL to check your role:
```sql
SELECT id, email, role FROM users WHERE email = 'Bentradeceo@gmail.com';
```

You should see `role = 'admin'`. If not, run:
```sql
UPDATE users SET role = 'admin' WHERE email = 'Bentradeceo@gmail.com';
```

### 3. Check Browser Console
Open DevTools (F12) → Console tab, look for:
```
[Layout] Admin check result: { isAdmin: true/false, ... }
```

### 4. Direct Access
Try going directly to: `http://localhost:3000/admin`

If you see "Unauthorized", the auth check is working but your role isn't admin.
If you see the admin panel, the link just isn't showing (UI issue).

### 5. Clear Browser Cache
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or clear cookies and cache

## Debug Steps

### Step 1: Verify Database
```sql
-- Check your user
SELECT id, email, role, supabase_user_id 
FROM users 
WHERE email = 'Bentradeceo@gmail.com';
```

### Step 2: Test Admin Check API
Open browser console and run:
```javascript
fetch('/api/admin/check?email=Bentradeceo@gmail.com')
  .then(r => r.json())
  .then(console.log);
```

Should return: `{ isAdmin: true, role: 'admin', email: '...' }`

### Step 3: Check Navigation
The admin link should appear in the navigation bar if:
- You're logged in (`user` exists)
- `isAdmin` is `true`
- The check API returns `isAdmin: true`

## Common Issues

### Issue: "Admin link not showing"
**Solution:**
1. Log out and log back in
2. Check browser console for admin check result
3. Verify role in database

### Issue: "Unauthorized" when accessing /admin
**Solution:**
1. Your role isn't set to 'admin' in database
2. Run the SQL update command above
3. Log out and log back in

### Issue: "Admin check returns false"
**Possible causes:**
- Email doesn't match exactly (case-sensitive in some cases)
- User doesn't exist in database
- Role isn't 'admin' or 'risk'

**Solution:**
```sql
-- Make absolutely sure
UPDATE users 
SET role = 'admin', updated_at = NOW() 
WHERE LOWER(email) = LOWER('Bentradeceo@gmail.com');

-- Verify
SELECT email, role FROM users WHERE LOWER(email) = LOWER('Bentradeceo@gmail.com');
```

## Still Not Working?

1. **Check server logs** - Look for `[Admin Check]` or `[Admin Auth]` messages
2. **Verify Supabase is configured** - If not, the fallback email check should work
3. **Try direct database update** - Use the SQL commands above
4. **Restart your dev server** - Sometimes helps refresh auth state
