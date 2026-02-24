# Quick Deployment Checklist

## ✅ Pre-Deployment

- [ ] Code pushed to GitHub
- [ ] All environment variables ready
- [ ] Database schema run in Supabase
- [ ] Supabase Auth configured

---

## 🚀 Deploy to Vercel (5 minutes)

1. [ ] Go to https://vercel.com
2. [ ] Click "Add New Project"
3. [ ] Import GitHub repository
4. [ ] Vercel auto-detects Next.js
5. [ ] Add environment variables (see below)
6. [ ] Click "Deploy"

---

## ⚙️ Environment Variables (Vercel)

Add these in **Vercel Dashboard → Settings → Environment Variables**:

### **Required:**
```bash
DATABASE_URL=postgresql://...
PGSSLMODE=require
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-random-secret  # Generate: openssl rand -hex 32
```

### **Optional:**
```bash
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
KALSHI_ACCESS_KEY=your-key
KALSHI_PRIVATE_KEY=your-key
```

---

## 🔧 Deploy Supabase Edge Function (5 minutes)

```bash
# 1. Install CLI (macOS)
brew install supabase/tap/supabase

# Or as dev dependency:
# npm install supabase --save-dev

# 2. Login
supabase login

# 3. Link project (get ref ID from Supabase Dashboard)
supabase link --project-ref your-project-ref-id

# 4. Deploy
supabase functions deploy risk-engine
```

**That's it!** Edge Function is now live.

---

## ✅ Post-Deployment Verification

### **Test Edge Function:**
```bash
supabase functions invoke risk-engine
```

### **Test Cron Jobs:**
- Check Vercel Dashboard → Cron Jobs
- Should show execution history
- Or test manually:
  ```bash
  curl https://your-app.vercel.app/api/cron/drawdown-check \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```

### **Verify Everything Works:**
- [ ] App loads at your Vercel URL
- [ ] Login/signup works
- [ ] Dashboard loads
- [ ] Trading works
- [ ] Risk engine runs (check logs)
- [ ] Cron jobs executing (check Vercel Dashboard)

---

## 📊 Monitoring

### **Vercel:**
- Dashboard → Your Project → Cron Jobs
- Dashboard → Deployments → Function Logs

### **Supabase:**
- Dashboard → Edge Functions → risk-engine → Logs
- Dashboard → Database → Logs

---

## 🎯 You're Live!

Your app is now running on:
- **Frontend + API:** Vercel (free tier)
- **Database + Auth:** Supabase (free tier)
- **Risk Engine:** Supabase Edge Functions (free tier)
- **Cron Jobs:** Vercel Cron (free tier)

**Total Cost:** $0/month (free tier) 🎉

---

**Need Help?** Check:
- `VERCEL_DEPLOYMENT_GUIDE.md` - Full deployment guide
- `EDGE_FUNCTIONS_SETUP.md` - Edge Functions setup
- `MIGRATION_TO_EDGE_FUNCTIONS.md` - Migration details
