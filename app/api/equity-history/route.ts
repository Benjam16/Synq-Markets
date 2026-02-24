import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Get equity history from daily snapshots
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
      SELECT id
      FROM challenge_subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [userId],
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json({ history: [] });
    }

    const subscriptionId = subRes.rows[0].id;

    // Get daily snapshots
    const snapshotsRes = await query(
      `
      SELECT 
        snapshot_date,
        equity,
        cash_balance
      FROM daily_balance_snapshots
      WHERE challenge_subscription_id = $1
      ORDER BY snapshot_date DESC
      LIMIT 30;
      `,
      [subscriptionId],
    );

    const history = snapshotsRes.rows.map((row: any) => ({
      date: row.snapshot_date,
      equity: Number(row.equity),
      balance: Number(row.cash_balance),
    }));

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('Equity history error:', error);
    return NextResponse.json({ history: [] });
  }
}
