import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

// ── Ensure the table exists (idempotent) ─────────────────────────────────────
async function ensureTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS stop_loss_orders (
      id                       SERIAL PRIMARY KEY,
      user_id                  INTEGER NOT NULL,
      trade_id                 INTEGER,
      challenge_subscription_id INTEGER NOT NULL,
      market_id                TEXT NOT NULL,
      provider                 TEXT NOT NULL,
      side                     TEXT NOT NULL,
      outcome                  TEXT,
      stop_price               DECIMAL(10,6) NOT NULL,
      quantity                 INTEGER NOT NULL,
      market_name              TEXT,
      status                   TEXT NOT NULL DEFAULT 'active',
      created_at               TIMESTAMPTZ DEFAULT NOW(),
      triggered_at             TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS stop_loss_active_idx
      ON stop_loss_orders (status, market_id, provider)
      WHERE status = 'active';
  `);
}

// ── POST — create a stop-loss order ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const userId = Number(body.userId);
  const tradeId = body.tradeId ? Number(body.tradeId) : null;
  const marketId = String(body.marketId || '');
  const provider = String(body.provider || '').toLowerCase();
  const side = String(body.side || 'yes').toLowerCase();
  const outcome = body.outcome ? String(body.outcome) : null;
  const stopPriceCents = Number(body.stopPriceCents); // 0–100 cents
  const quantity = Number(body.quantity);
  const marketName = body.marketName ? String(body.marketName) : null;

  if (!userId || !marketId || !provider || !stopPriceCents || !quantity) {
    return NextResponse.json({ error: 'userId, marketId, provider, stopPriceCents, quantity required' }, { status: 400 });
  }
  if (stopPriceCents <= 0 || stopPriceCents >= 100) {
    return NextResponse.json({ error: 'stopPriceCents must be between 1 and 99' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await ensureTable(client);

    // Get active subscription
    const subRes = await client.query(
      `SELECT id FROM challenge_subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
      [userId],
    );
    if (subRes.rows.length === 0) {
      return NextResponse.json({ error: 'No active challenge subscription' }, { status: 404 });
    }
    const subscriptionId = subRes.rows[0].id;

    const stopPrice = stopPriceCents / 100; // store as fraction

    const res = await client.query(
      `INSERT INTO stop_loss_orders
         (user_id, trade_id, challenge_subscription_id, market_id, provider, side, outcome, stop_price, quantity, market_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, stop_price, market_id, market_name, status`,
      [userId, tradeId, subscriptionId, marketId, provider, side, outcome, stopPrice, quantity, marketName],
    );

    return NextResponse.json({ success: true, stopLoss: res.rows[0] });
  } catch (err: any) {
    console.error('[StopLoss POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to create stop-loss' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ── GET — list active stop-loss orders for a user ────────────────────────────
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const client = await getClient();
  try {
    await ensureTable(client);
    const res = await client.query(
      `SELECT id, trade_id, market_id, market_name, provider, side, outcome,
              stop_price, quantity, status, created_at, triggered_at
       FROM stop_loss_orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [Number(userId)],
    );
    return NextResponse.json({ stopLosses: res.rows });
  } catch (err: any) {
    console.error('[StopLoss GET]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch stop-losses' }, { status: 500 });
  } finally {
    client.release();
  }
}

// ── DELETE — cancel a stop-loss order ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const userId = req.nextUrl.searchParams.get('userId');
  if (!id || !userId) return NextResponse.json({ error: 'id and userId required' }, { status: 400 });

  const client = await getClient();
  try {
    await ensureTable(client);
    const res = await client.query(
      `UPDATE stop_loss_orders SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING id`,
      [Number(id), Number(userId)],
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Stop-loss not found or already inactive' }, { status: 404 });
    }
    return NextResponse.json({ success: true, cancelled: res.rows[0].id });
  } catch (err: any) {
    console.error('[StopLoss DELETE]', err);
    return NextResponse.json({ error: err.message || 'Failed to cancel stop-loss' }, { status: 500 });
  } finally {
    client.release();
  }
}
