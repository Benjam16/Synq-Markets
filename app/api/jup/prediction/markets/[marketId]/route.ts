import { NextRequest, NextResponse } from 'next/server';
import { getMarket } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

// Use a loose context type to satisfy Next.js 16 RouteHandlerConfig
export async function GET(_req: NextRequest, context: any) {
  try {
    // In newer Next versions, context.params can be a Promise
    const params = await context?.params;
    const marketId: string | undefined = params?.marketId;
    if (!marketId) {
      return NextResponse.json({ error: 'marketId required' }, { status: 400 });
    }

    const market = await getMarket(marketId);
    return NextResponse.json(market, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch Jupiter prediction market' },
      { status: 500 }
    );
  }
}

