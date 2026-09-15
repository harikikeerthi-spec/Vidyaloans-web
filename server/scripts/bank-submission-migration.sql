CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "BankSubmission" (
  "id" TEXT NOT NULL DEFAULT ('sub-' || extract(epoch from now())::bigint::text || '-' || floor(random()*1000)::int::text),
  "applicationId" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "bankName" VARCHAR(255) NOT NULL,
  "submittedBy" TEXT NOT NULL,
  "workflowStatus" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED_TO_BANK',
  "currentStage" VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED_TO_BANK',
  "statusHistory" JSONB DEFAULT '[]',
  "lanNumber" VARCHAR(100),
  "fileLoggedAt" TIMESTAMP(3),
  "fileLoggedBy" TEXT,
  "comments" TEXT,
  "queriesRaised" INTEGER NOT NULL DEFAULT 0,
  "lastQueryAt" TIMESTAMP(3),
  "queryResponsePending" BOOLEAN NOT NULL DEFAULT false,
  "decisionStatus" VARCHAR(50),
  "decisionMadeAt" TIMESTAMP(3),
  "decisionMadeBy" TEXT,
  "decisionNotes" TEXT,
  "sanctionAmount" DOUBLE PRECISION,
  "sanctionDate" TIMESTAMP(3),
  "roiType" VARCHAR(20),
  "roiBase" DOUBLE PRECISION,
  "roiEffective" DOUBLE PRECISION,
  "tenure" INTEGER,
  "conditions" JSONB,
  "conditionDeadline" TIMESTAMP(3),
  "counterOfferDetails" JSONB,
  "rejectionReason" TEXT,
  "rejectionCategory" VARCHAR(100),
  "canResubmitToOtherBank" BOOLEAN NOT NULL DEFAULT false,
  "partialSanctionAmount" DOUBLE PRECISION,
  "processingFeeAmount" DOUBLE PRECISION,
  "processingFeeStatus" VARCHAR(50),
  "processingFeePaidAt" TIMESTAMP(3),
  "disbursementStatus" VARCHAR(50),
  "disbursementAmount" DOUBLE PRECISION,
  "disbursementReferenceNo" VARCHAR(255),
  "disbursementDate" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "refundAmount" DOUBLE PRECISION,
  "refundedAt" TIMESTAMP(3),
  "priority" VARCHAR(50) DEFAULT 'NORMAL',
  "submittedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS idx_banksubmission_application ON "BankSubmission"("applicationId");
CREATE INDEX IF NOT EXISTS idx_banksubmission_bank ON "BankSubmission"("bankId");
CREATE INDEX IF NOT EXISTS idx_banksubmission_status ON "BankSubmission"("workflowStatus");
CREATE UNIQUE INDEX IF NOT EXISTS idx_banksubmission_app_bank ON "BankSubmission"("applicationId", "bankId");

GRANT SELECT, INSERT, UPDATE, DELETE ON "BankSubmission" TO anon, authenticated, service_role;

-- Ensure LoanApplication has required columns for bank workflow
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "bankSubmissionId" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "bankWorkflowStatus" VARCHAR(50);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "bankWorkflowStage" VARCHAR(50);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "submittedToBankAt" TIMESTAMP(3);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "targetBank" VARCHAR(255);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "assignedBank" VARCHAR(255);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "decisionStatus" VARCHAR(50);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "decisionNotes" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "decisionMadeAt" TIMESTAMP(3);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "decisionMadeBy" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "conditions" JSONB;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "counterOfferDetails" JSONB;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "disbursementStatus" VARCHAR(50);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "disbursementAmount" DOUBLE PRECISION;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "disbursementDate" TIMESTAMP(3);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "disbursementReferenceNo" VARCHAR(255);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "processingFeeStatus" VARCHAR(50);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "processingFeeAmount" DOUBLE PRECISION;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "processingFeePaidAt" TIMESTAMP(3);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "queriesRaised" INTEGER DEFAULT 0;
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "lastQueryAt" TIMESTAMP(3);
ALTER TABLE "LoanApplication" ADD COLUMN IF NOT EXISTS "queryResponsePending" BOOLEAN DEFAULT false;