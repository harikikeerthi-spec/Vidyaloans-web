import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendEmailDto } from './dto/send-email.dto';
import { StaffGuard } from '../auth/staff.guard';

@ApiTags('Mail & Support Inbox')
@ApiBearerAuth()
@UseGuards(StaffGuard)
@Controller()
export class MailController {
  constructor(private readonly mailService: MailService) {}

  // ─── List Folders ───────────────────────────────────────────────────────────
  @Get(['mail/folders', 'support/mail/folders', 'support-inbox/folders'])
  @ApiOperation({ summary: 'List all available mail folders (support and staff folders in S3)' })
  async getFolders() {
    const folders = await this.mailService.listFolders();
    return { success: true, data: folders };
  }

  // ─── List Emails in Folder ───────────────────────────────────────────────────
  @Get(['mail/inbox', 'support/mail', 'support-inbox'])
  @ApiOperation({ summary: 'List incoming emails from S3 folder' })
  async getInbox(
    @Query('folder') folder?: string,
    @Query('staffEmail') staffEmail?: string,
  ) {
    const emails = await this.mailService.listSupport(folder, staffEmail);
    return { success: true, data: emails, total: emails.length };
  }

  // ─── Get Email Detail ────────────────────────────────────────────────────────
  @Get(['mail/inbox/:id', 'mail/:id', 'support/mail/:id'])
  @ApiOperation({ summary: 'Get full parsed email detail by base64url encoded S3 key' })
  async getMailDetail(@Param('id') id: string) {
    const mail = await this.mailService.getMailById(id);
    return { success: true, data: mail };
  }

  // ─── Send Outgoing Email / Reply ────────────────────────────────────────────
  @Post(['mail/send', 'support/send', 'send'])
  @ApiOperation({ summary: 'Send email or reply via Amazon SES SMTP' })
  async sendMail(@Body() dto: SendEmailDto, @Req() req: any) {
    const result = await this.mailService.sendEmail(dto, req.user);
    return { success: true, ...result };
  }
}
