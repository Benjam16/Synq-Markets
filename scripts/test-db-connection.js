/**
 * Test database connection
 * Usage: node scripts/test-db-connection.js
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

loadEnvFile();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is required');
  console.log('\n💡 Make sure you have DATABASE_URL in your .env.local file');
  console.log('   Format: DATABASE_URL=postgresql://user:password@host:port/database');
  process.exit(1);
}

console.log('🔍 Testing database connection...');
console.log(`   Connection string: ${connectionString.substring(0, 20)}...`);

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function testConnection() {
  try {
    // Test basic connection
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection successful!');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
    
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Users table exists');
      
      // Check user count
      const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
      console.log(`   Total users: ${userCount.rows[0].count}`);
      
      // Check for admin users
      const adminCount = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      console.log(`   Admin users: ${adminCount.rows[0].count}`);
      
      // Check specific user
      const userCheck = await pool.query("SELECT id, email, role FROM users WHERE email = 'Bentradeceo@gmail.com'");
      if (userCheck.rows.length > 0) {
        const user = userCheck.rows[0];
        console.log(`\n✅ Found your user:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   ID: ${user.id}`);
        
        if (user.role !== 'admin') {
          console.log('\n⚠️  Your role is not "admin". Updating now...');
          await pool.query(
            "UPDATE users SET role = 'admin', updated_at = NOW() WHERE email = 'Bentradeceo@gmail.com'"
          );
          console.log('✅ Role updated to admin!');
        } else {
          console.log('✅ You are already an admin!');
        }
      } else {
        console.log('\n⚠️  User not found: Bentradeceo@gmail.com');
        console.log('   Make sure you have signed up and logged in at least once.');
      }
    } else {
      console.log('⚠️  Users table does not exist');
      console.log('   You may need to run the database migrations.');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Common issues:');
    console.error('   1. DATABASE_URL is incorrect');
    console.error('   2. Database server is not running');
    console.error('   3. Network/firewall blocking connection');
    console.error('   4. Wrong credentials');
    await pool.end();
    process.exit(1);
  }
}

testConnection();
