# Active Challenge Detection Fix

## Issue
The "No Active Challenge" message was incorrectly appearing in both the Accounts and Dashboard pages, even when users had active challenges. This has been an ongoing issue.

## Root Cause

The dashboard API was only querying for subscriptions with `status = 'active'`:

```sql
WHERE cs.user_id = $1 AND cs.status = 'active'
```

**Problems with this approach:**
1. If a subscription exists but has a different status (e.g., 'failed', 'closed', or NULL), it wouldn't be found
2. The API would return `accountStatus: 'inactive'` and `subscriptionId: undefined`
3. The frontend checks `accountStatus === 'active' && subscriptionId`, which would fail
4. This caused the "No Active Challenge" message to appear incorrectly

## Fix Applied

### 1. Changed Query to Check ALL Subscriptions
**File**: `app/api/dashboard/route.ts`

**Before**:
```sql
WHERE cs.user_id = $1 AND cs.status = 'active'
```

**After**:
```sql
WHERE cs.user_id = $1
ORDER BY cs.started_at DESC
LIMIT 1
```

Now the API:
- Finds the most recent subscription regardless of status
- Checks if it's active before proceeding
- Returns the actual status (active, failed, closed, inactive) instead of always 'inactive'
- Includes the subscription ID even if inactive (for debugging)

### 2. Improved Status Handling
- Returns actual `accountStatus` from the database
- Includes `failReason` when account was closed
- Includes `subscriptionId` even when inactive (for debugging)

### 3. Added Debug Logging
Added console logging in development mode to help diagnose issues:
- Logs subscription status, ID, and active check results
- Helps identify when subscriptions exist but aren't active

### 4. Enhanced Frontend Checks
Both `dashboard/page.tsx` and `accounts/page.tsx` now:
- Have clearer comments explaining the check logic
- Include debug logging in development
- Properly handle all status cases

## Expected Behavior

### When User Has Active Challenge:
- ✅ Dashboard API returns `accountStatus: 'active'` and `subscriptionId: <number>`
- ✅ Frontend shows dashboard/accounts page with data
- ✅ No "No Active Challenge" message

### When User Has No Challenge:
- ✅ Dashboard API returns `accountStatus: 'inactive'` and `subscriptionId: undefined`
- ✅ Frontend shows "No Active Challenge" message
- ✅ User can purchase a new challenge

### When User Has Failed/Closed Challenge:
- ✅ Dashboard API returns `accountStatus: 'failed'` or `'closed'` and `subscriptionId: <number>`
- ✅ Frontend shows "No Active Challenge" message with fail reason
- ✅ User can purchase a new challenge

## Testing

To verify the fix:
1. Check browser console (in development) for debug logs
2. Verify that active challenges show dashboard data
3. Verify that inactive/failed challenges show appropriate message
4. Check that subscription status is correctly reflected

## Additional Notes

- The fix maintains backward compatibility
- All existing functionality preserved
- Better error messages for users
- Improved debugging capabilities
