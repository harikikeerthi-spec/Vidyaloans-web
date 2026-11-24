const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('Could not find .env at:', envPath);
  process.exit(1);
}

const env = dotenv.parse(fs.readFileSync(envPath));
const connStr = env.DIRECT_URL || env.DATABASE_URL;
if (!connStr) {
  console.error('No DIRECT_URL or DATABASE_URL found in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
});

async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  try {
    const check = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2;
    `, [tableName, columnName]);

    if (check.rows.length === 0) {
      console.log(`Adding column "${columnName}" to "${tableName}"...`);
      await client.query(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnDefinition};`);
      console.log(`✓ Added "${columnName}" to "${tableName}"`);
    } else {
      console.log(`- Column "${columnName}" already exists on "${tableName}"`);
    }
  } catch (err) {
    console.error(`Error adding ${columnName} to ${tableName}:`, err.message);
    throw err;
  }
}

async function run() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully.\n');

    // 1. Ensure BankSubmission table exists
    console.log('Ensuring "BankSubmission" table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BankSubmission" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "applicationId" TEXT NOT NULL,
        "bankId" TEXT NOT NULL,
        "bankName" VARCHAR(255) NOT NULL,
        "submittedBy" TEXT NOT NULL,
        "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "workflowStatus" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED_TO_BANK',
        "currentStage" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED_TO_BANK',
        "lanNumber" VARCHAR(100),
        "lanEnteredAt" TIMESTAMP(3),
        "fileLoggedAt" TIMESTAMP(3),
        "fileLoggedBy" TEXT,
        "queriesRaised" INTEGER DEFAULT 0,
        "lastQueryAt" TIMESTAMP(3),
        "queryResponsePending" BOOLEAN DEFAULT FALSE,
        "decisionStatus" VARCHAR(50),
        "decisionMadeAt" TIMESTAMP(3),
        "decisionMadeBy" TEXT,
        "decisionNotes" TEXT,
        "sanctionAmount" DOUBLE PRECISION,
        "sanctionDate" TIMESTAMP(3),
        "roiType" VARCHAR(20),
        "roiBase" DOUBLE PRECISION,
        "roiEffective" DOUBLE PRECISION,
        "roiSubsidy" DOUBLE PRECISION,
        "tenure" INTEGER,
        "conditions" JSONB,
        "conditionDeadline" TIMESTAMP(3),
        "counterOfferDetails" JSONB,
        "rejectionReason" TEXT,
        "rejectionCategory" VARCHAR(50),
        "canResubmitToOtherBank" BOOLEAN DEFAULT FALSE,
        "resubmissionAttempts" INTEGER DEFAULT 0,
        "lastResubmittedAt" TIMESTAMP(3),
        "partialSanctionAmount" DOUBLE PRECISION,
        "processingFeeAmount" DOUBLE PRECISION,
        "processingFeeStatus" VARCHAR(50) DEFAULT 'PENDING',
        "processingFeePaidAt" TIMESTAMP(3),
        "disbursementStatus" VARCHAR(50),
        "disbursementAmount" DOUBLE PRECISION,
        "disbursementDate" TIMESTAMP(3),
        "disbursementReferenceNo" VARCHAR(100),
        "cancellationReason" TEXT,
        "refundAmount" DOUBLE PRECISION,
        "refundedAt" TIMESTAMP(3),
        "priority" VARCHAR(20) DEFAULT 'standard',
        "comments" TEXT,
        "statusHistory" JSONB DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ "BankSubmission" table verified.\n');

    // 2. Ensure all BankSubmission columns exist (including Week 3 fields)
    console.log('Checking BankSubmission columns...');
    await addColumnIfNotExists('BankSubmission', 'isOnHold', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists('BankSubmission', 'holdReason', 'TEXT');
    await addColumnIfNotExists('BankSubmission', 'holdSetAt', 'TIMESTAMP(3)');
    await addColumnIfNotExists('BankSubmission', 'slaPausedDurationMs', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('BankSubmission', 'assignedOfficerId', 'TEXT');
    await addColumnIfNotExists('BankSubmission', 'assignedOfficerName', 'VARCHAR(255)');
    await addColumnIfNotExists('BankSubmission', 'qualityRating', 'JSONB');
    await addColumnIfNotExists('BankSubmission', 'amendments', "JSONB DEFAULT '[]'::jsonb");
    await addColumnIfNotExists('BankSubmission', 'disbursementTranches', "JSONB DEFAULT '[]'::jsonb");
    await addColumnIfNotExists('BankSubmission', 'cancellationReason', 'TEXT');
    await addColumnIfNotExists('BankSubmission', 'cancellationRequestedBy', 'TEXT');
    await addColumnIfNotExists('BankSubmission', 'cancellationRequestedAt', 'TIMESTAMP(3)');
    await addColumnIfNotExists('BankSubmission', 'refundAmount', 'DOUBLE PRECISION');
    await addColumnIfNotExists('BankSubmission', 'lanNumber', 'VARCHAR(100)');
    await addColumnIfNotExists('BankSubmission', 'lanEnteredAt', 'TIMESTAMP(3)');
    console.log('✓ All BankSubmission columns verified.\n');

    // 3. Ensure BankWorkflowHistory table exists
    console.log('Ensuring "BankWorkflowHistory" table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BankWorkflowHistory" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "submissionId" TEXT NOT NULL,
        "applicationId" TEXT NOT NULL,
        "fromStatus" VARCHAR(50),
        "toStatus" VARCHAR(50) NOT NULL,
        "fromStage" VARCHAR(50),
        "toStage" VARCHAR(50) NOT NULL,
        "changedBy" TEXT NOT NULL,
        "changeReason" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ "BankWorkflowHistory" table verified.\n');

    // 4. Ensure BankWorkflowQueryRequest table exists
    console.log('Ensuring "BankWorkflowQueryRequest" table exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BankWorkflowQueryRequest" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "submissionId" TEXT NOT NULL,
        "applicationId" TEXT NOT NULL,
        "queryType" VARCHAR(50) NOT NULL,
        "queryDescription" TEXT NOT NULL,
        "raisedBy" TEXT NOT NULL,
        "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        "responseNotes" TEXT,
        "respondedBy" TEXT,
        "respondedAt" TIMESTAMP(3),
        "documentsRequested" JSONB DEFAULT '[]'::jsonb,
        "docsChecklist" JSONB DEFAULT '[]'::jsonb,
        "messages" JSONB DEFAULT '[]'::jsonb,
        "metadata" JSONB
      );
    `);
    console.log('✓ "BankWorkflowQueryRequest" table verified.\n');

    // 5. Ensure LoanApplication columns exist
    console.log('Checking LoanApplication columns...');
    await addColumnIfNotExists('LoanApplication', 'lanEnteredAt', 'TIMESTAMP(3)');
    await addColumnIfNotExists('LoanApplication', 'lanNumber', 'VARCHAR(100)');
    await addColumnIfNotExists('LoanApplication', 'bankSubmissionId', 'TEXT');
    await addColumnIfNotExists('LoanApplication', 'bankWorkflowStatus', 'VARCHAR(50)');
    await addColumnIfNotExists('LoanApplication', 'bankWorkflowStage', 'VARCHAR(50)');
    await addColumnIfNotExists('LoanApplication', 'submittedToBankAt', 'TIMESTAMP(3)');
    await addColumnIfNotExists('LoanApplication', 'fileLoggedAt', 'TIMESTAMP(3)');
    await addColumnIfNotExists('LoanApplication', 'sanctionDate', 'TIMESTAMP(3)');
    console.log('✓ All LoanApplication columns verified.\n');

    // 6. Create indexes for performance
    console.log('Ensuring indexes exist...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_banksubmission_application" ON "BankSubmission"("applicationId");
      CREATE INDEX IF NOT EXISTS "idx_banksubmission_bank" ON "BankSubmission"("bankId");
      CREATE INDEX IF NOT EXISTS "idx_banksubmission_status" ON "BankSubmission"("workflowStatus");
      CREATE INDEX IF NOT EXISTS "idx_banksubmission_lan" ON "BankSubmission"("lanNumber");
      CREATE INDEX IF NOT EXISTS "idx_loanapplication_lan" ON "LoanApplication"("lanNumber");
      CREATE INDEX IF NOT EXISTS "idx_loanapplication_lan_entered" ON "LoanApplication"("lanEnteredAt");
    `);
    console.log('✓ Indexes verified.\n');

    // 7. Grant permissions
    console.log('Granting table permissions...');
    await client.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON "BankSubmission" TO anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON "BankWorkflowHistory" TO anon, authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON "BankWorkflowQueryRequest" TO anon, authenticated, service_role;
    `);
    console.log('✓ Permissions granted.\n');

    // 8. Reload PostgREST schema cache
    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('✓ PostgREST schema cache reloaded successfully.\n');

    console.log('ALL MISSING MIGRATIONS HAVE BEEN SUCCESSFULLY APPLIED!');
    await client.end();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
