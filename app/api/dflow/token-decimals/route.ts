import { NextRequest, NextResponse } from 'next/server';
import { getDflowMintDecimals } from '@/lib/dflow-tokens';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const mint = req.nextUrl.searchParams.get('mint');
    if (!mint) {
      return NextResponse.json(
        { error: 'mint query param required' },
        { status: 400 },
      );
    }

    const decimals = await getDflowMintDecimals(mint);
    if (decimals == null) {
      return NextResponse.json(
        { mint, decimals: null, error: 'Mint not found in Dflow tokens list' },
        { status: 200 },
      );
    }

    return NextResponse.json({ mint, decimals });
  } catch (e) {
    console.error('[api/dflow/token-decimals]', e);
    return NextResponse.json(
      {
        decimals: null,
        error: e instanceof Error ? e.message : 'Failed to load decimals',
      },
      { status: 500 },
    );
  }
}

