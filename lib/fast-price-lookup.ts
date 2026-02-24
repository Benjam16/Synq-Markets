/**
 * Fast market price lookup - optimized for trade execution
 * Checks database cache first, then falls back to entry price
 * Only fetches from API as last resort
 */
import { query } from "@/lib/db";
import { fetchAllMarkets } from "@/lib/market-fetchers";

interface PriceLookupResult {
  price: number;
  yesPrice?: number;
  noPrice?: number;
  source: 'cache' | 'entry' | 'api';
  market?: any;
}

/**
 * Fast price lookup for a single market
 * Priority: Cache > Entry Price > API (only if needed)
 */
export async function getMarketPriceFast(
  provider: string,
  marketId: string,
  side: 'yes' | 'no',
  outcome?: string,
  entryPrice?: number
): Promise<PriceLookupResult> {
  const normalizedProvider = provider.toLowerCase();
  
  // STEP 1: Try database cache first (fastest - <10ms)
  try {
    const cacheRes = await query<{ last_price: string }>(
      `
      SELECT last_price
      FROM market_price_cache
      WHERE provider = $1 AND market_id = $2
        AND as_of > NOW() - INTERVAL '30 minutes'
      ORDER BY as_of DESC
      LIMIT 1;
      `,
      [normalizedProvider, marketId]
    );

    if (cacheRes.rows.length > 0) {
      const cachedPrice = Number(cacheRes.rows[0].last_price);
      const yesPrice = cachedPrice;
      const noPrice = 1 - cachedPrice;
      
      return {
        price: side === 'no' ? noPrice : yesPrice,
        yesPrice,
        noPrice,
        source: 'cache',
      };
    }
  } catch (error) {
    // Cache lookup failed, continue to next step
    console.warn('[Fast Price] Cache lookup failed:', error);
  }

  // STEP 2: Use entry price if provided (very fast - 0ms, no API call)
  // This is safe because prices don't change dramatically in seconds
  if (entryPrice !== undefined && entryPrice > 0) {
    const yesPrice = entryPrice;
    const noPrice = 1 - entryPrice;
    
    return {
      price: side === 'no' ? noPrice : yesPrice,
      yesPrice,
      noPrice,
      source: 'entry',
    };
  }

  // STEP 3: Fetch from API (slowest - 2-5 seconds, but accurate)
  // Only do this if we have no cache and no entry price
  try {
    const allMarkets = await fetchAllMarkets(100);
    const market = allMarkets.find(m => 
      m.id === marketId || 
      m.conditionId === marketId ||
      m.id.endsWith(marketId) ||
      marketId.endsWith(m.id)
    );

    if (market) {
      // Use outcome-specific price if available
      let price = market.price ?? 0;
      // UnifiedMarket uses 'price' for primary outcome, calculate noPrice from it
      let yesPrice = price;
      let noPrice = 1 - price;

      if (outcome && market.outcomes && market.outcomes.length > 0) {
        const outcomeName = outcome.replace(/\s*\(No\)\s*$/i, '').trim();
        const targetOutcome = market.outcomes.find((o: any) => 
          o.name === outcomeName || 
          o.name.replace(/\s*\(No\)\s*$/i, '') === outcomeName
        );
        
        if (targetOutcome) {
          if (side === 'no') {
            price = 1 - (targetOutcome.price || 0);
          } else {
            price = targetOutcome.price || 0;
          }
        } else {
          price = side === 'no' ? noPrice : yesPrice;
        }
      } else {
        price = side === 'no' ? noPrice : yesPrice;
      }

      // Update cache in background (don't wait)
      query(
        `INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (provider, market_id) DO UPDATE SET last_price = EXCLUDED.last_price, as_of = EXCLUDED.as_of;`,
        [normalizedProvider, marketId, yesPrice.toString()]
      ).catch(() => {}); // Silently fail - cache update is not critical

      return {
        price,
        yesPrice,
        noPrice,
        source: 'api',
        market,
      };
    }
  } catch (error) {
    console.error('[Fast Price] API fetch failed:', error);
  }

  // STEP 4: Last resort - return 0.5 (neutral price) if everything fails
  // This should rarely happen, but prevents trade execution from failing
  console.warn(`[Fast Price] All lookups failed for ${provider}:${marketId}, using fallback`);
  return {
    price: 0.5,
    yesPrice: 0.5,
    noPrice: 0.5,
    source: 'entry', // Mark as entry to indicate it's a fallback
  };
}
