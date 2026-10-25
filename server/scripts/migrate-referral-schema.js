/**
 * migrate-referral-schema.js
 * Adds referralCode and referredById columns to User table, and creates Referral and ReferralVisit tables.
 * Run: node scripts/migrate-referral-schema.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DIRECT_URL or DATABASE_URL environment variable is required.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // 1. Add columns to "User" table
    console.log('📦 Adding referralCode and referredById columns to "User" table...');
    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "referralCode" TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS "referredById" TEXT;
    `);
    console.log('✅ User columns added successfully.\n');

    // 2. Create index on "referralCode"
    console.log('📦 Creating index on "referralCode" column...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_referral_code 
      ON "User"("referralCode") 
      WHERE "referralCode" IS NOT NULL;
    `);
    console.log('✅ referralCode index created.\n');

    // 3. Create "Referral" table
    console.log('📦 Creating "Referral" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Referral" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "referrerId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
        "refereeEmail" TEXT NOT NULL,
        "refereeId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "reward" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        UNIQUE("referrerId", "refereeEmail")
      );
    `);
    console.log('✅ "Referral" table created successfully.\n');

    // 4. Create indexes for "Referral" table
    console.log('📦 Creating indexes for "Referral" table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_referrer ON "Referral"("referrerId");
      CREATE INDEX IF NOT EXISTS idx_referral_referee_email ON "Referral"("refereeEmail");
      CREATE INDEX IF NOT EXISTS idx_referral_referee_id ON "Referral"("refereeId");
    `);
    console.log('✅ Referral indexes created successfully.\n');

    // 5. Create "ReferralVisit" table
    console.log('📦 Creating "ReferralVisit" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ReferralVisit" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "referralCode" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "referrerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ "ReferralVisit" table created successfully.\n');

    // 6. Create indexes for "ReferralVisit" table
    console.log('📦 Creating indexes for "ReferralVisit" table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_visit_referrer ON "ReferralVisit"("referrerId");
      CREATE INDEX IF NOT EXISTS idx_referral_visit_code ON "ReferralVisit"("referralCode");
    `);
    console.log('✅ ReferralVisit indexes created successfully.\n');

    // 7. Verify tables and columns exist in information schema
    console.log('🔍 Verifying schema changes...');
    const userColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name IN ('referralCode', 'referredById');
    `);
    console.log('User Columns:', userColumns.rows);

    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('Referral', 'ReferralVisit');
    `);
    console.log('Created Tables:', tables.rows);

    console.log('\n🎉 Referral schema migration complete! Please restart your dev server if needed to refresh the Supabase schema cache.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('\nDetails:', err);
  } finally {
    await client.end();
  }
}

run();
