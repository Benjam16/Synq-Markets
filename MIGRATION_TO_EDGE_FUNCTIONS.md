# Migration Guide: Python Scripts → Supabase Edge Functions + Vercel Cron

## 🎯 Overview

This guide helps you migrate from Python background workers to:
- **Supabase Edge Functions** (for risk engine)
- **Vercel Cron Jobs** (for scheduled tasks)

---

## 📁 New Folder Structure

```
prop-market/
├── supabase/
│   ├── functions/
│   │   └── risk-engine/
│   │       ├── index.ts          # Risk engine logic
│   │       └── README.md
│   ├── config.toml               # Supabase CLI config
│   └── README.md
├── app/
│   └── api/
│       └── cron/
│           ├── drawdown-check/
│           │   └── route.ts      # Calls Supabase Edge Function
│           └── midnight-reset/
│               └── route.ts      # Direct database update
└── vercel.json                    # Cron job configuration
```

---

## 🔄 Migration Steps

### Step 1: Install Supabase CLI

**On macOS (Recommended):**
```bash
brew install supabase/tap/supabase
```

**Alternative (if Homebrew not available):**
```bash
# Install as dev dependency
npm install supabase --save-dev
# Then use: npx supabase
```

### Step 2: Login and Link Project

```bash
# Login to Supabase
supabase login

# Link to your project (get project ref from Supabase Dashboard)
supabase link --project-ref your-project-ref-id
```

### Step 3: Deploy Risk Engine Function

```bash
# Deploy the risk engine Edge Function
supabase functions deploy risk-engine
```

### Step 4: Set Up Vercel Cron Jobs

The cron jobs are already configured in `vercel.json`:

- **Drawdown Check:** Every 2 minutes (`*/2 * * * *`)
- **Midnight Reset:** Daily at 4 AM UTC (`0 4 * * *`) - Adjust timezone as needed

### Step 5: Add Environment Variables

In **Vercel Dashboard → Settings → Environment Variables**, add:

```bash
# Required for cron jobs
CRON_SECRET=your-random-secret-key-here  # Generate a random string

# Supabase (should already be set)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Generate CRON_SECRET:**
```bash
# Generate a random secret
openssl rand -hex 32
```

### Step 6: Test Locally

```bash
# Test risk engine function locally
supabase functions serve risk-engine

# In another terminal, test the cron endpoints
curl http://localhost:54321/functions/v1/risk-engine \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## 🔍 What Changed

### Before (Python Scripts):

```bash
# Had to run separately
python3 scripts/drawdown_monitor.py      # Every 2 minutes
python3 scripts/midnight_reset.py        # Daily at midnight
```

### After (Edge Functions + Cron):

```typescript
// Supabase Edge Function (risk-engine)
// Called by Vercel Cron → /api/cron/drawdown-check
// Runs every 2 minutes automatically

// Vercel Cron Job (midnight-reset)
// Runs daily at 4 AM UTC automatically
// No separate hosting needed!
```

---

## ✅ Benefits

1. **No Separate Hosting:** Everything runs on Vercel + Supabase
2. **Automatic Scaling:** Edge Functions scale automatically
3. **Better Monitoring:** Logs in Supabase Dashboard
4. **Type Safety:** TypeScript instead of Python
5. **Integrated:** All in one codebase
6. **Cost Effective:** Free tier covers most use cases

---

## 🧪 Testing

### Test Risk Engine:

```bash
# Via Supabase CLI
supabase functions invoke risk-engine

# Via HTTP (from your app)
curl -X POST https://your-project.supabase.co/functions/v1/risk-engine \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Test Cron Jobs:

```bash
# Drawdown check
curl https://your-app.vercel.app/api/cron/drawdown-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Midnight reset
curl https://your-app.vercel.app/api/cron/midnight-reset \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 📊 Monitoring

### Supabase Edge Functions:
- **Dashboard:** Supabase Dashboard → Edge Functions → risk-engine → Logs
- **CLI:** `supabase functions logs risk-engine`

### Vercel Cron Jobs:
- **Dashboard:** Vercel Dashboard → Your Project → Cron Jobs
- **Logs:** Vercel Dashboard → Deployments → Function Logs

---

## 🔒 Security

### Cron Job Security:

The cron endpoints verify requests using `CRON_SECRET`:

```typescript
const authHeader = req.headers.get("authorization");
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Vercel automatically adds the Authorization header when calling cron jobs**, but you can also call them manually with the secret.

### Edge Function Security:

Edge Functions use Supabase Service Role Key for authentication. This key has admin access, so keep it secure!

---

## 🚀 Deployment Checklist

- [ ] Supabase CLI installed
- [ ] Project linked (`supabase link`)
- [ ] Risk engine function deployed (`supabase functions deploy risk-engine`)
- [ ] Environment variables set in Vercel:
  - [ ] `CRON_SECRET`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `vercel.json` configured with cron schedules
- [ ] Tested locally
- [ ] Deployed to Vercel
- [ ] Verified cron jobs are running (check Vercel Dashboard)

---

## 📝 Next Steps

1. **Deploy to Vercel** - Cron jobs will start automatically
2. **Monitor Logs** - Check both Supabase and Vercel logs
3. **Remove Python Scripts** - Once confirmed working, you can delete:
   - `scripts/drawdown_monitor.py`
   - `scripts/midnight_reset.py`
   - `scripts/run_all_workers.sh` (if only running these)

---

## 🆘 Troubleshooting

### "Function not found"
- Make sure you've deployed: `supabase functions deploy risk-engine`
- Check project is linked: `supabase link --project-ref your-ref`

### "Unauthorized" in cron jobs
- Verify `CRON_SECRET` is set in Vercel
- Check the Authorization header format

### "Database connection error"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check Supabase project is active

---

**Last Updated:** Today
**Status:** ✅ Ready for Migration
