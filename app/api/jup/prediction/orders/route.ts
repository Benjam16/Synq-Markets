import { NextRequest, NextResponse } from 'next/server';
import { createOrder, JupCreateOrderRequest } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<JupCreateOrderRequest>;

    if (!body.ownerPubkey || !body.marketId || typeof body.isYes !== 'boolean' || typeof body.isBuy !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!body.depositAmount || !body.depositMint) {
      return NextResponse.json({ error: 'Missing depositAmount or depositMint' }, { status: 400 });
    }

    const resp = await createOrder(body as JupCreateOrderRequest);
    return NextResponse.json(resp, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create Jupiter prediction order' },
      { status: 500 }
    );
  }
}

