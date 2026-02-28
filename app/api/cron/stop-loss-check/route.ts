/**
 * Stop-Loss Checker
 *
 * Runs periodically (called from terminal/feed polling or as a Vercel cron).
 * For each active stop-loss order, fetches the current market price and
 * executes a sell if the price has hit or fallen below the stop-loss threshold.
 *
 * GET /api/cron/stop-loss-check
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getMarketPriceFast } from '@/lib/fast-price-lookup';

// Prevent concurrent runs
let _running = false;
let _lastRunTime = 0;
const MIN_INTERVAL_MS = 10_000; // run at most every 10 seconds

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const now = Date.now();
  if (_running || now - _lastRunTime < MIN_INTERVAL_MS) {
    return NextResponse.json({ skipped: true });
  }
  _running = true;
  _lastRunTime = now;

  const client = await getClient();
  let triggered = 0;
  let checked = 0;

  try {
    // Fetch all active stop-loss orders
    const ordersRes = await client.query(`
      SELECT s.id, s.user_id, s.trade_id, s.challenge_subscription_id,
             s.market_id, s.provider, s.side, s.outcome,
             s.stop_price, s.quantity, s.market_name
      FROM stop_loss_orders s
      WHERE s.status = 'active'
      ORDER BY s.created_at ASC
      LIMIT 200
    `).catch(() => ({ rows: [] as any[] }));

    const orders = ordersRes.rows;
    if (orders.length === 0) {
      _running = false;
      return NextResponse.json({ checked: 0, triggered: 0 });
    }

    const origin = req.nextUrl.origin;

    for (const order of orders) {
      checked++;
      try {
        const priceResult = await getMarketPriceFast(
          order.provider,
          order.market_id,
          (order.side || 'yes') as 'yes' | 'no',
          order.outcome || undefined,
          Number(order.stop_price),
        );

        if (!priceResult) {
          console.log(`[Stop-Loss] Skipping order ${order.id}: price unavailable`);
          continue;
        }
        const currentPrice = priceResult.price;
        const stopPrice = Number(order.stop_price);

        // Trigger if current price has dropped to or below the stop price
        if (currentPrice <= stopPrice) {
          // Execute sell via the existing sell API
          const sellRes = await fetch(`${origin}/api/sell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: order.user_id,
              marketId: order.market_id,
              provider: order.provider,
              side: order.side,
              outcome: order.outcome || order.side,
              quantity: order.quantity,
            }),
          });

          if (sellRes.ok) {
            // Mark stop-loss as triggered
            await client.query(
              `UPDATE stop_loss_orders SET status = 'triggered', triggered_at = NOW() WHERE id = $1`,
              [order.id],
            ).catch(() => {});
            triggered++;
            console.log(`[StopLoss] Triggered order ${order.id}: ${order.market_name} @ ${(currentPrice * 100).toFixed(1)}¢ (stop: ${(stopPrice * 100).toFixed(1)}¢)`);
          } else {
            console.warn(`[StopLoss] Sell failed for order ${order.id}:`, await sellRes.text().catch(() => ''));
          }
        }
      } catch (err) {
        console.warn(`[StopLoss] Error checking order ${order.id}:`, err);
      }
    }

    return NextResponse.json({ checked, triggered });
  } catch (err) {
    console.error('[StopLoss cron]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    client.release();
    _running = false;
  }
}
