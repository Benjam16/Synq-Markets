import { NextRequest, NextResponse } from "next/server";
import { query, getClient } from "@/lib/db";

/**
 * Vercel Cron Job: Midnight Reset
 * Runs daily at midnight EST to:
 * 1. Snapshot daily balances
 * 2. Reset day_start_balance for new trading day
 * Configured in vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    // Verify this is a cron request (security)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const client = await getClient();
    
    try {
      await client.query("BEGIN");

      // Step 1: Record ending balance into daily snapshots
      const snapshotResult = await client.query(
        `
        INSERT INTO daily_balance_snapshots (
          challenge_subscription_id,
          snapshot_date,
          starting_balance,
          ending_balance,
          equity,
          cash_balance
        )
        SELECT
          id,
          CURRENT_DATE,
          day_start_balance,
          current_balance,
          current_balance,
          current_balance
        FROM challenge_subscriptions
        WHERE status = 'active'
        ON CONFLICT (challenge_subscription_id, snapshot_date) DO NOTHING
        RETURNING challenge_subscription_id, snapshot_date;
        `
      );

      // Step 2: Reset day_start_balance for the new day
      const resetResult = await client.query(
        `
        UPDATE challenge_subscriptions
        SET day_start_balance = current_balance
        WHERE status = 'active'
        RETURNING id, day_start_balance;
        `
      );

      await client.query("COMMIT");
      client.release();

      const snapshotsCreated = snapshotResult.rows.length;
      const accountsReset = resetResult.rows.length;

      console.log(`[Midnight Reset] Created ${snapshotsCreated} snapshots, reset ${accountsReset} accounts`);

      return NextResponse.json({
        success: true,
        snapshotsCreated,
        accountsReset,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  } catch (error: any) {
    console.error("[Cron] Midnight reset error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run midnight reset" },
      { status: 500 }
    );
  }
}
