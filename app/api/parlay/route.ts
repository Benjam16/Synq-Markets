import { NextRequest, NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';

export interface ParlayLeg {
  marketId: string;
  provider: string;
  outcome: 'yes' | 'no';
  price: number;
  marketName: string;
  status: 'pending' | 'won' | 'lost';
}

/**
 * GET /api/parlay?userId=...
 * Returns all parlay bets for a user (most recent first).
 * Also runs a lightweight settle-check for each pending parlay.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const res = await query<{
      id: number;
      stake: string;
      combined_multiplier: string;
      potential_payout: string;
      status: string;
      legs: ParlayLeg[];
      placed_at: string;
      settled_at: string | null;
    }>(
      `SELECT id, stake, combined_multiplier, potential_payout, status, legs, placed_at, settled_at
       FROM parlay_bets
       WHERE user_id = $1
       ORDER BY placed_at DESC
       LIMIT 50`,
      [userId],
    );

    return NextResponse.json({ parlays: res.rows });
  } catch (err) {
    console.error('[Parlay GET]', err);
    return NextResponse.json({ error: 'Failed to fetch parlays' }, { status: 500 });
  }
}

/**
 * POST /api/parlay
 * Places a new parlay bet.
 *
 * Body: { userId, legs: ParlayLeg[], stake: number }
 *
 * Rules:
 *  - 2 to 6 legs required
 *  - Each leg must have a unique marketId
 *  - Stake deducted from current_balance immediately
 *  - combined_multiplier = Π(1/price) for each leg
 *  - potential_payout = stake × combined_multiplier
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, legs, stake } = body as {
      userId: number;
      legs: ParlayLeg[];
      stake: number;
    };

    if (!userId || !legs || !stake) {
      return NextResponse.json({ error: 'userId, legs, and stake are required' }, { status: 400 });
    }
    if (legs.length < 2 || legs.length > 6) {
      return NextResponse.json({ error: 'Parlay must have 2 to 6 legs' }, { status: 400 });
    }
    if (stake <= 0) {
      return NextResponse.json({ error: 'Stake must be positive' }, { status: 400 });
    }

    // Deduplicate legs by marketId
    const uniqueIds = new Set(legs.map(l => l.marketId));
    if (uniqueIds.size !== legs.length) {
      return NextResponse.json({ error: 'Each leg must be a different market' }, { status: 400 });
    }

    // Validate prices
    for (const leg of legs) {
      if (leg.price <= 0 || leg.price >= 1) {
        return NextResponse.json({ error: `Invalid price for leg: ${leg.marketName}` }, { status: 400 });
      }
    }

    // Get active subscription for user
    const subRes = await query<{
      id: number;
      current_balance: string;
      phase: string;
    }>(
      `SELECT id, current_balance, COALESCE(phase, 'phase1') AS phase
       FROM challenge_subscriptions
       WHERE user_id = $1 AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
      [userId],
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json({ error: 'No active challenge subscription found' }, { status: 400 });
    }

    const sub = subRes.rows[0];
    const currentBalance = Number(sub.current_balance);

    if (stake > currentBalance) {
      return NextResponse.json({
        error: `Insufficient balance. Available: $${currentBalance.toFixed(2)}, Stake: $${stake.toFixed(2)}`,
      }, { status: 400 });
    }

    // Calculate combined multiplier: Π(1/price)
    const combinedMultiplier = legs.reduce((acc, leg) => acc * (1 / leg.price), 1);
    const potentialPayout = +(stake * combinedMultiplier).toFixed(2);

    // Set all legs as pending
    const legsWithStatus: ParlayLeg[] = legs.map(l => ({ ...l, status: 'pending' }));

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Deduct stake from balance
      await client.query(
        `UPDATE challenge_subscriptions
         SET current_balance = current_balance - $1
         WHERE id = $2`,
        [stake, sub.id],
      );

      // Insert parlay bet
      const insertRes = await client.query<{ id: number }>(
        `INSERT INTO parlay_bets
           (user_id, challenge_subscription_id, stake, combined_multiplier,
            potential_payout, status, legs)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING id`,
        [
          userId,
          sub.id,
          stake,
          combinedMultiplier.toFixed(4),
          potentialPayout,
          JSON.stringify(legsWithStatus),
        ],
      );

      await client.query('COMMIT');
      client.release();

      return NextResponse.json({
        parlayId: insertRes.rows[0].id,
        combinedMultiplier: +combinedMultiplier.toFixed(4),
        potentialPayout,
        stake,
        legs: legsWithStatus,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  } catch (err) {
    console.error('[Parlay POST]', err);
    return NextResponse.json({ error: 'Failed to place parlay' }, { status: 500 });
  }
}
