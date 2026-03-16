import { NextRequest, NextResponse } from 'next/server';
import { createBagsSwapTransaction, type BagsTradeQuoteResponse } from '@/lib/bags';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      quoteResponse?: BagsTradeQuoteResponse;
      userPublicKey?: string;
    };

    if (!body?.quoteResponse || !body?.userPublicKey) {
      return NextResponse.json(
        { error: 'quoteResponse and userPublicKey required' },
        { status: 400 },
      );
    }

    const resp = await createBagsSwapTransaction({
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey,
    });

    return NextResponse.json(resp, { status: 200 });
  } catch (e) {
    console.error('[api/bags/swap]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bags swap error' },
      { status: 500 },
    );
  }
}

