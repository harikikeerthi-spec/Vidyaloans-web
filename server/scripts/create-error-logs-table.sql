-- ============================================================
-- ErrorLog Table Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS "ErrorLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "fingerprint" VARCHAR(64) NOT NULL,
    "level" VARCHAR(20) NOT NULL DEFAULT 'ERROR',
    "name" VARCHAR(255) NOT NULL DEFAULT 'Error',
    "message" TEXT NOT NULL,
    "statusCode" INTEGER DEFAULT 500,
    "endpoint" VARCHAR(1000),
    "method" VARCHAR(20),
    "stack" TEXT,
    "source" VARCHAR(50) NOT NULL DEFAULT 'backend',
    "context" VARCHAR(255),
    "metadata" JSONB,
    "userId" VARCHAR(255),
    "userEmail" VARCHAR(255),
    "userRole" VARCHAR(50),
    "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
    "resolvedAt" TIMESTAMPTZ,
    "resolvedBy" VARCHAR(255),
    "resolutionNote" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_error_log_is_resolved_last_seen" ON "ErrorLog" ("isResolved", "lastSeenAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_error_log_fingerprint" ON "ErrorLog" ("fingerprint");
CREATE INDEX IF NOT EXISTS "idx_error_log_level" ON "ErrorLog" ("level");
CREATE INDEX IF NOT EXISTS "idx_error_log_status_code" ON "ErrorLog" ("statusCode");
CREATE INDEX IF NOT EXISTS "idx_error_log_source" ON "ErrorLog" ("source");
CREATE INDEX IF NOT EXISTS "idx_error_log_created_at" ON "ErrorLog" ("createdAt" DESC);
