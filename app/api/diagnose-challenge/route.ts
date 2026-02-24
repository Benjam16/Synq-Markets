import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Diagnostic endpoint to check challenge subscription status
 * Helps debug why "No Active Challenge" appears
 */
export async function GET(req: NextRequest) {
  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    const userId = userIdParam ? Number(userIdParam) : NaN;
    
    if (!userId || Number.isNaN(userId)) {
      return NextResponse.json(
        { error: "userId parameter required" },
        { status: 400 }
      );
    }

    // Get ALL subscriptions for this user
    const allSubsRes = await query(
      `
      SELECT 
        id, 
        user_id,
        tier_id,
        status,
        start_balance,
        current_balance,
        day_start_balance,
        fail_reason,
        started_at,
        ended_at
      FROM challenge_subscriptions
      WHERE user_id = $1
      ORDER BY started_at DESC;
      `,
      [userId],
    );

    // Get active subscription specifically
    const activeSubRes = await query(
      `
      SELECT 
        id, 
        status,
        start_balance,
        current_balance
      FROM challenge_subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [userId],
    );

    // Get user info
    const userRes = await query(
      `SELECT id, email, full_name FROM users WHERE id = $1`,
      [userId],
    );

    return NextResponse.json({
      userId,
      user: userRes.rows[0] || null,
      allSubscriptions: allSubsRes.rows.map(sub => ({
        id: sub.id,
        status: sub.status,
        statusNormalized: String(sub.status || '').trim().toLowerCase(),
        startBalance: Number(sub.start_balance),
        currentBalance: Number(sub.current_balance),
        failReason: sub.fail_reason,
        startedAt: sub.started_at,
        endedAt: sub.ended_at,
      })),
      activeSubscription: activeSubRes.rows[0] ? {
        id: activeSubRes.rows[0].id,
        status: activeSubRes.rows[0].status,
        startBalance: Number(activeSubRes.rows[0].start_balance),
        currentBalance: Number(activeSubRes.rows[0].current_balance),
      } : null,
      diagnosis: {
        hasAnySubscription: allSubsRes.rows.length > 0,
        hasActiveSubscription: activeSubRes.rows.length > 0,
        totalSubscriptions: allSubsRes.rows.length,
        latestSubscription: allSubsRes.rows[0] ? {
          id: allSubsRes.rows[0].id,
          status: allSubsRes.rows[0].status,
          statusNormalized: String(allSubsRes.rows[0].status || '').trim().toLowerCase(),
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Diagnose challenge error:', error);
    return NextResponse.json(
      { 
        error: error?.message || 'Failed to diagnose challenge',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
