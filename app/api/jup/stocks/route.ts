import { NextResponse } from 'next/server';
import {
  getStockList,
  fetchPriceV2,
  fetchTokensV2,
  enrichStock,
} from '@/lib/jup-stocks';

/**
 * GET /api/jup/stocks
 * Returns all RWA stocks with price (and optional Tokens V2 enrichment when JUPITER_API_KEY is set).
 */
export async function GET() {
  try {
    // Support both env names: JUPITER_API_KEY (what you have) and JUPITER_API_KEY (alt)
    const apiKey = process.env.JUPITER_API_KEY || process.env.JUPITER_API_KEY;
    const list = getStockList();
    const withMint = list.filter((t) => t.mint);
    const mints = withMint.map((t) => t.mint);

    const [priceData, tokensV2Raw] = await Promise.all([
      fetchPriceV2(mints, apiKey),
      apiKey
        ? fetchTokensV2(mints, apiKey)
        : Promise.resolve({}),
    ]);

    const tokensV2Data = tokensV2Raw as Record<string, any>;

    const stocks = withMint.map((t) =>
      enrichStock(t, priceData[t.mint], tokensV2Data[t.mint])
    );

    return NextResponse.json({ stocks });
  } catch (e) {
    console.error('[api/jup/stocks]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch stocks' },
      { status: 500 }
    );
  }
}
