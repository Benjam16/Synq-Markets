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
          console.log('[Admin Trades] Authenticated via email fallback:', admin.email);
        }
      }
    }
    
    if (!admin) {
      console.log('[Admin Trades] Access denied - not an admin');
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const challengeId = searchParams.get("challengeId");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let sql = `
      SELECT 
        st.id,
        st.user_id,
        st.challenge_subscription_id,
        u.email as user_email,
        u.full_name as user_name,
        cs.status as challenge_status,
        st.provider,
        st.market_id,
        st.side,
        st.price,
        st.quantity,
        st.notional,
        st.executed_at
      FROM simulated_trades st
      JOIN users u ON u.id = st.user_id
      JOIN challenge_subscriptions cs ON cs.id = st.challenge_subscription_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (userId) {
      sql += ` AND st.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (challengeId) {
      sql += ` AND st.challenge_subscription_id = $${paramCount}`;
      params.push(challengeId);
      paramCount++;
    }

    sql += ` ORDER BY st.executed_at DESC`;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM simulated_trades st WHERE 1=1`;
    const countParams: any[] = [];
    if (userId) {
      countSql += ` AND st.user_id = $1`;
      countParams.push(userId);
    }
    if (challengeId) {
      countSql += ` AND st.challenge_subscription_id = $${countParams.length + 1}`;
      countParams.push(challengeId);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    return NextResponse.json({
      trades: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Admin Trades] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
