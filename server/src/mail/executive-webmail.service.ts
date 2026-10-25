import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { randomUUID, createHash } from 'crypto';

export interface ExecutiveMailboxUser {
  id: string;
  email: string;
  name: string;
  title: string;
  s3Prefix: string;
  status: string;
  createdAt: Date;
}

@Injectable()
export class ExecutiveWebmailService implements OnModuleInit {
  private readonly logger = new Logger(ExecutiveWebmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.ensureTableAndSeed();
  }

  // Password hashing utility using SHA-256 + secret salt
  private hashPassword(password: string): string {
    const salt = this.config.get<string>('JWT_SECRET') || 'vidyaloans_executive_secure_salt_2026';
    return createHash('sha256').update(password + salt).digest('hex');
  }

  // Initialize DB table
  async ensureTableAndSeed() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "executive_mailboxes" (
          "id" TEXT PRIMARY KEY,
          "email" TEXT UNIQUE NOT NULL,
          "password" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "title" TEXT,
          "s3Prefix" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'active',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      this.logger.error('[ExecutiveWebmailService] Database init error: ' + err.message);
    }
  }

  // Authenticate official with Email + Password
  async login(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestException('Email address and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const hashed = this.hashPassword(password.trim());

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT "id", "email", "password", "name", "title", "s3Prefix", "status"
      FROM "executive_mailboxes"
      WHERE LOWER("email") = '${cleanEmail}'
      LIMIT 1;
    `);

    if (!rows || rows.length === 0) {
      throw new UnauthorizedException('Invalid official mailbox email or password');
    }

    const user = rows[0];

    if (user.password !== hashed) {
      throw new UnauthorizedException('Invalid official mailbox email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('This executive mailbox account is inactive. Please contact administrator.');
    }

    // Generate dedicated executive JWT token
    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      title: user.title,
      s3Prefix: user.s3Prefix,
      isExecutive: true,
      role: 'executive_official',
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: user.title,
        s3Prefix: user.s3Prefix,
      },
    };
  }

  // Verify token from header
  async verifyToken(authHeader?: string): Promise<ExecutiveMailboxUser> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing executive session token');
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Invalid authorization token format');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload || !payload.s3Prefix || !payload.email) {
        throw new UnauthorizedException('Invalid executive token payload');
      }
      return {
        id: payload.id || payload.sub,
        email: payload.email,
        name: payload.name || 'Executive Official',
        title: payload.title || 'Official',
        s3Prefix: payload.s3Prefix,
        status: 'active',
        createdAt: new Date(),
      };
    } catch (e: any) {
      throw new UnauthorizedException('Session expired or invalid. Please log in again.');
    }
  }

  // List emails for the logged-in official (Isolated to their private s3Prefix)
  async getInbox(user: ExecutiveMailboxUser, folder = 'inbox') {
    // S3 prefix is strictly scoped to this official: e.g. "officials/director/"
    const targetPrefix = folder === 'sent' 
      ? `${user.s3Prefix}sent/`
      : user.s3Prefix;

    this.logger.log(`[ExecutiveWebmail] Fetching emails for ${user.email} in prefix: ${targetPrefix}`);

    const currentUser = {
      id: user.id,
      email: user.email,
      role: 'executive_official',
      mailboxPrefix: targetPrefix,
    };

    try {
      const emails = await this.mailService.listSupport(targetPrefix, user.email, user.id, currentUser);
      return {
        success: true,
        data: emails,
        total: emails.length,
      };
    } catch (err: any) {
      this.logger.error(`[ExecutiveWebmail] Error reading emails: ${err.message}`);
      return {
        success: true,
        data: [],
        total: 0,
      };
    }
  }

  // Read single email content
  async getEmailDetail(user: ExecutiveMailboxUser, id: string) {
    const currentUser = {
      id: user.id,
      email: user.email,
      role: 'executive_official',
      mailboxPrefix: user.s3Prefix,
    };

    return await this.mailService.getMailById(id, user.id, currentUser);
  }

  // Send email as this official via AWS SES
  async sendEmail(user: ExecutiveMailboxUser, body: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: any[];
  }) {
    const toList = Array.isArray(body.to) ? body.to : [body.to];
    const ccList = body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : [];
    const bccList = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : [];

    const sendDto: any = {
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: body.subject,
      body: body.html || body.text || '',
      html: body.html,
      text: body.text,
      senderName: user.name,
      senderEmail: user.email,
      attachments: body.attachments,
    };

    const currentUser = {
      id: user.id,
      email: user.email,
      role: 'executive_official',
      mailboxEmail: user.email,
      mailboxPrefix: user.s3Prefix,
    };

    const result = await this.mailService.sendEmail(sendDto, currentUser);
    return {
      success: true,
      message: 'Email dispatched successfully via AWS SES',
      data: result,
    };
  }

  // Update password for an official
  async changePassword(user: ExecutiveMailboxUser, currentPass: string, newPass: string) {
    if (!currentPass || !newPass || newPass.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long');
    }

    const hashedCurrent = this.hashPassword(currentPass.trim());
    const hashedNew = this.hashPassword(newPass.trim());

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT "password" FROM "executive_mailboxes" WHERE "id" = '${user.id}' LIMIT 1;
    `);

    if (!rows || rows.length === 0 || rows[0].password !== hashedCurrent) {
      throw new BadRequestException('Current password is incorrect');
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE "executive_mailboxes"
      SET "password" = '${hashedNew}', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = '${user.id}';
    `);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }
}
