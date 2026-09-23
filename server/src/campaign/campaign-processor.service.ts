import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';

@Injectable()
export class CampaignProcessorService {
  private readonly logger = new Logger(CampaignProcessorService.name);
  private isProcessing = false;

  // Rate Limiting: 60 emails per minute = 1 email every 1000ms
  private readonly THROTTLE_DELAY_MS = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Background queue worker cron:
   * Checks every 30 seconds for any pending queued emails across all campaigns.
   */
  @Cron('*/30 * * * * *')
  async handleCron() {
    await this.processQueuedEmails().catch(err => {
      this.logger.error('Error during campaign queue batch processing:', err);
    });
  }

  /**
   * Main Queue Processor with Rate Limiting (60 emails/minute)
   */
  async processQueuedEmails() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      // 1. Fetch active campaigns in 'queued' or 'sending' status that have reached their scheduled time
      const activeCampaigns = await this.prisma.campaign.findMany({
        where: {
          status: { in: ['queued', 'sending'] },
          scheduledAt: { lte: new Date() },
        },
      });

      if (activeCampaigns.length === 0) {
        this.isProcessing = false;
        return;
      }

      const campaignIds = activeCampaigns.map(c => c.id);

      // 2. Fetch the next batch of queued recipients in FIFO order
      const pendingRecipients = await this.prisma.campaignRecipient.findMany({
        where: {
          campaignId: { in: campaignIds },
          status: 'queued',
        },
        orderBy: { createdAt: 'asc' },
        take: 60, // process up to 60 per minute cycle
        include: {
          campaign: true,
        },
      });

      if (pendingRecipients.length === 0) {
        await this.checkAndFinalizeCampaigns(campaignIds);
        this.isProcessing = false;
        return;
      }

      this.logger.log(`[EmailQueue] Processing ${pendingRecipients.length} queued emails at rate of 60 emails/min (1 email/sec)...`);

