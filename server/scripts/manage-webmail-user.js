require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
let hostname = '';
try {
  if (connectionString) {
    const url = new URL(connectionString.replace(/^postgresql:\/\//, 'http://'));
    hostname = url.hostname;
  }
} catch (_) {}

const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocalhost
    ? false
    : {
        rejectUnauthorized: false,
        servername: hostname,
      },
  connectionTimeoutMillis: 15000,
});

const salt = process.env.JWT_SECRET || 'vidyaloans_executive_secure_salt_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function main() {
  const [,, command, ...args] = process.argv;

  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "executive_mailboxes" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT UNIQUE NOT NULL,
      "password" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "title" TEXT,
      "s3Prefix" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (command === 'remove-defaults') {
    const res = await pool.query(`
      DELETE FROM "executive_mailboxes" 
      WHERE LOWER("email") IN ('director@vidyaloans.in', 'management@vidyaloans.in');
    `);
    console.log(`[Success] Removed default mailboxes. Affected rows: ${res.rowCount}`);
  } else if (command === 'fix-prefixes') {
    const res = await pool.query(`
      UPDATE "executive_mailboxes"
      SET "s3Prefix" = REPLACE("s3Prefix", 'officials/', '')
      WHERE "s3Prefix" LIKE 'officials/%';
    `);
    console.log(`[Success] Stripped officials/ from s3Prefix so folders match S3 directly. Affected rows: ${res.rowCount}`);
  } else if (command === 'list') {
    const res = await pool.query(`
      SELECT "id", "email", "name", "title", "s3Prefix", "status", "createdAt" 
      FROM "executive_mailboxes" 
      ORDER BY "createdAt" ASC;
    `);
    console.log('[Webmail Users List]:');
    console.table(res.rows);
  } else if (command === 'add') {
    const [email, password, name, title, s3Prefix] = args;
    if (!email || !password) {
      console.error('Usage: node scripts/manage-webmail-user.js add <email> <password> [name] [designation] [s3Prefix]');
      process.exit(1);
    }
    const cleanEmail = email.trim().toLowerCase();
    const username = cleanEmail.split('@')[0];
    const defaultName = username.charAt(0).toUpperCase() + username.slice(1);
    const cleanName = (name && name.trim()) || defaultName;
    const cleanTitle = (title && title.trim()) || 'Official';
    const folderName = s3Prefix || `${username}/`;
    const cleanPrefix = folderName.endsWith('/') ? folderName : `${folderName}/`;
    const hashedPassword = hashPassword(password.trim());

    await pool.query(`
      INSERT INTO "executive_mailboxes" ("id", "email", "password", "name", "title", "s3Prefix", "status")
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      ON CONFLICT ("email") DO UPDATE SET
        "password" = EXCLUDED."password",
        "name" = EXCLUDED."name",
        "title" = EXCLUDED."title",
        "s3Prefix" = EXCLUDED."s3Prefix",
        "status" = 'active',
        "updatedAt" = CURRENT_TIMESTAMP;
    `, [crypto.randomUUID(), cleanEmail, hashedPassword, cleanName, cleanTitle, cleanPrefix]);

    console.log(`[Success] Mailbox created/updated successfully:`);
    console.log({
      email: cleanEmail,
      name: cleanName,
      title: cleanTitle,
      s3Prefix: cleanPrefix,
    });
  } else if (command === 'set-password') {
    const [email, password] = args;
    if (!email || !password) {
      console.error('Usage: node scripts/manage-webmail-user.js set-password <email> <password>');
      process.exit(1);
    }
    const cleanEmail = email.trim().toLowerCase();
    const hashedPassword = hashPassword(password.trim());

    const res = await pool.query(`
      UPDATE "executive_mailboxes"
      SET "password" = $1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE LOWER("email") = $2;
    `, [hashedPassword, cleanEmail]);

    if (res.rowCount === 0) {
      console.error(`[Error] Mailbox with email "${cleanEmail}" not found in database.`);
    } else {
      console.log(`[Success] Password updated successfully for "${cleanEmail}".`);
    }
  } else if (command === 'delete') {
    const [email] = args;
    if (!email) {
      console.error('Usage: node scripts/manage-webmail-user.js delete <email>');
      process.exit(1);
    }
    const res = await pool.query(`
      DELETE FROM "executive_mailboxes" WHERE LOWER("email") = $1;
    `, [email.trim().toLowerCase()]);
    console.log(`[Success] Deleted ${email}. Rows affected: ${res.rowCount}`);
  } else {
    console.log(`
VidyaLoans Webmail User Management Tool
---------------------------------------
Commands:
  node scripts/manage-webmail-user.js list
    Lists all configured webmail accounts

  node scripts/manage-webmail-user.js add <email> <password> [name] [title] [s3Prefix]
    Creates or updates a user for Webmail login.
    Example:
      node scripts/manage-webmail-user.js add support@vidyaloans.in Support@2026 "Support Team" "Helpdesk" "support/"

  node scripts/manage-webmail-user.js set-password <email> <password>
    Updates the password for an existing mailbox user.
    Example:
      node scripts/manage-webmail-user.js set-password support@vidyaloans.in NewPassword123#

  node scripts/manage-webmail-user.js remove-defaults
    Removes director@vidyaloans.in and management@vidyaloans.in

  node scripts/manage-webmail-user.js delete <email>
    Deletes a user mailbox
    `);
  }
}

main()
  .catch((err) => {
    console.error('[Error]:', err.message);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
