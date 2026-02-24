import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Debug endpoint to check if trades are being saved
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
      SELECT id, user_id, status, current_balance
      FROM challenge_subscriptions
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 5;
      `,
      [userId],
    );

    // Get ALL trades for this user (any status)
    const allTradesRes = await query(
      `
      SELECT 
        id,
        user_id,
        challenge_subscription_id,
        market_id,
        provider,
        side,
        outcome,
        price,
        quantity,
        status,
        executed_at
      FROM simulated_trades
      WHERE user_id = $1
      ORDER BY executed_at DESC
      LIMIT 20;
      `,
      [userId],
    );

    // Get open trades for active subscription
    const activeSub = subRes.rows.find((s: any) => s.status === 'active');
    let openTradesRes = { rows: [] };
    if (activeSub) {
      openTradesRes = await query(
        `
        SELECT 
          id,
          market_id,
          provider,
          side,
          outcome,
          price,
          quantity,
          status
        FROM simulated_trades
        WHERE challenge_subscription_id = $1 AND status = 'open'
        ORDER BY executed_at DESC;
        `,
        [activeSub.id],
      );
    }

    return NextResponse.json({
      userId,
      subscriptions: subRes.rows,
      activeSubscription: activeSub,
      allTrades: allTradesRes.rows,
      openTrades: openTradesRes.rows,
      summary: {
        totalTrades: allTradesRes.rows.length,
        openTrades: openTradesRes.rows.length,
        activeSubscriptionId: activeSub?.id || null,
      },
    });
  } catch (error: any) {
    console.error('Debug trades error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to debug trades' },
      { status: 500 },
    );
  }
}
