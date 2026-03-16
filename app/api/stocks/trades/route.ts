import { NextRequest, NextResponse } from 'next/server';

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const GT_ACCEPT = 'application/json;version=20230203';

type TradeRow = {
  id: string;
  time: string;
  side: 'buy' | 'sell';
  priceUsd: number;
  volumeUsd: number;
  tokenAmount: number;
  maker: string;
  txHash: string;
};

const tradesCache = new Map<
  string,
  { trades: TradeRow[]; poolId: string | null; updatedAt: number }
>();
const TRADES_CACHE_TTL_MS = 30_000;

function pickBestPool(poolsData: any): string | null {
  const included = Array.isArray(poolsData?.included) ? poolsData.included : [];
  const pools = Array.isArray(poolsData?.data) ? poolsData.data : [];
  if (included.length) {
    let best: any = null;
    let bestLiq = -1;
    for (const inc of included) {
      if (inc?.type !== 'pool') continue;
      const liq = Number(
        inc?.attributes?.reserve_in_usd ?? inc?.attributes?.liquidity_usd ?? 0
      );
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
 * GET /api/stocks/trades?mint=<spl_mint>&limit=50
 * Returns recent pool trades (GeckoTerminal) for the best Solana pool.
 */
export async function GET(req: NextRequest) {
  try {
    const mint = req.nextUrl.searchParams.get('mint');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100);

    if (!mint) {
      return NextResponse.json({ error: 'mint required' }, { status: 400 });
    }

    const cacheKey = `${mint}:${limit}`;
    const cached = tradesCache.get(cacheKey);
    const now = Date.now();

    // 1) Find pools for this token on Solana
    const poolsUrl = `${GT_BASE}/networks/solana/tokens/${encodeURIComponent(mint)}/pools`;
    const poolsRes = await fetch(poolsUrl, {
      cache: 'no-store',
      headers: { Accept: GT_ACCEPT },
    });
    const poolsJson = await poolsRes.json();
    if (!poolsRes.ok) {
      if (cached && now - cached.updatedAt < 10 * TRADES_CACHE_TTL_MS) {
        return NextResponse.json({
          poolId: cached.poolId,
          trades: cached.trades,
          stale: true,
          error: 'Failed to fetch pools',
        });
      }
      return NextResponse.json({ trades: [], poolId: null, stale: false });
    }

    const poolId = pickBestPool(poolsJson);
    if (!poolId) {
      if (cached) {
        return NextResponse.json({
          poolId: cached.poolId,
          trades: cached.trades,
          stale: true,
          error: 'No pool found',
        });
      }
      return NextResponse.json({ trades: [], poolId: null, stale: false });
    }

    const poolAddress = poolId.includes('_') ? poolId.split('_').slice(1).join('_') : poolId;

    // 2) Fetch trades for the pool
    const tradesUrl = `${GT_BASE}/networks/solana/pools/${encodeURIComponent(poolAddress)}/trades`;
    const tradesRes = await fetch(tradesUrl, {
      cache: 'no-store',
      headers: { Accept: GT_ACCEPT },
    });
    const tradesJson = await tradesRes.json();
    if (!tradesRes.ok) {
      if (cached && now - cached.updatedAt < 10 * TRADES_CACHE_TTL_MS) {
        return NextResponse.json({
          poolId: cached.poolId,
          trades: cached.trades,
          stale: true,
          error: 'Failed to fetch trades',
        });
      }
      return NextResponse.json({ trades: [], poolId, stale: false });
    }

    const rows = Array.isArray(tradesJson?.data) ? tradesJson.data : [];

    const trades: TradeRow[] = rows.slice(0, limit).map((t: any) => {
      const a = t?.attributes || {};
      const kind = String(a.kind || '').toLowerCase(); // buy/sell
      const txHash = String(a.tx_hash || '');
      const ts = String(a.block_timestamp || '');
      const maker = String(a.tx_from_address || '');
      const volumeUsd = Number(a.volume_in_usd || 0);
      const fromAddr = String(a.from_token_address || '');
      const toAddr = String(a.to_token_address || '');
      const priceUsd =
        toAddr === mint
          ? Number(a.price_to_in_usd || 0)
          : fromAddr === mint
            ? Number(a.price_from_in_usd || 0)
            : Number(a.price_to_in_usd || a.price_from_in_usd || 0);

      const tokenAmount =
        toAddr === mint
          ? Number(a.to_token_amount || 0)
          : fromAddr === mint
            ? Number(a.from_token_amount || 0)
            : Number(a.to_token_amount || a.from_token_amount || 0);

      return {
        id: String(t?.id || txHash || Math.random()),
        time: ts,
        side: kind === 'sell' ? 'sell' : 'buy',
        priceUsd,
        volumeUsd,
        tokenAmount,
        maker,
        txHash,
      };
    });

    if (trades.length) {
      tradesCache.set(cacheKey, { trades, poolId, updatedAt: now });
    }

    if (!trades.length && cached) {
      return NextResponse.json({
        poolId: cached.poolId,
        trades: cached.trades,
        stale: true,
      });
    }

    return NextResponse.json({ poolId, trades, stale: false });
  } catch (e) {
    console.error('[api/stocks/trades]', e);
    try {
      const mint = req.nextUrl.searchParams.get('mint') || '';
      const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100);
      const cacheKey = `${mint}:${limit}`;
      const cached = tradesCache.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          poolId: cached.poolId,
          trades: cached.trades,
          stale: true,
          error: e instanceof Error ? e.message : 'Trades error',
        });
      }
    } catch {}
    return NextResponse.json({ trades: [], poolId: null, stale: false });
  }
}

