import { NextRequest, NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';
import { fetchAllMarkets } from '@/lib/market-fetchers';

/**
 * POST /api/parlay/settle
 * Checks all pending parlays and settles them based on current market prices.
 *
 * A leg is considered:
 *   won  — current price ≥ 0.98 (if outcome='yes') or ≤ 0.02 (if outcome='no')
 *   lost — current price ≤ 0.02 (if outcome='yes') or ≥ 0.98 (if outcome='no')
 *
 * A parlay is settled when all legs are no longer 'pending':
 *   all won  → status='won',  credit potential_payout to current_balance
 *   any lost → status='lost', no credit (stake already deducted on placement)
 *
 * Body: { userId? } — if provided, only settle that user's parlays
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId ? Number(body.userId) : null;

    // Fetch pending parlays
    const parlaysRes = await query<{
      id: number;
      user_id: number;
      challenge_subscription_id: number;
      stake: string;
      combined_multiplier: string;
      potential_payout: string;
      legs: any[];
    }>(
      userId
        ? `SELECT id, user_id, challenge_subscription_id, stake, combined_multiplier,
                  potential_payout, legs
           FROM parlay_bets
           WHERE status = 'pending' AND user_id = $1`
        : `SELECT id, user_id, challenge_subscription_id, stake, combined_multiplier,
                  potential_payout, legs
           FROM parlay_bets
           WHERE status = 'pending'`,
      userId ? [userId] : [],
    );

    if (parlaysRes.rows.length === 0) {
      return NextResponse.json({ settled: 0 });
    }

    // Fetch current market prices
    const markets = await fetchAllMarkets(500);
    const priceMap = new Map<string, number>();
    markets.forEach(m => {
      priceMap.set(`${m.provider.toLowerCase()}:${m.id}`, m.price);
    });

    const WIN_THRESHOLD = 0.97;
    const LOSE_THRESHOLD = 0.03;

    let settledCount = 0;

    for (const parlay of parlaysRes.rows) {
      const legs: any[] = parlay.legs || [];
      let allSettled = true;
      let anyLost = false;

      const updatedLegs = legs.map((leg: any) => {
        if (leg.status !== 'pending') return leg;

        const key = `${(leg.provider || '').toLowerCase()}:${leg.marketId}`;
        const currentPrice = priceMap.get(key);

        if (currentPrice === undefined) {
          allSettled = false;
          return leg;
        }

        const isYes = leg.outcome === 'yes';
        let legStatus: 'pending' | 'won' | 'lost' = 'pending';

        if (isYes) {
          if (currentPrice >= WIN_THRESHOLD) legStatus = 'won';
          else if (currentPrice <= LOSE_THRESHOLD) legStatus = 'lost';
          else allSettled = false;
        } else {
          if (currentPrice <= LOSE_THRESHOLD) legStatus = 'won';
          else if (currentPrice >= WIN_THRESHOLD) legStatus = 'lost';
          else allSettled = false;
        }

        if (legStatus === 'lost') anyLost = true;
        return { ...leg, status: legStatus };
      });

      if (!allSettled) continue;

      // All legs have resolved
      const parlayStatus = anyLost ? 'lost' : 'won';
      const payout = parlayStatus === 'won' ? Number(parlay.potential_payout) : 0;

      const client = await getClient();
      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE parlay_bets
           SET status = $1, legs = $2, settled_at = NOW()
           WHERE id = $3`,
          [parlayStatus, JSON.stringify(updatedLegs), parlay.id],
        );

        if (parlayStatus === 'won') {
          await client.query(
            `UPDATE challenge_subscriptions
             SET current_balance = current_balance + $1
             WHERE id = $2`,
            [payout, parlay.challenge_subscription_id],
          );
        }

        await client.query('COMMIT');
        client.release();
        settledCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        console.error(`[Parlay Settle] Error settling parlay ${parlay.id}:`, err);
      }
    }

    return NextResponse.json({ settled: settledCount, checked: parlaysRes.rows.length });
  } catch (err) {
    console.error('[Parlay Settle]', err);
    return NextResponse.json({ error: 'Failed to settle parlays' }, { status: 500 });
  }
}
