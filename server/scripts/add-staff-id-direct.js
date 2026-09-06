/**
 * add-staff-id-direct.js
 * Adds staffId column to the User table via direct PostgreSQL connection (bypassing Supabase REST API).
 * Run: node scripts/add-staff-id-direct.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Add the staffId column
    console.log('📦 Adding staffId column to "User" table...');
    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "staffId" TEXT UNIQUE;
    `);
    console.log('✅ staffId column added (or already exists)\n');

    // Create indexes
    console.log('📦 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_staffid 
      ON "User"("staffId") 
      WHERE "staffId" IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_staffid_like 
      ON "User"("staffId") 
      WHERE "staffId" LIKE 'VL-SF-%';
    `);
    console.log('✅ Indexes created\n');

    // Verify column exists
    const verify = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'staffId';
    `);
    
    if (verify.rows.length > 0) {
      console.log('✅ Migration verified! Column details:');
      console.log(verify.rows[0]);
    } else {
      console.log('⚠️  Column not found after migration. Check table name case.');
    }

    // List existing staff users
    const staff = await client.query(`
      SELECT email, role, "staffId" 
      FROM "User" 
      WHERE role IN ('staff', 'admin') 
      LIMIT 10;
    `);
    
    if (staff.rows.length > 0) {
      console.log('\nExisting staff users:');
      staff.rows.forEach(u => console.log(`  - ${u.email} (${u.role}) → staffId: ${u.staffId || 'null'}`));
    }

    console.log('\n🎉 Migration complete! Restart your NestJS server to refresh the schema cache.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('\nDetails:', err);
    
    // Provide manual SQL as fallback
    console.log('\n📋 Run this SQL manually in Supabase SQL Editor:');
    console.log('   → https://supabase.com/dashboard/project/mhhmqdbzsmwyizmvwtsx/sql\n');
    console.log('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffId" TEXT UNIQUE;');
    console.log('CREATE INDEX IF NOT EXISTS idx_user_staffid ON "User"("staffId") WHERE "staffId" IS NOT NULL;');
  } finally {
    await client.end();
  }
}

run();
