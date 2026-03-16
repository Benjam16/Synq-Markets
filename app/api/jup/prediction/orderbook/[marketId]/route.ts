import { NextRequest, NextResponse } from 'next/server';
import { getOrderbook } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

// Compatible with Next 16 RouteHandlerConfig where context.params may be a Promise
export async function GET(_req: NextRequest, context: any) {
  try {
    const params = await context?.params;
    const marketId: string | undefined = params?.marketId;
    if (!marketId) {
      return NextResponse.json({ error: 'marketId required' }, { status: 400 });
    }

    const ob = await getOrderbook(marketId);
    return NextResponse.json(ob, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch Jupiter prediction orderbook' },
      { status: 500 }
    );
  }
}

