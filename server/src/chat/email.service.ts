import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private getFromAddress(): string {
    const emailFrom = (this.configService.get<string>('EMAIL_FROM') || process.env.EMAIL_FROM || '').trim();
    const emailUser = (this.configService.get<string>('EMAIL_USER') || process.env.EMAIL_USER || '').trim();

    if (emailFrom && emailFrom.includes('@')) {
      if (emailFrom.includes('<')) return emailFrom;
      return `"VidyaLoans" <${emailFrom}>`;
    }

    if (emailUser) {
      return `"VidyaLoans" <${emailUser}>`;
    }

    return '"VidyaLoans" <support@vidyaloans.in>';
  }

  private getFrontendUrl(): string {
    const url = (this.configService.get<string>('FRONTEND_URL') || process.env.FRONTEND_URL || '').trim();
    if (url && url !== 'http://localhost:3000' && url !== 'http://localhost:5000') {
      return url;
    }
    return 'https://www.vidyaloans.in';
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('EMAIL_HOST') || process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(this.configService.get<number>('EMAIL_PORT') || process.env.EMAIL_PORT || process.env.SMTP_PORT) || 587;
    const user = this.configService.get<string>('EMAIL_USER') || process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass = this.configService.get<string>('EMAIL_PASS') || process.env.EMAIL_PASS || process.env.SMTP_PASS;
    const from = this.getFromAddress();

    this.transporter = nodemailer.createTransport(
      {
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      },
      {
        from,
      },
    );
  }

  async sendChatNotificationEmail(
    to: string,
    senderName: string,
    senderRole: string,
    message: string,
    conversationContext: {
      applicationNumber?: string;
      customerName?: string;
      bank?: string;
      subject: string;
    }
  ): Promise<boolean> {
    try {
      const frontendUrl = this.getFrontendUrl();
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6605c7 0%, #5504a6 100%); padding: 40px; border-radius: 16px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">VidyaLoans</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">New Message in Your Application</p>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
              <strong>${senderName}</strong> (${senderRole}) has sent you a message regarding your loan application.
            </p>

            ${conversationContext.applicationNumber ? `
              <div style="background: white; padding: 15px; border-left: 4px solid #6605c7; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Application Details</p>
                <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; color: #333;">
                  ${conversationContext.applicationNumber}
                  ${conversationContext.bank ? ` • ${conversationContext.bank}` : ''}
                </p>
              </div>
            ` : ''}

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
                ${this.escapeHtml(message)}
              </p>
            </div>

            <div style="background: #f0f4ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #6605c7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">Subject</p>
              <p style="margin: 8px 0 0 0; color: #333; font-size: 14px;">
                ${this.escapeHtml(conversationContext.subject)}
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${frontendUrl}/dashboard#applications" 
               style="display: inline-block; background: linear-gradient(135deg, #6605c7 0%, #5504a6 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
              View Application
            </a>
          </div>

          <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              You received this email because you have an active loan application with VidyaLoans.
            </p>
            <p style="margin: 0;">
              © ${new Date().getFullYear()} VidyaLoans. All rights reserved.
            </p>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: `New Message: ${conversationContext.subject}`,
        html: htmlContent,
        text: `${senderName} (${senderRole}) sent: ${message}`,
      });

      this.logger.log(`Email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendDocumentNotificationEmail(
    to: string,
    documentDetails: {
      documentName: string;
      uploadedBy: string;
      uploadedByRole: string;
      applicationNumber: string;
      bank?: string;
      status: string;
    }
  ): Promise<boolean> {
    try {
      const frontendUrl = this.getFrontendUrl();
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #6605c7 0%, #5504a6 100%); padding: 40px; border-radius: 16px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">VidyaLoans</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Document Shared with You</p>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
              A document has been shared with you by <strong>${documentDetails.uploadedBy}</strong> (${documentDetails.uploadedByRole}).
            </p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #6605c7; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Document Details</p>
              <p style="margin: 12px 0 8px 0; font-size: 18px; font-weight: bold; color: #333;">
                📄 ${this.escapeHtml(documentDetails.documentName)}
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #6605c7; font-weight: bold;">
                Status: ${documentDetails.status}
              </p>
            </div>

            <div style="background: #f0f4ff; padding: 15px; border-radius: 8px;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #6605c7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">Application</p>
              <p style="margin: 0; font-size: 14px; color: #333;">
                ${documentDetails.applicationNumber}
                ${documentDetails.bank ? ` • ${documentDetails.bank}` : ''}
              </p>
            </div>
          </div>

          <div style="text-align: center;">
            <a href="${frontendUrl}/document-vault" 
               style="display: inline-block; background: linear-gradient(135deg, #6605c7 0%, #5504a6 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
              View Document
            </a>
          </div>

          <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} VidyaLoans. All rights reserved.</p>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: `Document Shared: ${documentDetails.documentName}`,
        html: htmlContent,
        text: `Document ${documentDetails.documentName} has been shared with you for application ${documentDetails.applicationNumber}`,
      });

      this.logger.log(`Document notification email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send document email to ${to}:`, error);
      return false;
    }
  }

  async sendAiToolResultEmail(
    to: string,
    userName: string,
    toolName: string,
    resultHtml: string,
    textSummary?: string
  ): Promise<boolean> {
    try {
      const frontendUrl = this.getFrontendUrl();
      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #6605c7 0%, #5504a6 100%); padding: 40px; border-radius: 16px; color: white; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">VidyaLoans AI</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Your AI Tool Results are Ready</p>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #eef2f6;">
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #1e293b;">
              Hello ${userName || 'there'},
            </p>
            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
              Thank you for using the <strong>${toolName}</strong> tool on VidyaLoans! We hope our AI insights help you make informed decisions about your study abroad and financing journey.
            </p>

            <div style="background: white; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02); margin-top: 10px;">
              <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 16px; font-weight: 800; color: #6605c7; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
                ${toolName} Results
              </h3>
              ${resultHtml}
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${frontendUrl}/dashboard" 
               style="display: inline-block; background: linear-gradient(135deg, #6605c7 0%, #5504a6 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 6px rgba(102, 5, 199, 0.2);">
              Go to Dashboard
            </a>
          </div>

          <div style="border-top: 1px solid #e0e0e0; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              You received this email because you used an AI tool on VidyaLoans.
            </p>
            <p style="margin: 0;">
              © ${new Date().getFullYear()} VidyaLoans. All rights reserved.
            </p>
          </div>
        </div>
      `;

      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: `Your VidyaLoans AI Results: ${toolName}`,
        html: htmlContent,
        text: textSummary || `Thank you for using ${toolName} on VidyaLoans. Find your results attached.`,
      });

      this.logger.log(`AI Tool results email sent to ${to} for tool: ${toolName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send AI tool email to ${to} for tool: ${toolName}:`, error);
      return false;
    }
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
