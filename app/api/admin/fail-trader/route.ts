import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    let admin = await checkAdminAuth(req);
    
    // Parse body first to get email for fallback auth
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    
    // Fallback: Check by email from request body if session auth fails
    if (!admin) {
      const email = body.email || req.nextUrl.searchParams.get("email");
      
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
        }
      }
    }
    
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }
    const { challengeId, reason } = body;

    if (!challengeId) {
      return NextResponse.json(
        { error: "challengeId is required" },
        { status: 400 }
      );
    }

    // Start transaction
    await query("BEGIN");

    try {
      // Update challenge status to failed
      const updateResult = await query(
        `UPDATE challenge_subscriptions 
         SET status = 'failed', 
             fail_reason = $1,
             ended_at = NOW()
         WHERE id = $2 AND status = 'active'
         RETURNING id, user_id, current_balance, start_balance`,
        [reason || "Manually failed by admin", challengeId]
      );

      if (updateResult.rows.length === 0) {
        await query("ROLLBACK");
        return NextResponse.json(
          { error: "Challenge not found or already ended" },
          { status: 404 }
        );
      }

      const challenge = updateResult.rows[0];

      // Log risk event
      await query(
        `INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
         VALUES ($1, 'manual_fail', $2)`,
        [
          challengeId,
          JSON.stringify({
            admin_id: admin.id,
            admin_email: admin.email,
            reason: reason || "Manually failed by admin",
            balance_at_fail: challenge.current_balance,
            start_balance: challenge.start_balance,
          }),
        ]
      );

      await query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Trader challenge failed successfully",
        challenge: {
          id: challenge.id,
          userId: challenge.user_id,
          status: "failed",
        },
      });
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("[Admin Fail Trader] Error:", error);
    return NextResponse.json(
      { error: "Failed to fail trader challenge" },
      { status: 500 }
    );
  }
}
