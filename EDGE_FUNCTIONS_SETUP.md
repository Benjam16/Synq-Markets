# Supabase Edge Functions Setup Guide

## 📁 Folder Structure Created

```
prop-market/
├── supabase/
│   ├── functions/
│   │   └── risk-engine/
│   │       ├── index.ts          # Risk engine Edge Function
│   │       └── README.md
│   ├── config.toml                # Supabase CLI configuration
│   └── README.md
├── app/
│   └── api/
│       └── cron/
│           ├── drawdown-check/
│           │   └── route.ts      # Vercel Cron → Calls Edge Function
│           └── midnight-reset/
│               └── route.ts      # Vercel Cron → Direct DB update
└── vercel.json                     # Cron job schedules
```

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Supabase CLI

**On macOS (Recommended):**
```bash
brew install supabase/tap/supabase
```

**Alternative (if Homebrew not available):**
```bash
# Install as dev dependency in your project
npm install supabase --save-dev

# Then use: npx supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

### Step 3: Link Your Project

```bash
# Get your project reference ID from:
# Supabase Dashboard → Settings → General → Reference ID

supabase link --project-ref your-project-ref-id
```

### Step 4: Deploy Risk Engine Function

```bash
supabase functions deploy risk-engine
```

**That's it!** The function is now deployed.

---

## ⚙️ Environment Variables

Supabase Edge Functions automatically have access to:
- `SUPABASE_URL` - Your project URL (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-set)

**No manual configuration needed!**

---

## 🔄 How It Works

### Risk Engine Flow:

```
Vercel Cron (every 2 min)
    ↓
/api/cron/drawdown-check
    ↓
Supabase Edge Function (risk-engine)
    ↓
Checks all active accounts
    ↓
Updates status if limits breached
```

### Midnight Reset Flow:

```
Vercel Cron (daily at 4 AM UTC)
    ↓
/api/cron/midnight-reset
    ↓
Direct database update
    ↓
Snapshots balances & resets day_start_balance
```

---

## 🧪 Testing

### Test Edge Function Locally:

```bash
# Start local Supabase (optional, for testing)
supabase start

# Serve function locally
supabase functions serve risk-engine

# In another terminal, test it
curl -X POST http://localhost:54321/functions/v1/risk-engine \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Test Deployed Function:

```bash
# Invoke deployed function
supabase functions invoke risk-engine

# Or via HTTP
curl -X POST https://your-project.supabase.co/functions/v1/risk-engine \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Test Cron Jobs:

After deploying to Vercel, cron jobs run automatically. You can also test manually:

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

### View Function Logs:

```bash
# Via CLI
supabase functions logs risk-engine

# Via Dashboard
# Supabase Dashboard → Edge Functions → risk-engine → Logs
```

### View Cron Job Logs:

- **Vercel Dashboard** → Your Project → Cron Jobs
- **Vercel Dashboard** → Deployments → Function Logs

---

## 🔒 Security

### Cron Job Security:

Add `CRON_SECRET` to Vercel environment variables:

```bash
# Generate a random secret
openssl rand -hex 32

# Add to Vercel Dashboard → Settings → Environment Variables
CRON_SECRET=your-generated-secret
```

The cron endpoints verify requests using this secret to prevent unauthorized access.

### Edge Function Security:

- Uses Supabase Service Role Key (auto-provided)
- Runs in isolated Deno runtime
- No direct database access (uses Supabase client)

---

## 📝 Cron Schedule Configuration

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/drawdown-check",
      "schedule": "*/2 * * * *"    // Every 2 minutes
    },
    {
      "path": "/api/cron/midnight-reset",
      "schedule": "0 4 * * *"      // Daily at 4 AM UTC
    }
  ]
}
```

**To change timezone for midnight reset:**
- Current: `0 4 * * *` = 4 AM UTC
- For EST (UTC-5): `0 5 * * *` = Midnight EST
- For PST (UTC-8): `0 8 * * *` = Midnight PST

---

## ✅ Deployment Checklist

- [ ] Supabase CLI installed
- [ ] Logged in (`supabase login`)
- [ ] Project linked (`supabase link`)
- [ ] Risk engine deployed (`supabase functions deploy risk-engine`)
- [ ] `CRON_SECRET` set in Vercel
- [ ] `vercel.json` configured
- [ ] Deployed to Vercel
- [ ] Tested cron jobs
- [ ] Verified logs

---

## 🆘 Troubleshooting

### "Function not found"
- Make sure you deployed: `supabase functions deploy risk-engine`
- Check project is linked: `supabase link --project-ref your-ref`

### "Unauthorized" in cron jobs
- Verify `CRON_SECRET` is set in Vercel
- Check Authorization header format: `Bearer YOUR_SECRET`

### "Database connection error"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is available to Edge Function
- Check Supabase project is active

### Function not running
- Check Supabase Dashboard → Edge Functions → Logs
- Verify function is deployed (not just local)
- Check Vercel Cron Jobs dashboard for execution history

---

## 🎯 Next Steps

1. **Deploy to Vercel** - Cron jobs will start automatically
2. **Monitor Logs** - Check both Supabase and Vercel
3. **Remove Python Scripts** (optional, once confirmed working):
   - `scripts/drawdown_monitor.py`
   - `scripts/midnight_reset.py`

---

**Last Updated:** Today
**Status:** ✅ Ready for Deployment
