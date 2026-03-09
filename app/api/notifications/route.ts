import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function getWallet(req: NextRequest): string | null {
  const wallet =
    req.headers.get("x-wallet-address")?.trim() ||
    req.nextUrl.searchParams.get("wallet")?.trim();
  return wallet || null;
}

export async function GET(req: NextRequest) {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const userRes = await query<{ id: number }>(
      `SELECT id FROM users WHERE wallet_address = $1 LIMIT 1`,
      [wallet]
    ).catch(() => ({ rows: [] as { id: number }[] }));

    if (userRes.rows.length === 0) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const userId = userRes.rows[0].id;
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
    const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
    const type = req.nextUrl.searchParams.get("type");

    let sql = `
      SELECT id, type, title, message, data, read, created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];
    let paramCount = 2;
    if (unreadOnly) sql += ` AND read = false`;
    if (type) {
      sql += ` AND type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const unreadCountRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
      [userId]
    );
    const unreadCount = parseInt(unreadCountRes.rows[0]?.count || "0", 10);

    return NextResponse.json({
      notifications: result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data,
        read: row.read,
        createdAt: row.created_at,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("[Notifications] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: true });
    }

    const userRes = await query<{ id: number }>(
      `SELECT id FROM users WHERE wallet_address = $1 LIMIT 1`,
      [wallet]
    ).catch(() => ({ rows: [] as { id: number }[] }));

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: true });
    }

    const userId = userRes.rows[0].id;
    const body = await req.json().catch(() => ({}));
    const { notificationIds, markAllRead } = body;

    if (markAllRead) {
      await query(`UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`, [userId]);
    } else if (Array.isArray(notificationIds)) {
      await query(
        `UPDATE notifications SET read = true WHERE user_id = $1 AND id = ANY($2::bigint[])`,
        [userId, notificationIds]
      );
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Notifications] Error marking as read:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
