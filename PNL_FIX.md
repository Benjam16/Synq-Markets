# P&L Calculation Bug Fix

## Issue
Users were experiencing incorrect negative P&L when closing trades, even when the market price hadn't moved. For example, a trade opened at $0.97 and closed at the same price was showing -$94.35 P&L instead of $0.

## Root Causes Identified

### Bug #1: Wrong Side Used for P&L Calculation
**Location**: `app/api/sell/route.ts` line 150

**Problem**: The P&L calculation was using the request's `side` parameter instead of the position's actual `side` from the database.

**Before**:
```typescript
if (side === 'yes' || !side.includes('(No)')) {
  positionPnL = (currentPrice - entryPrice) * closeQty;
} else {
  positionPnL = (entryPrice - currentPrice) * closeQty;
}
```

**After**:
```typescript
const positionSide = String(position.side || '').toLowerCase();
if (positionSide === 'yes' || positionSide === 'up') {
  positionPnL = (currentPrice - entryPrice) * closeQty;
} else {
  positionPnL = (entryPrice - currentPrice) * closeQty;
}
```

### Bug #2: Incorrect Price Fetching
**Location**: `app/api/sell/route.ts` line 102-137

**Problem**: The sell route was using `market.price` (general market price) instead of the specific outcome price or side-specific price (yesPrice/noPrice). This could result in using the wrong price for P&L calculation.

**Before**:
```typescript
const market = allMarkets.find(m => m.id === marketId);
if (market) {
  currentPrice = market.price; // Wrong! Uses general price
}
```

**After**:
- Now uses the same logic as the buy route
- Fetches the specific outcome price if available
- Falls back to yesPrice/noPrice based on position side
- Uses entry price as last resort if market data unavailable (ensures P&L = 0 if market hasn't moved)

### Bug #3: Position Query Issue
**Location**: `app/api/sell/route.ts` line 65-77

**Problem**: The query was trying to match positions by `side = outcome || side`, which could fail when outcome is a name like "Gavin Newsom" instead of "yes"/"no".

**After**:
- Now properly matches by outcome name OR side
- Handles both outcome-based and side-based positions correctly

## Fixes Applied

1. ✅ **Fixed P&L calculation** to use position's side from database
2. ✅ **Fixed price fetching** to use outcome-specific or side-specific prices
3. ✅ **Fixed position query** to properly match by outcome name or side
4. ✅ **Added fallback** to use entry price if market data unavailable (prevents incorrect P&L when market hasn't moved)

## Testing

To verify the fix:
1. Open a trade at a specific price (e.g., $0.97)
2. Close it immediately (before market moves)
3. P&L should be $0.00 (or very close, accounting for any actual price movement)

## Impact

- ✅ Correct P&L calculation for all trade types (YES/NO, outcome-based)
- ✅ Proper price matching when closing positions
- ✅ Prevents false negative P&L when market hasn't moved
- ✅ Maintains backward compatibility with existing trades
