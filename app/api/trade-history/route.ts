import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchAllMarkets } from "@/lib/market-fetchers";

type TradeHistoryRow = {
  id: number;
  provider: string;
  market_id: string;
  side: string;
  price: string;
  quantity: string;
  executed_at: string;
  status: string;
  close_price: string | null;
  closed_at: string | null;
  market_name: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    const subscriptionIdParam = req.nextUrl.searchParams.get("subscriptionId");
    const activeOnlyParam = req.nextUrl.searchParams.get("activeOnly");
    
    if (!userIdParam) {
      return NextResponse.json(
        { error: "userId parameter required" },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "Invalid userId" },
        { status: 400 }
      );
    }

    // If activeOnly is true, only get trades from the active challenge
    let subscriptionId: number | null = null;
    if (activeOnlyParam === 'true' || subscriptionIdParam) {
      if (subscriptionIdParam) {
        subscriptionId = parseInt(subscriptionIdParam, 10);
      } else {
        // Get the active challenge subscription ID
        const activeSubRes = await query<{ id: number }>(
          `
          SELECT id
          FROM challenge_subscriptions
          WHERE user_id = $1 AND status = 'active'
          ORDER BY started_at DESC
          LIMIT 1;
          `,
          [userId],
        );
        if (activeSubRes.rows.length > 0) {
          subscriptionId = activeSubRes.rows[0].id;
        }
      }
    }

    // Fetch all trades (open and closed) with market names
    // Filter by subscription ID if provided
    const rows = await query<TradeHistoryRow>(
      `
      SELECT 
        st.id,
        st.provider,
        st.market_id,
        st.side,
        st.price,
        st.quantity,
        st.executed_at,
        st.status,
        st.close_price,
        st.closed_at,
        COALESCE(mm.name, st.market_id) AS market_name
      FROM simulated_trades st
      JOIN challenge_subscriptions cs ON cs.id = st.challenge_subscription_id
      LEFT JOIN market_metadata mm ON mm.provider = st.provider AND mm.market_id = st.market_id
      WHERE cs.user_id = $1
      ${subscriptionId ? 'AND st.challenge_subscription_id = $2' : ''}
      ORDER BY st.executed_at DESC
      LIMIT 500;
      `,
      subscriptionId ? [userId, subscriptionId] : [userId],
    );

    // Fetch live markets to get proper market names
    const marketNameMap = new Map<string, string>();
    try {
      const markets = await fetchAllMarkets(500);
      markets.forEach((m) => {
        // Store by multiple keys for better matching
        marketNameMap.set(`${m.provider.toLowerCase()}:${m.id}`, m.name);
        marketNameMap.set(m.id, m.name);
        // UnifiedMarket uses 'name' property, not 'eventTitle'
      });
    } catch (error) {
      console.warn('[Trade History] Failed to fetch live markets for names:', error);
    }

    const trades = rows.rows.map((row) => {
      const entryPrice = Number(row.price);
      const quantity = Number(row.quantity);
      const side = row.side.toUpperCase() === "NO" ? "NO" : "YES";
      const isClosed = row.status === 'closed' && row.close_price !== null;
      const closePrice = isClosed ? Number(row.close_price) : null;
      
      // Calculate P&L
      let pnl: number | null = null;
      if (isClosed && closePrice !== null) {
        if (side === 'YES') {
          pnl = (closePrice - entryPrice) * quantity;
        } else {
          pnl = (entryPrice - closePrice) * quantity;
        }
      }

      // Get market name - prioritize live data, then database metadata, then format the ID nicely
      let marketName = marketNameMap.get(`${row.provider.toLowerCase()}:${row.market_id}`);
      if (!marketName) {
        marketName = marketNameMap.get(row.market_id);
      }
      if (!marketName) {
        marketName = row.market_name || undefined;
      }
      if (!marketName) {
        // Format the ID to be more readable
        const idStr = row.market_id.toString();
        // If it's just numbers, try to make it more readable
        if (/^\d+$/.test(idStr)) {
          marketName = `Market ${idStr}`;
        } else {
          // Remove provider prefix if present
          marketName = idStr.replace(/^(polymarket|kalshi)\./i, '').replace(/_/g, ' ').replace(/-/g, ' ');
          // Capitalize first letter of each word
          marketName = marketName.split(' ').map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
      }

      return {
        id: row.id,
        marketId: row.market_id,
        marketName: marketName || row.market_id,
        provider: row.provider.toLowerCase() === "kalshi" ? "Kalshi" : "Polymarket",
        side: side as "YES" | "NO",
        entryPrice,
        closePrice,
        quantity,
        pnl,
        executedAt: row.executed_at,
        closedAt: row.closed_at,
        status: (row.status || 'open') as 'open' | 'closed' | 'settled',
      };
    });

    // Calculate stats
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    const winningTrades = closedTrades.filter(t => t.pnl! > 0);
    const losingTrades = closedTrades.filter(t => t.pnl! < 0);
    const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const pnls = closedTrades.map(t => t.pnl!).filter(p => p !== null);
    const largestWin = pnls.length > 0 ? Math.max(...pnls.filter(p => p > 0), 0) : 0;
    const largestLoss = pnls.length > 0 ? Math.min(...pnls.filter(p => p < 0), 0) : 0;

    return NextResponse.json({ 
      trades,
      stats: {
        totalTrades: trades.length,
        closedTrades: closedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
        totalRealizedPnl,
        largestWin,
        largestLoss,
        avgTradeSize: trades.length > 0 
          ? trades.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0) / trades.length
          : 0,
        totalVolume: trades.reduce((sum, t) => sum + (t.entryPrice * t.quantity), 0),
      }
    });
  } catch (error) {
    console.error("Failed to load trade history:", error);
    return NextResponse.json(
      { error: "Failed to load trade history" },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
}


