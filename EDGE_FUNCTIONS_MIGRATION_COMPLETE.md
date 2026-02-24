# ✅ Edge Functions Migration Complete

## 🎉 What's Been Set Up

### 1. **Supabase Edge Function: Risk Engine** ✅
**Location:** `supabase/functions/risk-engine/index.ts`

**What it does:**
- Checks all active challenge subscriptions
- Calculates unrealized P&L from cached prices
- Checks PASS condition: Total return >= 10%
- Checks FAIL conditions: Total drawdown <= -10% OR Daily drawdown <= -5%
- Updates subscription status and logs events

**Benefits:**
- Runs on Supabase infrastructure (no separate hosting)
- Auto-scales
- TypeScript (type-safe)
- Integrated with your database

---

### 2. **Vercel Cron Jobs** ✅

#### **Drawdown Check** (`/api/cron/drawdown-check`)
- **Schedule:** Every 2 minutes (`*/2 * * * *`)
- **What it does:** Calls Supabase Edge Function to check risk limits
- **Fallback:** Uses existing `/api/risk-check` route if Edge Function unavailable

#### **Midnight Reset** (`/api/cron/midnight-reset`)
- **Schedule:** Daily at 4 AM UTC (`0 4 * * *`)
- **What it does:**
  - Creates daily balance snapshots
  - Resets `day_start_balance` for new trading day
- **Direct database update** (no Edge Function needed)

---

## 📁 Folder Structure

```
prop-market/
├── supabase/
│   ├── functions/
│   │   └── risk-engine/
│   │       ├── index.ts          # Risk engine logic
│   │       └── README.md
│   ├── config.toml                # Supabase CLI config
│   └── README.md
├── app/
│   └── api/
│       └── cron/
│           ├── drawdown-check/
│           │   └── route.ts      # Vercel Cron → Edge Function
│           └── midnight-reset/
│               └── route.ts      # Vercel Cron → Direct DB
└── vercel.json                     # Cron schedules
```

---

## 🚀 Deployment Steps

### **Step 1: Deploy Supabase Edge Function**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project (get ref ID from Supabase Dashboard)
supabase link --project-ref your-project-ref-id

# Deploy function
supabase functions deploy risk-engine
```

### **Step 2: Configure Vercel**

1. **Add Environment Variable:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add: `CRON_SECRET` = (generate random string: `openssl rand -hex 32`)

2. **Deploy to Vercel:**
   - Push to GitHub
   - Vercel will auto-deploy
   - Cron jobs will start automatically

### **Step 3: Verify**

1. **Check Edge Function:**
   ```bash
   supabase functions logs risk-engine
   ```

2. **Check Cron Jobs:**
   - Vercel Dashboard → Your Project → Cron Jobs
   - Should show execution history

---

## 🔄 Migration Path

### **Before (Python Scripts):**
```bash
# Had to run separately on server
python3 scripts/drawdown_monitor.py      # Every 2 minutes
python3 scripts/midnight_reset.py       # Daily at midnight
```

### **After (Edge Functions + Cron):**
```
✅ Supabase Edge Function (risk-engine)
   ↓ Called by
✅ Vercel Cron (/api/cron/drawdown-check)
   ↓ Runs every 2 minutes automatically

✅ Vercel Cron (/api/cron/midnight-reset)
   ↓ Runs daily at 4 AM UTC automatically
```

**No separate hosting needed!**

---

## 📊 What Gets Replaced

| Old (Python) | New (Edge Function/Cron) | Status |
|--------------|---------------------------|--------|
| `scripts/drawdown_monitor.py` | `supabase/functions/risk-engine/index.ts` | ✅ Replaced |
| `scripts/midnight_reset.py` | `app/api/cron/midnight-reset/route.ts` | ✅ Replaced |
| Separate server/VPS | Vercel + Supabase | ✅ No hosting needed |

---

## ✅ Benefits

1. **No Separate Hosting** - Everything runs on Vercel + Supabase
2. **Automatic Scaling** - Edge Functions scale automatically
3. **Better Monitoring** - Logs in Supabase Dashboard
4. **Type Safety** - TypeScript instead of Python
5. **Integrated** - All in one codebase
6. **Cost Effective** - Free tier covers most use cases
7. **Reliable** - Vercel Cron is more reliable than manual cron jobs

---

## 🧪 Testing Checklist

- [ ] Edge Function deploys successfully
- [ ] Edge Function can be invoked manually
- [ ] Cron jobs appear in Vercel Dashboard
- [ ] Drawdown check runs every 2 minutes
- [ ] Midnight reset runs daily
- [ ] Risk engine correctly passes accounts at 10%
- [ ] Risk engine correctly fails accounts at -5% daily or -10% total
- [ ] Logs are visible in both Supabase and Vercel

---

## 📝 Next Steps

1. **Deploy Edge Function:**
   ```bash
   supabase functions deploy risk-engine
   ```

2. **Deploy to Vercel:**
   - Push code to GitHub
   - Vercel auto-deploys
   - Cron jobs start automatically

3. **Monitor:**
   - Check Supabase Dashboard → Edge Functions → Logs
   - Check Vercel Dashboard → Cron Jobs

4. **Optional: Remove Python Scripts** (once confirmed working):
   - `scripts/drawdown_monitor.py`
   - `scripts/midnight_reset.py`

---

## 🔒 Security Notes

- **CRON_SECRET:** Required for cron job security
- **Service Role Key:** Used by Edge Function (auto-provided by Supabase)
- **No Public Access:** Cron endpoints require authentication

---

## 📚 Documentation

- **Setup Guide:** `EDGE_FUNCTIONS_SETUP.md`
- **Migration Guide:** `MIGRATION_TO_EDGE_FUNCTIONS.md`
- **Supabase Functions:** `supabase/README.md`

---

**Last Updated:** Today
**Status:** ✅ Ready for Deployment
