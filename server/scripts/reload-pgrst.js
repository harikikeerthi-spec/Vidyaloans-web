const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log('Connected');
    await client.query("NOTIFY pgrst, 'reload schema';");
    await client.query("NOTIFY pgrst, 'reload config';");
    console.log('Sent NOTIFY pgrst reload schema & config');
    await client.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
