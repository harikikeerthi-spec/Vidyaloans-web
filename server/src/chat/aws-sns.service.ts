import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export interface SnsPublishResult {
  messageId: string;
  status: 'sent' | 'mocked' | 'failed';
  error?: string;
}

@Injectable()
export class AwsSnsService {
  private readonly logger = new Logger(AwsSnsService.name);
  private snsClient: SNSClient | null = null;
  private readonly senderId: string;
  private readonly defaultTopicArn: string;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('AWS_SNS_REGION') ||
      this.configService.get<string>('AWS_REGION') ||
      'ap-south-1';

    const accessKeyId =
      this.configService.get<string>('AWS_SNS_ACCESS_KEY_ID') ||
      this.configService.get<string>('AWS_ACCESS_KEY_ID');

    const secretAccessKey =
      this.configService.get<string>('AWS_SNS_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    this.senderId = this.configService.get<string>('AWS_SNS_SENDER_ID') || 'VIDYALN';
    this.defaultTopicArn = this.configService.get<string>('AWS_SNS_TOPIC_ARN') || '';

    if (accessKeyId && secretAccessKey && !accessKeyId.startsWith('your_')) {
      try {
        this.snsClient = new SNSClient({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.logger.log(`AWS SNS Client initialized in region ${region} with SenderId ${this.senderId}`);
      } catch (err: any) {
        this.logger.warn(`Failed to initialize AWS SNS client: ${err?.message}. Mock mode active.`);
      }
    } else {
      this.logger.warn('AWS SNS credentials not set in .env — mock mode active.');
    }
  }

  /**
   * Format phone number to E.164 international format (+91...)
   */
  formatE164(phone: string): string {
    let clean = phone.trim().replace(/\D/g, '');
    if (clean.length === 10) {
      clean = `91${clean}`;
    }
    return `+${clean}`;
  }

  /**
   * Send a direct transactional SMS to an Indian or international mobile number
   */
  async sendSMS(phoneNumber: string, message: string): Promise<SnsPublishResult> {
    const formattedPhone = this.formatE164(phoneNumber);

    if (this.snsClient) {
      try {
        const command = new PublishCommand({
          PhoneNumber: formattedPhone,
          Message: message,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
            'AWS.MM.SMS.SenderId': {
              DataType: 'String',
              StringValue: this.senderId,
            },
          },
        });

        const response = await this.snsClient.send(command);
        const messageId = response.MessageId || `sns_sms_${Date.now()}`;
        this.logger.log(`[AWS SNS SMS] Sent to ${formattedPhone}. MessageId: ${messageId}`);

        return {
          messageId,
          status: 'sent',
        };
      } catch (err: any) {
        this.logger.error(`[AWS SNS SMS Error] Failed to send SMS to ${formattedPhone}: ${err?.message}`);
        throw err;
      }
    }

    // Mock
    this.logger.log(`[MOCK AWS SNS SMS] SMS to ${formattedPhone}: "${message}"`);
    return {
      messageId: `mock_sns_${Date.now()}`,
      status: 'mocked',
    };
  }

  /**
   * Publish an alert/event to an Amazon SNS Topic
   */
  async publishToTopic(message: string, subject?: string, topicArn?: string): Promise<SnsPublishResult> {
    const targetTopic = topicArn || this.defaultTopicArn;
    if (!targetTopic) {
      this.logger.warn('No SNS Topic ARN specified.');
      return { messageId: 'none', status: 'mocked' };
    }

    if (this.snsClient) {
      try {
        const command = new PublishCommand({
          TopicArn: targetTopic,
          Message: typeof message === 'object' ? JSON.stringify(message) : message,
          ...(subject ? { Subject: subject } : {}),
        });

        const response = await this.snsClient.send(command);
        const messageId = response.MessageId || `sns_topic_${Date.now()}`;
        this.logger.log(`[AWS SNS Topic] Published to ${targetTopic}. MessageId: ${messageId}`);
        return { messageId, status: 'sent' };
      } catch (err: any) {
        this.logger.error(`[AWS SNS Topic Error]: ${err?.message}`);
        throw err;
      }
    }

    this.logger.log(`[MOCK AWS SNS TOPIC] Published to ${targetTopic}: ${subject || 'Notification'}`);
    return { messageId: `mock_sns_topic_${Date.now()}`, status: 'mocked' };
  }
}
