import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendEmailDto } from './dto/send-email.dto';
import { UpdateEmailStateDto, BatchUpdateEmailStateDto } from './dto/update-email-state.dto';
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
  async getFolders(@Req() req?: any) {
    const folders = await this.mailService.listFolders(req?.user);
    return { success: true, data: folders };
  }

  // ─── List Emails in Folder ───────────────────────────────────────────────────
  @Get(['mail/inbox', 'support/mail', 'support-inbox'])
  @ApiOperation({ summary: 'List incoming emails from S3 folder with user state merged' })
  async getInbox(
    @Query('folder') folder?: string,
    @Query('staffEmail') staffEmail?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;
    const emails = await this.mailService.listSupport(folder, staffEmail, userId, req?.user);
    return { success: true, data: emails, total: emails.length };
  }

  // ─── Get Email Detail ────────────────────────────────────────────────────────
  @Get(['mail/inbox/:id', 'mail/:id', 'support/mail/:id'])
  @ApiOperation({ summary: 'Get full parsed email detail by base64url encoded S3 key' })
  async getMailDetail(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id;
    const mail = await this.mailService.getMailById(id, userId, req?.user);
    return { success: true, data: mail };
  }

  // ─── Update Single Email State (Read, Star, Spam, Trash) ─────────────────────
  @Patch(['mail/state/:id', 'support/mail/state/:id'])
  @ApiOperation({ summary: 'Update state (read, star, spam, trash) for an email' })
  async updateEmailState(
    @Param('id') id: string,
    @Body() dto: UpdateEmailStateDto,
    @Req() req: any,
  ) {
    const result = await this.mailService.updateEmailState(req.user.id, id, dto);
    return { success: true, data: result };
  }

  // ─── Batch Update Email States ──────────────────────────────────────────────
  @Post(['mail/state/batch', 'support/mail/state/batch'])
  @ApiOperation({ summary: 'Batch update state for multiple emails' })
  async batchUpdateEmailState(
    @Body() dto: BatchUpdateEmailStateDto,
    @Req() req: any,
  ) {
    const result = await this.mailService.batchUpdateEmailState(req.user.id, dto.emailIds, dto);
    return { success: true, ...result };
  }

  // ─── Get User Email States ──────────────────────────────────────────────────
  @Get(['mail/states', 'support/mail/states'])
  @ApiOperation({ summary: 'Get all email state overrides for the current user' })
  async getUserStates(@Req() req: any) {
    const states = await this.mailService.getUserEmailStates(req.user.id);
    return { success: true, data: states };
  }

  // ─── Send Outgoing Email / Reply ────────────────────────────────────────────
  @Post(['mail/send', 'support/send', 'send'])
  @ApiOperation({ summary: 'Send email or reply via Amazon SES SMTP' })
  async sendMail(@Body() dto: SendEmailDto, @Req() req: any) {
    const result = await this.mailService.sendEmail(dto, req.user);
    return { success: true, ...result };
  }
}
