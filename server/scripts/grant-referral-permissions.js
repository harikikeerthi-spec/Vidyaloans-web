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

    console.log('📦 Granting privileges on "Referral" and "ReferralVisit" tables...');
    await client.query('GRANT ALL PRIVILEGES ON TABLE "Referral" TO postgres, anon, authenticated, service_role;');
    await client.query('GRANT ALL PRIVILEGES ON TABLE "ReferralVisit" TO postgres, anon, authenticated, service_role;');
    console.log('✅ Privileges granted successfully.\n');

  } catch (err) {
    console.error('❌ Granting privileges failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
