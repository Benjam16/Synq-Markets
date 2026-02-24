# Supabase Edge Functions

This directory contains Supabase Edge Functions that replace Python background workers.

## Structure

```
supabase/
├── functions/
│   └── risk-engine/
│       ├── index.ts          # Main function code
│       └── README.md         # Function documentation
└── config.toml               # Supabase CLI configuration
```

## Setup

### 1. Install Supabase CLI

**On macOS (Recommended):**
```bash
brew install supabase/tap/supabase
```

**Alternative:**
```bash
# Install as dev dependency
npm install supabase --save-dev
# Then use: npx supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to Your Project

```bash
# Get your project reference ID from Supabase Dashboard
supabase link --project-ref your-project-ref-id
```

### 4. Deploy Functions

```bash
# Deploy risk engine
supabase functions deploy risk-engine
```

## Functions

### risk-engine

**Purpose:** Checks drawdown limits and closes accounts when breached

**Schedule:** Should be called every 2 minutes (via Vercel Cron)

**Logic:**
- Fetches all active subscriptions
- Calculates unrealized P&L
- Checks PASS condition: Total return >= 10%
- Checks FAIL conditions: Total drawdown <= -10% OR Daily drawdown <= -5%
- Updates subscription status and logs events

**Invocation:**
```bash
# Manual test
supabase functions invoke risk-engine

# Via HTTP (from Vercel Cron)
POST https://your-project.supabase.co/functions/v1/risk-engine
Headers: Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

## Environment Variables

Set in Supabase Dashboard → Edge Functions → Settings:

- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase

## Monitoring

View function logs:
```bash
supabase functions logs risk-engine
```

Or in Supabase Dashboard → Edge Functions → risk-engine → Logs
