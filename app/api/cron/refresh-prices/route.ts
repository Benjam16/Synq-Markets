import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const POLYMARKET_CLOB = 'https://clob.polymarket.com';
const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

async function fetchPolymarketPriceByToken(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${POLYMARKET_CLOB}/price?token_id=${tokenId}&side=buy`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.price === 'number' ? data.price : Number(data.price) || null;
  } catch {
    return null;
  }
}

async function fetchPolymarketPriceBySlug(conditionId: string): Promise<number | null> {
  // Fallback: try Gamma API to get price by condition ID
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}&limit=1`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const market = Array.isArray(data) ? data[0] : data;
    if (!market) return null;
    const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [];
    const yesPrice = parseFloat(prices[0]);
    return !isNaN(yesPrice) && yesPrice > 0 && yesPrice < 1 ? yesPrice : null;
  } catch {
    return null;
  }
}

async function fetchKalshiPrice(ticker: string): Promise<number | null> {
  try {
    const cleanTicker = ticker.replace(/^kalshi-/i, '');
    const res = await fetch(`${KALSHI_API}/markets/${cleanTicker}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const market = data.market || data;
    const yesPrice = market.yes_ask ?? market.yes_bid ?? market.last_price;
    if (yesPrice !== undefined && yesPrice !== null) {
      return Number(yesPrice) <= 1 ? Number(yesPrice) : Number(yesPrice) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/cron/refresh-prices
 * Fetches live prices for all markets with open positions or pending parlay legs
 * and upserts them into market_price_cache.
 */
export async function GET(_req: NextRequest) {
  const start = Date.now();

  try {
    // 1. Get all distinct markets with open positions
    let openMarkets: { provider: string; market_id: string }[] = [];
    try {
      const res = await query<{ provider: string; market_id: string }>(
        `SELECT DISTINCT provider, market_id FROM simulated_trades WHERE status = 'open'`,
      );
      openMarkets = res.rows;
    } catch (e: any) {
      if (e?.message?.includes('column') || e?.code === '42703') {
        const res = await query<{ provider: string; market_id: string }>(
          `SELECT DISTINCT provider, market_id FROM simulated_trades WHERE close_price IS NULL AND closed_at IS NULL`,
        );
        openMarkets = res.rows;
      } else {
        console.error('[RefreshPrices] Error fetching open markets:', e);
      }
    }

    // 2. Get markets from pending parlay legs
    let parlayMarkets: { provider: string; market_id: string }[] = [];
    try {
      const parlayRes = await query<{ legs: any }>(
        `SELECT legs FROM parlay_bets WHERE status = 'pending'`,
      );
      for (const row of parlayRes.rows) {
        const legs = typeof row.legs === 'string' ? JSON.parse(row.legs) : row.legs;
        if (Array.isArray(legs)) {
          for (const leg of legs) {
            if (leg.marketId && leg.provider) {
              parlayMarkets.push({
                provider: leg.provider.toLowerCase(),
                market_id: leg.marketId,
              });
            }
          }
        }
      }
    } catch {
      // parlay_bets table may not exist yet
    }

    // 3. Merge and deduplicate
    const seen = new Set<string>();
    const allMarkets: { provider: string; market_id: string }[] = [];
    for (const m of [...openMarkets, ...parlayMarkets]) {
      const key = `${m.provider}:${m.market_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        allMarkets.push(m);
      }
    }

    if (allMarkets.length === 0) {
      return NextResponse.json({ updated: 0, elapsed: Date.now() - start });
    }

    // 4. Look up stored token_ids for Polymarket markets
    const polyMarkets = allMarkets.filter(m => m.provider === 'polymarket');
    const kalshiMarkets = allMarkets.filter(m => m.provider === 'kalshi');

    // Build a map of market_id → token_id from market_metadata
    const tokenIdMap = new Map<string, string>();
    if (polyMarkets.length > 0) {
      try {
        const tokenRows = await query<{ market_id: string; token_id: string }>(
          `SELECT market_id, token_id FROM market_metadata
           WHERE provider = 'polymarket' AND token_id IS NOT NULL AND token_id != ''
             AND market_id = ANY($1::text[])`,
          [polyMarkets.map(m => m.market_id)],
        );
        for (const row of tokenRows.rows) {
          tokenIdMap.set(row.market_id, row.token_id);
        }
      } catch {
        // token_id column may not exist yet
      }
    }

    const updates: { provider: string; market_id: string; price: number }[] = [];

    // Polymarket — try token_id first (CLOB), fall back to Gamma API by condition_id
    for (let i = 0; i < polyMarkets.length; i += 10) {
      const batch = polyMarkets.slice(i, i + 10);
      await Promise.allSettled(
        batch.map(async (m) => {
          let price: number | null = null;
          const tokenId = tokenIdMap.get(m.market_id);
          if (tokenId) {
            price = await fetchPolymarketPriceByToken(tokenId);
          }
          if (price === null) {
            price = await fetchPolymarketPriceBySlug(m.market_id);
          }
          if (price !== null && price > 0 && price < 1) {
            updates.push({ provider: m.provider, market_id: m.market_id, price });
          }
        }),
      );
    }

    // Kalshi — fetch in parallel batches of 10
    for (let i = 0; i < kalshiMarkets.length; i += 10) {
      const batch = kalshiMarkets.slice(i, i + 10);
      await Promise.allSettled(
        batch.map(async (m) => {
          const price = await fetchKalshiPrice(m.market_id);
          if (price !== null && price > 0 && price < 1) {
            updates.push({ provider: m.provider, market_id: m.market_id, price });
          }
        }),
      );
    }

    // 5. Upsert all prices into cache
    let upserted = 0;
    if (updates.length > 0) {
      const values = updates.map(
        (u, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}, NOW())`,
      );
      const params = updates.flatMap(u => [u.provider, u.market_id, u.price.toString()]);

      try {
        await query(
          `INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
           VALUES ${values.join(', ')}
           ON CONFLICT (provider, market_id)
           DO UPDATE SET last_price = EXCLUDED.last_price, as_of = EXCLUDED.as_of`,
          params,
        );
        upserted = updates.length;
      } catch (e) {
        console.error('[RefreshPrices] Batch upsert failed, falling back to individual:', e);
        for (const u of updates) {
          try {
            await query(
              `INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (provider, market_id)
               DO UPDATE SET last_price = EXCLUDED.last_price, as_of = EXCLUDED.as_of`,
              [u.provider, u.market_id, u.price.toString()],
            );
            upserted++;
          } catch {}
        }
      }
    }

    console.log(`[RefreshPrices] Updated ${upserted}/${allMarkets.length} prices in ${Date.now() - start}ms`);

    return NextResponse.json({
      total: allMarkets.length,
      updated: upserted,
      elapsed: Date.now() - start,
    });
  } catch (err) {
    console.error('[RefreshPrices] Fatal error:', err);
    return NextResponse.json({ error: 'Failed to refresh prices' }, { status: 500 });
  }
}
