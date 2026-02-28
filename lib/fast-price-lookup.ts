/**
 * Fast market price lookup - optimized for trade execution
 * Checks database cache first, then falls back to batch market fetch,
 * then direct API. Returns null if no real price can be found.
 */
import { query } from "@/lib/db";
import { fetchAllMarkets } from "@/lib/market-fetchers";

export interface PriceLookupResult {
  price: number;
  yesPrice?: number;
  noPrice?: number;
  source: 'cache' | 'entry' | 'api';
  market?: any;
}

/**
 * Fast price lookup for a single market.
 * Priority: Cache > Entry Price > fetchAllMarkets (batch, outcome-aware) > Direct API > null
 *
 * Returns null when no real price can be resolved — callers must handle this
 * by rejecting the trade or showing "Price Stale" in the UI.
 */
export async function getMarketPriceFast(
  provider: string,
  marketId: string,
  side: 'yes' | 'no',
  outcome?: string,
  entryPrice?: number,
  outcomeIndex?: number,
  tokenId?: string
): Promise<PriceLookupResult | null> {
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
    console.warn('[Fast Price] Cache lookup failed:', error);
  }

  // STEP 2: Use entry price if provided (very fast - 0ms, no API call)
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

  // STEP 3: Batch fetch from fetchAllMarkets (same source as Markets tab — 500 limit)
  try {
    const allMarkets = await fetchAllMarkets(500);
    const market = allMarkets.find(m => 
      m.id === marketId || 
      m.conditionId === marketId ||
      m.id.endsWith(marketId) ||
      marketId.endsWith(m.id)
    );

    if (market) {
      let price = market.price ?? 0;
      let yesPrice = price;
      let noPrice = 1 - price;

      if (market.outcomes && market.outcomes.length > 0) {
        let matched = false;

        // Try outcomeIndex first (most precise)
        if (outcomeIndex !== undefined && outcomeIndex >= 0 && outcomeIndex < market.outcomes.length) {
          const oc = market.outcomes[outcomeIndex];
          if (oc && oc.price != null && oc.price > 0) {
            yesPrice = oc.price;
            noPrice = 1 - yesPrice;
            price = side === 'no' ? noPrice : yesPrice;
            matched = true;
          }
        }

        // Try tokenId match
        if (!matched && tokenId) {
          const tokenLower = tokenId.toLowerCase();
          const oc = market.outcomes.find((o: any) =>
            (o.tokenId || '').toLowerCase() === tokenLower ||
            (o.clobTokenId || '').toLowerCase() === tokenLower
          );
          if (oc && oc.price != null && oc.price > 0) {
            yesPrice = oc.price;
            noPrice = 1 - yesPrice;
            price = side === 'no' ? noPrice : yesPrice;
            matched = true;
          }
        }

        // Try outcome name match
        if (!matched && outcome) {
          const outcomeName = outcome.replace(/\s*\(No\)\s*$/i, '').trim();
          const targetOutcome = market.outcomes.find((o: any) => 
            o.name === outcomeName || 
            o.name?.replace(/\s*\(No\)\s*$/i, '') === outcomeName
          );
          if (targetOutcome && targetOutcome.price != null && targetOutcome.price > 0) {
            yesPrice = targetOutcome.price;
            noPrice = 1 - yesPrice;
            price = side === 'no' ? noPrice : yesPrice;
            matched = true;
          }
        }

        if (!matched) {
          price = side === 'no' ? noPrice : yesPrice;
        }
      } else {
        price = side === 'no' ? noPrice : yesPrice;
      }

      // Update cache in background
      query(
        `INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (provider, market_id) DO UPDATE SET last_price = EXCLUDED.last_price, as_of = EXCLUDED.as_of;`,
        [normalizedProvider, marketId, yesPrice.toString()]
      ).catch(() => {});

      return {
        price,
        yesPrice,
        noPrice,
        source: 'api',
        market,
      };
    }
  } catch (error) {
    console.error('[Fast Price] fetchAllMarkets failed:', error);
  }

  // STEP 4: Direct single-market API fetch (outcome-aware)
  try {
    if (normalizedProvider === 'kalshi') {
      const cleanTicker = marketId.replace(/^kalshi-/i, '');
      const res = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${cleanTicker}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const m = data.market || data;
        const raw = m.yes_ask ?? m.yes_bid ?? m.last_price;
        if (raw != null) {
          const yp = Number(raw) <= 1 ? Number(raw) : Number(raw) / 100;
          const np = 1 - yp;
          query(
            `INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (provider, market_id) DO UPDATE SET last_price = EXCLUDED.last_price, as_of = EXCLUDED.as_of;`,
            [normalizedProvider, marketId, yp.toString()]
          ).catch(() => {});
          return { price: side === 'no' ? np : yp, yesPrice: yp, noPrice: np, source: 'api' };
        }
      }
    } else {
      // Polymarket: try Gamma API by condition_id, use outcomeIndex for correct price
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?condition_id=${marketId}&limit=1`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json();
        const m = Array.isArray(data) ? data[0] : data;
        if (m?.outcomePrices) {
          const prices = JSON.parse(m.outcomePrices);
          // Use outcomeIndex if available, otherwise try matching tokenId via clobTokenIds
          let priceIdx = 0;
          if (outcomeIndex !== undefined && outcomeIndex >= 0 && outcomeIndex < prices.length) {
            priceIdx = outcomeIndex;
          } else if (tokenId && m.clobTokenIds) {
            try {
              const clobIds = JSON.parse(m.clobTokenIds);
              const foundIdx = clobIds.indexOf(tokenId);
              if (foundIdx >= 0 && foundIdx < prices.length) priceIdx = foundIdx;
            } catch { /* ignore */ }
          }

          const yp = parseFloat(prices[priceIdx]);
          if (!isNaN(yp) && yp > 0 && yp < 1) {
            const np = 1 - yp;
            query(
              `INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (provider, market_id) DO UPDATE SET last_price = EXCLUDED.last_price, as_of = EXCLUDED.as_of;`,
              [normalizedProvider, marketId, yp.toString()]
            ).catch(() => {});
            return { price: side === 'no' ? np : yp, yesPrice: yp, noPrice: np, source: 'api' };
          }
        }
      }
    }
  } catch {
    // Direct API also failed
  }

  // STEP 5: No real price available — return null instead of 0.50
  console.warn(`[Fast Price] All lookups failed for ${normalizedProvider}:${marketId} — returning null (no 0.50 fallback)`);
  return null;
}
