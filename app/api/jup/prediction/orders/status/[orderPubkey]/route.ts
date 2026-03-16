import { NextRequest, NextResponse } from 'next/server';
import { getOrderStatus } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: { orderPubkey: string } },
) {
  try {
    const status = await getOrderStatus(context.params.orderPubkey);
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch Jupiter prediction order status' },
      { status: 500 }
    );
  }
}

