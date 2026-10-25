const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const salt = process.env.JWT_SECRET || 'vidyaloans_executive_secure_salt_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function main() {
  const [,, command, ...args] = process.argv;

  // Ensure table exists
  await prisma.$executeRawUnsafe(`
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
    const res = await prisma.$executeRawUnsafe(`
      DELETE FROM "executive_mailboxes" 
      WHERE LOWER("email") IN ('director@vidyaloans.in', 'management@vidyaloans.in');
    `);
    console.log(`[Success] Removed default mailboxes. Affected rows: ${res}`);
  } else if (command === 'list') {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT "id", "email", "name", "title", "s3Prefix", "status", "createdAt" 
      FROM "executive_mailboxes" 
      ORDER BY "createdAt" ASC;
    `);
    console.log('[Webmail Users List]:');
    console.table(rows);
  } else if (command === 'add') {
    const [email, password, name, title, s3Prefix] = args;
    if (!email || !password || !name) {
      console.error('Usage: node scripts/manage-webmail-user.js add <email> <password> <name> [title] [s3Prefix]');
      process.exit(1);
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanTitle = (title || 'Official').trim();
    const folderName = s3Prefix || `officials/${cleanEmail.split('@')[0]}/`;
    const cleanPrefix = folderName.endsWith('/') ? folderName : `${folderName}/`;
    const hashedPassword = hashPassword(password.trim());

    await prisma.$executeRawUnsafe(`
      INSERT INTO "executive_mailboxes" ("id", "email", "password", "name", "title", "s3Prefix", "status")
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      ON CONFLICT ("email") DO UPDATE SET
        "password" = EXCLUDED."password",
        "name" = EXCLUDED."name",
        "title" = EXCLUDED."title",
        "s3Prefix" = EXCLUDED."s3Prefix",
        "status" = 'active',
        "updatedAt" = CURRENT_TIMESTAMP;
    `, crypto.randomUUID(), cleanEmail, hashedPassword, cleanName, cleanTitle, cleanPrefix);

    console.log(`[Success] Mailbox created/updated successfully:`);
    console.log({
      email: cleanEmail,
      name: cleanName,
      title: cleanTitle,
      s3Prefix: cleanPrefix,
    });
  } else if (command === 'delete') {
    const [email] = args;
    if (!email) {
      console.error('Usage: node scripts/manage-webmail-user.js delete <email>');
      process.exit(1);
    }
    const res = await prisma.$executeRawUnsafe(`
      DELETE FROM "executive_mailboxes" WHERE LOWER("email") = $1;
    `, email.trim().toLowerCase());
    console.log(`[Success] Deleted ${email}. Rows affected: ${res}`);
  } else {
    console.log(`
VidyaLoans Webmail User Management Tool
---------------------------------------
Commands:
  node scripts/manage-webmail-user.js remove-defaults
    Removes director@vidyaloans.in and management@vidyaloans.in

  node scripts/manage-webmail-user.js list
    Lists all configured webmail accounts

  node scripts/manage-webmail-user.js add <email> <password> <name> [title] [s3Prefix]
    Creates or updates a user for Webmail login.
    Example:
      node scripts/manage-webmail-user.js add ceo@vidyaloans.in MySecret123# "John Doe" "CEO" "officials/ceo/"

  node scripts/manage-webmail-user.js delete <email>
    Deletes a user mailbox
    `);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[Error]:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
