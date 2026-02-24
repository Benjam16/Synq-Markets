# Trade Debugging Guide

## Issue: Trades not showing up in dashboard

## What I've Fixed:

1. **Database Column Handling**: Added fallback logic for missing `status` and `outcome` columns
2. **Dashboard Query**: Now tries with all columns first, then falls back to basic columns if needed
3. **Logging**: Added extensive logging throughout the trade flow
4. **Error Handling**: Improved error handling in both buy and dashboard routes

## How to Debug:

### Step 1: Check Browser Console
After making a trade, look for these logs:
- `[TradePanel] Trade successful:` - Confirms trade was accepted
- `[TradePanel] Refreshed positions:` - Shows positions after trade

### Step 2: Check Server Logs
Look for these logs in your terminal:
- `[Buy] Trade saved successfully:` - Confirms trade was saved to database
- `[Dashboard] Total trades for subscription X:` - Shows total trades found
- `[Dashboard] Found X positions` - Shows how many positions were returned

### Step 3: Use Debug Endpoint
Open in browser: `http://localhost:3000/api/debug-trades?userId=YOUR_USER_ID`

This will show:
- All subscriptions for the user
- All trades (any status)
- Open trades for active subscription
- Summary counts

### Step 4: Check Database Directly
Run this SQL query:
```sql
-- Check if trades exist
SELECT COUNT(*) FROM simulated_trades WHERE user_id = YOUR_USER_ID;

-- Check subscription
SELECT id, user_id, status FROM challenge_subscriptions WHERE user_id = YOUR_USER_ID;

-- Check trades for subscription
SELECT * FROM simulated_trades WHERE challenge_subscription_id = (SELECT id FROM challenge_subscriptions WHERE user_id = YOUR_USER_ID AND status = 'active' LIMIT 1);
```

## Common Issues:

1. **Missing `status` column**: If you see `column "status" does not exist` errors, run the migration:
   ```sql
   ALTER TABLE simulated_trades ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
   UPDATE simulated_trades SET status = 'open' WHERE status IS NULL;
   ```

2. **Missing `outcome` column**: If you see `column "outcome" does not exist` errors, run:
   ```sql
   ALTER TABLE simulated_trades ADD COLUMN IF NOT EXISTS outcome TEXT;
   ```

3. **Subscription mismatch**: Make sure the buy route and dashboard route are using the same subscription query pattern (they should be).

4. **Transaction not committing**: Check if there are any errors after the INSERT that cause a ROLLBACK.

## Next Steps:

1. Make a test trade
2. Check browser console for logs
3. Check server terminal for logs
4. Use debug endpoint to verify trade was saved
5. Check database directly if needed
