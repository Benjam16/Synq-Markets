# Update Workflow - Step-by-Step Guide

## 🚀 Standard Update Process

### **1. Local Development**

```bash
# Navigate to project
cd /Users/oneilbenjamin/prop-market

# Pull latest changes
git pull origin master

# Install dependencies (if package.json changed)
npm install

# Start dev server
npm run dev
```

**Visit:** http://localhost:3000

---

### **2. Make Your Changes**

#### **Frontend (UI/Components)**
- Edit files in `app/` directory
- Changes hot-reload automatically
- Test in browser immediately

#### **Backend (API Routes)**
- Edit files in `app/api/` directory
- May need to restart dev server
- Test API endpoints with Postman/curl

#### **Database**
- Create SQL migration files
- Test locally first
- Run on Supabase before deploying

---

### **3. Test Your Changes**

#### **Essential Tests:**
```bash
# 1. Check for TypeScript errors
npm run build

# 2. Test production build locally
npm start

# 3. Test on mobile (use browser dev tools)
# 4. Test authentication flows
# 5. Test affected features
```

#### **Checklist:**
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Mobile responsive (if UI change)
- [ ] Authentication works
- [ ] Database operations work
- [ ] API endpoints respond correctly

---

### **4. Commit Changes**

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: [what you added]"
# OR
git commit -m "Fix: [what you fixed]"
# OR
git commit -m "Update: [what you updated]"

# Push to GitHub
git push origin master
```

**Commit Message Examples:**
- ✅ `"Add dark mode toggle to settings"`
- ✅ `"Fix mobile layout on dashboard"`
- ✅ `"Update risk engine to check daily drawdown"`
- ❌ `"fix"` (too vague)
- ❌ `"changes"` (not descriptive)

---

### **5. Vercel Auto-Deployment**

1. **Vercel detects** new commit automatically
2. **Starts deployment** (~2-3 minutes)
3. **Monitor:**
   - Go to Vercel Dashboard → Deployments
   - Click on new deployment
   - Watch build logs
   - Wait for "Ready" status

---

### **6. Verify on Live Site**

1. **Visit:** Your Vercel URL
2. **Test:** The changes you made
3. **Check:**
   - Browser console (F12)
   - Network tab for errors
   - Functionality works as expected

---

## 🔧 Common Update Types

### **Type 1: UI/Design Changes**

**Files to edit:**
- `app/[page]/page.tsx` - Page components
- `app/components/[Component].tsx` - Reusable components
- `app/globals.css` - Global styles

**Process:**
1. Edit component/style file
2. Test in browser (hot reload)
3. Test on mobile
4. Commit and push

**Example:**
```bash
# Edit dashboard styling
# File: app/dashboard/page.tsx

# Test locally
npm run dev

# Commit
git add app/dashboard/page.tsx
git commit -m "Update dashboard card styling"
git push origin master
```

---

### **Type 2: Add New Feature**

**Steps:**
1. Create new page/component
2. Add API route (if needed)
3. Update navigation (if needed)
4. Test thoroughly
5. Commit and push

**Example:**
```bash
# 1. Create new page
# File: app/new-feature/page.tsx

# 2. Add API route (if needed)
# File: app/api/new-feature/route.ts

# 3. Update navigation
# File: app/components/Layout.tsx

# 4. Test
npm run dev
npm run build

# 5. Commit
git add .
git commit -m "Add new feature: [feature name]"
git push origin master
```

---

### **Type 3: Fix Bug**

**Steps:**
1. Identify the bug
2. Locate the problematic code
3. Fix it
4. Test the fix
5. Commit with clear message

**Example:**
```bash
# Fix bug in trade execution
# File: app/api/buy/route.ts

# Test fix
npm run dev
# Test the specific bug scenario

# Commit
git add app/api/buy/route.ts
git commit -m "Fix: Trade execution error when balance is zero"
git push origin master
```

---

### **Type 4: Update Environment Variables**

**No code changes needed!**

1. Go to **Vercel Dashboard** → Your Project
2. **Settings** → **Environment Variables**
3. **Add/Edit** variable
4. **Save**
5. **Redeploy** (Vercel will prompt)

**Note:** Changes take effect after redeploy

---

### **Type 5: Database Changes**

**Steps:**
1. Create migration SQL file
2. Test locally
3. Run on Supabase
4. Update code to use new schema
5. Test and deploy

**Example:**
```bash
# 1. Create migration
# File: db/migrations/001_add_column.sql
# ALTER TABLE users ADD COLUMN new_field TEXT;

# 2. Test locally (if you have local DB)
psql $DATABASE_URL -f db/migrations/001_add_column.sql

# 3. Run on Supabase
# Go to Supabase Dashboard → SQL Editor
# Copy/paste migration SQL
# Run it

# 4. Update code
# File: app/api/user/route.ts
# Add new field handling

# 5. Test and commit
npm run dev
git add .
git commit -m "Add new_field to users table"
git push origin master
```

---

## 🚨 Emergency Rollback

If something breaks after deployment:

### **Quick Rollback:**
1. Go to **Vercel Dashboard** → **Deployments**
2. Find the **previous working deployment**
3. Click **"..."** (three dots)
4. Click **"Promote to Production"**
5. Site reverts to previous version

### **Fix and Redeploy:**
1. Fix the issue locally
2. Test thoroughly
3. Commit and push
4. New deployment will replace broken one

---

## 📝 Best Practices

### **Before Every Update:**

1. **Pull latest code:**
   ```bash
   git pull origin master
   ```

2. **Test locally:**
   ```bash
   npm run dev
   ```

3. **Build test:**
   ```bash
   npm run build
   ```

4. **Check for errors:**
   - TypeScript errors
   - Console errors
   - Build errors

### **Commit Best Practices:**

- ✅ **Descriptive messages:** "Add dark mode toggle"
- ✅ **Reference features:** "Update risk engine logic"
- ✅ **Mention affected areas:** "Fix mobile layout on dashboard"
- ❌ **Avoid:** "fix", "update", "changes" (too vague)

### **Deployment Best Practices:**

- ✅ **Test before pushing**
- ✅ **Monitor build logs**
- ✅ **Verify on live site**
- ✅ **Check mobile after UI changes**
- ❌ **Don't deploy untested code**
- ❌ **Don't skip testing**

---

## 🔍 Quick Reference

### **File Locations:**

**Pages:**
- Landing: `app/page.tsx`
- Dashboard: `app/dashboard/page.tsx`
- Markets: `app/markets/page.tsx`
- Accounts: `app/accounts/page.tsx`
- Risk: `app/risk/page.tsx`
- Portal: `app/portal/page.tsx`
- Admin: `app/admin/page.tsx`

**API Routes:**
- Dashboard: `app/api/dashboard/route.ts`
- Buy: `app/api/buy/route.ts`
- Sell: `app/api/sell/route.ts`
- Markets: `app/api/markets/route.ts`

**Components:**
- Layout: `app/components/Layout.tsx`
- Trade Panel: `app/components/TradePanel.tsx`
- Charts: `app/components/EquityChart.tsx`

**Configuration:**
- Next.js: `next.config.ts`
- Vercel: `vercel.json`
- TypeScript: `tsconfig.json`

---

## 🎯 Update Checklist

Before pushing any update:

- [ ] Code tested locally
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Mobile tested (if UI change)
- [ ] Authentication works
- [ ] Database operations work
- [ ] Commit message is descriptive
- [ ] Ready to push

---

**Last Updated:** Today
**Status:** ✅ Ready for Updates
