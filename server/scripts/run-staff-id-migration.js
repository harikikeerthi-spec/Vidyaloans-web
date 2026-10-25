/**
 * run-staff-id-migration.js
 * Adds the staffId column to the User table in Supabase via direct DB connection.
 * Run: node scripts/run-staff-id-migration.js
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🚀 Running staffId column migration...\n');

  // Step 1: Check if the column already exists by querying it
  console.log('1. Checking if staffId column exists...');
  const { data: testData, error: testError } = await supabase
    .from('User')
    .select('staffId')
    .limit(1);

  if (!testError) {
    console.log('✅ staffId column already exists! No migration needed.');
    console.log('   Supabase schema cache is up to date.\n');
    // Show current staff users
    const { data: staffUsers } = await supabase
      .from('User')
      .select('email, role, staffId')
      .or('role.eq.staff,role.eq.admin')
      .limit(10);
    if (staffUsers && staffUsers.length > 0) {
      console.log('Current staff users:');
      staffUsers.forEach(u => console.log(`  - ${u.email} (${u.role}) → staffId: ${u.staffId || 'null'}`));
    }
    return;
  }

  if (testError.code === 'PGRST204') {
    console.log('⚠️  staffId column NOT found in schema cache.');
    console.log('   Error:', testError.message);
    console.log('\n   The column needs to be added via Supabase SQL Editor.');
    console.log('\n📋 Please run this SQL in your Supabase SQL Editor:');
    console.log('   → https://supabase.com/dashboard/project/mhhmqdbzsmwyizmvwtsx/sql\n');
    console.log('─'.repeat(60));
    console.log('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffId" TEXT UNIQUE;');
    console.log('');
    console.log('CREATE INDEX IF NOT EXISTS idx_user_staffid ON "User"("staffId") WHERE "staffId" IS NOT NULL;');
    console.log('');
    console.log('CREATE INDEX IF NOT EXISTS idx_user_staffid_like ON "User"("staffId") WHERE "staffId" LIKE \'VL-SF-%\';');
    console.log('─'.repeat(60));
    console.log('\nAfter running the SQL, restart your NestJS server to refresh the schema cache.');
  } else {
    console.error('❌ Unexpected error:', testError);
  }
}

runMigration().catch(console.error);
