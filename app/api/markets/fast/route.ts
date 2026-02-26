/**
 * Fast Crypto Markets API
 *
 * Returns crypto markets from Polymarket and Kalshi that resolve within
 * the next ~60 minutes. Short cache TTL (15s) so countdowns stay accurate.
 *
 * GET /api/markets/fast
 */

import { NextResponse } from 'next/server';
import { fetchFastCryptoMarkets } from '@/lib/market-fetchers';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// In-process cache — 15 second TTL
let _cache: { markets: any[]; ts: number } | null = null;
const TTL = 15_000;

export async function GET() {
  try {
    const now = Date.now();
    if (_cache && now - _cache.ts < TTL) {
      return NextResponse.json(
        { markets: _cache.markets },
        { headers: { 'Cache-Control': 'no-cache, no-store', 'X-Cache': 'HIT' } },
      );
    }

    const markets = await fetchFastCryptoMarkets();
    _cache = { markets, ts: now };

    return NextResponse.json(
      { markets },
      { headers: { 'Cache-Control': 'no-cache, no-store', 'X-Cache': 'MISS' } },
    );
  } catch (err) {
    console.error('[FastMarkets API]', err);
    return NextResponse.json({ markets: [], error: String(err) }, { status: 500 });
  }
}
