require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Adding bank column to User table if not exists...');
    await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bank" TEXT;');
    await pool.query("NOTIFY pgrst, 'reload schema';");
    console.log('Migration succeeded: bank column added to User table.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
