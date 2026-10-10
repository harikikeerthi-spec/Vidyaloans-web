export class SaveDraftDto {
  id?: string;
  senderEmail?: string;
  senderName?: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  body?: string;
  replyTo?: string;
  attachments?: any[];
  priority?: 'high' | 'normal' | 'low';
  requestReadReceipt?: boolean;
}
