# Next Steps: Deploy Edge Functions

## ✅ Step 1: Supabase CLI Installed

You now have Supabase CLI v2.72.7 installed!

---

## 🚀 Step 2: Login to Supabase

```bash
supabase login
```

This will open your browser to authenticate with Supabase.

---

## 🔗 Step 3: Link Your Project

```bash
# Get your project reference ID from:
# Supabase Dashboard → Settings → General → Reference ID
# (It looks like: xxxxxx)

supabase link --project-ref your-project-ref-id
```

---

## 📦 Step 4: Deploy Risk Engine Function

```bash
supabase functions deploy risk-engine
```

This will:
- Upload the function to Supabase
- Make it available at: `https://your-project.supabase.co/functions/v1/risk-engine`

---

## ⚙️ Step 5: Set Up Vercel Cron

1. **Add Environment Variable to Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `CRON_SECRET` = (generate with: `openssl rand -hex 32`)

2. **Deploy to Vercel:**
   - Push code to GitHub
   - Vercel will auto-deploy
   - Cron jobs will start automatically

---

## 🧪 Step 6: Test Everything

### Test Edge Function:
```bash
supabase functions invoke risk-engine
```

### Test Cron Jobs:
After deploying to Vercel, check:
- Vercel Dashboard → Cron Jobs (should show execution history)
- Or test manually:
  ```bash
  curl https://your-app.vercel.app/api/cron/drawdown-check \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```

---

## 📊 Step 7: Monitor

### View Logs:
```bash
# Edge Function logs
supabase functions logs risk-engine

# Or in Supabase Dashboard:
# Edge Functions → risk-engine → Logs
```

### Vercel Cron Logs:
- Vercel Dashboard → Your Project → Cron Jobs
- Vercel Dashboard → Deployments → Function Logs

---

## ✅ You're Done!

Your risk engine is now:
- ✅ Running on Supabase Edge Functions
- ✅ Called automatically every 2 minutes via Vercel Cron
- ✅ No separate hosting needed!

---

**Need Help?** Check:
- `EDGE_FUNCTIONS_SETUP.md` - Detailed setup guide
- `MIGRATION_TO_EDGE_FUNCTIONS.md` - Migration details
