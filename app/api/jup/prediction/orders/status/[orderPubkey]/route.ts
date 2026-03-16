import { NextRequest, NextResponse } from 'next/server';
import { getOrderStatus } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

// Use a broad `any` type for context so the signature
// is compatible with Next.js' internal AppRouteHandlerFnContext.
export async function GET(_req: NextRequest, context: any) {
  try {
    const orderPubkey = context?.params?.orderPubkey as string | undefined;
    if (!orderPubkey) {
      return NextResponse.json(
        { error: 'orderPubkey param is required' },
        { status: 400 },
      );
    }
    const status = await getOrderStatus(orderPubkey);
    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch Jupiter prediction order status' },
      { status: 500 },
    );
  }
}

