import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Cleanup endpoint to delete or fail all challenges for a user
 * Usage: POST /api/cleanup-challenges?userId=X&action=delete|fail
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, action = 'fail' } = await req.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (action !== 'delete' && action !== 'fail') {
      return NextResponse.json(
        { error: "action must be 'delete' or 'fail'" },
        { status: 400 }
      );
    }

    // Get all challenges for this user
    const challengesRes = await query<{
      id: number;
      status: string;
      started_at: string;
    }>(
      `
      SELECT id, status, started_at
      FROM challenge_subscriptions
      WHERE user_id = $1
      ORDER BY started_at DESC;
      `,
      [userId]
    );

    const challenges = challengesRes.rows;

    if (challenges.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No challenges found for this user",
        challenges: [],
      });
    }

    if (action === 'delete') {
      // Delete all trades first (foreign key constraint)
      await query(
        `
        DELETE FROM simulated_trades
        WHERE challenge_subscription_id IN (
          SELECT id FROM challenge_subscriptions WHERE user_id = $1
        );
        `,
        [userId]
      );

      // Delete balance snapshots
      await query(
        `
        DELETE FROM daily_balance_snapshots
        WHERE challenge_subscription_id IN (
          SELECT id FROM challenge_subscriptions WHERE user_id = $1
        );
        `,
        [userId]
      );

      // Delete risk events
      await query(
        `
        DELETE FROM risk_events
        WHERE challenge_subscription_id IN (
          SELECT id FROM challenge_subscriptions WHERE user_id = $1
        );
        `,
        [userId]
      );

      // Finally delete the challenges
      await query(
        `
        DELETE FROM challenge_subscriptions
        WHERE user_id = $1;
        `,
        [userId]
      );

      return NextResponse.json({
        success: true,
        message: `Deleted ${challenges.length} challenge(s) and all associated data`,
        deletedChallenges: challenges.length,
        challenges: challenges.map(c => ({
          id: c.id,
          status: c.status,
          startedAt: c.started_at,
        })),
      });
    } else {
      // Fail all active challenges
      const activeChallenges = challenges.filter(c => c.status === 'active');
      
      if (activeChallenges.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No active challenges to fail",
          challenges: challenges.map(c => ({
            id: c.id,
            status: c.status,
            startedAt: c.started_at,
          })),
        });
      }

      await query(
        `
        UPDATE challenge_subscriptions
        SET status = 'failed',
            fail_reason = 'Manually closed by user',
            ended_at = NOW()
        WHERE user_id = $1 AND status = 'active';
        `,
        [userId]
      );

      return NextResponse.json({
        success: true,
        message: `Failed ${activeChallenges.length} active challenge(s)`,
        failedChallenges: activeChallenges.length,
        allChallenges: challenges.map(c => ({
          id: c.id,
          status: c.status === 'active' ? 'failed' : c.status,
          startedAt: c.started_at,
        })),
      });
    }
  } catch (error: any) {
    console.error('Cleanup challenges error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cleanup challenges' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to view all challenges for a user
 */
export async function GET(req: NextRequest) {
  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    
    if (!userIdParam) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    const userId = Number(userIdParam);

    // Get all challenges for this user
    const challengesRes = await query<{
      id: number;
      status: string;
      start_balance: string;
      current_balance: string;
      started_at: string;
      ended_at: string | null;
      fail_reason: string | null;
    }>(
      `
      SELECT id, status, start_balance, current_balance, started_at, ended_at, fail_reason
      FROM challenge_subscriptions
      WHERE user_id = $1
      ORDER BY started_at DESC;
      `,
      [userId]
    );

    const challenges = challengesRes.rows.map(c => ({
      id: c.id,
      status: c.status,
      startBalance: Number(c.start_balance),
      currentBalance: Number(c.current_balance),
      startedAt: c.started_at,
      endedAt: c.ended_at,
      failReason: c.fail_reason,
    }));

    // Get trade counts for each challenge
    const tradeCounts = await Promise.all(
      challenges.map(async (challenge) => {
        const tradesRes = await query<{ count: string }>(
          `
          SELECT COUNT(*) as count
          FROM simulated_trades
          WHERE challenge_subscription_id = $1;
          `,
          [challenge.id]
        );
        return {
          challengeId: challenge.id,
          tradeCount: Number(tradesRes.rows[0]?.count || 0),
        };
      })
    );

    const challengesWithTrades = challenges.map(c => ({
      ...c,
      tradeCount: tradeCounts.find(tc => tc.challengeId === c.id)?.tradeCount || 0,
    }));

    return NextResponse.json({
      userId,
      totalChallenges: challenges.length,
      activeChallenges: challenges.filter(c => c.status === 'active').length,
      challenges: challengesWithTrades,
    });
  } catch (error: any) {
    console.error('Get challenges error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get challenges' },
      { status: 500 }
    );
  }
}
