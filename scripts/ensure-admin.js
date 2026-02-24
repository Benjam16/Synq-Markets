/**
 * Script to ensure a user is an admin
 * Usage: node scripts/ensure-admin.js <email>
 * Example: node scripts/ensure-admin.js bentradeceo@gmail.com
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

async function ensureAdmin(email) {
  try {
    if (!email) {
      console.error('❌ Error: Email is required');
      console.log('\nUsage: node scripts/ensure-admin.js <email>');
      console.log('Example: node scripts/ensure-admin.js bentradeceo@gmail.com');
      process.exit(1);
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`\n🔍 Checking user: ${normalizedEmail}...`);
    
    // Check if user exists
    const userCheck = await query(
      "SELECT id, email, role FROM users WHERE LOWER(TRIM(email)) = $1",
      [normalizedEmail]
    );

    if (userCheck.rows.length === 0) {
      console.log(`\n⚠️  User not found: ${normalizedEmail}`);
      console.log('   Please make sure the user has logged in at least once.');
      process.exit(1);
    }

    const user = userCheck.rows[0];
    console.log(`\n📋 Current user info:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);

    if (user.role === 'admin' || user.role === 'risk') {
      console.log(`\n✅ User is already an admin!`);
      console.log(`\n🎉 You can access the admin panel at: http://localhost:3000/admin`);
      await pool.end();
      process.exit(0);
    }

    // Update to admin
    console.log(`\n🔄 Updating role to 'admin'...`);
    const updateResult = await query(
      `UPDATE users 
       SET role = 'admin', updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, email, role`,
      [user.id]
    );

    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log(`\n✅ Success! User is now an admin:`);
      console.log(`   ID: ${updated.id}`);
      console.log(`   Email: ${updated.email}`);
      console.log(`   Role: ${updated.role}`);
      console.log(`\n🎉 You can now access the admin panel at: http://localhost:3000/admin`);
      console.log(`   (Or your production URL + /admin)`);
    } else {
      console.log(`\n❌ Failed to update user role`);
      process.exit(1);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

// Get email from command line
const email = process.argv[2];
ensureAdmin(email).catch(async (error) => {
  console.error('❌ Unhandled error:', error);
  await pool.end();
  process.exit(1);
});
