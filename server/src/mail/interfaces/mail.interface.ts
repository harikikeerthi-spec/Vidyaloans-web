export interface MailAttachment {
  filename: string;
  contentType?: string;
  size: number;
  content?: string; // base64 string or data URL
}

export interface MailSummary {
  id: string; // base64url encoded S3 key
  key: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  size: number;
  read: boolean;
  starred?: boolean;
  trashed?: boolean;
  userSpamOverride?: boolean | null;
  folder?: string;
  snippet?: string;
  // Spam / Junk metadata
  isSpam?: boolean;
  spamScore?: number;
  spamVerdict?: 'PASS' | 'FAIL' | 'GRAY' | 'UNKNOWN';
  virusVerdict?: 'PASS' | 'FAIL' | 'UNKNOWN';
  spamReasons?: string[];
  authResults?: {
    spf?: string;
    dkim?: string;
    dmarc?: string;
  };
}

export interface MailDetail extends MailSummary {
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string;
  bcc?: string;
  attachments: MailAttachment[];
}

export interface MailFolder {
  name: string;
  prefix: string;
  count?: number;
  isStaff?: boolean;
  assignedStaffName?: string;
  assignedStaffEmail?: string;
  assignedMailboxEmail?: string;
}
