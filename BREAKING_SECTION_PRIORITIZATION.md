# Breaking Section Prioritization - Same Day Sports & Crypto

## Changes Made

Updated the "Breaking" section to prioritize same-day sports and crypto markets, making them appear at the top of the Breaking feed. Enhanced detection logic to identify short-term markets like "15-minute crypto markets" and "same-day over/under odds on games playing today".

## Implementation

### 1. Updated Breaking Category Filter
**Files**: `app/markets/page.tsx`, `app/dashboard/page.tsx`

**Before**:
- Breaking section only showed markets with volume > $1,000,000

**After**:
- Breaking section now includes:
  - **Same-day sports markets**: Games happening today (over/under, spreads, game outcomes)
  - **Short-term crypto markets**: 15-minute, hourly, daily price movements
  - **High volume markets**: (> $1,000,000)
  - **Excludes**: Long-term championship markets (2026, 2027, 2028, etc.)

### 2. Enhanced Detection Logic

#### For Crypto Markets:
Detects short-term markets by checking for keywords:
- "15 min", "15-minute", "15m"
- "hourly", "hour"
- "today", "tonight"
- "daily", "intraday"
- "price by end of day", "by midnight"
- Price targets that resolve today

#### For Sports Markets:
Detects same-day game markets by checking for:
- Resolution date is today
- Keywords: "over", "under", "o/u", "spread", "total", "points"
- "tonight", "today" in market name/description
- "game" + ("today" or "tonight")
- Team vs team format (" vs ") + recently updated
- "win", "score" + ("today" or "tonight")

#### Exclusions:
- Long-term championship markets (2026, 2027, 2028, etc.)
- Markets with "champion 202", "winner 202", "mvp 202" in name

### 3. Enhanced Sorting Logic
**Files**: `app/markets/page.tsx`, `app/dashboard/page.tsx`

**New Sorting Priority**:
1. **First**: Same-day sports/crypto markets (highest priority)
2. **Second**: All other markets sorted by volume (descending)

### 4. Multi-Factor Same-Day Detection
- **Resolution Date**: Checks if `resolutionDate` is today (timezone-safe)
- **Recent Updates**: Markets updated in last 24 hours (indicates active same-day market)
- **Keyword Detection**: Analyzes market name and description for same-day indicators
- **Category Matching**: Ensures market is categorized as Sports or Crypto

## How It Works

### Filtering Logic:
```typescript
// Breaking section includes:
- Same-day sports markets (category === 'sports' && resolves today)
- Same-day crypto markets (category === 'crypto' && resolves today)  
- High volume markets (volume > $1,000,000)
```

### Sorting Logic:
```typescript
1. Same-day sports/crypto markets appear first
2. Then sorted by total volume (descending)
```

## Benefits

- ✅ Same-day sports events (games, matches) appear prominently
- ✅ Same-day crypto events (price movements, announcements) get visibility
- ✅ High-volume markets still included
- ✅ Better user experience for time-sensitive markets
- ✅ No breaking changes to existing functionality

## Testing

To verify:
1. Navigate to Markets or Dashboard page
2. Click "Breaking" category
3. Same-day sports/crypto markets should appear at the top
4. Followed by high-volume markets sorted by volume

## Notes

- Date comparison uses year/month/day to avoid timezone issues
- Markets without resolutionDate can still be detected via keywords
- Category must exactly match "sports" or "crypto" (case-insensitive)
- Works on both Markets page and Dashboard page
- Long-term championship markets (2026, 2027, 2028) are excluded from Breaking even if high volume
- Recently updated markets (within 24 hours) are considered for same-day detection

## Detection Examples

### Crypto Markets That Will Show:
- "Bitcoin price 15 min after announcement"
- "ETH hourly price target"
- "BTC price by end of today"
- "Crypto market cap by midnight"

### Sports Markets That Will Show:
- "Lakers vs Warriors over/under tonight"
- "NFL game total points today"
- "NBA spread for tonight's game"
- Markets with resolution date = today

### Markets That Will NOT Show (Excluded):
- "Super Bowl Champion 2026"
- "2028 NBA Champion"
- "World Cup Winner 2026"
- Long-term championship predictions
