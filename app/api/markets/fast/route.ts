/**
 * Fast Crypto Markets API
 *
 * Returns "Up or Down" crypto markets from both Polymarket and Kalshi —
 * the rolling 5-min, 15-min, and hourly crypto price resolution markets.
 *
 * Rather than making separate API calls (which can fail or return stale data),
 * this endpoint filters from the same full market dataset already fetched and
 * cached by fetchAllMarkets(). This guarantees the Fast tab always shows the
 * same markets that appear when you search "up or down" in the Crypto tab.
 *
 * GET /api/markets/fast
 */

import { NextResponse } from 'next/server';
import { fetchFastCryptoMarkets } from '@/lib/market-fetchers';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// In-process cache — 30s TTL (fast markets change often but share underlying
// data with the main /api/markets cache which is 60s)
let _cache: { markets: any[]; ts: number } | null = null;
const TTL = 30_000;

export async function GET() {
  try {
    const now = Date.now();
    if (_cache && now - _cache.ts < TTL) {
      return NextResponse.json(
        { markets: _cache.markets, count: _cache.markets.length },
        { headers: { 'Cache-Control': 'no-cache, no-store', 'X-Cache': 'HIT' } },
      );
    }

    const markets = await fetchFastCryptoMarkets();
    _cache = { markets, ts: now };

    return NextResponse.json(
      { markets, count: markets.length },
      { headers: { 'Cache-Control': 'no-cache, no-store', 'X-Cache': 'MISS' } },
    );
  } catch (err) {
    console.error('[FastMarkets API]', err);
    // On error, return stale cache if available
    if (_cache) {
      return NextResponse.json({ markets: _cache.markets, count: _cache.markets.length, stale: true });
    }
    return NextResponse.json({ markets: [], count: 0, error: String(err) }, { status: 500 });
  }
}
