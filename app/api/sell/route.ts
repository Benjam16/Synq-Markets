import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { getMarketPriceFast } from "@/lib/fast-price-lookup";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = Number(body.userId);
  const marketId = String(body.marketId || "");
  const provider = String(body.provider || "").toLowerCase();
  const side = String(body.side || body.outcome || "yes").toLowerCase();
  const outcome = String(body.outcome || body.side || "yes");
  const quantity = Number(body.quantity);

  if (!userId || !marketId || !provider || Number.isNaN(quantity)) {
    return NextResponse.json(
      { error: "userId, marketId, provider, quantity required" },
      { status: 400 },
    );
  }

  if (quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be positive" }, { status: 400 });
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    // Get user's subscription
    const subRes = await client.query(
      `
      SELECT id, current_balance, status, fail_reason
      FROM challenge_subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [userId],
    );

    const subscription = subRes.rows[0];
    if (!subscription) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "No active challenge subscription for user" },
        { status: 404 },
      );
    }

    // Check if account is still active (not failed/closed)
    if (subscription.status !== 'active') {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { 
          error: "Account has been closed",
          reason: subscription.fail_reason || "Account limit exceeded. Please purchase a new account.",
          status: subscription.status,
        },
        { status: 403 },
      );
    }

    // Get user's open positions for this market/outcome
    // Match by outcome name if provided, otherwise match by side
    const positionsRes = await client.query(
      `
      SELECT id, price, quantity, side, outcome
      FROM simulated_trades
      WHERE challenge_subscription_id = $1 
        AND market_id = $2 
        AND provider = $3
        AND status = 'open'
        AND (
          (outcome IS NOT NULL AND outcome = $4) OR
          (outcome IS NULL AND side = $5)
        )
      ORDER BY executed_at ASC;
      `,
      [subscription.id, marketId, provider, outcome || side, side],
    );

    const positions = positionsRes.rows;
    if (positions.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "No open positions found to sell" },
        { status: 404 },
      );
    }

    // Calculate total available shares
    const totalShares = positions.reduce((sum, p) => sum + Number(p.quantity), 0);
    if (quantity > totalShares) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Insufficient shares. You have ${totalShares} shares available.` },
        { status: 400 },
      );
    }

    // Fast price lookup: Use entry price from position (fastest for sells)
    // This is safe because we're closing an existing position
    const firstPosition = positions[0];
    const positionSide = String(firstPosition.side || '').toLowerCase() as 'yes' | 'no';
    const positionOutcome = String(firstPosition.outcome || '').trim();
    const entryPrice = Number(firstPosition.price);
    
    let currentPrice = 0;
    try {
      const priceResult = await getMarketPriceFast(
        provider,
        marketId,
        positionSide,
        positionOutcome || undefined,
        entryPrice // Use entry price as fallback (very fast)
      );
      
      currentPrice = priceResult.price;
      
      // Log price source for debugging
      if (priceResult.source === 'api') {
        console.log(`[Sell] Price from API for ${provider}:${marketId} (slow)`);
      } else {
        console.log(`[Sell] Price from ${priceResult.source} for ${provider}:${marketId} (fast)`);
      }
    } catch (priceError) {
      console.error('Error fetching current price:', priceError);
      // Fallback to entry price if lookup fails (prevents incorrect P&L)
      currentPrice = entryPrice;
    }
    
    if (currentPrice <= 0) {
      // Last resort: use entry price
      currentPrice = entryPrice;
    }

    // Calculate PnL and proceeds
    let remainingQty = quantity;
    let totalPnL = 0;
    let totalProceeds = 0;

    // Close positions using FIFO (First In, First Out)
    for (const position of positions) {
      if (remainingQty <= 0) break;

      const positionQty = Number(position.quantity);
      const entryPrice = Number(position.price);
      const closeQty = Math.min(remainingQty, positionQty);
      
      // Calculate PnL for this position
      // CRITICAL: Use the position's side from the database, not the request side
      const positionSide = String(position.side || '').toLowerCase();
      let positionPnL: number;
      if (positionSide === 'yes' || positionSide === 'up') {
        // YES position: profit when price goes up
        positionPnL = (currentPrice - entryPrice) * closeQty;
      } else {
        // NO position: profit when price goes down
        positionPnL = (entryPrice - currentPrice) * closeQty;
      }

      totalPnL += positionPnL;
      totalProceeds += currentPrice * closeQty;

      // Update or close the position
      if (closeQty >= positionQty) {
        // Close entire position
        await client.query(
          `
          UPDATE simulated_trades
          SET status = 'closed',
              closed_at = NOW(),
              close_price = $1
          WHERE id = $2;
          `,
          [currentPrice, position.id],
        );
      } else {
        // Partially close - reduce quantity
        await client.query(
          `
          UPDATE simulated_trades
          SET quantity = quantity - $1
          WHERE id = $2;
          `,
          [closeQty, position.id],
        );
      }

      remainingQty -= closeQty;
    }

    // Update balance: When you sell, you receive the proceeds (sale price * quantity)
    // The P&L is already implicit in the difference between entry and exit prices
    // When you bought: balance -= entryPrice * quantity
    // When you sell: balance += closePrice * quantity
    // Net P&L = (closePrice - entryPrice) * quantity (already accounted for)
    // So we only add proceeds, NOT proceeds + PnL (that would double-count)
    await client.query(
      `
      UPDATE challenge_subscriptions
      SET current_balance = current_balance + $1,
          last_trade_at = NOW()
      WHERE id = $2;
      `,
      [totalProceeds, subscription.id],
    );

    await client.query("COMMIT");

    // Run risk check after trade (async, don't wait)
    fetch(`${req.nextUrl.origin}/api/risk-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {}); // Silently fail - risk check runs periodically anyway

    return NextResponse.json({
      success: true,
      quantity,
      proceeds: totalProceeds,
      pnl: totalPnL,
      totalReturn: totalProceeds, // Return proceeds only (PnL is implicit)
      subscriptionId: subscription.id,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Sell route error:", error);
    return NextResponse.json({ error: "Failed to execute sell" }, { status: 500 });
  } finally {
    client.release();
  }
}
