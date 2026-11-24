const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
const env = dotenv.parse(fs.readFileSync(envPath));
const connStr = env.DIRECT_URL || env.DATABASE_URL;
const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function listAll() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('All public tables in DB:');
    console.log(res.rows.map(r => r.table_name));

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listAll();
