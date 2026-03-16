import { NextRequest, NextResponse } from 'next/server';

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const GT_ACCEPT = 'application/json;version=20230203';

type Tf = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const candlesCache = new Map<
  string,
  { candles: Candle[]; poolId: string | null; tf: Tf; updatedAt: number }
>();
const CANDLES_CACHE_TTL_MS = 60_000;

function toGeckoTimeframe(tf: Tf): { timeframe: string; aggregate: number } {
  switch (tf) {
    case '1m':
      return { timeframe: 'minute', aggregate: 1 };
    case '5m':
      return { timeframe: 'minute', aggregate: 5 };
    case '15m':
      return { timeframe: 'minute', aggregate: 15 };
    case '1h':
      return { timeframe: 'hour', aggregate: 1 };
    case '4h':
      return { timeframe: 'hour', aggregate: 4 };
    case '1d':
      return { timeframe: 'day', aggregate: 1 };
  }
}

function pickBestPool(poolsData: any): string | null {
  // GeckoTerminal returns { data: [...], included: [...] } where included has pool/liquidity details.
  // We try to pick the pool with highest reserve_in_usd (if present), else first.
  const included = Array.isArray(poolsData?.included) ? poolsData.included : [];
  const pools = Array.isArray(poolsData?.data) ? poolsData.data : [];
  if (included.length) {
    let best: any = null;
    let bestLiq = -1;
    for (const inc of included) {
      if (inc?.type !== 'pool') continue;
      const liq = Number(inc?.attributes?.reserve_in_usd ?? inc?.attributes?.liquidity_usd ?? 0);
      if (liq > bestLiq) {
        bestLiq = liq;
        best = inc;
      }
    }
    if (best?.id) return String(best.id);
  }
  if (pools[0]?.id) return String(pools[0].id);
  return null;
}

/**
 * GET /api/stocks/candles?mint=<spl_mint>&tf=5m&limit=200
 * Returns OHLCV candles derived from best pool on Solana (GeckoTerminal).
 */
export async function GET(req: NextRequest) {
  try {
    const mint = req.nextUrl.searchParams.get('mint');
    const tf = (req.nextUrl.searchParams.get('tf') || '15m') as Tf;
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 200), 500);

    if (!mint) {
      return NextResponse.json({ error: 'mint required' }, { status: 400 });
    }

    const cacheKey = `${mint}:${tf}:${limit}`;
    const cached = candlesCache.get(cacheKey);
    const now = Date.now();

    // 1) Find pools for this token on Solana
    const poolsUrl = `${GT_BASE}/networks/solana/tokens/${encodeURIComponent(mint)}/pools`;
    const poolsRes = await fetch(poolsUrl, {
      cache: 'no-store',
      headers: { Accept: GT_ACCEPT },
    });
    const poolsJson = await poolsRes.json();
    if (!poolsRes.ok) {
      // Serve stale cache if available.
      if (cached && now - cached.updatedAt < 10 * CANDLES_CACHE_TTL_MS) {
        return NextResponse.json({
          poolId: cached.poolId,
          tf: cached.tf,
          candles: cached.candles,
          stale: true,
          error: 'Failed to fetch pools',
        });
      }
      return NextResponse.json({ candles: [], poolId: null, tf, stale: false });
    }

    const poolId = pickBestPool(poolsJson);
    if (!poolId) {
      if (cached) {
        return NextResponse.json({
          poolId: cached.poolId,
          tf: cached.tf,
          candles: cached.candles,
          stale: true,
          error: 'No pool found',
        });
      }
      return NextResponse.json({ candles: [], poolId: null, tf, stale: false });
    }

    // Gecko pool ids can be like "solana_<address>" – the OHLCV endpoint wants the pool address/id segment.
    const poolAddress = poolId.includes('_') ? poolId.split('_').slice(1).join('_') : poolId;

    // 2) Fetch OHLCV for that pool
    const { timeframe, aggregate } = toGeckoTimeframe(tf);
    const ohlcvUrl = `${GT_BASE}/networks/solana/pools/${encodeURIComponent(poolAddress)}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`;
    const ohlcvRes = await fetch(ohlcvUrl, {
      cache: 'no-store',
      headers: { Accept: GT_ACCEPT },
    });
    const ohlcvJson = await ohlcvRes.json();
    if (!ohlcvRes.ok) {
      if (cached && now - cached.updatedAt < 10 * CANDLES_CACHE_TTL_MS) {
        return NextResponse.json({
          poolId: cached.poolId,
          tf: cached.tf,
          candles: cached.candles,
          stale: true,
          error: 'Failed to fetch ohlcv',
        });
      }
      return NextResponse.json({ candles: [], poolId, tf, stale: false });
    }

    const list =
      ohlcvJson?.data?.attributes?.ohlcv_list ||
      ohlcvJson?.data?.attributes?.ohlcv ||
      [];

    // Each item: [time, open, high, low, close, volume]
    const candles: Candle[] = Array.isArray(list)
      ? list
          .map((c: any[]) => ({
            time: Number(c[0]), // unix seconds
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5]),
          }))
          .filter((c: any) => Number.isFinite(c.time) && Number.isFinite(c.open))
      : [];

    if (candles.length) {
      candlesCache.set(cacheKey, { candles, poolId, tf, updatedAt: now });
    }

    // If upstream returns empty, serve cache to avoid blank charts.
    if (!candles.length && cached) {
      return NextResponse.json({
        poolId: cached.poolId,
        tf: cached.tf,
        candles: cached.candles,
        stale: true,
      });
    }

    return NextResponse.json({ poolId, tf, candles, stale: false });
  } catch (e) {
    console.error('[api/stocks/candles]', e);
    // Serve stale cache if possible.
    try {
      const mint = req.nextUrl.searchParams.get('mint') || '';
      const tf = (req.nextUrl.searchParams.get('tf') || '15m') as Tf;
      const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 200), 500);
      const cacheKey = `${mint}:${tf}:${limit}`;
      const cached = candlesCache.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          poolId: cached.poolId,
          tf: cached.tf,
          candles: cached.candles,
          stale: true,
          error: e instanceof Error ? e.message : 'Candles error',
        });
      }
    } catch {}
    return NextResponse.json({ candles: [], poolId: null, stale: false });
  }
}

