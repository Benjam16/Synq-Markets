import { NextResponse } from 'next/server';
import { fetchCoinMarketsById } from '@/lib/coingecko-coins';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const markets = await fetchCoinMarketsById(['solana', 'usd-coin']);
    const sol = markets['solana']?.current_price ?? null;
    const usdc = markets['usd-coin']?.current_price ?? 1;
    return NextResponse.json({ sol, usdc });
  } catch (e) {
    console.error('[api/prices/core]', e);
    return NextResponse.json(
      {
        sol: null,
        usdc: 1,
        error: e instanceof Error ? e.message : 'Failed to load prices',
      },
      { status: 200 },
    );
  }
}

