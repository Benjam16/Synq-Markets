# Debugging Market Fetch Issues

## Changes Made

### 1. Enhanced Category Matching
**File**: `app/markets/page.tsx` (lines 340-375)

**Problem**: Category matching was too strict, especially for:
- "Climate & Science" (with "&" character)
- "Finance" vs "Economics" variations
- Case sensitivity issues

**Solution**: 
- Normalized "&" to "and" for matching
- Added comprehensive special mappings
- Made matching bidirectional (partial matches work both ways)

### 2. Enhanced Debug Logging
**Files**: 
- `app/markets/page.tsx` - Added filtered category distribution logging
- `app/api/markets/route.ts` - Added fetch time logging

## How to Debug

### Step 1: Restart Server
```bash
# Stop server (Ctrl+C)
# Restart
npm run dev
```

### Step 2: Check Server Logs
Look for these log messages in your terminal:

**Pagination Logs** (should see multiple batches):
```
[Polymarket] Starting recursive pagination (safety limit: 5000 items)
[Polymarket] Fetching batch 1 at offset 0...
[Polymarket] Batch 1: Received 1000 events (Total: 1000)
[Polymarket] Fetching batch 2 at offset 1000...
[Polymarket] Batch 2: Received 1000 events (Total: 2000)
...
[Polymarket] Pagination complete: Fetched X total events across Y batches
```

**API Route Logs**:
```
[Markets API] Fetching markets with limit: 10000
[Markets API] Fetched X markets in Yms
[Markets API] Category distribution: { Crypto: X, Sports: Y, Finance: Z, ... }
```

### Step 3: Check Browser Console
Open DevTools (F12) → Console tab, look for:

```
[Markets Page] Total markets: X | Categories: {...}
[Markets Page] After filtering for "Finance": Y markets
[Markets Page] Filtered category distribution: {...}
```

**If you see "No markets matched" warning**:
```
[Markets Page] No markets matched "Finance". Sample categories in data: [...]
```
This shows what categories ARE in the data, helping identify mismatches.

## Common Issues

### Issue 1: Only 1 Batch Fetched
**Symptom**: Logs show only "Batch 1: Received 1000 events" then stops

**Possible Causes**:
- Polymarket API doesn't support `offset` parameter (needs verification)
- API returns exactly 1000 events and we think that's the end
- Rate limiting or API error

**Fix**: Check if Polymarket API actually supports pagination via `offset`. May need to use cursor-based pagination instead.

### Issue 2: Categories Don't Match
**Symptom**: Server logs show markets with categories, but frontend shows "No markets found"

**Check**:
1. Browser console: `[Markets Page] Sample categories in data: [...]`
2. Compare with selected category name
3. Verify category normalization is working

### Issue 3: Markets Filtered Out
**Symptom**: Many events fetched, but few markets after processing

**Check**:
- `[Polymarket] Processed X events, Y valid markets after filtering`
- If Y << X, markets are being filtered out during processing
- Check resolution date filters, volume filters, etc.

## Next Steps

1. **Restart server** and share the complete server logs
2. **Open browser console** and share the console logs
3. **Check specific category** - try "Trending" (shows all) vs "Finance" (filtered)

This will help identify if the issue is:
- Pagination not working (only 1 batch)
- Category matching (categories exist but don't match)
- Market filtering (markets removed during processing)
- Frontend display (markets exist but not shown)
