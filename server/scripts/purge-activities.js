/**
 * purge-activities.js
 * Purges all AuditLog entries where action = 'STAFF_ACTIVITY'.
 * Run: node scripts/purge-activities.js
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

async function main() {
  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected successfully. Purging AuditLog 'STAFF_ACTIVITY' records...");

    const res = await client.query("DELETE FROM \"AuditLog\" WHERE action = 'STAFF_ACTIVITY'");
    console.log(`Successfully deleted ${res.rowCount} records.`);

  } catch (err) {
    console.error("Error purging activities:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

main();
