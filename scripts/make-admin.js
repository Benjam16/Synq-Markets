/**
 * Script to make a user an admin
 * Usage: node scripts/make-admin.js <email>
 * Example: node scripts/make-admin.js Bentradeceo@gmail.com
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

// Load .env.local if it exists
loadEnvFile();

// Get database connection from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is required');
  console.log('   Make sure you have DATABASE_URL in your .env.local file');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function makeAdmin(email) {
  try {
    if (!email) {
      console.error('❌ Error: Email is required');
      console.log('Usage: node scripts/make-admin.js <email>');
      process.exit(1);
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`\n🔍 Looking for user: ${normalizedEmail}...`);

    // Check if user exists
    const checkResult = await query(
      `SELECT id, email, role FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (checkResult.rows.length === 0) {
      console.error(`❌ User not found: ${normalizedEmail}`);
      console.log('\n💡 The user must exist in the database first.');
      console.log('   Make sure you have signed up and logged in at least once.');
      process.exit(1);
    }

    const user = checkResult.rows[0];
    console.log(`✅ Found user: ${user.email} (ID: ${user.id}, Current role: ${user.role})`);

    // Update to admin
    const updateResult = await query(
      `UPDATE users SET role = 'admin', updated_at = NOW() WHERE email = $1 RETURNING id, email, role`,
      [normalizedEmail]
    );

    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log(`\n✅ Success! User is now an admin:`);
      console.log(`   Email: ${updated.email}`);
      console.log(`   Role: ${updated.role}`);
      console.log(`\n🎉 You can now access the admin panel at: http://localhost:3000/admin`);
      console.log(`   (Or your production URL + /admin)`);
    } else {
      console.error('❌ Failed to update user');
      process.exit(1);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];
makeAdmin(email).catch(async (error) => {
  console.error('❌ Unhandled error:', error);
  await pool.end();
  process.exit(1);
});
