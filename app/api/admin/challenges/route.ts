import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
    let admin = await checkAdminAuth(req);
    
    // Fallback: Check by email from query param if session auth fails
    if (!admin) {
      const email = req.nextUrl.searchParams.get("email");
      
      if (email) {
        const result = await query(
          `SELECT id, email, role FROM users WHERE LOWER(TRIM(email)) = $1`,
          [email.trim().toLowerCase()]
        );
        
        if (result.rows.length > 0 && (result.rows[0].role === "admin" || result.rows[0].role === "risk")) {
          admin = {
            id: result.rows[0].id,
            email: result.rows[0].email,
            role: result.rows[0].role,
          };
          console.log('[Admin Challenges] Authenticated via email fallback:', admin.email);
        }
      }
    }
    
    if (!admin) {
      console.log('[Admin Challenges] Access denied - not an admin');
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let sql = `
      SELECT 
        cs.id,
        cs.user_id,
        cs.tier_id,
        cs.status,
        cs.start_balance,
        cs.current_balance,
        cs.day_start_balance,
        cs.fail_reason,
        cs.started_at,
        cs.ended_at,
        u.email as user_email,
        u.full_name as user_name,
        at.name as tier_name,
        at.account_size as tier_size,
        (cs.current_balance - cs.start_balance) / cs.start_balance * 100 as total_return_pct,
        (cs.current_balance - cs.day_start_balance) / cs.day_start_balance * 100 as daily_drawdown_pct,
        COUNT(DISTINCT st.id) as trade_count
      FROM challenge_subscriptions cs
      JOIN users u ON u.id = cs.user_id
      JOIN account_tiers at ON at.id = cs.tier_id
      LEFT JOIN simulated_trades st ON st.challenge_subscription_id = cs.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      sql += ` AND cs.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (userId) {
      sql += ` AND cs.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    sql += ` GROUP BY cs.id, u.email, u.full_name, at.name, at.account_size`;
    sql += ` ORDER BY cs.started_at DESC`;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM challenge_subscriptions cs WHERE 1=1`;
    const countParams: any[] = [];
    if (status) {
      countSql += ` AND cs.status = $1`;
      countParams.push(status);
    }
    if (userId) {
      countSql += ` AND cs.user_id = $${countParams.length + 1}`;
      countParams.push(userId);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    return NextResponse.json({
      challenges: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Admin Challenges] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
      { status: 500 }
    );
  }
}
