import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const GT_ACCEPT = 'application/json;version=20230203';

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

async function fetchPoolsPage(
  pathWithNetwork: string,
  page: number,
): Promise<{ data: any[]; included: GeckoIncluded[] }> {
  const res = await fetch(geckoPoolsUrl(pathWithNetwork, page), {
    headers: { Accept: GT_ACCEPT },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${pathWithNetwork} p${page}: ${res.status}`);
  return res.json();
}

let cache: { rows: PumpTokenRow[]; updatedAt: number } | null = null;
const TTL_MS = 90 * 1000;

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 80), 120);

    if (cache && now - cache.updatedAt < TTL_MS) {
      return NextResponse.json({
        tokens: cache.rows.slice(0, limit),
        cached: true,
      });
    }

    const pages = await Promise.all([
      fetchPoolsPage('trending_pools', 1),
      fetchPoolsPage('trending_pools', 2),
      fetchPoolsPage('trending_pools', 3),
      fetchPoolsPage('new_pools', 1).catch(() => ({ data: [], included: [] })),
    ]);

    const mergedIncluded: GeckoIncluded[] = [];
    const poolsRaw: any[] = [];
    for (const p of pages) {
      poolsRaw.push(...(p.data || []));
      mergedIncluded.push(...(p.included || []));
    }

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

    const rows = Array.from(byMint.values()).sort((a, b) => {
      const va = a.volume24hUsd || 0;
      const vb = b.volume24hUsd || 0;
      if (vb !== va) return vb - va;
      return Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0);
    });

    cache = { rows, updatedAt: now };

    return NextResponse.json({
      tokens: rows.slice(0, limit),
      cached: false,
    });
  } catch (e) {
    console.error('[api/pump/tokens]', e);
    return NextResponse.json(
      {
        tokens: [],
        error: e instanceof Error ? e.message : 'Pump tokens error',
      },
      { status: 200 },
    );
  }
}
