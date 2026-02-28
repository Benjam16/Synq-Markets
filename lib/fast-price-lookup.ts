/**
 * Fast market price lookup - optimized for trade execution
 * Checks database cache first, then falls back to batch market fetch,
 * then direct API. Returns null if no real price can be found.
 *
 * KEY FIX: For Kalshi, terminal trades use market-level tickers
 * (e.g. "KXBTCD-28FEB2603-T61999.99") but UnifiedMarket stores event-level
 * IDs (e.g. "kalshi-KXBTCD-28FEB26"). We now search OUTCOMES by tokenId
 * so these always match.
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

// ── Global In-Memory Price Cache ──
// Warm cache populated by terminal feed trades and batch lookups.
// Used for instant price display when a user expands a trade row.
const _memCache = new Map<string, { yesPrice: number; noPrice: number; ts: number }>();
const MEM_CACHE_TTL = 60_000; // 60 seconds

export function warmPriceCache(provider: string, marketId: string, yesPrice: number) {
  const key = `${provider.toLowerCase()}:${marketId}`;
  _memCache.set(key, { yesPrice, noPrice: 1 - yesPrice, ts: Date.now() });
  if (_memCache.size > 5000) {
    const oldest = [..._memCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    oldest.slice(0, 1000).forEach(([k]) => _memCache.delete(k));
  }
}

export function getCachedPrice(provider: string, marketId: string): { yesPrice: number; noPrice: number } | null {
  const key = `${provider.toLowerCase()}:${marketId}`;
  const hit = _memCache.get(key);
  if (hit && Date.now() - hit.ts < MEM_CACHE_TTL) return hit;
  return null;
}

/**
 * Fast price lookup for a single market.
 * Priority: In-Memory Cache > DB Cache > fetchAllMarkets (outcome-aware) > Direct API > null
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

  // STEP 0: In-memory cache (instant, <1ms)
  const memHit = getCachedPrice(normalizedProvider, marketId);
  if (memHit) {
    return {
      price: side === 'no' ? memHit.noPrice : memHit.yesPrice,
      yesPrice: memHit.yesPrice,
      noPrice: memHit.noPrice,
      source: 'cache',
    };
  }
  
  // STEP 1: Try database cache (fastest DB - <10ms)
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
      warmPriceCache(normalizedProvider, marketId, yesPrice);
      
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

  // STEP 2: Batch fetch from fetchAllMarkets (same source as Markets tab)
  try {
    const allMarkets = await fetchAllMarkets(500);

    // 2a: Direct market-level matching
    let market = allMarkets.find(m => 
      m.id === marketId || 
      m.conditionId === marketId ||
      m.id.endsWith(marketId) ||
      marketId.endsWith(m.id)
    );

    // 2b: If no market-level match, search ALL outcomes across ALL markets
    // This is the critical fix for Kalshi terminal trades where the marketId
    // is a market-level ticker but UnifiedMarket uses event-level IDs.
    let outcomeMatch: any = null;
    if (!market) {
      const searchId = (tokenId || marketId).toLowerCase();
      for (const m of allMarkets) {
        if (!m.outcomes || m.outcomes.length === 0) continue;
        const oc = m.outcomes.find((o: any) =>
          (o.tokenId || '').toLowerCase() === searchId ||
          (o.id || '').toLowerCase() === searchId ||
          (o.clobTokenId || '').toLowerCase() === searchId
        );
        if (oc && oc.price != null && oc.price > 0) {
          market = m;
          outcomeMatch = oc;
          break;
        }
      }
    }

    if (market) {
      let price = market.price ?? 0;
      let yesPrice = price;
      let noPrice = 1 - price;

      // If we already found an outcome match from the cross-market search, use it
      if (outcomeMatch) {
        yesPrice = outcomeMatch.price;
        noPrice = 1 - yesPrice;
        price = side === 'no' ? noPrice : yesPrice;
      } else if (market.outcomes && market.outcomes.length > 0) {
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

        // Try tokenId match within this market's outcomes
        if (!matched && (tokenId || marketId)) {
          const searchToken = (tokenId || marketId).toLowerCase();
          const oc = market.outcomes.find((o: any) =>
            (o.tokenId || '').toLowerCase() === searchToken ||
            (o.id || '').toLowerCase() === searchToken ||
            (o.clobTokenId || '').toLowerCase() === searchToken
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

      // Update both caches
      warmPriceCache(normalizedProvider, marketId, yesPrice);
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

  // STEP 3: Direct single-market API fetch (with auth for Kalshi)
  try {
    if (normalizedProvider === 'kalshi') {
      const cleanTicker = marketId.replace(/^kalshi-/i, '');
      const accessKey = process.env.KALSHI_ACCESS_KEY;
      const privateKey = process.env.KALSHI_PRIVATE_KEY;

      let headers: Record<string, string> = { 'Accept': 'application/json' };
      if (accessKey && privateKey) {
        try {
          const { generateKalshiHeaders } = await import('./kalshi-auth');
          const path = `/trade-api/v2/markets/${cleanTicker}`;
          const authHeaders = generateKalshiHeaders('GET', path, accessKey, privateKey);
          headers = { ...headers, ...authHeaders };
        } catch { /* proceed without auth */ }
      }

      const res = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${cleanTicker}`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const m = data.market || data;
        // Prefer order book mid-price (avg of best bid and ask) for accuracy
        let yp: number | null = null;
        const yesBid = m.yes_bid != null ? Number(m.yes_bid) : null;
        const yesAsk = m.yes_ask != null ? Number(m.yes_ask) : null;
        if (yesBid != null && yesAsk != null && yesBid > 0 && yesAsk > 0) {
          const bidNorm = yesBid <= 1 ? yesBid : yesBid / 100;
          const askNorm = yesAsk <= 1 ? yesAsk : yesAsk / 100;
          yp = (bidNorm + askNorm) / 2;
        } else {
          const raw = yesAsk ?? yesBid ?? m.last_price;
          if (raw != null) yp = Number(raw) <= 1 ? Number(raw) : Number(raw) / 100;
        }
        if (yp != null && yp > 0 && yp < 1) {
          const np = 1 - yp;
          warmPriceCache(normalizedProvider, marketId, yp);
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
            warmPriceCache(normalizedProvider, marketId, yp);
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

  // STEP 4: No real price available — return null instead of 0.50
  console.warn(`[Fast Price] All lookups failed for ${normalizedProvider}:${marketId} — returning null (no 0.50 fallback)`);
  return null;
}
