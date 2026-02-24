/**
 * Seed script to bootstrap tiers, a demo user, and one active challenge subscription.
 * Usage: DATABASE_URL=... node scripts/seed.js
 */

const { Pool } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tiers = [
      ["The Scout", 5000, 49, 'New traders, "micro-betting" experimenters.'],
      ["The Analyst", 25000, 199, "Serious retail traders looking for a side income."],
      ["The Strategist", 100000, 549, "Pro-level traders; top 2% of the market."],
      ["The Whale", 250000, 1099, "Institutional-grade traders focused on high liquidity."],
      ["VIP/Elite", 500000, 0, "Dedicated to massive events (e.g., Elections, Super Bowl)."],
    ];

    for (const [name, size, fee, target] of tiers) {
      await client.query(
        `
        INSERT INTO account_tiers (name, account_size, challenge_fee, target_audience)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET account_size = EXCLUDED.account_size,
                                       challenge_fee = EXCLUDED.challenge_fee,
                                       target_audience = EXCLUDED.target_audience;
        `,
        [name, size, fee, target],
      );
    }

    const email = "demo@prop.local";
    const userRes = await client.query(
      `
      INSERT INTO users (email, full_name, role)
      VALUES ($1, 'Demo User', 'trader')
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id;
      `,
      [email],
    );
    const userId = userRes.rows[0].id;

    const tierRes = await client.query(
      `SELECT id FROM account_tiers WHERE name = 'The Strategist' LIMIT 1;`,
    );
    const tierId = tierRes.rows[0].id;

    const balance = 100000;
    const subRes = await client.query(
      `
      SELECT id FROM challenge_subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1;
      `,
      [userId],
    );

    if (subRes.rows.length === 0) {
      await client.query(
        `
        INSERT INTO challenge_subscriptions
          (user_id, tier_id, status, start_balance, current_balance, day_start_balance)
        VALUES ($1, $2, 'active', $3, $3, $3);
        `,
        [userId, tierId, balance],
      );
    }

    await client.query("COMMIT");
    console.log("Seed complete. User:", email, "Password: (set externally)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();


