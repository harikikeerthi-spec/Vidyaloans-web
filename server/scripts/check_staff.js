const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
async function main() {
  await client.connect();
  const res = await client.query('SELECT id, email, role, "mailboxEmail", "mailboxPrefix", "canAccessSupport" FROM "User" WHERE role = \'staff\'');
  console.log('Staff Users in DB:');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
main().catch(console.error);
