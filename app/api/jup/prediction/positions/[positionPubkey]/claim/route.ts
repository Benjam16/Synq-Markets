import { NextRequest, NextResponse } from 'next/server';
import { claimPosition } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

// Use a broad `any` context type so this stays compatible
// with the App Route handler context type that Vercel expects.
export async function POST(req: NextRequest, context: any) {
  try {
    const body = (await req.json().catch(() => ({}))) as { ownerPubkey?: string };
    if (!body.ownerPubkey) {
      return NextResponse.json({ error: 'Missing ownerPubkey' }, { status: 400 });
    }

    const positionPubkey = context?.params?.positionPubkey as string | undefined;
    if (!positionPubkey) {
      return NextResponse.json(
        { error: 'positionPubkey param is required' },
        { status: 400 },
      );
    }

    const resp = await claimPosition(positionPubkey, body.ownerPubkey);
    return NextResponse.json(resp, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to claim Jupiter prediction position payout' },
      { status: 500 },
    );
  }
}