      // 3. Process each queued email with exact 1-second delay (60 emails/min)
      for (const recipient of pendingRecipients) {
        const campaign = recipient.campaign;
        if (!campaign || campaign.status === 'cancelled') {
          continue;
        }

        // Transition campaign status to 'sending' if still 'queued'
        if (campaign.status === 'queued') {
          await this.prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'sending', updatedAt: new Date() },
          }).catch(() => {});
          campaign.status = 'sending';
        }

        // Transition recipient to 'generating'
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'generating' },
        }).catch(() => {});

        const startTime = Date.now();

        try {
          // Fetch student variables or profile
          const vars: any = (recipient.variables as any) || {};
          let studentName = recipient.recipientName || vars.studentName || 'Student';
          let university = vars.university || 'your university';
          let country = vars.country || 'your destination';
          let loanAmount = vars.loanAmount || 'eligible loan amount';
          let dashboardUrl = vars.dashboardUrl || 'https://vidyaloan.com/dashboard';

          // Compile Subject & HTML Body
          let compiledSubject = (campaign.subject || 'Education Loan Update')
            .replace(/{{studentName}}/g, studentName)
            .replace(/{{firstName}}/g, studentName.split(' ')[0])
            .replace(/{{university}}/g, university)
            .replace(/{{targetUniversity}}/g, university)
            .replace(/{{country}}/g, country)
            .replace(/{{loanAmount}}/g, loanAmount);

          let compiledBody = (campaign.body || '')
            .replace(/{{studentName}}/g, studentName)
            .replace(/{{firstName}}/g, studentName.split(' ')[0])
            .replace(/{{university}}/g, university)
            .replace(/{{targetUniversity}}/g, university)
            .replace(/{{country}}/g, country)
            .replace(/{{loanAmount}}/g, loanAmount)
            .replace(/{{dashboardUrl}}/g, dashboardUrl);

          // Inject open pixel and click tracking
          const trackedBody = this.injectTracking(compiledBody, recipient.id);

          this.logger.log(`[EmailQueue Dispatch] Sending email to ${recipient.recipientEmail} (${studentName}) for campaign: "${campaign.name}"`);

          // Dispatch via EmailService SMTP
          await this.emailService.sendMail(
            recipient.recipientEmail,
            compiledSubject,
            trackedBody,
            `Dear ${studentName},\n\nPlease view this email in an HTML-compatible email client.`,
          );

          // Update recipient status to 'sent'
          await this.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'sent',
              sentAt: new Date(),
            },
          });

          // Create EmailLog record
          await this.prisma.emailLog.create({
            data: {
              campaignId: campaign.id,
              recipientEmail: recipient.recipientEmail,
              subject: compiledSubject,
              status: 'sent',
              sentAt: new Date(),
            },
          }).catch(() => {});

          // Increment sent counter on campaign
          await this.prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              sentCount: { increment: 1 },
              updatedAt: new Date(),
            },
          }).catch(() => {});

        } catch (sendError: any) {
          this.logger.error(`[EmailQueue Error] Failed to send email to ${recipient.recipientEmail}: ${sendError.message}`);

          // Update recipient status to 'failed'
          await this.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'failed',
              errorMessage: sendError.message || 'SMTP delivery failure',
              sentAt: new Date(),
            },
          }).catch(() => {});

          // Create EmailLog record
          await this.prisma.emailLog.create({
            data: {
              campaignId: campaign.id,
              recipientEmail: recipient.recipientEmail,
              subject: campaign.subject,
              status: 'failed',
              errorMessage: sendError.message,
              sentAt: new Date(),
            },
          }).catch(() => {});

          // Increment failed counter on campaign
          await this.prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              failedCount: { increment: 1 },
              updatedAt: new Date(),
            },
          }).catch(() => {});
        }

        // Enforce exact rate-limit delay: 60 emails per minute = 1000ms delay per email
        const elapsed = Date.now() - startTime;
        const sleepTime = Math.max(0, this.THROTTLE_DELAY_MS - elapsed);
        if (sleepTime > 0) {
          await new Promise(resolve => setTimeout(resolve, sleepTime));
        }
      }

      // 4. Check if campaigns have finished all recipients
      await this.checkAndFinalizeCampaigns(campaignIds);

    } catch (error: any) {
      if (
        error?.message?.includes('connection timeout') ||
        error?.message?.includes('Connection terminated') ||
        error?.message?.includes("Can't reach database") ||
        error?.message?.includes('database server')
      ) {
        this.logger.warn('[EmailQueue] Database connection warming up / temporarily unreachable. Will retry on next tick.');
      } else {
        this.logger.error('[EmailQueue] Error processing queued emails:', error?.message || error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async checkAndFinalizeCampaigns(campaignIds: string[]) {
    for (const campaignId of campaignIds) {
      const remainingQueued = await this.prisma.campaignRecipient.count({
        where: {
          campaignId,
          status: { in: ['queued', 'generating'] },
        },
      });

      if (remainingQueued === 0) {
        this.logger.log(`[EmailQueue] Campaign ${campaignId} has finished all queued emails. Marking as 'completed'.`);
        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: 'completed',
            updatedAt: new Date(),
          },
        }).catch(() => {});
      }
    }
  }

  private injectTracking(html: string, recipientId: string): string {
    if (!html) return '';

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000/api';

    // 1. Inject open tracking pixel
    const trackingPixel = `<img src="${backendUrl}/campaigns/track/open/${recipientId}" width="1" height="1" style="display:none;" />`;

    let processedHtml = html;
    if (processedHtml.includes('</body>')) {
      processedHtml = processedHtml.replace('</body>', `${trackingPixel}</body>`);
    } else if (processedHtml.includes('</html>')) {
      processedHtml = processedHtml.replace('</html>', `${trackingPixel}</html>`);
    } else {
      processedHtml = processedHtml + trackingPixel;
    }

    // 2. Wrap links inside <a> tags
    const anchorRegex = /<a\s+([^>]*?)href=(["'])(https?:\/\/[^"'\s>]+)(["'])([^>]*?)>/gi;
    processedHtml = processedHtml.replace(anchorRegex, (match, before, quote1, url, quote2, after) => {
      const trackingUrl = `${backendUrl}/campaigns/track/click/${recipientId}?redirect=${encodeURIComponent(url)}`;
      return `<a ${before}href=${quote1}${trackingUrl}${quote2}${after}>`;
    });

    return processedHtml;
  }
}
