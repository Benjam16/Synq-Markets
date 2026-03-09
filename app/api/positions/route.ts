import { NextRequest, NextResponse } from "next/server";
import { getClient, query } from "@/lib/db";

async function resolveUserId(userId: string | null, wallet: string | null): Promise<number | null> {
  if (userId && !Number.isNaN(Number(userId))) return Number(userId);
  if (!wallet || !process.env.DATABASE_URL) return null;
  try {
    const res = await query<{ id: number }>(`SELECT id FROM users WHERE wallet_address = $1 LIMIT 1`, [wallet]);
    return res.rows.length > 0 ? res.rows[0].id : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const wallet = req.nextUrl.searchParams.get("wallet");
  const marketId = req.nextUrl.searchParams.get("marketId");

  const resolvedId = await resolveUserId(userId, wallet || null);
  if (resolvedId == null) {
    return NextResponse.json(
      userId || wallet ? { positions: [] } : { error: "userId or wallet is required" },
      { status: userId || wallet ? 200 : 400 },
    );
  }

  const client = await getClient();

  try {
    const subRes = await client.query(
      `
      SELECT id
      FROM challenge_subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [resolvedId],
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
