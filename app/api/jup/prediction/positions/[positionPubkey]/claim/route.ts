import { NextRequest, NextResponse } from 'next/server';
import { claimPosition } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { positionPubkey: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as { ownerPubkey?: string };
    if (!body.ownerPubkey) return NextResponse.json({ error: 'Missing ownerPubkey' }, { status: 400 });

    const resp = await claimPosition(params.positionPubkey, body.ownerPubkey);
    return NextResponse.json(resp, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to claim Jupiter prediction position payout' },
      { status: 500 }
    );
  }
}

