import { NextRequest, NextResponse } from "next/server";
import { query, getClient } from "@/lib/db";
import { fetchAllMarkets } from "@/lib/market-fetchers";

/**
 * Risk Engine: Checks drawdown limits and phase progression.
 *
 * 3-Phase Challenge System:
 *   Phase 1 (phase1): profit target = +10%
 *     → on pass: mark current sub 'passed', create new sub with phase='phase2'
 *       at the same original start_balance (reset).
 *   Phase 2 (phase2): profit target = +5%
 *     → on pass: mark current sub 'passed', create new sub with phase='funded',
 *       profit_split_pct = 80.
 *   Funded (funded): no profit target, drawdown rules still apply.
 *
 * Fail conditions (all phases): -10% total drawdown OR -5% daily drawdown.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId ? Number(body.userId) : null;

    let subscriptionsRes;
    const subType = {
      id: 0, user_id: 0, tier_id: 0,
      start_balance: '', current_balance: '', day_start_balance: '',
      status: '', phase: '', profit_split_pct: '',
    };
    try {
      subscriptionsRes = await query<typeof subType>(
        userId
          ? `SELECT id, user_id, tier_id, start_balance, current_balance, day_start_balance,
                    status,
                    COALESCE(phase, 'phase1') AS phase,
                    COALESCE(profit_split_pct, 0) AS profit_split_pct
             FROM challenge_subscriptions
             WHERE user_id = $1
             ORDER BY started_at DESC
             LIMIT 1`
          : `SELECT id, user_id, tier_id, start_balance, current_balance, day_start_balance,
                    status,
                    COALESCE(phase, 'phase1') AS phase,
                    COALESCE(profit_split_pct, 0) AS profit_split_pct
             FROM challenge_subscriptions
             WHERE status = 'active'`,
        userId ? [userId] : [],
      );
    } catch (colError: any) {
      if (colError?.message?.includes('column') || colError?.code === '42703') {
        console.warn('[Risk Check] phase/profit_split_pct columns missing, querying without them');
        subscriptionsRes = await query<typeof subType>(
          userId
            ? `SELECT id, user_id, tier_id, start_balance, current_balance, day_start_balance,
                      status, 'phase1' AS phase, '0' AS profit_split_pct
               FROM challenge_subscriptions
               WHERE user_id = $1
               ORDER BY started_at DESC
               LIMIT 1`
            : `SELECT id, user_id, tier_id, start_balance, current_balance, day_start_balance,
                      status, 'phase1' AS phase, '0' AS profit_split_pct
               FROM challenge_subscriptions
               WHERE status = 'active'`,
          userId ? [userId] : [],
        );
      } else {
        throw colError;
      }
    }

    const subscriptions = subscriptionsRes.rows;
    const closedAccounts: Array<{ subscriptionId: number; reason: string }> = [];

    const markets = await fetchAllMarkets(500);
    const priceMap = new Map<string, number>();
    markets.forEach(m => {
      priceMap.set(`${m.provider.toLowerCase()}:${m.id}`, m.price);
    });

    for (const sub of subscriptions) {
      let positionsRes;
      try {
        positionsRes = await query<{
          id: number; provider: string; market_id: string;
          side: string; price: string; quantity: string;
        }>(
          `SELECT id, provider, market_id, side, price, quantity
           FROM simulated_trades
           WHERE challenge_subscription_id = $1
             AND (status = 'open' OR status IS NULL)
             AND close_price IS NULL AND closed_at IS NULL`,
          [sub.id],
        );
      } catch (error: any) {
        if (error.message?.includes('column') && error.message?.includes('status')) {
          positionsRes = await query<{
            id: number; provider: string; market_id: string;
            side: string; price: string; quantity: string;
          }>(
            `SELECT id, provider, market_id, side, price, quantity
             FROM simulated_trades
             WHERE challenge_subscription_id = $1
               AND close_price IS NULL AND closed_at IS NULL`,
            [sub.id],
          );
        } else { throw error; }
      }

      let unrealizedPnL = 0;
      for (const pos of positionsRes.rows) {
        const entryPrice = Number(pos.price);
        const quantity = Number(pos.quantity);
        const side = pos.side.toLowerCase();
        let currentPrice = priceMap.get(`${pos.provider}:${pos.market_id}`) ?? entryPrice;
        if (side === 'yes') unrealizedPnL += (currentPrice - entryPrice) * quantity;
        else unrealizedPnL += (entryPrice - currentPrice) * quantity;
      }

      const cashBalance = Number(sub.current_balance);
      const currentEquity = cashBalance + unrealizedPnL;
      const startBalance = Number(sub.start_balance);
      const dayStartBalance = Number(sub.day_start_balance);
      const phase = sub.phase || 'phase1';

      const totalReturnPct = startBalance > 0
        ? ((currentEquity - startBalance) / startBalance) * 100 : 0;
      const dailyDrawdownPct = dayStartBalance > 0
        ? ((currentEquity - dayStartBalance) / dayStartBalance) * 100 : 0;

      // Profit target per phase
      const profitTarget = phase === 'phase1' ? 10 : phase === 'phase2' ? 5 : null;

      console.log(`[Risk Engine] Account ${sub.id} (User ${sub.user_id}, ${phase}):`, {
        cashBalance: cashBalance.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        currentEquity: currentEquity.toFixed(2),
        startBalance: startBalance.toFixed(2),
        dayStartBalance: dayStartBalance.toFixed(2),
        totalReturnPct: totalReturnPct.toFixed(2),
        dailyDrawdownPct: dailyDrawdownPct.toFixed(2),
        profitTarget,
      });

      if (sub.status !== 'active') {
        if (totalReturnPct <= -10 || dailyDrawdownPct <= -5) {
          console.log(`[Risk Engine] Account ${sub.id} already ${sub.status} but in breach`);
        }
        continue;
      }

      // ── PASS condition ──────────────────────────────────────────────
      if (profitTarget !== null && totalReturnPct >= profitTarget) {
        const nextPhase = phase === 'phase1' ? 'phase2' : 'funded';
        const isFunded = nextPhase === 'funded';
        console.log(`[Risk Engine] ✅ PASSING account ${sub.id} phase=${phase}: ${totalReturnPct.toFixed(2)}% ≥ ${profitTarget}% → ${nextPhase}`);

        const client = await getClient();
        try {
          await client.query("BEGIN");

          // Mark current subscription as passed
          await client.query(
            `UPDATE challenge_subscriptions
             SET status = 'passed', fail_reason = $1, ended_at = NOW()
             WHERE id = $2`,
            [`${phase === 'phase1' ? 'Phase 1' : 'Phase 2'} passed: ${totalReturnPct.toFixed(2)}% profit`, sub.id],
          );

          // Create new subscription for the next phase (reset balance)
          let newSubRes;
          try {
            newSubRes = await client.query<{ id: number }>(
              `INSERT INTO challenge_subscriptions
                 (user_id, tier_id, status, phase, start_balance, current_balance,
                  day_start_balance, phase_started_at, profit_split_pct)
               VALUES ($1, $2, 'active', $3, $4, $4, $4, NOW(), $5)
               RETURNING id`,
              [sub.user_id, sub.tier_id, nextPhase, startBalance, isFunded ? 80 : 0],
            );
          } catch (colErr: any) {
            if (colErr?.message?.includes('column') || colErr?.code === '42703') {
              newSubRes = await client.query<{ id: number }>(
                `INSERT INTO challenge_subscriptions
                   (user_id, tier_id, status, start_balance, current_balance, day_start_balance)
                 VALUES ($1, $2, 'active', $3, $3, $3)
                 RETURNING id`,
                [sub.user_id, sub.tier_id, startBalance],
              );
            } else { throw colErr; }
          }

          const newSubId = newSubRes.rows[0].id;

          // Log event
          await client.query(
            `INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
             VALUES ($1, $2, $3)`,
            [
              sub.id,
              isFunded ? 'phase2_passed_funded' : 'phase1_passed',
              JSON.stringify({
                from_phase: phase,
                to_phase: nextPhase,
                total_return_pct: totalReturnPct.toFixed(2),
                current_equity: currentEquity.toFixed(2),
                start_balance: startBalance.toFixed(2),
                new_subscription_id: newSubId,
                passed_at: new Date().toISOString(),
              }),
            ]
          );

          await client.query("COMMIT");
          client.release();

          closedAccounts.push({
            subscriptionId: sub.id,
            reason: `${phase === 'phase1' ? 'Phase 1' : 'Phase 2'} passed → ${nextPhase} account created (id: ${newSubId})`,
          });
        } catch (error) {
          await client.query("ROLLBACK");
          client.release();
          throw error;
        }
      }
      // ── FAIL: total drawdown ────────────────────────────────────────
      else if (totalReturnPct <= -10) {
        console.log(`[Risk Engine] ⚠️ FAILING account ${sub.id}: Total drawdown ${totalReturnPct.toFixed(2)}%`);

        const client = await getClient();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE challenge_subscriptions
             SET status = 'failed', fail_reason = $1, ended_at = NOW()
             WHERE id = $2`,
            [`Total drawdown limit exceeded: ${totalReturnPct.toFixed(2)}% (limit: -10%)`, sub.id],
          );
          await client.query(
            `INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
             VALUES ($1, 'total_drawdown', $2)`,
            [sub.id, JSON.stringify({
              phase,
              total_drawdown_pct: totalReturnPct.toFixed(2),
              current_equity: currentEquity.toFixed(2),
              start_balance: startBalance.toFixed(2),
              failed_at: new Date().toISOString(),
            })],
          );
          await client.query("COMMIT");
          client.release();
          closedAccounts.push({ subscriptionId: sub.id, reason: `Total drawdown -10% (${phase})` });
        } catch (error) {
          await client.query("ROLLBACK");
          client.release();
          throw error;
        }
      }
      // ── FAIL: daily drawdown ────────────────────────────────────────
      else if (dailyDrawdownPct <= -5) {
        console.log(`[Risk Engine] ⚠️ FAILING account ${sub.id}: Daily drawdown ${dailyDrawdownPct.toFixed(2)}%`);

        const client = await getClient();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE challenge_subscriptions
             SET status = 'failed', fail_reason = $1, ended_at = NOW()
             WHERE id = $2`,
            [`Daily drawdown limit exceeded: ${dailyDrawdownPct.toFixed(2)}% (limit: -5%)`, sub.id],
          );
          await client.query(
            `INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
             VALUES ($1, 'daily_drawdown', $2)`,
            [sub.id, JSON.stringify({
              phase,
              daily_drawdown_pct: dailyDrawdownPct.toFixed(2),
              current_equity: currentEquity.toFixed(2),
              day_start_balance: dayStartBalance.toFixed(2),
              failed_at: new Date().toISOString(),
            })],
          );
          await client.query("COMMIT");
          client.release();
          closedAccounts.push({ subscriptionId: sub.id, reason: `Daily drawdown -5% (${phase})` });
        } catch (error) {
          await client.query("ROLLBACK");
          client.release();
          throw error;
        }
      }
    }

    return NextResponse.json({
      checked: subscriptions.length,
      closed: closedAccounts.length,
      closedAccounts,
    });
  } catch (error) {
    console.error('Risk check error:', error);
    return NextResponse.json({ error: 'Failed to check risk limits' }, { status: 500 });
  }
}
