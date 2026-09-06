-- ============================================================
-- Chat System Schema Migration (Conversation & Message)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Conversation table
CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerPhone" TEXT,
  "customerEmail" TEXT,
  "customerName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB DEFAULT '{}'::JSONB,
  "applicationId" TEXT,
  "isMultiParty" BOOLEAN DEFAULT false,
  "conversationTopic" VARCHAR DEFAULT 'general',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_phone ON "Conversation"("customerPhone");
CREATE INDEX IF NOT EXISTS idx_conversation_email ON "Conversation"("customerEmail");
CREATE INDEX IF NOT EXISTS idx_conversation_status ON "Conversation"("status");
CREATE INDEX IF NOT EXISTS idx_conversation_updated_at ON "Conversation"("updatedAt" DESC);

-- 2. Message table
CREATE TABLE IF NOT EXISTS "Message" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "senderType" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderName" TEXT,
  "receiverType" TEXT,
  "content" TEXT NOT NULL DEFAULT '',
  "messageType" TEXT NOT NULL DEFAULT 'text',
  "status" TEXT NOT NULL DEFAULT 'sent',
  "attachmentUrl" TEXT,
  "attachmentType" TEXT,
  "recipientEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "readBy" JSONB DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_conversation ON "Message"("conversationId");
CREATE INDEX IF NOT EXISTS idx_message_created_at ON "Message"("createdAt" ASC);
CREATE INDEX IF NOT EXISTS idx_message_sender ON "Message"("senderId");

-- 3. Conversation_Participant table
CREATE TABLE IF NOT EXISTS "Conversation_Participant" (
  "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "conversationId" UUID NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "email" VARCHAR NOT NULL,
  "role" VARCHAR NOT NULL,
  "fullName" VARCHAR,
  "joinedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "canShare" BOOLEAN DEFAULT true,
  "isActive" BOOLEAN DEFAULT true,
  UNIQUE("conversationId", "email", "role")
);

CREATE INDEX IF NOT EXISTS idx_conv_participant_conversation ON "Conversation_Participant"("conversationId");
CREATE INDEX IF NOT EXISTS idx_conv_participant_email ON "Conversation_Participant"("email");
CREATE INDEX IF NOT EXISTS idx_conv_participant_role ON "Conversation_Participant"("role");

-- 4. Document_Share table
CREATE TABLE IF NOT EXISTS "Document_Share" (
  "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "conversationId" UUID NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "applicationId" TEXT,
  "documentId" UUID NOT NULL,
  "documentName" VARCHAR NOT NULL,
  "documentType" VARCHAR NOT NULL,
  "uploadedBy" VARCHAR NOT NULL,
  "uploaderRole" VARCHAR NOT NULL,
  "sharedWith" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sharedWithRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" VARCHAR DEFAULT 'active',
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_share_conversation ON "Document_Share"("conversationId");
CREATE INDEX IF NOT EXISTS idx_document_share_application ON "Document_Share"("applicationId");

-- 5. Message_Recipient table
CREATE TABLE IF NOT EXISTS "Message_Recipient" (
  "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "messageId" UUID NOT NULL REFERENCES "Message"("id") ON DELETE CASCADE,
  "recipientEmail" VARCHAR NOT NULL,
  "recipientRole" VARCHAR NOT NULL,
  "readAt" TIMESTAMPTZ,
  "status" VARCHAR DEFAULT 'delivered',
  "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_recipient_message ON "Message_Recipient"("messageId");
CREATE INDEX IF NOT EXISTS idx_message_recipient_email ON "Message_Recipient"("recipientEmail");

-- 6. Email_Log table
CREATE TABLE IF NOT EXISTS "Email_Log" (
  "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "recipientEmail" VARCHAR NOT NULL,
  "subject" VARCHAR NOT NULL,
  "messageId" UUID REFERENCES "Message"("id") ON DELETE SET NULL,
  "documentShareId" UUID REFERENCES "Document_Share"("id") ON DELETE SET NULL,
  "status" VARCHAR DEFAULT 'sent',
  "failureReason" TEXT,
  "sentAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON "Email_Log"("recipientEmail");
