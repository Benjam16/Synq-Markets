import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { getMarketPriceFast } from "@/lib/fast-price-lookup";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = Number(body.userId);
  const marketId = String(body.marketId || "");
  const provider = String(body.provider || "").toLowerCase();
  // side MUST be 'yes' or 'no' for database constraint
  let side = String(body.side || "yes").toLowerCase();
  if (side !== 'yes' && side !== 'no') {
    // Try to infer from outcome name
    const outcomeStr = String(body.outcome || "").toLowerCase();
    if (outcomeStr.includes('(no)') || outcomeStr.endsWith(' no')) {
      side = 'no';
    } else {
      side = 'yes';
    }
  }
  const outcome = String(body.outcome || side); // Store outcome name (e.g., "Gavin Newsom")
  const quantity = Number(body.quantity);
  const currentOutcome = body.currentOutcome || null;
  const stopLossCents = body.stopLossCents ? Number(body.stopLossCents) : null;

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

    // Fast price lookup: Cache first, then entry price, then API (only if needed)
    let currentPrice = 0;
    try {
      const priceResult = await getMarketPriceFast(
        provider,
        marketId,
        side as 'yes' | 'no',
        outcome,
        undefined // No entry price for new buys
      );
      
      currentPrice = priceResult.price;
      
      // Log price source for debugging
      if (priceResult.source === 'api') {
        console.log(`[Buy] Price from API for ${provider}:${marketId} (slow)`);
      } else {
        console.log(`[Buy] Price from ${priceResult.source} for ${provider}:${marketId} (fast)`);
      }
    } catch (priceError) {
      console.error('Error fetching current price:', priceError);
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Failed to fetch current market price" },
        { status: 500 },
      );
    }
    
    if (currentPrice <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Market price not available. Please try again." },
        { status: 404 },
      );
    }

    const cost = currentPrice * quantity;
    if (cost <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Cost must be positive" }, { status: 400 });
    }

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

    // Check sufficient balance
    if (Number(subscription.current_balance) < cost) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Insufficient balance for purchase" },
        { status: 400 },
      );
    }

    // Get current equity to check position size limit (20% max)
    // Simplify to avoid complex joins that might fail in transaction
    const currentEquity = Number(subscription.current_balance);
    
    // Check 20% max position size rule (only if equity > 0 to avoid division by zero)
    if (currentEquity > 0) {
      const positionSizePct = (cost / currentEquity) * 100;
      if (positionSizePct > 20) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { 
            error: `Institutional Limit: Max 20% per event. Your position size (${positionSizePct.toFixed(2)}%) exceeds this limit.`,
            positionSize: positionSizePct,
            maxSize: 20,
          },
          { status: 400 },
        );
      }
    }

    // Record trade with real-world market price and outcome
    // side is already normalized to 'yes' or 'no' above
    // Extract clean outcome name (remove "(No)" suffix if present)
    const cleanOutcome = outcome 
      ? outcome.replace(/\s*\(No\)\s*$/i, '').trim() 
      : (side === 'yes' ? 'YES' : 'NO');
    
    // Insert trade - side must be exactly 'yes' or 'no' for database constraint
    // Try to insert with outcome column, fallback if it doesn't exist
    let tradeRes;
    try {
      tradeRes = await client.query(
        `
        INSERT INTO simulated_trades
          (user_id, challenge_subscription_id, provider, market_id, side, outcome, price, quantity, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
        RETURNING id, provider, market_id, side, outcome, price, quantity, executed_at, status;
        `,
        [
          userId, 
          subscription.id, 
          provider, 
          marketId, 
          side, // Must be exactly 'yes' or 'no'
          cleanOutcome, // Store clean outcome name (e.g., "Gavin Newsom")
          currentPrice, 
          quantity
        ],
      );
    } catch (insertError: any) {
      // If outcome column doesn't exist, ROLLBACK and try again without it
      if (insertError?.message?.includes('column "outcome"') || insertError?.code === '42703') {
        console.log('[Buy] Outcome column not found, retrying without it');
        // Rollback the failed transaction
        await client.query("ROLLBACK");
        // Start a new transaction
        await client.query("BEGIN");
        // Try insert without outcome column
        try {
          tradeRes = await client.query(
            `
            INSERT INTO simulated_trades
              (user_id, challenge_subscription_id, provider, market_id, side, price, quantity, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
            RETURNING id, provider, market_id, side, price, quantity, executed_at, status;
            `,
            [
              userId, 
              subscription.id, 
              provider, 
              marketId, 
              side, // Must be exactly 'yes' or 'no'
              currentPrice, 
              quantity
            ],
          );
          console.log('[Buy] Trade saved without outcome column:', tradeRes.rows[0]?.id);
        } catch (retryError: any) {
          // If status column also doesn't exist, try without it
          if (retryError?.message?.includes('column "status"') || retryError?.code === '42703') {
            console.log('[Buy] Status column not found, retrying without it');
            await client.query("ROLLBACK");
            await client.query("BEGIN");
            tradeRes = await client.query(
              `
              INSERT INTO simulated_trades
                (user_id, challenge_subscription_id, provider, market_id, side, price, quantity)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id, provider, market_id, side, price, quantity, executed_at;
              `,
              [
                userId, 
                subscription.id, 
                provider, 
                marketId, 
                side,
                currentPrice, 
                quantity
              ],
            );
            console.log('[Buy] Trade saved without status column:', tradeRes.rows[0]?.id);
          } else {
            throw retryError;
          }
        }
      } else {
        console.error('[Buy] Insert error:', insertError);
        throw insertError;
      }
    }

    // Update balance after successful trade insert
    try {
      await client.query(
        `
        UPDATE challenge_subscriptions
        SET current_balance = current_balance - $1,
            last_trade_at = NOW()
        WHERE id = $2;
        `,
        [cost, subscription.id],
      );
    } catch (updateError: any) {
      await client.query("ROLLBACK");
      console.error("Failed to update balance:", updateError);
      return NextResponse.json(
        { 
          error: "Failed to update account balance",
          details: updateError?.message || String(updateError),
        },
        { status: 500 }
      );
    }

    await client.query("COMMIT");

    // Save market name + external URL to market_metadata so dashboard can display it
    const marketName = body.marketName ? String(body.marketName) : null;
    const externalUrl = body.externalUrl ? String(body.externalUrl) : null;
    if (marketName) {
      try {
        // Try with external_url column first
        await client.query(
          `INSERT INTO market_metadata (provider, market_id, name, category, external_url)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (provider, market_id)
           DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),
              external_url = COALESCE(EXCLUDED.external_url, market_metadata.external_url)`,
          [provider, marketId, marketName, body.category || 'General', externalUrl]
        );
      } catch (metaErr: any) {
        if (metaErr?.message?.includes('external_url') || metaErr?.code === '42703') {
          // external_url column doesn't exist yet — auto-add it
          try {
            await client.query(`ALTER TABLE market_metadata ADD COLUMN IF NOT EXISTS external_url TEXT`);
            await client.query(
              `INSERT INTO market_metadata (provider, market_id, name, category, external_url)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (provider, market_id)
               DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(),
                  external_url = COALESCE(EXCLUDED.external_url, market_metadata.external_url)`,
              [provider, marketId, marketName, body.category || 'General', externalUrl]
            );
          } catch (alterErr) {
            // Last resort: save without external_url
            try {
              await client.query(
                `INSERT INTO market_metadata (provider, market_id, name, category)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (provider, market_id)
                 DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
                [provider, marketId, marketName, body.category || 'General']
              );
            } catch {}
          }
        } else {
          console.warn('[Buy] Could not save market metadata:', metaErr);
        }
      }
    }

    // Log successful trade for debugging
    const balanceBefore = Number(subscription.current_balance);
    const balanceAfter = balanceBefore - cost;
    console.log('[Buy] Trade saved successfully:', {
      tradeId: tradeRes.rows[0]?.id,
      userId,
      subscriptionId: subscription.id,
      marketId,
      side,
      outcome: cleanOutcome,
      price: currentPrice,
      quantity,
      cost,
      balanceBefore,
      balanceAfter,
      balanceChange: -cost,
    });

    // Create stop-loss order if requested (async, non-blocking)
    if (stopLossCents && stopLossCents > 0 && stopLossCents < 100 && tradeRes.rows[0]?.id) {
      fetch(`${req.nextUrl.origin}/api/stop-loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tradeId: tradeRes.rows[0].id,
          marketId,
          provider,
          side,
          outcome: cleanOutcome,
          stopPriceCents: stopLossCents,
          quantity,
          marketName: body.marketName || null,
        }),
      }).catch((err) => console.warn('[Buy] Stop-loss creation failed:', err));
    }

    // Run risk check after trade (async, don't wait)
    fetch(`${req.nextUrl.origin}/api/risk-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {}); // Silently fail - risk check runs periodically anyway

    return NextResponse.json({
      success: true,
      trade: tradeRes.rows[0],
      cost,
      subscriptionId: subscription.id,
      message: 'Trade executed successfully',
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Buy route error:", error);
    // Return more detailed error message for debugging
    const errorMessage = error?.message || error?.detail || "Failed to record trade";
    const errorCode = error?.code || 'UNKNOWN';
    
    // Log full error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error("Full error details:", {
        message: errorMessage,
        code: errorCode,
        stack: error?.stack,
        body: { userId, marketId, provider, side, outcome, quantity },
      });
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      }, 
      { status: 500 }
    );
  } finally {
    client.release();
  }
}


