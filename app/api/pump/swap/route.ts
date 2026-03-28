import { NextRequest, NextResponse } from 'next/server';
import { jupiterSwapV6 } from '@/lib/jup-swap';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      quoteResponse?: Record<string, unknown>;
      userPublicKey?: string;
    } | null;

    if (!body?.quoteResponse || !body?.userPublicKey) {
      return NextResponse.json(
        { error: 'quoteResponse and userPublicKey required' },
        { status: 400 },
      );
    }

    const resp = await jupiterSwapV6({
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey,
    });

    return NextResponse.json(resp, { status: 200 });
  } catch (e) {
    console.error('[api/pump/swap]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Pump swap error' },
      { status: 500 },
    );
  }
}
