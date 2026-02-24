/**
 * Script to clean up challenges for a user
 * Usage: node scripts/cleanup-user-challenges.js <email> [action]
 * 
 * Actions:
 *   - view (default): View all challenges
 *   - fail: Fail all active challenges
 *   - delete: Delete all challenges (permanent!)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local manually if dotenv is not available
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      envFile.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match && !process.env[match[1]]) {
            let value = match[2].trim();
            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            process.env[match[1]] = value;
          }
        }
      });
    }
  } catch (e) {
    console.error('Error loading .env.local:', e.message);
  }
}

// Also strip quotes from existing DATABASE_URL if present
if (process.env.DATABASE_URL) {
  let dbUrl = process.env.DATABASE_URL;
  if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || 
      (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
    process.env.DATABASE_URL = dbUrl.slice(1, -1);
  }
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment or .env.local');
  console.error('Please set DATABASE_URL environment variable or create .env.local file');
  process.exit(1);
}

// Debug: Show if DATABASE_URL was loaded (without showing the full URL)
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;
  const preview = dbUrl.length > 50 ? dbUrl.substring(0, 50) + '...' : dbUrl;
  console.log('Using DATABASE_URL:', preview.replace(/:[^:@]*@/, ':****@'));
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? {
    rejectUnauthorized: false
  } : undefined,
});

async function main() {
  const email = process.argv[2];
  const action = process.argv[3] || 'view';

  if (!email) {
    console.error('Usage: node scripts/cleanup-user-challenges.js <email> [view|fail|delete]');
    process.exit(1);
  }

  if (!['view', 'fail', 'delete'].includes(action)) {
    console.error('Action must be: view, fail, or delete');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find user by email
    const userRes = await client.query(
      'SELECT id, email, full_name FROM users WHERE email = $1',
      [email]
    );

    if (userRes.rows.length === 0) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    const userId = userRes.rows[0].id;
    console.log(`\nFound user: ${userRes.rows[0].email} (ID: ${userId})`);

    // Get all challenges
    const challengesRes = await client.query(
      `
      SELECT 
        cs.id,
        cs.status,
        cs.start_balance,
        cs.current_balance,
        cs.started_at,
        cs.ended_at,
        cs.fail_reason,
        COUNT(st.id) as trade_count
      FROM challenge_subscriptions cs
      LEFT JOIN simulated_trades st ON st.challenge_subscription_id = cs.id
      WHERE cs.user_id = $1
      GROUP BY cs.id
      ORDER BY cs.started_at DESC;
      `,
      [userId]
    );

    const challenges = challengesRes.rows;

    if (challenges.length === 0) {
      console.log('No challenges found for this user');
      await client.query('COMMIT');
      return;
    }

    console.log(`\nFound ${challenges.length} challenge(s):`);
    challenges.forEach((c, i) => {
      console.log(`\n${i + 1}. Challenge ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Start Balance: $${Number(c.start_balance).toFixed(2)}`);
      console.log(`   Current Balance: $${Number(c.current_balance).toFixed(2)}`);
      console.log(`   Trades: ${c.trade_count}`);
      console.log(`   Started: ${new Date(c.started_at).toLocaleString()}`);
      if (c.ended_at) {
        console.log(`   Ended: ${new Date(c.ended_at).toLocaleString()}`);
      }
      if (c.fail_reason) {
        console.log(`   Fail Reason: ${c.fail_reason}`);
      }
    });

    const activeChallenges = challenges.filter(c => c.status === 'active');
    console.log(`\nActive challenges: ${activeChallenges.length}`);

    if (action === 'view') {
      console.log('\nTo fail active challenges, run:');
      console.log(`  node scripts/cleanup-user-challenges.js ${email} fail`);
      console.log('\nTo delete all challenges (permanent!), run:');
      console.log(`  node scripts/cleanup-user-challenges.js ${email} delete`);
      await client.query('COMMIT');
      return;
    }

    if (action === 'fail') {
      if (activeChallenges.length === 0) {
        console.log('\nNo active challenges to fail');
        await client.query('COMMIT');
        return;
      }

      await client.query(
        `
        UPDATE challenge_subscriptions
        SET 
          status = 'failed',
          fail_reason = 'Manually closed by user',
          ended_at = NOW()
        WHERE user_id = $1 AND status = 'active';
        `,
        [userId]
      );

      console.log(`\n✅ Failed ${activeChallenges.length} active challenge(s)`);
      await client.query('COMMIT');
      return;
    }

    if (action === 'delete') {
      console.log('\n⚠️  WARNING: This will permanently delete:');
      console.log(`   - ${challenges.length} challenge(s)`);
      console.log(`   - All trades for these challenges`);
      console.log(`   - All balance snapshots`);
      console.log(`   - All risk events`);
      console.log('\nThis action cannot be undone!');
      
      // In a real script, you might want to add a confirmation prompt
      // For now, we'll proceed

      // Delete trades
      const tradesDeleted = await client.query(
        `
        DELETE FROM simulated_trades
        WHERE challenge_subscription_id IN (
          SELECT id FROM challenge_subscriptions WHERE user_id = $1
        );
        `,
        [userId]
      );

      // Delete balance snapshots
      await client.query(
        `
        DELETE FROM daily_balance_snapshots
        WHERE challenge_subscription_id IN (
          SELECT id FROM challenge_subscriptions WHERE user_id = $1
        );
        `,
        [userId]
      );

      // Delete risk events
      await client.query(
        `
        DELETE FROM risk_events
        WHERE challenge_subscription_id IN (
          SELECT id FROM challenge_subscriptions WHERE user_id = $1
        );
        `,
        [userId]
      );

      // Delete challenges
      await client.query(
        'DELETE FROM challenge_subscriptions WHERE user_id = $1',
        [userId]
      );

      console.log(`\n✅ Deleted all challenges and associated data`);
      await client.query('COMMIT');
      return;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
