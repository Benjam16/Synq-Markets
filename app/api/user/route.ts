import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * User identity by wallet. GET ?wallet= returns user; optional DB lookup for dbId.
 * POST with { wallet } creates or returns user (when DB has wallet_address).
 */
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet')?.trim();
    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet is required' },
        { status: 400 }
      );
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        user: {
          id: wallet,
          address: wallet,
          email: `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
          full_name: null,
          role: 'trader',
          paypal_email: null,
          created_at: null,
          updated_at: null,
          dbId: null,
        },
      });
    }

    try {
      const result = await query<{ id: number; full_name: string | null; paypal_email: string | null }>(
        `SELECT id, full_name, paypal_email FROM users WHERE wallet_address = $1 LIMIT 1`,
        [wallet]
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return NextResponse.json({
          user: {
            id: row.id,
            address: wallet,
            email: `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
            full_name: row.full_name,
            role: 'trader',
            paypal_email: row.paypal_email,
            created_at: null,
            updated_at: null,
            dbId: row.id,
          },
        });
      }
    } catch {
      // wallet_address column may not exist
    }

    return NextResponse.json({
      user: {
        id: wallet,
        address: wallet,
        email: `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
        full_name: null,
        role: 'trader',
        paypal_email: null,
        created_at: null,
        updated_at: null,
        dbId: null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const wallet = body.wallet || body.address;
  if (!wallet) {
    return NextResponse.json({ error: 'wallet or address required' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ userId: wallet, created: false });
  }

  try {
    const existing = await query<{ id: number }>(
      `SELECT id FROM users WHERE wallet_address = $1 LIMIT 1`,
      [wallet]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ userId: existing.rows[0].id, created: false });
    }
    const insert = await query<{ id: number }>(
      `INSERT INTO users (email, wallet_address, full_name, role) VALUES ($1, $2, $3, 'trader') RETURNING id`,
      [`${wallet}@wallet.local`, wallet, body.fullName || null]
    );
    return NextResponse.json({ userId: insert.rows[0].id, created: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('wallet_address') || (err as { code?: string }).code === '42703') {
      return NextResponse.json({ userId: wallet, created: false });
    }
    throw err;
  }
}
