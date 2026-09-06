const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // 1. Run migrate_assignment_engine.sql
    console.log('📦 Running migrate_assignment_engine.sql...');
    const assignmentSql = fs.readFileSync(path.resolve(__dirname, 'migrate_assignment_engine.sql'), 'utf8');
    await client.query(assignmentSql);
    console.log('✅ Assignment engine migration applied.\n');

    // 2. Run staff-profile-migration.sql
    console.log('📦 Running staff-profile-migration.sql...');
    const staffProfileSql = fs.readFileSync(path.resolve(__dirname, 'staff-profile-migration.sql'), 'utf8');
    try {
      await client.query(staffProfileSql);
      console.log('✅ Staff profile migration applied.\n');
    } catch (err) {
      console.log('⚠️ Staff profile notice (may already exist):', err.message);
    }

    // 3. Run bank-dashboard-schema.sql
    console.log('📦 Running bank-dashboard-schema.sql...');
    const bankSql = fs.readFileSync(path.resolve(__dirname, 'bank-dashboard-schema.sql'), 'utf8');
    try {
      await client.query(bankSql);
      console.log('✅ Bank dashboard schema applied.\n');
    } catch (err) {
      console.log('⚠️ Bank dashboard notice (may already exist):', err.message);
    }

    // 4. Reload PostgREST schema cache
    console.log('🔄 Reloading PostgREST schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('✅ PostgREST schema cache reload notification sent.\n');

    // 5. Verify LoanApplication columns
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'LoanApplication' AND column_name IN ('assignedStaffId', 'assignedAt', 'assignmentStatus', 'priority');
    `);
    console.log('Verified LoanApplication assignment columns:', cols.rows);

    // 6. Test specific loan record
    const targetLoan = await client.query(`
      SELECT id, "applicationNumber", "assignedStaffId", status 
      FROM "LoanApplication" 
      WHERE id = 'f9e3c0ea-b125-4ed3-bdc4-b732ab5fab74';
    `);
    console.log('Target Loan Record:', targetLoan.rows[0]);

  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
