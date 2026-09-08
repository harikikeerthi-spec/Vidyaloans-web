const { Client } = require('pg');
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
    console.log('✅ Connected!');

    console.log('📦 Creating StaffEmailState table...');
    const sql = `
      CREATE TABLE IF NOT EXISTS "StaffEmailState" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "emailId" TEXT NOT NULL,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "isStarred" BOOLEAN NOT NULL DEFAULT false,
        "isSpam" BOOLEAN,
        "isTrashed" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StaffEmailState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "StaffEmailState_userId_emailId_key" ON "StaffEmailState"("userId", "emailId");
      CREATE INDEX IF NOT EXISTS "StaffEmailState_userId_idx" ON "StaffEmailState"("userId");
      CREATE INDEX IF NOT EXISTS "StaffEmailState_emailId_idx" ON "StaffEmailState"("emailId");
    `;

    await client.query(sql);
    console.log('✅ StaffEmailState table and indexes verified successfully.');

    const check = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'StaffEmailState';
    `);
    console.log('Columns in StaffEmailState:', check.rows.map(r => `${r.column_name} (${r.data_type})`));

  } catch (err) {
    console.error('❌ Error creating StaffEmailState table:', err);
  } finally {
    await client.end();
  }
}

run();
