export class MailAttachmentDto {
  filename: string;
  content: string; // base64 encoded string
  contentType?: string;
}

export class SendEmailDto {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: MailAttachmentDto[];
}
