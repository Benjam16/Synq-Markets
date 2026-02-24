# Risk Engine - Supabase Edge Function

This Edge Function runs the risk engine logic to check drawdown limits and close accounts when breached.

## Deployment

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy risk-engine
```

## Environment Variables

Set in Supabase Dashboard → Edge Functions → risk-engine → Settings:

- `SUPABASE_URL` - Your Supabase project URL (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-set)

## Invocation

### Manual Trigger:
```bash
supabase functions invoke risk-engine
```

### Scheduled (via Supabase Cron or external scheduler):
- Set up a cron job to call this function every 2 minutes
- Or use Vercel Cron to call the function via HTTP

## What It Does

1. Fetches all active challenge subscriptions
2. Calculates unrealized P&L for each subscription
3. Checks drawdown limits:
   - **PASS:** Total return >= 10%
   - **FAIL:** Total drawdown <= -10%
   - **FAIL:** Daily drawdown <= -5%
4. Updates subscription status and logs events
