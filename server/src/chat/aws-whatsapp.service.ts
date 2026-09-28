import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SocialMessagingClient,
  SendWhatsAppMessageCommand,
} from '@aws-sdk/client-socialmessaging';

export interface WhatsAppSendResult {
  messageId: string;
  status: 'sent' | 'mocked' | 'failed';
  channel: 'aws_whatsapp' | 'meta_cloud_api' | 'mock';
  error?: string;
}

@Injectable()
export class AwsWhatsAppService {
  private readonly logger = new Logger(AwsWhatsAppService.name);
  private socialClient: SocialMessagingClient | null = null;
  private readonly phoneId: string;
  private readonly region: string;
  private readonly metaToken: string;
  private readonly metaPhoneId: string;

  constructor(private readonly configService: ConfigService) {
    this.region =
      this.configService.get<string>('AWS_WHATSAPP_REGION') ||
      this.configService.get<string>('AWS_REGION') ||
      'ap-south-1';

    const accessKeyId =
      this.configService.get<string>('AWS_WHATSAPP_ACCESS_KEY_ID') ||
      this.configService.get<string>('AWS_ACCESS_KEY_ID');

    const secretAccessKey =
      this.configService.get<string>('AWS_WHATSAPP_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    this.phoneId =
      this.configService.get<string>('AWS_WHATSAPP_PHONE_NUMBER_ID') ||
      this.configService.get<string>('AWS_WHATSAPP_PHONE_NUMBER_ARN') ||
      '';

    // Direct Meta WhatsApp Cloud API credentials (if provided or linked to AWS)
    this.metaToken = this.configService.get<string>('WHATSAPP_TOKEN') || '';
    this.metaPhoneId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';

    if (accessKeyId && secretAccessKey && !accessKeyId.startsWith('your_')) {
      try {
        this.socialClient = new SocialMessagingClient({
          region: this.region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.logger.log(`AWS Social Messaging (WhatsApp) client initialized for region ${this.region}`);
      } catch (err: any) {
        this.logger.warn(`Failed to initialize AWS Social Messaging client: ${err?.message}. Falling back to mock/direct mode.`);
      }
    } else {
      this.logger.warn('AWS WhatsApp credentials not found in .env — mock mode active.');
    }
  }

  /**
   * Format any incoming phone number to standard international format without '+' or 'whatsapp:' prefix
   * Example: "+91 9876543210" or "whatsapp:+919876543210" -> "919876543210"
   */
  normalizePhoneNumber(to: string): string {
    let clean = to.replace('whatsapp:', '').trim().replace(/\D/g, '');
    if (clean.length === 10) {
      clean = `91${clean}`;
    }
    return clean;
  }

  /**
   * Send a standard text message over WhatsApp
   */
  async sendWhatsAppMessage(to: string, text: string): Promise<WhatsAppSendResult> {
    const formattedRecipient = this.normalizePhoneNumber(to);

    // 1. Try AWS End User Messaging Social (SocialMessagingClient)
    if (this.socialClient && this.phoneId) {
      try {
        const payload = {
          messaging_product: 'whatsapp',
          to: formattedRecipient,
          type: 'text',
          text: {
            preview_url: true,
            body: text,
          },
        };

        const command = new SendWhatsAppMessageCommand({
          originationPhoneNumberId: this.phoneId,
          metaApiVersion: 'v20.0',
          message: Buffer.from(JSON.stringify(payload), 'utf-8'),
        });

        const response = await this.socialClient.send(command);
        const messageId = response.messageId || `aws_msg_${Date.now()}`;
        this.logger.log(`[AWS WhatsApp] Message sent to ${formattedRecipient}. MessageId: ${messageId}`);

        return {
          messageId,
          status: 'sent',
          channel: 'aws_whatsapp',
        };
      } catch (err: any) {
        this.logger.error(`[AWS WhatsApp] Send error to ${formattedRecipient}: ${err?.message}`);
        // If direct Meta Cloud API token is available, attempt fallback
        if (!this.metaToken) {
          throw err;
        }
      }
    }

    // 2. Direct Meta WhatsApp Cloud API fallback
    if (this.metaToken && this.metaPhoneId) {
      try {
        const response = await fetch(`https://graph.facebook.com/v20.0/${this.metaPhoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.metaToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedRecipient,
            type: 'text',
            text: { preview_url: true, body: text },
          }),
        });

        const data: any = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message || 'Meta Cloud API call failed');
        }

        const messageId = data?.messages?.[0]?.id || `meta_msg_${Date.now()}`;
        this.logger.log(`[Meta Cloud API] Message sent to ${formattedRecipient}. ID: ${messageId}`);
        return {
          messageId,
          status: 'sent',
          channel: 'meta_cloud_api',
        };
      } catch (err: any) {
        this.logger.error(`[Meta WhatsApp] Send error: ${err?.message}`);
        throw err;
      }
    }

    // 3. Mock mode for local development & testing
    this.logger.log(`[MOCK AWS WHATSAPP] Message to ${formattedRecipient}: "${text}"`);
    return {
      messageId: `mock_aws_wa_${Date.now()}`,
      status: 'mocked',
      channel: 'mock',
    };
  }

  /**
   * Send pre-approved Meta WhatsApp Template message (outside 24h window)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components: any[] = [],
  ): Promise<WhatsAppSendResult> {
    const formattedRecipient = this.normalizePhoneNumber(to);

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedRecipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    if (this.socialClient && this.phoneId) {
      try {
        const command = new SendWhatsAppMessageCommand({
          originationPhoneNumberId: this.phoneId,
          metaApiVersion: 'v20.0',
          message: Buffer.from(JSON.stringify(payload), 'utf-8'),
        });

        const response = await this.socialClient.send(command);
        const messageId = response.messageId || `aws_tmpl_${Date.now()}`;
        this.logger.log(`[AWS WhatsApp Template] Sent "${templateName}" to ${formattedRecipient}. MessageId: ${messageId}`);
        return { messageId, status: 'sent', channel: 'aws_whatsapp' };
      } catch (err: any) {
        this.logger.error(`[AWS WhatsApp Template Error]: ${err?.message}`);
        throw err;
      }
    }

    // Mock
    this.logger.log(`[MOCK AWS WHATSAPP TEMPLATE] Template "${templateName}" to ${formattedRecipient}`);
    return {
      messageId: `mock_aws_tmpl_${Date.now()}`,
      status: 'mocked',
      channel: 'mock',
    };
  }

  /**
   * Send media message (image, document, PDF)
   */
  async sendMediaMessage(
    to: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    mediaUrl: string,
    caption?: string,
    filename?: string,
  ): Promise<WhatsAppSendResult> {
    const formattedRecipient = this.normalizePhoneNumber(to);

    const payload: any = {
      messaging_product: 'whatsapp',
      to: formattedRecipient,
      type: mediaType,
      [mediaType]: {
        link: mediaUrl,
        ...(caption ? { caption } : {}),
        ...(filename ? { filename } : {}),
      },
    };

    if (this.socialClient && this.phoneId) {
      try {
        const command = new SendWhatsAppMessageCommand({
          originationPhoneNumberId: this.phoneId,
          metaApiVersion: 'v20.0',
          message: Buffer.from(JSON.stringify(payload), 'utf-8'),
        });

        const response = await this.socialClient.send(command);
        const messageId = response.messageId || `aws_media_${Date.now()}`;
        this.logger.log(`[AWS WhatsApp Media] Sent ${mediaType} to ${formattedRecipient}. MessageId: ${messageId}`);
        return { messageId, status: 'sent', channel: 'aws_whatsapp' };
      } catch (err: any) {
        this.logger.error(`[AWS WhatsApp Media Error]: ${err?.message}`);
        throw err;
      }
    }

    // Mock
    this.logger.log(`[MOCK AWS WHATSAPP MEDIA] ${mediaType} (${mediaUrl}) to ${formattedRecipient}`);
    return {
      messageId: `mock_aws_media_${Date.now()}`,
      status: 'mocked',
      channel: 'mock',
    };
  }
}
