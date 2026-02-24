import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchAllMarkets } from "@/lib/market-fetchers";

/**
 * Comprehensive diagnostic endpoint to check account state, balance, P&L, and risk engine
 */
export async function GET(req: NextRequest) {
  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    if (!userIdParam) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const userId = Number(userIdParam);

    // Get subscription
    const subRes = await query<{
      id: number;
      user_id: number;
      start_balance: string;
      current_balance: string;
      day_start_balance: string;
      status: string;
      fail_reason: string | null;
      started_at: string;
    }>(
      `
      SELECT id, user_id, start_balance, current_balance, day_start_balance, status, fail_reason, started_at
      FROM challenge_subscriptions
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [userId],
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const sub = subRes.rows[0];

    // Get all trades
    const tradesRes = await query<{
      id: number;
      provider: string;
      market_id: string;
      side: string;
      price: string;
      quantity: string;
      status: string | null;
      close_price: string | null;
      closed_at: string | null;
      executed_at: string;
    }>(
      `
      SELECT id, provider, market_id, side, price, quantity, status, close_price, closed_at, executed_at
      FROM simulated_trades
      WHERE challenge_subscription_id = $1
      ORDER BY executed_at DESC;
      `,
      [sub.id],
    );

    const trades = tradesRes.rows;

    // Calculate what the balance SHOULD be based on trades
    let calculatedBalance = Number(sub.start_balance);
    let totalBuyCost = 0;
    let totalSellProceeds = 0;
    let totalRealizedPnL = 0;

    for (const trade of trades) {
      const entryPrice = Number(trade.price);
      const quantity = Number(trade.quantity);
      const cost = entryPrice * quantity;

      if (trade.status === 'open' || (trade.status === null && trade.close_price === null)) {
        // Open position: cash was spent
        calculatedBalance -= cost;
        totalBuyCost += cost;
      } else if (trade.status === 'closed' && trade.close_price) {
        // Closed position: cash was spent, then received back
        const closePrice = Number(trade.close_price);
        const proceeds = closePrice * quantity;
        
        calculatedBalance -= cost; // When bought
        calculatedBalance += proceeds; // When sold
        
        totalBuyCost += cost;
        totalSellProceeds += proceeds;

        // Calculate P&L
        const side = trade.side.toLowerCase();
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
    const openTrades = trades.filter(t => 
      (t.status === 'open' || (t.status === null && t.close_price === null))
    );

    // Fetch live prices for unrealized P&L
    const markets = await fetchAllMarkets(500);
    const priceMap = new Map<string, number>();
    markets.forEach(m => {
      priceMap.set(`${m.provider.toLowerCase()}:${m.id}`, m.price);
      // UnifiedMarket uses 'price' for both yes/no, so we use the main price
      // If you need separate yes/no prices, you'd need to fetch from the specific provider API
    });

    let unrealizedPnL = 0;
    for (const trade of openTrades) {
      const entryPrice = Number(trade.price);
      const quantity = Number(trade.quantity);
      const side = trade.side.toLowerCase();
      
      // Get current price
      let currentPrice = priceMap.get(`${trade.provider}:${trade.market_id}`);
      if (side === 'yes' && priceMap.has(`${trade.provider}:${trade.market_id}:yes`)) {
        currentPrice = priceMap.get(`${trade.provider}:${trade.market_id}:yes`)!;
      } else if (side === 'no' && priceMap.has(`${trade.provider}:${trade.market_id}:no`)) {
        currentPrice = priceMap.get(`${trade.provider}:${trade.market_id}:no`)!;
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

    // Calculate drawdowns
    const totalDrawdownPct = startBalance > 0
      ? ((currentEquity - startBalance) / startBalance) * 100
      : 0;

    const dailyDrawdownPct = dayStartBalance > 0
      ? ((currentEquity - dayStartBalance) / dayStartBalance) * 100
      : 0;

    // Calculate ROI (using current_balance only, like leaderboard)
    const roiFromBalance = startBalance > 0
      ? ((cashBalance - startBalance) / startBalance) * 100
      : 0;

    // Calculate ROI (using equity, which includes unrealized P&L)
    const roiFromEquity = startBalance > 0
      ? ((currentEquity - startBalance) / startBalance) * 100
      : 0;

    return NextResponse.json({
      subscription: {
        id: sub.id,
        userId: sub.user_id,
        status: sub.status,
        failReason: sub.fail_reason,
        startedAt: sub.started_at,
      },
      balances: {
        startBalance: startBalance.toFixed(2),
        currentBalance: cashBalance.toFixed(2),
        calculatedBalance: calculatedBalance.toFixed(2),
        dayStartBalance: dayStartBalance.toFixed(2),
        balanceDiscrepancy: (cashBalance - calculatedBalance).toFixed(2),
      },
      equity: {
        cashBalance: cashBalance.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        currentEquity: currentEquity.toFixed(2),
      },
      pnl: {
        totalRealizedPnL: totalRealizedPnL.toFixed(2),
        unrealizedPnL: unrealizedPnL.toFixed(2),
        totalPnL: (totalRealizedPnL + unrealizedPnL).toFixed(2),
      },
      trades: {
        totalBuyCost: totalBuyCost.toFixed(2),
        totalSellProceeds: totalSellProceeds.toFixed(2),
        netCashFlow: (totalSellProceeds - totalBuyCost).toFixed(2),
        totalTrades: trades.length,
        openTrades: openTrades.length,
        closedTrades: trades.length - openTrades.length,
      },
      drawdown: {
        totalDrawdownPct: totalDrawdownPct.toFixed(2),
        dailyDrawdownPct: dailyDrawdownPct.toFixed(2),
        shouldBeClosed: totalDrawdownPct <= -10 || dailyDrawdownPct <= -5,
        totalDrawdownLimit: -10,
        dailyDrawdownLimit: -5,
      },
      roi: {
        roiFromBalance: roiFromBalance.toFixed(2), // What leaderboard shows
        roiFromEquity: roiFromEquity.toFixed(2), // What it should be
        difference: (roiFromEquity - roiFromBalance).toFixed(2),
      },
      riskCheck: {
        accountStatus: sub.status,
        shouldBeActive: sub.status === 'active',
        shouldBeFailed: totalDrawdownPct <= -10 || dailyDrawdownPct <= -5,
        isCorrectlyClosed: sub.status === 'failed' && (totalDrawdownPct <= -10 || dailyDrawdownPct <= -5),
        isIncorrectlyActive: sub.status === 'active' && (totalDrawdownPct <= -10 || dailyDrawdownPct <= -5),
      },
    });
  } catch (error: any) {
    console.error('Diagnose account error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to diagnose account' },
      { status: 500 },
    );
  }
}
