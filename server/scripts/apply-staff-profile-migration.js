const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
const env = dotenv.parse(fs.readFileSync(envPath));
const connStr = env.DIRECT_URL || env.DATABASE_URL;

async function run() {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    console.log('Creating StaffProfile table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "StaffProfile" (
        id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        "linkedUserId"    TEXT UNIQUE,
        email             TEXT,
        "isAvailable"     BOOLEAN DEFAULT TRUE,
        "isOnLeave"       BOOLEAN DEFAULT FALSE,
        "currentWorkload" INT DEFAULT 0,
        "maxWorkload"     INT DEFAULT 20,
        specialization    TEXT[],
        "staffRole"       TEXT DEFAULT 'loan_officer',
        "targetBank"       TEXT,
        "loanType"         TEXT,
        "internalNotes"    TEXT,
        "bankStatus"       TEXT NOT NULL DEFAULT 'NOT_SENT',
        "assignedStaffId"  TEXT,
        "createdAt"       TIMESTAMPTZ DEFAULT now(),
        "updatedAt"       TIMESTAMPTZ DEFAULT now()
      );
    `);

    console.log('Creating StaffProfileDocument table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "StaffProfileDocument" (
        "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        "staffProfileId"    TEXT,
        "userDocumentId"    TEXT,
        "docType"           TEXT NOT NULL,
        "filePath"          TEXT,
        "originalFilename"  TEXT,
        "source"            TEXT NOT NULL DEFAULT 'USER_UPLOAD',
        "status"            TEXT NOT NULL DEFAULT 'pending',
        "rejectionReason"   TEXT,
        "description"       TEXT,
        "uploadedBy"        TEXT,
        "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Creating StaffProfileShare table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "StaffProfileShare" (
        "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        "staffProfileId"  TEXT,
        "sharedBy"        TEXT,
        "bankName"        TEXT,
        "bankEmail"       TEXT,
        "documentIds"     TEXT[],
        "token"           TEXT UNIQUE,
        "expiresAt"       TIMESTAMPTZ,
        "accessNote"      TEXT,
        "accessCount"     INT NOT NULL DEFAULT 0,
        "lastAccessedAt"  TIMESTAMPTZ,
        "revoked"         BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Granting permissions...');
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON "StaffProfile" TO anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON "StaffProfileDocument" TO anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON "StaffProfileShare" TO anon, authenticated, service_role;
    `);

    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    await client.query("NOTIFY pgrst, 'reload config';");
    console.log('Done!');
    await client.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
