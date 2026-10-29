import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExecutiveWebmailService } from './executive-webmail.service';

@ApiTags('Executive Webmail')
@Controller('webmail')
export class ExecutiveWebmailController {
  constructor(private readonly webmailService: ExecutiveWebmailService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Executive Webmail Login for Higher Officials' })
  async login(@Body() body: { email: string; password: string }) {
    return this.webmailService.login(body.email, body.password);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current logged-in official profile' })
  async getProfile(@Headers('authorization') auth?: string) {
    const user = await this.webmailService.verifyToken(auth);
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: user.title,
        s3Prefix: user.s3Prefix,
      },
    };
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Get private emails for logged-in higher official' })
  async getInbox(
    @Headers('authorization') auth?: string,
    @Query('folder') folder?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.getInbox(user, folder || 'inbox');
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get live mail counts and statistics for official' })
  async getStats(@Headers('authorization') auth?: string) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.getMailStats(user);
  }

  @Get('message/:id')
  @ApiOperation({ summary: 'Read full email message content and attachments' })
  async getMessage(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    const detail = await this.webmailService.getEmailDetail(user, id);
    return {
      success: true,
      data: detail,
    };
  }

  @Patch('message/:id/state')
  @ApiOperation({ summary: 'Toggle read, starred, or trash state for an email' })
  async updateState(
    @Param('id') id: string,
    @Body() body: { read?: boolean; starred?: boolean; trashed?: boolean },
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.updateEmailState(user, id, body);
  }

  @Delete('message/:id')
  @ApiOperation({ summary: 'Delete or trash an email' })
  async deleteMessage(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.deleteEmail(user, id);
  }

  @Post('drafts')
  @ApiOperation({ summary: 'Save or auto-save draft email' })
  async saveDraft(
    @Body() body: any,
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.saveDraft(user, body);
  }

  @Delete('drafts/:id')
  @ApiOperation({ summary: 'Delete a draft email' })
  async deleteDraft(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.deleteDraft(user, id);
  }

  @Post('send')
  @ApiOperation({ summary: 'Dispatch outgoing email via AWS SES as this official' })
  async sendEmail(
    @Body() body: {
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject: string;
      text?: string;
      html?: string;
      body?: string;
      content?: string;
      priority?: string;
      attachments?: any[];
    },
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.sendEmail(user, body);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Update password for higher official' })
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Headers('authorization') auth?: string,
  ) {
    const user = await this.webmailService.verifyToken(auth);
    return this.webmailService.changePassword(user, body.currentPassword, body.newPassword);
  }
}
