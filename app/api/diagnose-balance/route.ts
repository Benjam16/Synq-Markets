import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Diagnostic endpoint to check balance calculations
 */
export async function GET(req: NextRequest) {
  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    if (!userIdParam) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const userId = Number(userIdParam);

    // Get subscription
    const subRes = await query(
      `
      SELECT id, start_balance, current_balance, day_start_balance, status
      FROM challenge_subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [userId],
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    const sub = subRes.rows[0];
    const subscriptionId = sub.id;

    // Get all trades
    const tradesRes = await query(
      `
      SELECT 
        id,
        side,
        price,
        quantity,
        status,
        close_price,
        executed_at,
        closed_at
      FROM simulated_trades
      WHERE challenge_subscription_id = $1
      ORDER BY executed_at;
      `,
      [subscriptionId],
    );

    const trades = tradesRes.rows;

    // Calculate what cash balance SHOULD be
    let calculatedCash = Number(sub.start_balance);
    let totalBuyCost = 0;
    let totalSellProceeds = 0;
    let totalRealizedPnL = 0;

    for (const trade of trades) {
      const entryPrice = Number(trade.price);
      const quantity = Number(trade.quantity);
      const side = trade.side.toLowerCase();
      const cost = entryPrice * quantity;

      if (trade.status === 'open') {
        // Open position: cash was spent
        calculatedCash -= cost;
        totalBuyCost += cost;
      } else if (trade.status === 'closed' && trade.close_price) {
        // Closed position: cash was spent, then received back
        const closePrice = Number(trade.close_price);
        const proceeds = closePrice * quantity;
        
        calculatedCash -= cost; // When bought
        calculatedCash += proceeds; // When sold
        
        totalBuyCost += cost;
        totalSellProceeds += proceeds;

        // Calculate P&L
        let pnl: number;
        if (side === 'yes') {
          pnl = (closePrice - entryPrice) * quantity;
        } else {
          pnl = (entryPrice - closePrice) * quantity;
        }
        totalRealizedPnL += pnl;
      }
    }

    // Get open positions for unrealized P&L
    const openTrades = trades.filter(t => t.status === 'open');
    const unrealizedPnL = 0; // Would need live prices to calculate

    return NextResponse.json({
      subscription: {
        id: subscriptionId,
        startBalance: Number(sub.start_balance),
        currentBalance: Number(sub.current_balance),
        dayStartBalance: Number(sub.day_start_balance),
        status: sub.status,
      },
      calculated: {
        calculatedCash,
        totalBuyCost,
        totalSellProceeds,
        totalRealizedPnL,
        netCashFlow: totalSellProceeds - totalBuyCost,
      },
      trades: {
        total: trades.length,
        open: openTrades.length,
        closed: trades.length - openTrades.length,
      },
      discrepancy: {
        cashBalanceDifference: Number(sub.current_balance) - calculatedCash,
        shouldBe: calculatedCash,
        actuallyIs: Number(sub.current_balance),
      },
    });
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to diagnose balance' },
      { status: 500 },
    );
  }
}
