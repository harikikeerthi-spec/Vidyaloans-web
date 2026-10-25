const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating executive_mailboxes table...');
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

  const salt = process.env.JWT_SECRET || 'vidyaloans_executive_secure_salt_2026';
  const directorPass = crypto.createHash('sha256').update('Director@2026#' + salt).digest('hex');
  const mgmtPass = crypto.createHash('sha256').update('Management@2026#' + salt).digest('hex');

  await prisma.$executeRawUnsafe(`
    INSERT INTO "executive_mailboxes" ("id", "email", "password", "name", "title", "s3Prefix", "status")
    VALUES 
      ('${crypto.randomUUID()}', 'director@vidyaloans.in', '${directorPass}', 'Executive Director', 'Director of Operations', 'officials/director/', 'active'),
      ('${crypto.randomUUID()}', 'management@vidyaloans.in', '${mgmtPass}', 'Senior Management', 'Board of Management', 'officials/management/', 'active')
    ON CONFLICT ("email") DO UPDATE SET "password" = EXCLUDED."password";
  `);

  console.log('Successfully created and seeded executive_mailboxes!');
  const rows = await prisma.$queryRawUnsafe(`SELECT id, email, name, "s3Prefix", status FROM "executive_mailboxes";`);
  console.log('Rows in DB:', rows);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
