import { NextRequest, NextResponse } from 'next/server';
import { getBagsPools, getBagsTokenLaunchFeed } from '@/lib/bags';
import { fetchGeckoStatsForMints } from '@/lib/geckoterminal-stats';
import { getMintMetadata } from '@/lib/solana-metadata';
import { getDflowMintDecimals } from '@/lib/dflow-tokens';

export const runtime = 'nodejs';

function normalizeBagsMint(raw: string): string {
  const s = String(raw || '').trim();
  // Strip ONLY the dotted suffix; plain trailing "BAGS" is a valid mint for many Bags tokens.
  return s.replace(/\.BAGS$/i, '');
}

type BagsTokenRow = {
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
  source?: 'feed' | 'pools';
};

// Simple in-memory cache to avoid hammering GeckoTerminal and Bags quote API.
let cached:
  | { rows: BagsTokenRow[]; updatedAt: number; onlyMigrated: boolean }
  | null = null;
const TTL_MS = 2 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    const { searchParams } = req.nextUrl;
    const onlyMigrated = searchParams.get('onlyMigrated') === 'true';
    // We only ever show the top 50 movers; keep limit bounded accordingly.
    const limit = Math.min(Number(searchParams.get('limit') || 50), 50);

    if (
      cached &&
      cached.onlyMigrated === onlyMigrated &&
      now - cached.updatedAt < TTL_MS
    ) {
      return NextResponse.json({
        tokens: cached.rows.slice(0, limit),
        stale: false,
        cached: true,
      });
    }

    const [pools, feed] = await Promise.all([
      getBagsPools(onlyMigrated).catch(() => []),
      getBagsTokenLaunchFeed().catch(() => []),
    ]);

    // Prefer Bags' own launch feed for metadata (name/symbol/image).
    const feedItems = (feed || [])
      .map((i) => ({
        mint: normalizeBagsMint(String(i.tokenMint || '')),
        name: String(i.name || ''),
        symbol: String(i.symbol || ''),
        image: String(i.image || ''),
      }))
      .filter((i) => i.mint && i.mint.length > 0);

    const poolsMints = (pools || [])
      .map((p) => normalizeBagsMint(String((p as any)?.tokenMint || '')))
      .filter((m) => m && m.length > 0);

    // Universe: feed first (most relevant), then pools. Cap at 80 for fast first load.
    const universe = Array.from(
      new Set([...feedItems.map((i) => i.mint), ...poolsMints]),
    ).slice(0, 80);

    // 1) Pull market stats from GeckoTerminal (best pool on Solana)
    const gtStats = await fetchGeckoStatsForMints(universe);

    // 2) Pull name/symbol/image from Bags token launch feed when available (single call).
    const feedMap = new Map<string, { name: string; symbol: string; image: string }>();
    for (const item of feedItems) {
      feedMap.set(item.mint, { name: item.name, symbol: item.symbol, image: item.image });
    }
    const feedMintSet = new Set(feedItems.map((i) => i.mint));

    // On-chain metadata fallback for anything not in feed.
    const needMeta = universe.filter((m) => !feedMap.has(m)).slice(0, 30);
    const metaPairs = await Promise.all(
      needMeta.map(async (m) => {
        try {
          const md = await getMintMetadata(m);
          return [m, md] as const;
        } catch {
          return [m, null] as const;
        }
      }),
    );
    const metaMap = new Map(metaPairs.filter(([, v]) => v).map(([k, v]) => [k, v!]));

    const rows: BagsTokenRow[] = universe.map((mint) => {
      const s = gtStats[mint] || {};
      const f = feedMap.get(mint);
      const md = metaMap.get(mint);
      const name = f?.name || md?.name || null;
      const symbol = f?.symbol || md?.symbol || null;
      const imageUrl = f?.image || md?.image || null;
      const priceUsd = s.priceUsd;
      return {
        mint,
        name,
        symbol,
        imageUrl,
        priceUsd,
        volume24hUsd: s.volume24hUsd,
        liquidityUsd: s.liquidityUsd,
        fdvUsd: s.fdvUsd,
        marketCapUsd: s.marketCapUsd ?? null,
        priceChange24h: s.priceChange24h,
        source: feedMintSet.has(mint) ? 'feed' : 'pools',
      };
    });

    // Keep tokens with a real price AND non-zero 24h volume (traded in the past 24h),
    // prefer those with 24h change, sort by absolute 24h move.
    const ranked = rows
      .filter(
        (r) =>
          typeof r.priceUsd === 'number' &&
          Number.isFinite(r.priceUsd) &&
          typeof r.volume24hUsd === 'number' &&
          Number.isFinite(r.volume24hUsd) &&
          r.volume24hUsd > 0,
      )
      .sort((a, b) => {
        const aHasChange =
          typeof a.priceChange24h === 'number' && Number.isFinite(a.priceChange24h);
        const bHasChange =
          typeof b.priceChange24h === 'number' && Number.isFinite(b.priceChange24h);
        if (aHasChange && !bHasChange) return -1;
        if (!aHasChange && bHasChange) return 1;
        const aAbs = aHasChange ? Math.abs(a.priceChange24h as number) : 0;
        const bAbs = bHasChange ? Math.abs(b.priceChange24h as number) : 0;
        return bAbs - aAbs;
      });

    cached = { rows: ranked, updatedAt: now, onlyMigrated };
    return NextResponse.json({
      tokens: ranked.slice(0, limit),
      stale: false,
      cached: false,
    });
  } catch (e) {
    console.error('[api/bags/tokens]', e);
    if (cached) {
      return NextResponse.json(
        {
          tokens: cached.rows,
          stale: true,
          error: e instanceof Error ? e.message : 'Bags tokens error',
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { tokens: [], error: e instanceof Error ? e.message : 'Bags tokens error' },
      { status: 500 },
    );
  }
}

