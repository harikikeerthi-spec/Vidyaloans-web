-- ============================================================
-- Create Notification table for VidyaLoans notification system
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS public."Notification" (
  id          TEXT          PRIMARY KEY,
  "userId"    TEXT          NOT NULL,
  title       TEXT          NOT NULL,
  body        TEXT          NOT NULL,
  type        TEXT          NOT NULL,
  "isRead"    BOOLEAN       NOT NULL DEFAULT FALSE,
  timestamp   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  metadata    JSONB         DEFAULT NULL
);

-- Index for fast per-user lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_notification_userId
  ON public."Notification" ("userId");

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_notification_type
  ON public."Notification" (type);

-- Index for ordering by timestamp
CREATE INDEX IF NOT EXISTS idx_notification_timestamp
  ON public."Notification" (timestamp DESC);

-- Index for read/unread filtering
CREATE INDEX IF NOT EXISTS idx_notification_isRead
  ON public."Notification" ("isRead");

-- ============================================================
-- Enable Row Level Security (RLS) — required for Supabase
-- The service_role key bypasses RLS so the server can write freely.
-- ============================================================
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;

-- Allow service_role (server) full access
CREATE POLICY "service_role_all" ON public."Notification"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Verify the table was created successfully
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Notification'
ORDER BY ordinal_position;
