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

    console.log('📦 Executing create-chat-tables.sql...');
    const sql = fs.readFileSync(path.resolve(__dirname, 'create-chat-tables.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ Chat tables created successfully.\n');

    console.log('🔄 Reloading PostgREST schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('✅ PostgREST schema cache reload notification sent.\n');

    const res = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('Conversation', 'Message', 'Conversation_Participant', 'Document_Share', 'Message_Recipient', 'Email_Log');
    `);
    console.log('Verified chat tables created:', res.rows.map(r => r.table_name));

  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
