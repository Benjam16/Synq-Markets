import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
    let admin = await checkAdminAuth(req);
    
    // Fallback: check wallet from query
    if (!admin) {
      const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
      if (wallet) {
        const list = process.env.ADMIN_WALLET_ADDRESSES;
        if (list && list.split(",").map((w) => w.trim().toLowerCase()).includes(wallet.toLowerCase())) {
          admin = { id: wallet, email: wallet, role: "admin" };
        }
      }
    }

    if (!admin) {
      console.log('[Admin Users] Access denied - not an admin');
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let sql = `
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.created_at,
        COUNT(DISTINCT cs.id) as challenge_count,
        COUNT(DISTINCT st.id) as trade_count,
        COALESCE(SUM(CASE WHEN cs.status = 'active' THEN 1 ELSE 0 END), 0) as active_challenges
      FROM users u
      LEFT JOIN challenge_subscriptions cs ON cs.user_id = u.id
      LEFT JOIN simulated_trades st ON st.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (search) {
      sql += ` AND (u.email ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    sql += ` GROUP BY u.id, u.email, u.full_name, u.role, u.created_at`;
    sql += ` ORDER BY u.created_at DESC`;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count for pagination
    let countSql = `SELECT COUNT(DISTINCT u.id) as total FROM users u WHERE 1=1`;
    const countParams: any[] = [];
    if (search) {
      countSql += ` AND (u.email ILIKE $1 OR u.full_name ILIKE $1)`;
      countParams.push(`%${search}%`);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    return NextResponse.json({
      users: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Admin Users] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
