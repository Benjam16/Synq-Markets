import { NextRequest, NextResponse } from 'next/server';
import { getPositions } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ownerPubkey = req.nextUrl.searchParams.get('ownerPubkey');
    if (!ownerPubkey) return NextResponse.json({ error: 'Missing ownerPubkey' }, { status: 400 });

    const positions = await getPositions(ownerPubkey);
    return NextResponse.json(positions, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch Jupiter prediction positions' },
      { status: 500 }
    );
  }
}

