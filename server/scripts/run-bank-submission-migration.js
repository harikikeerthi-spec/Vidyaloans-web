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
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('Connected!\n');

    const sqlPath = path.resolve(__dirname, 'bank-submission-migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Creating BankSubmission table...');
    await client.query(sql);
    console.log('BankSubmission table created successfully!\n');

    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Schema cache reloaded.\n');

    const res = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BankSubmission';"
    );
    if (res.rows.length > 0) {
      console.log('SUCCESS: BankSubmission table now exists in the database!');
    } else {
      console.log('WARNING: Table not found after migration - check SQL logs');
    }

  } catch (err) {
    console.error('Migration error:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
