import { NextResponse } from 'next/server';
import { loadDflowStocks } from '@/lib/dflow';
import type { JupStockDetail } from '@/lib/jup-stocks';
import { fetchOnchainStatsForMints } from '@/lib/coingecko-onchain';
import { fetchGeckoStatsForMints } from '@/lib/geckoterminal-stats';
import { fetchCoinMarketsById } from '@/lib/coingecko-coins';

// Ensure this runs in the Node.js runtime (not edge),
// so we can use standard outgoing HTTPS requests to Dflow.
export const runtime = 'nodejs';

/**
 * GET /api/stocks/dflow
 *
 * Temporary bridge endpoint that:
 * - Uses Dflow's Trading API token list as the source of mints
 * - Maps each mint into a minimal JupStockDetail so the existing
 *   Stocks UI and RwaDetailPanel can continue to work unchanged.
 *
 * Once you have a dedicated Dflow "stocks" universe + richer metadata,
 * we can swap this mapper to reflect those fields.
 */
export async function GET() {
  try {
    const configs = loadDflowStocks();

    const mints = configs.map((c) => c.mint);
    const ids = configs
      .map((c) => c.coingeckoId || '')
      .filter((id) => id && typeof id === 'string');

    const [cgStatsMap, gtStatsMap, marketsMap] = await Promise.all([
      fetchOnchainStatsForMints(mints),
      fetchGeckoStatsForMints(mints),
      fetchCoinMarketsById(ids),
    ]);

    const stocks: JupStockDetail[] = configs.map((cfg) => {
      const cg = cgStatsMap[cfg.mint] ?? {};
      const gt = gtStatsMap[cfg.mint] ?? {};
      const market = cfg.coingeckoId
        ? marketsMap[cfg.coingeckoId]
        : undefined;

      const price =
        market?.current_price ?? cg.priceUsd ?? gt.priceUsd ?? 0;

      return {
        symbol: cfg.symbol,
        name: cfg.name,
        underlying: 'DFLOW_TOKEN',
        mint: cfg.mint,
        sector: undefined,
        description: undefined,
        links: {},
        price,
        markPrice: price,
        discount: undefined,
        stockMc: undefined,
        mc:
          market?.market_cap ??
          cg.marketCapUsd ??
          gt.marketCapUsd ??
          undefined,
        stats: {
          priceChange5m: cg.priceChange5m ?? gt.priceChange5m,
          priceChange1h: cg.priceChange1h ?? gt.priceChange1h,
          priceChange6h: cg.priceChange6h ?? gt.priceChange6h,
          priceChange24h:
            market?.price_change_percentage_24h ??
            cg.priceChange24h ??
            gt.priceChange24h,
          volume24h:
            market?.total_volume ??
            cg.volume24hUsd ??
            gt.volume24hUsd,
          liquidity: cg.liquidityUsd ?? gt.liquidityUsd,
          mcap:
            market?.market_cap ??
            cg.marketCapUsd ??
            gt.marketCapUsd ??
            undefined,
        },
        tokenInfo: undefined,
        icon: market?.image ?? cg.iconUrl,
        decimals: cg.decimals ?? cfg.decimals,
      };
    });

    return NextResponse.json({ stocks });
  } catch (e) {
    console.error('[api/stocks/dflow]', e);
    const message =
      e instanceof Error ? e.message : 'Unknown error contacting Dflow';
    return NextResponse.json(
      { stocks: [], error: `Failed to load Dflow stocks: ${message}` },
      { status: 500 },
    );
  }
}

