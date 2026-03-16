import { NextRequest, NextResponse } from 'next/server';
import {
  getStockList,
  fetchPriceV2,
  fetchTokensV2,
  enrichStock,
} from '@/lib/jup-stocks';

/**
 * GET /api/jup/stocks/[mint]
 * Returns full detail for one RWA stock (Jupiter-style stats when JUPITER_API_KEY is set).
 */
export async function GET(_req: NextRequest, context: any) {
  try {
    const apiKey = process.env.JUPITER_API_KEY || process.env.JUPITER_API_KEY;
    const mint = context?.params?.mint as string | undefined;
    if (!mint) {
      return NextResponse.json({ error: 'mint required' }, { status: 400 });
    }

    const list = getStockList();
    const config = list.find((t) => t.mint === mint);
    if (!config) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
    }

    const [priceData, tokensV2Raw] = await Promise.all([
      fetchPriceV2([mint], apiKey),
      apiKey
        ? fetchTokensV2([mint], apiKey)
        : Promise.resolve({}),
    ]);

    const tokensV2Data = tokensV2Raw as Record<string, any>;

    const stock = enrichStock(config, priceData[mint], tokensV2Data[mint]);
    return NextResponse.json(stock);
  } catch (e) {
    console.error('[api/jup/stocks/[mint]]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch stock' },
      { status: 500 }
    );
  }
}
