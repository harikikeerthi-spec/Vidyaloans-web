import { Injectable, Logger } from '@nestjs/common';
import { AwsWhatsAppService } from './aws-whatsapp.service';
import { AwsSnsService } from './aws-sns.service';

export interface StudentNotificationPayload {
  /** Student's full name (used in message greeting) */
  name: string;
  /** Indian mobile number — digits only, no country code, e.g. "9876543210" */
  mobile: string;
  /** Whether the student has opted in to receive WhatsApp messages */
  whatsapp_consent: boolean;
}

export interface NotificationResult {
  channel: 'whatsapp' | 'sms' | 'mock';
  sid: string;
  status: string;
}

@Injectable()
export class StudentNotificationService {
  private readonly logger = new Logger(StudentNotificationService.name);

  constructor(
    private readonly awsWhatsApp: AwsWhatsAppService,
    private readonly awsSns: AwsSnsService,
  ) {}

  /**
   * Send a nudge notification to a student via AWS WhatsApp & AWS SNS SMS fallback.
   *
   * Privacy rule: the body never contains sensitive loan data.
   * The student is directed to log in to the portal to read the actual message.
   *
   * Flow:
   *   whatsapp_consent = true  → try AWS WhatsApp → on failure fall back to AWS SNS SMS
   *   whatsapp_consent = false → AWS SNS SMS directly
   */
  async sendStudentNotification(
    student: StudentNotificationPayload,
  ): Promise<NotificationResult> {
    const { name, mobile, whatsapp_consent } = student;

    // Sanitised body — never expose loan details in the SMS/WA text
    const safeBody =
      `Hi ${name}, you have a new update from VidyaLoans staff. ` +
      `Login to your portal to view and reply: https://www.vidyaloans.in/login`;

    if (whatsapp_consent) {
      try {
        const res = await this.awsWhatsApp.sendWhatsAppMessage(mobile, safeBody);
        return {
          channel: 'whatsapp',
          sid: res.messageId,
          status: res.status,
        };
      } catch (err: any) {
        this.logger.warn(
          `AWS WhatsApp failed for ${mobile}: ${err?.message}. Falling back to AWS SNS SMS.`,
        );
        return await this.sendSMS(mobile, safeBody);
      }
    }

    return await this.sendSMS(mobile, safeBody);
  }

  private async sendSMS(
    mobile: string,
    body: string,
  ): Promise<NotificationResult> {
    try {
      const res = await this.awsSns.sendSMS(mobile, body);
      return {
        channel: 'sms',
        sid: res.messageId,
        status: res.status,
      };
    } catch (err: any) {
      this.logger.error(`AWS SNS SMS send failed for ${mobile}: ${err?.message}`);
      return {
        channel: 'mock',
        sid: `err_sms_${Date.now()}`,
        status: 'failed',
      };
    }
  }
}
