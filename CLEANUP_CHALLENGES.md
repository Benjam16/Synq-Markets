# How to Clean Up Challenges for a User

## Why Multiple Challenges Exist

1. **Historical Record**: The system allows multiple challenges per user to maintain a complete trading history. This is useful for:
   - Tracking performance over time
   - Analyzing past challenges
   - Compliance and audit trails

2. **No Unique Constraint**: The database schema doesn't prevent multiple challenges - it only prevents multiple **active** challenges at the same time.

3. **Supabase Auth vs Database**: When you delete your Supabase Auth account, it only removes the authentication record. The database records (users, challenges, trades) remain in PostgreSQL because they're separate systems.

## How to Clean Up Challenges

### Option 1: Use the API Endpoint (Recommended)

#### View All Challenges for a User
```bash
# Replace YOUR_USER_ID with your actual user ID
curl http://localhost:3000/api/cleanup-challenges?userId=YOUR_USER_ID
```

Or open in browser:
```
http://localhost:3000/api/cleanup-challenges?userId=YOUR_USER_ID
```

#### Fail All Active Challenges
```bash
curl -X POST http://localhost:3000/api/cleanup-challenges \
  -H "Content-Type: application/json" \
  -d '{"userId": YOUR_USER_ID, "action": "fail"}'
```

#### Delete All Challenges (Permanent)
```bash
curl -X POST http://localhost:3000/api/cleanup-challenges \
  -H "Content-Type: application/json" \
  -d '{"userId": YOUR_USER_ID, "action": "delete"}'
```

**Warning**: `delete` will permanently remove:
- All challenges
- All trades
- All balance snapshots
- All risk events

### Option 2: Direct SQL in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run these queries (replace `YOUR_USER_ID`):

#### Find Your User ID
```sql
SELECT id, email, full_name 
FROM users 
WHERE email = 'your-email@example.com';
```

#### View All Challenges
```sql
SELECT 
  cs.id,
  cs.status,
  cs.start_balance,
  cs.current_balance,
  cs.started_at,
  cs.ended_at,
  cs.fail_reason,
  COUNT(st.id) as trade_count
FROM challenge_subscriptions cs
LEFT JOIN simulated_trades st ON st.challenge_subscription_id = cs.id
WHERE cs.user_id = YOUR_USER_ID
GROUP BY cs.id
ORDER BY cs.started_at DESC;
```

#### Fail All Active Challenges
```sql
UPDATE challenge_subscriptions
SET 
  status = 'failed',
  fail_reason = 'Manually closed by user',
  ended_at = NOW()
WHERE user_id = YOUR_USER_ID AND status = 'active';
```

#### Delete All Challenges (Permanent - Use with Caution!)
```sql
-- Delete trades first (foreign key constraint)
DELETE FROM simulated_trades
WHERE challenge_subscription_id IN (
  SELECT id FROM challenge_subscriptions WHERE user_id = YOUR_USER_ID
);

-- Delete balance snapshots
DELETE FROM daily_balance_snapshots
WHERE challenge_subscription_id IN (
  SELECT id FROM challenge_subscriptions WHERE user_id = YOUR_USER_ID
);

-- Delete risk events
DELETE FROM risk_events
WHERE challenge_subscription_id IN (
  SELECT id FROM challenge_subscriptions WHERE user_id = YOUR_USER_ID
);

-- Finally delete challenges
DELETE FROM challenge_subscriptions
WHERE user_id = YOUR_USER_ID;
```

### Option 3: Delete User Entirely

If you want to completely remove a user and all their data:

```sql
-- First, delete all challenges (as above)
-- Then delete the user
DELETE FROM users WHERE id = YOUR_USER_ID;
```

## Why Deleting Supabase Auth Account Doesn't Remove Database Records

- **Supabase Auth** (authentication service) is separate from your **PostgreSQL database**
- When you delete an Auth account, it only removes the authentication record
- Your database records (users table, challenges, trades) remain because they're in PostgreSQL
- This is by design - it allows you to:
  - Keep trading history even if auth is reset
  - Re-link accounts if needed
  - Maintain data integrity

## Preventing Multiple Active Challenges

The system already prevents multiple **active** challenges per user in the `purchase-challenge` API:

```typescript
// Check if user already has an active challenge
const activeChallenge = await query(
  `SELECT id FROM challenge_subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
  [userId]
);

if (activeChallenge.rows.length > 0) {
  return NextResponse.json(
    { error: 'User already has an active challenge' },
    { status: 400 }
  );
}
```

However, users can have multiple **inactive** (failed/passed/cancelled) challenges for historical purposes.

## Recommended Workflow

### Using the Script (Easiest)

1. **View challenges**:
   ```bash
   node scripts/cleanup-user-challenges.js your-email@example.com view
   ```

2. **Fail active challenges**:
   ```bash
   node scripts/cleanup-user-challenges.js your-email@example.com fail
   ```

3. **Purchase new challenge**: Go to `/challenges` page and purchase a new one

4. **If needed, delete old challenges** (permanent!):
   ```bash
   node scripts/cleanup-user-challenges.js your-email@example.com delete
   ```

### Using the API

1. **Find your user ID**: `GET /api/user?email=your-email@example.com`
2. **View challenges**: `GET /api/cleanup-challenges?userId=X`
3. **Fail active challenges**: `POST /api/cleanup-challenges` with `action: "fail"`
4. **Purchase new challenge**: Go to `/challenges` page and purchase a new one
5. **If needed, delete old challenges**: `POST /api/cleanup-challenges` with `action: "delete"`
