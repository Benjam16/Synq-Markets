import { NextRequest, NextResponse } from 'next/server';
import { closePosition } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, context: any) {
  try {
    const body = (await req.json().catch(() => ({}))) as { ownerPubkey?: string };
    if (!body.ownerPubkey) return NextResponse.json({ error: 'Missing ownerPubkey' }, { status: 400 });

    const positionPubkey = context?.params?.positionPubkey as string | undefined;
    if (!positionPubkey) return NextResponse.json({ error: 'positionPubkey param is required' }, { status: 400 });

    const resp = await closePosition(positionPubkey, body.ownerPubkey);
    return NextResponse.json(resp, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to close Jupiter prediction position' },
      { status: 500 }
    );
  }
}

