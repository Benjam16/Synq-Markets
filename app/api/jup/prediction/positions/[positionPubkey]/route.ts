import { NextRequest, NextResponse } from 'next/server';
import { closePosition } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { positionPubkey: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as { ownerPubkey?: string };
    if (!body.ownerPubkey) return NextResponse.json({ error: 'Missing ownerPubkey' }, { status: 400 });

    const resp = await closePosition(params.positionPubkey, body.ownerPubkey);
    return NextResponse.json(resp, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to close Jupiter prediction position' },
      { status: 500 }
    );
  }
}

