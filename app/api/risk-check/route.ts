import { NextRequest, NextResponse } from "next/server";
import { query, getClient } from "@/lib/db";
import { fetchAllMarkets } from "@/lib/market-fetchers";

/**
 * Risk Engine: Checks drawdown limits and closes accounts when breached
 * Should be called periodically (every few seconds) or after each trade
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId ? Number(body.userId) : null;

    // Get all active subscriptions (or all subscriptions if checking specific user)
    // If checking a specific user, check their account regardless of status
    const subscriptionsRes = await query<{
      id: number;
      user_id: number;
      start_balance: string;
      current_balance: string;
      day_start_balance: string;
      status: string;
    }>(
      userId
        ? `
          SELECT id, user_id, start_balance, current_balance, day_start_balance, status
          FROM challenge_subscriptions
          WHERE user_id = $1
          ORDER BY started_at DESC
          LIMIT 1
        `
        : `
          SELECT id, user_id, start_balance, current_balance, day_start_balance, status
          FROM challenge_subscriptions
          WHERE status = 'active'
        `,
      userId ? [userId] : [],
    );

    const subscriptions = subscriptionsRes.rows;
    const closedAccounts: Array<{ subscriptionId: number; reason: string }> = [];

    // Fetch live market prices for P&L calculation
    const markets = await fetchAllMarkets(500);
    const priceMap = new Map<string, number>();
    markets.forEach(m => {
      priceMap.set(`${m.provider.toLowerCase()}:${m.id}`, m.price);
      // UnifiedMarket uses 'price' for both yes/no, so we use the main price
      // If you need separate yes/no prices, you'd need to fetch from the specific provider API
    });

    for (const sub of subscriptions) {
      // Get open positions for this subscription
      // Handle cases where status column might not exist or be NULL
      let positionsRes;
      try {
        positionsRes = await query<{
          id: number;
          provider: string;
          market_id: string;
          side: string;
          price: string;
          quantity: string;
        }>(
          `
          SELECT id, provider, market_id, side, price, quantity
          FROM simulated_trades
          WHERE challenge_subscription_id = $1 
            AND (status = 'open' OR status IS NULL)
            AND close_price IS NULL
            AND closed_at IS NULL
          `,
          [sub.id],
        );
      } catch (error: any) {
        // If status column doesn't exist, fall back to checking close_price and closed_at
        if (error.message?.includes('column') && error.message?.includes('status')) {
          positionsRes = await query<{
            id: number;
            provider: string;
            market_id: string;
            side: string;
            price: string;
            quantity: string;
          }>(
            `
            SELECT id, provider, market_id, side, price, quantity
            FROM simulated_trades
            WHERE challenge_subscription_id = $1 
              AND close_price IS NULL
              AND closed_at IS NULL
            `,
            [sub.id],
          );
        } else {
          throw error;
        }
      }

      // Calculate unrealized P&L
      let unrealizedPnL = 0;
      for (const pos of positionsRes.rows) {
        const entryPrice = Number(pos.price);
        const quantity = Number(pos.quantity);
        const side = pos.side.toLowerCase();
        
        // Get current price
        let currentPrice = priceMap.get(`${pos.provider}:${pos.market_id}`);
        if (side === 'yes' && priceMap.has(`${pos.provider}:${pos.market_id}:yes`)) {
          currentPrice = priceMap.get(`${pos.provider}:${pos.market_id}:yes`)!;
        } else if (side === 'no' && priceMap.has(`${pos.provider}:${pos.market_id}:no`)) {
          currentPrice = priceMap.get(`${pos.provider}:${pos.market_id}:no`)!;
        }
        
        // Fallback to entry price if no current price
        if (currentPrice === undefined) {
          currentPrice = entryPrice;
        }

        // Calculate P&L
        if (side === 'yes') {
          unrealizedPnL += (currentPrice - entryPrice) * quantity;
        } else {
          unrealizedPnL += (entryPrice - currentPrice) * quantity;
        }
      }

      // Calculate equity
      const cashBalance = Number(sub.current_balance);
      const currentEquity = cashBalance + unrealizedPnL;
      const startBalance = Number(sub.start_balance);
      const dayStartBalance = Number(sub.day_start_balance);

      // Calculate total return percentage (positive = profit, negative = loss)
      const totalReturnPct = startBalance > 0
        ? ((currentEquity - startBalance) / startBalance) * 100
        : 0;

      // Check daily drawdown (5% limit)
      const dailyDrawdownPct = dayStartBalance > 0
        ? ((currentEquity - dayStartBalance) / dayStartBalance) * 100
        : 0;

      // Log current state for debugging
      console.log(`[Risk Engine] Account ${sub.id} (User ${sub.user_id}):`, {
        cashBalance: cashBalance.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        currentEquity: currentEquity.toFixed(2),
        startBalance: startBalance.toFixed(2),
        dayStartBalance: dayStartBalance.toFixed(2),
        totalReturnPct: totalReturnPct.toFixed(2),
        dailyDrawdownPct: dailyDrawdownPct.toFixed(2),
        openPositions: positionsRes.rows.length,
      });

      // Process account status changes (only if still active)
      if (sub.status === 'active') {
        // PRIORITY 1: Check for PASS condition (10% profit target)
        // CRITICAL: Check pass FIRST - if user hits 10% profit, they pass regardless of daily drawdown
        if (totalReturnPct >= 10) {
          console.log(`[Risk Engine] ✅ PASSING account ${sub.id}: Total return ${totalReturnPct.toFixed(2)}% (target: 10%)`);
          
          const client = await getClient();
          try {
            await client.query("BEGIN");
            
            await client.query(
              `
              UPDATE challenge_subscriptions
              SET status = 'passed',
                  fail_reason = $1,
                  ended_at = NOW()
              WHERE id = $2
              `,
              [`Challenge passed: ${totalReturnPct.toFixed(2)}% profit (target: 10%)`, sub.id],
            );
            
            // Log pass event
            await client.query(
              `INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
               VALUES ($1, 'challenge_passed', $2)`,
              [
                sub.id,
                JSON.stringify({
                  total_return_pct: totalReturnPct.toFixed(2),
                  current_equity: currentEquity.toFixed(2),
                  start_balance: startBalance.toFixed(2),
                  passed_at: new Date().toISOString(),
                }),
              ]
            );
            
            await client.query("COMMIT");
            client.release();
            
            closedAccounts.push({
              subscriptionId: sub.id,
              reason: `Challenge passed: ${totalReturnPct.toFixed(2)}% profit`,
            });
          } catch (error) {
            await client.query("ROLLBACK");
            client.release();
            throw error;
          }
        }
        // PRIORITY 2: Check for FAIL conditions (only if not already passed)
        else if (totalReturnPct <= -10) {
          console.log(`[Risk Engine] ⚠️ FAILING account ${sub.id}: Total drawdown ${totalReturnPct.toFixed(2)}% (limit: -10%)`);
          
          const client = await getClient();
          try {
            await client.query("BEGIN");
            
            await client.query(
              `
              UPDATE challenge_subscriptions
              SET status = 'failed',
                  fail_reason = $1,
                  ended_at = NOW()
              WHERE id = $2
              `,
              [`Total drawdown limit exceeded: ${totalReturnPct.toFixed(2)}% (limit: -10%)`, sub.id],
            );
            
            // Log fail event
            await client.query(
              `INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
               VALUES ($1, 'total_drawdown', $2)`,
              [
                sub.id,
                JSON.stringify({
                  total_drawdown_pct: totalReturnPct.toFixed(2),
                  current_equity: currentEquity.toFixed(2),
                  start_balance: startBalance.toFixed(2),
                  failed_at: new Date().toISOString(),
                }),
              ]
            );
            
            await client.query("COMMIT");
            client.release();
            
            closedAccounts.push({
              subscriptionId: sub.id,
              reason: `Total drawdown limit exceeded: ${totalReturnPct.toFixed(2)}%`,
            });
          } catch (error) {
            await client.query("ROLLBACK");
            client.release();
            throw error;
          }
        } else if (dailyDrawdownPct <= -5) {
          console.log(`[Risk Engine] ⚠️ FAILING account ${sub.id}: Daily drawdown ${dailyDrawdownPct.toFixed(2)}% (limit: -5%)`);
          
          const client = await getClient();
          try {
            await client.query("BEGIN");
            
            await client.query(
              `
              UPDATE challenge_subscriptions
              SET status = 'failed',
                  fail_reason = $1,
                  ended_at = NOW()
              WHERE id = $2
              `,
              [`Daily drawdown limit exceeded: ${dailyDrawdownPct.toFixed(2)}% (limit: -5%)`, sub.id],
            );
            
            // Log fail event
            await client.query(
              `INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
               VALUES ($1, 'daily_drawdown', $2)`,
              [
                sub.id,
                JSON.stringify({
                  daily_drawdown_pct: dailyDrawdownPct.toFixed(2),
                  current_equity: currentEquity.toFixed(2),
                  day_start_balance: dayStartBalance.toFixed(2),
                  failed_at: new Date().toISOString(),
                }),
              ]
            );
            
            await client.query("COMMIT");
            client.release();
            
            closedAccounts.push({
              subscriptionId: sub.id,
              reason: `Daily drawdown limit exceeded: ${dailyDrawdownPct.toFixed(2)}%`,
            });
          } catch (error) {
            await client.query("ROLLBACK");
            client.release();
            throw error;
          }
        }
      } else {
        // Account already closed, but log if it should still be closed or passed
        if (totalReturnPct <= -10 || dailyDrawdownPct <= -5) {
          console.log(`[Risk Engine] Account ${sub.id} is already ${sub.status}, but still in breach (Total: ${totalReturnPct.toFixed(2)}%, Daily: ${dailyDrawdownPct.toFixed(2)}%)`);
        } else if (totalReturnPct >= 10 && sub.status !== 'passed') {
          console.log(`[Risk Engine] ⚠️ Account ${sub.id} is already ${sub.status}, but should be passed (Total: ${totalReturnPct.toFixed(2)}%)`);
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
    return NextResponse.json(
      { error: 'Failed to check risk limits' },
      { status: 500 },
    );
  }
}
