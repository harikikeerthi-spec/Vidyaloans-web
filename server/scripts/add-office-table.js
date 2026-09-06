const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Office" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        location TEXT NOT NULL,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMPTZ DEFAULT now(),
        "updatedAt" TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('Table "Office" verified/created.');

    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "officeId" TEXT,
      ADD COLUMN IF NOT EXISTS "officeLocation" TEXT;
    `);
    console.log('Columns "officeId" and "officeLocation" verified/added to "User".');

    // Check count of offices
    const res = await client.query('SELECT count(*) FROM "Office";');
    console.log('Current Office count:', res.rows[0].count);

    await client.end();
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
