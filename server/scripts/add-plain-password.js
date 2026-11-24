const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plainPassword" TEXT;');
    console.log('ALTER TABLE User ADD COLUMN plainPassword SUCCESS');
    const res = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'plainPassword';`);
    console.log('Column info:', res.rows);
    await client.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
