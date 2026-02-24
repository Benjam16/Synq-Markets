/**
 * Terminal Wallet Lookup API
 * 
 * Looks up a wallet address and returns PnL, volume, trade history,
 * and cohort classification.
 * 
 * GET /api/terminal/wallet?address=0x...
 */

import { NextRequest, NextResponse } from 'next/server';
import { lookupWallet } from '@/lib/terminal-engine';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address query parameter' },
      { status: 400 }
    );
  }

  try {
    const profile = await lookupWallet(address);

    if (!profile) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(profile, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[Terminal Wallet] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}
