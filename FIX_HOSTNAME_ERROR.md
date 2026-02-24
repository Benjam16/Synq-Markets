# Fix Hostname Error - DATABASE_URL Mismatch

## 🚨 Error: `getaddrinfo ENOTFOUND db.iphqnpapf1hznzsaqkah.supabase.co`

The error shows your `DATABASE_URL` has the wrong hostname!

**Error shows:** `db.iphqnpapf1hznzsaqkah.supabase.co` (has "1")
**Should be:** `db.iphqnpapflhznzsaqkah.supabase.co` (has "l")

---

## ✅ Quick Fix Steps

### Step 1: Get Correct Hostname from Supabase

1. **Go to:** https://supabase.com/dashboard
2. **Click:** Your project
3. **Go to:** Settings → Database
4. **Scroll to:** "Connection string" section
5. **Select:** "URI" tab
6. **Copy** the connection string

**The hostname in the connection string is the correct one!**

### Step 2: Update DATABASE_URL in Vercel

1. **Go to:** Vercel Dashboard → Your Project → Settings → Environment Variables
2. **Find:** `DATABASE_URL`
3. **Click:** Edit
4. **Check the hostname** in the current value
5. **Compare** with the connection string from Supabase
6. **Update** the hostname to match exactly
7. **Make sure** the password is correct (not `YOUR_PASSWORD` or placeholder)
8. **Click:** Save

### Step 3: Verify Format

Your `DATABASE_URL` should look like:
```
postgresql://postgres:[ACTUAL-PASSWORD]@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require
```

**Important checks:**
- ✅ Hostname matches Supabase Dashboard exactly
- ✅ Password is your actual password (not placeholder)
- ✅ Includes `?sslmode=require` at the end
- ✅ No typos in project ID

### Step 4: Redeploy

1. **Click:** "Redeploy" button (or go to Deployments → Redeploy)
2. **Wait:** 2-3 minutes
3. **Test:** Try purchasing a challenge again

---

## 🔍 How to Verify Correct Hostname

### Option 1: Check Supabase Dashboard

1. Supabase Dashboard → Settings → API
2. **Project URL** shows: `https://iphqnpapflhznzsaqkah.supabase.co`
3. **Database hostname** should be: `db.iphqnpapflhznzsaqkah.supabase.co`
4. Notice: "l" not "1" in the middle

### Option 2: Check Connection String

1. Supabase Dashboard → Settings → Database → Connection string (URI)
2. The hostname in the connection string is the correct one
3. Copy it exactly as shown

---

## ⚠️ Common Mistakes

### Mistake 1: Typo in Project ID
- ❌ `iphqnpapf1hznzsaqkah` (has "1")
- ✅ `iphqnpapflhznzsaqkah` (has "l")

### Mistake 2: Wrong Project
- If you have multiple Supabase projects, make sure you're using the right one
- Check the project ID matches your `NEXT_PUBLIC_SUPABASE_URL`

### Mistake 3: Old Connection String
- If you copied the connection string a while ago, get a fresh one
- Project IDs can change if project was paused/resumed

---

## ✅ After Fixing

1. **Redeploy** on Vercel
2. **Test** the site
3. **Try** purchasing a challenge
4. **Should work** without DNS errors

---

## 🆘 If Still Not Working

1. **Verify** Supabase project is active (not paused)
2. **Check** `NEXT_PUBLIC_SUPABASE_URL` matches the project
3. **Get** completely fresh connection string from Supabase
4. **Update** `DATABASE_URL` with fresh string
5. **Redeploy**
