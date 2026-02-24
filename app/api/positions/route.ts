import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const marketId = req.nextUrl.searchParams.get("marketId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 },
    );
  }

  const client = await getClient();

  try {
    // Get user's subscription
    const subRes = await client.query(
      `
      SELECT id
      FROM challenge_subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [Number(userId)],
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json({ positions: [] });
    }

    const subscriptionId = subRes.rows[0].id;

    // Get open positions
    let query = `
      SELECT 
        id,
        market_id,
        provider,
        side as outcome,
        price,
        quantity,
        executed_at
      FROM simulated_trades
      WHERE challenge_subscription_id = $1 AND status = 'open'
    `;
    const params: any[] = [subscriptionId];

    if (marketId) {
      query += ` AND market_id = $2`;
      params.push(marketId);
    }

    query += ` ORDER BY executed_at DESC;`;

    const positionsRes = await client.query(query, params);

    return NextResponse.json({
      positions: positionsRes.rows.map((p: any) => ({
        id: p.id,
        marketId: p.market_id,
        provider: p.provider,
        outcome: p.outcome,
        price: Number(p.price),
        quantity: Number(p.quantity),
        executedAt: p.executed_at,
      })),
    });
  } catch (error) {
    console.error("Positions route error:", error);
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 });
  } finally {
    client.release();
  }
}
