import { NextRequest, NextResponse } from "next/server";
import { getClient, query } from "@/lib/db";

async function resolveUserId(body: { userId?: unknown; wallet?: string }): Promise<number | null> {
  if (body.userId != null && !Number.isNaN(Number(body.userId))) return Number(body.userId);
  const wallet = body.wallet;
  if (!wallet || !process.env.DATABASE_URL) return null;
  try {
    const res = await query<{ id: number }>(`SELECT id FROM users WHERE wallet_address = $1 LIMIT 1`, [wallet]);
    return res.rows.length > 0 ? res.rows[0].id : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = await resolveUserId(body);
  const positionId = Number(body.positionId);
  const closePrice = Number(body.closePrice);

  if (userId == null || !positionId || Number.isNaN(closePrice)) {
    return NextResponse.json(
      { error: "wallet (or userId), positionId, and closePrice required" },
      { status: 400 },
    );
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Get the trade/position
    const actualId = positionId;

    const tradeRes = await client.query(
      `
      SELECT id, challenge_subscription_id, price, quantity, side
      FROM simulated_trades
      WHERE id = $1 AND user_id = $2
      `,
      [actualId, userId],
    );

    const trade = tradeRes.rows[0];
    if (!trade) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Position not found" },
        { status: 404 },
      );
    }

    // Check if account is still active
    const subCheckRes = await client.query(
      `
      SELECT status, fail_reason
      FROM challenge_subscriptions
      WHERE id = $1
      `,
      [trade.challenge_subscription_id],
    );
    
    if (subCheckRes.rows[0]?.status !== 'active') {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { 
          error: "Account has been closed",
          reason: subCheckRes.rows[0]?.fail_reason || "Account limit exceeded. Please purchase a new account.",
        },
        { status: 403 },
      );
    }

    // Calculate P&L (correct for YES and NO positions) - for reporting only
    const entryPrice = Number(trade.price);
    const quantity = Number(trade.quantity);
    const side = trade.side.toLowerCase();
    
    let pnl: number;
    if (side === 'yes') {
      // YES: profit when price goes up
      pnl = (closePrice - entryPrice) * quantity;
    } else {
      // NO: profit when price goes down
      pnl = (entryPrice - closePrice) * quantity;
    }

    // Update challenge subscription balance
    // When you close a position, you receive the proceeds (closePrice * quantity)
    // The P&L is already implicit: when you bought, balance was reduced by entryPrice * quantity
    // When you close, balance is increased by closePrice * quantity
    // Net effect = (closePrice - entryPrice) * quantity = P&L (already accounted for)
    const proceeds = closePrice * quantity;
    await client.query(
      `
      UPDATE challenge_subscriptions
      SET current_balance = current_balance + $1,
          last_trade_at = NOW()
      WHERE id = $2;
      `,
      [proceeds, Number(trade.challenge_subscription_id)],
    );

    // Mark trade as closed instead of deleting (keep history)
    await client.query(
      `
      UPDATE simulated_trades
      SET status = 'closed',
          closed_at = NOW(),
          close_price = $1
      WHERE id = $2;
      `,
      [closePrice, actualId],
    );

    await client.query("COMMIT");

    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Close Position] Position closed:', {
        positionId: actualId,
        entryPrice,
        closePrice,
        quantity,
        proceeds,
        pnl,
      });
    }

    return NextResponse.json({
      success: true,
      pnl,
      closedAt: new Date().toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Close position error:", error);
    return NextResponse.json(
      { error: "Failed to close position" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

