/**
 * Terminal Feed API
 * 
 * Returns the current terminal snapshot: live trades, whale alerts,
 * arbitrage signals, and market ticks. The terminal-engine handles
 * caching so this endpoint is safe to poll every 2-5 seconds.
 * 
 * GET /api/terminal/feed
 */

import { NextResponse } from 'next/server';
import { getTerminalSnapshot } from '@/lib/terminal-engine';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getTerminalSnapshot();

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[Terminal Feed] Error:', error);
    return NextResponse.json(
      {
        trades: [],
        whaleAlerts: [],
        arbSignals: [],
        marketTicks: [],
        stats: {
          totalTrades: 0,
          totalVolume: 0,
          avgTradeSize: 0,
          whaleCount: 0,
          arbCount: 0,
          uptime: 0,
          rate: '0/s',
          polymarketConnected: false,
          kalshiConnected: false,
          lastUpdate: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
