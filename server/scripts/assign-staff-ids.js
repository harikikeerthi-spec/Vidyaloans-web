/**
 * assign-staff-ids.js
 * Assigns VL-SF-XXX staff IDs to existing staff/admin users who don't have one yet.
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('🔌 Connecting...');
    await client.connect();

    // Get all staff/admin users without a staffId
    const { rows: staffUsers } = await client.query(`
      SELECT id, email, role, "staffId"
      FROM "User"
      WHERE role IN ('staff', 'admin', 'super_admin')
      ORDER BY "createdAt" ASC;
    `);

    console.log(`\nFound ${staffUsers.length} staff/admin users\n`);

    // Get max existing staff ID sequence
    const { rows: maxRows } = await client.query(`
      SELECT "staffId" FROM "User"
      WHERE "staffId" LIKE 'VL-SF-%'
      ORDER BY "staffId" DESC;
    `);

    let nextSeq = 1;
    if (maxRows.length > 0) {
      const nums = maxRows
        .map(r => parseInt(r.staffId.replace('VL-SF-', ''), 10))
        .filter(n => !isNaN(n));
      if (nums.length > 0) nextSeq = Math.max(...nums) + 1;
    }

    for (const user of staffUsers) {
      if (user.staffId) {
        console.log(`✅ ${user.email} (${user.role}) already has staffId: ${user.staffId}`);
        continue;
      }

      const staffId = `VL-SF-${String(nextSeq).padStart(3, '0')}`;
      nextSeq++;

      await client.query(
        `UPDATE "User" SET "staffId" = $1 WHERE id = $2`,
        [staffId, user.id]
      );
      console.log(`🔑 Assigned ${staffId} → ${user.email} (${user.role})`);
    }

    console.log('\n🔄 Reloading PostgREST schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('✅ PostgREST schema cache reload triggered.');

    console.log('\n✅ All staff IDs assigned successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
