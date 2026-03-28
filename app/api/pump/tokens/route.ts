import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const GT_ACCEPT = 'application/json;version=20230203';

/** GeckoTerminal free tier rate-limits bursts; space calls and retry 429s. */
const PACE_MS = 220;
const TTL_MS = 4 * 60 * 1000;

type GeckoIncluded = {
  id: string;
  type: string;
  attributes?: {
    address?: string;
    name?: string;
    symbol?: string;
    image_url?: string | null;
    decimals?: number;
  };
};

export type PumpTokenRow = {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  marketCapUsd?: number | null;
  priceChange24h?: number;
  poolAddress?: string;
};

function numFromGeo(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function geckoPoolsUrl(pathWithNetwork: string, page: number): string {
  const url = new URL(`${GT_BASE}/networks/solana/${pathWithNetwork}`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('include', 'base_token,quote_token,dex');
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPoolsPageWithRetry(
  pathWithNetwork: string,
  page: number,
  maxAttempts = 4,
): Promise<{ data: any[]; included: GeckoIncluded[] }> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(geckoPoolsUrl(pathWithNetwork, page), {
      headers: { Accept: GT_ACCEPT },
      cache: 'no-store',
    });
    if (res.ok) {
      return res.json();
    }
    lastStatus = res.status;
    if (res.status === 429 && attempt < maxAttempts - 1) {
      const ra = res.headers.get('retry-after');
      const fromHeader = ra ? parseInt(ra, 10) * 1000 : 0;
      const backoff = fromHeader > 0 ? Math.min(fromHeader, 25_000) : 1200 * (attempt + 1);
      await sleep(backoff);
      continue;
    }
    throw new Error(`${pathWithNetwork} p${page}: ${res.status}`);
  }
  throw new Error(`${pathWithNetwork} p${page}: ${lastStatus}`);
}

/**
 * Sequential fetches with pacing to avoid GeckoTerminal 429 on parallel bursts.
 * Extra pages are best-effort: failures after page 1 still return merged data.
 */
async function collectGeckoPumpPages(): Promise<{
  poolsRaw: any[];
  mergedIncluded: GeckoIncluded[];
}> {
  const jobs: Array<{ path: string; page: number }> = [
    { path: 'trending_pools', page: 1 },
    { path: 'trending_pools', page: 2 },
    { path: 'new_pools', page: 1 },
  ];

  const poolsRaw: any[] = [];
  const mergedIncluded: GeckoIncluded[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const { path, page } = jobs[i];
    if (i > 0) await sleep(PACE_MS);
    try {
      const chunk = await fetchPoolsPageWithRetry(path, page);
      poolsRaw.push(...(chunk.data || []));
      mergedIncluded.push(...(chunk.included || []));
    } catch (e) {
      // First page is required; later pages optional when rate-limited.
      if (i === 0) throw e;
      console.warn('[api/pump/tokens] optional gecko page skipped', path, page, e);
    }
  }

  return { poolsRaw, mergedIncluded };
}

function buildRows(
  poolsRaw: any[],
  mergedIncluded: GeckoIncluded[],
): PumpTokenRow[] {
  const incMap = new Map<string, GeckoIncluded>();
  for (const x of mergedIncluded) {
    incMap.set(`${x.type}:${x.id}`, x);
  }

  const byMint = new Map<string, PumpTokenRow>();

  for (const pool of poolsRaw) {
    const dexId = pool?.relationships?.dex?.data?.id;
    if (dexId !== 'pumpswap') continue;

    const bt = pool?.relationships?.base_token?.data;
    if (!bt?.id) continue;
    const token = incMap.get(`${bt.type}:${bt.id}`);
    const mint = token?.attributes?.address;
    if (!mint) continue;

    const attrs = pool.attributes || {};
    const priceUsd = numFromGeo(attrs.base_token_price_usd);
    const vol = numFromGeo(attrs.volume_usd?.h24);
    const liq = numFromGeo(attrs.reserve_in_usd);
    const fdv = numFromGeo(attrs.fdv_usd);
    const mcap = numFromGeo(attrs.market_cap_usd);
    const pc = attrs.price_change_percentage;
    const pc24 = numFromGeo(pc?.h24);

    const row: PumpTokenRow = {
      mint,
      name: token.attributes?.name ?? null,
      symbol: token.attributes?.symbol ?? null,
      imageUrl: token.attributes?.image_url ?? null,
      priceUsd: priceUsd || undefined,
      volume24hUsd: vol || undefined,
      liquidityUsd: liq || undefined,
      fdvUsd: fdv || undefined,
      marketCapUsd: mcap || null,
      priceChange24h: Number.isFinite(pc24) ? pc24 : undefined,
      poolAddress: typeof attrs.address === 'string' ? attrs.address : undefined,
    };

    const prev = byMint.get(mint);
    if (!prev || (row.volume24hUsd || 0) > (prev.volume24hUsd || 0)) {
      byMint.set(mint, row);
    }
  }

  return Array.from(byMint.values()).sort((a, b) => {
    const va = a.volume24hUsd || 0;
    const vb = b.volume24hUsd || 0;
    if (vb !== va) return vb - va;
    return Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0);
  });
}

let cache: { rows: PumpTokenRow[]; updatedAt: number } | null = null;

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 80), 120);
  const now = Date.now();

  try {
    if (cache && now - cache.updatedAt < TTL_MS && cache.rows.length > 0) {
      return NextResponse.json({
        tokens: cache.rows.slice(0, limit),
        cached: true,
      });
    }

    const { poolsRaw, mergedIncluded } = await collectGeckoPumpPages();
    const rows = buildRows(poolsRaw, mergedIncluded);

    if (rows.length > 0) {
      cache = { rows, updatedAt: now };
    }

    return NextResponse.json({
      tokens: rows.slice(0, limit),
      cached: false,
    });
  } catch (e) {
    console.error('[api/pump/tokens]', e);
    const msg = e instanceof Error ? e.message : 'Pump tokens error';

    if (cache && cache.rows.length > 0) {
      return NextResponse.json({
        tokens: cache.rows.slice(0, limit),
        cached: true,
        stale: true,
        error: msg,
      });
    }

    return NextResponse.json(
      {
        tokens: [],
        error: msg,
      },
      { status: 200 },
    );
  }
}
