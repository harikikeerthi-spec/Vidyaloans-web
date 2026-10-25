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
