/**
 * Enable Supabase Trigger Script
 * 
 * This script uses the service role key to enable the trigger
 * Run with: node scripts/enable-trigger.js
 */

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey || !databaseUrl) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('- DATABASE_URL');
  process.exit(1);
}

async function enableTrigger() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('Connecting to database...');
    
    // Check current trigger status
    const checkResult = await pool.query(`
      SELECT 
        tgname as trigger_name,
        CASE tgenabled
          WHEN 0 THEN 'DISABLED'
          WHEN 1 THEN 'ENABLED'
          WHEN 2 THEN 'REPLICA'
          WHEN 3 THEN 'ALWAYS'
        END as status,
        tgenabled
      FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created';
    `);

    if (checkResult.rows.length === 0) {
      console.error('❌ Trigger "on_auth_user_created" not found!');
      console.error('You need to create the trigger first. Run db/supabase_migrations.sql in Supabase SQL Editor.');
      process.exit(1);
    }

    const currentStatus = checkResult.rows[0];
    console.log(`Current trigger status: ${currentStatus.status} (tgenabled=${currentStatus.tgenabled})`);

    if (currentStatus.tgenabled === 1) {
      console.log('✅ Trigger is already enabled!');
      process.exit(0);
    }

    // Try to enable the trigger
    console.log('Attempting to enable trigger...');
    
    // Use service role to enable trigger
    // Note: This might still fail if service role doesn't have permission
    // In that case, you'll need to contact Supabase support or use their dashboard
    await pool.query(`
      ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
    `);

    // Verify it's enabled
    const verifyResult = await pool.query(`
      SELECT 
        tgname as trigger_name,
        CASE tgenabled
          WHEN 0 THEN 'DISABLED'
          WHEN 1 THEN 'ENABLED'
          WHEN 2 THEN 'REPLICA'
          WHEN 3 THEN 'ALWAYS'
        END as status,
        tgenabled
      FROM pg_trigger 
      WHERE tgname = 'on_auth_user_created';
    `);

    const newStatus = verifyResult.rows[0];
    console.log(`New trigger status: ${newStatus.status} (tgenabled=${newStatus.tgenabled})`);

    if (newStatus.tgenabled === 1) {
      console.log('✅ Trigger enabled successfully!');
    } else {
      console.error('❌ Failed to enable trigger. Status is still:', newStatus.status);
      console.error('You may need to contact Supabase support or use their dashboard.');
    }

  } catch (error) {
    console.error('❌ Error enabling trigger:', error.message);
    console.error('\nIf you get a permission error, try:');
    console.error('1. Go to Supabase Dashboard → Database → Extensions');
    console.error('2. Or contact Supabase support to enable the trigger');
    console.error('3. Or use the workaround: Make sure your API route handles user creation properly');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

enableTrigger();
