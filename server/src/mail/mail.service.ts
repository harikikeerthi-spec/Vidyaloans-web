import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { simpleParser, ParsedMail } from 'mailparser';
import * as nodemailer from 'nodemailer';
import { Readable } from 'stream';
import { MailSummary, MailDetail, MailFolder, MailAttachment } from './interfaces/mail.interface';
import { SendEmailDto } from './dto/send-email.dto';
import { UpdateEmailStateDto } from './dto/update-email-state.dto';
import { DISPOSABLE_DOMAINS } from '../site-settings/disposable-domains';
import { PrismaService } from '../prisma/prisma.service';

const DISPOSABLE_SET = new Set(
  DISPOSABLE_DOMAINS.map((d: string) => d.toLowerCase().trim()),
);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly s3Client: S3Client;
  private readonly transporter: nodemailer.Transporter;
  private readonly bucketName: string;
  private readonly defaultPrefix: string;
  private readonly mailFrom: string;
  private readonly replyTo: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const rawRegion = (
      this.config.get<string>('AWS_REGION') ||
      process.env.AWS_REGION ||
      'ap-south-1'
    ).trim();
    const regionMatch = rawRegion.match(/[a-z]{2}-[a-z]+-\d/i);
    const region = regionMatch ? regionMatch[0].toLowerCase() : 'ap-south-1';

    const accessKeyId = (
      this.config.get<string>('AWS_ACCESS_KEY_ID') ||
      process.env.AWS_ACCESS_KEY_ID ||
      ''
    ).trim();
    const secretAccessKey = (
      this.config.get<string>('AWS_SECRET_ACCESS_KEY') ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      ''
    ).trim();

    this.bucketName = (
      this.config.get<string>('AWS_S3_EMAIL_BUCKET_NAME') ||
      process.env.AWS_S3_EMAIL_BUCKET_NAME ||
      (this.config.get<string>('AWS_S3_BUCKET_NAME') === 'vidyaloans-s3' ? 'vidyaloans-incoming-emails' : this.config.get<string>('AWS_S3_BUCKET_NAME')) ||
      'vidyaloans-incoming-emails'
    ).trim();

    this.defaultPrefix = (
      this.config.get<string>('S3_PREFIX') ||
      process.env.S3_PREFIX ||
      'support/'
    ).trim();

    this.mailFrom = (
      this.config.get<string>('MAIL_FROM') ||
      process.env.MAIL_FROM ||
      '"VidyaLoans Support" <support@vidyaloans.in>'
    ).trim();

    this.replyTo = (
      this.config.get<string>('EMAIL_REPLY_TO') ||
      process.env.EMAIL_REPLY_TO ||
      'support@vidyaloans.in'
    ).trim();

    // 1. Initialize AWS S3 Client
    this.s3Client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });

    // 2. Initialize Nodemailer SES SMTP Transporter
    const smtpHost = (
      this.config.get<string>('SMTP_HOST') ||
      process.env.SMTP_HOST ||
      'email-smtp.ap-south-1.amazonaws.com'
    ).trim();
    const smtpPort = parseInt(
      this.config.get<string>('SMTP_PORT') || process.env.SMTP_PORT || '587',
      10,
    );
    const smtpUser = (
      this.config.get<string>('SMTP_USER') ||
      process.env.SMTP_USER ||
      ''
    ).trim();
    const smtpPass = (
      this.config.get<string>('SMTP_PASS') ||
      process.env.SMTP_PASS ||
      ''
    ).trim();

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.logger.log(
      `[MailService] Initialized. Region: ${region}, Bucket: ${this.bucketName}, Default Prefix: ${this.defaultPrefix}, SMTP Host: ${smtpHost}:${smtpPort}`,
    );
  }

  /**
   * Helper to convert Node.js stream to Buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Dynamically discover available folders in S3 bucket (root prefixes and staff/ prefixes)
   */
  async listFolders(): Promise<MailFolder[]> {
    const folders: MailFolder[] = [];
    const seen = new Set<string>();

    const addFolder = (name: string, prefix: string, isStaff: boolean = false) => {
      const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      if (!seen.has(cleanPrefix)) {
        seen.add(cleanPrefix);
        folders.push({ name, prefix: cleanPrefix, isStaff });
      }
    };

    // Always include default support inbox
    addFolder('Support Team Inbox', this.defaultPrefix, false);

    try {
      // 1. Discover top-level prefixes with delimiter '/'
      const rootCmd = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Delimiter: '/',
      });
      const rootRes = await this.s3Client.send(rootCmd);
      if (rootRes.CommonPrefixes) {
        for (const cp of rootRes.CommonPrefixes) {
          if (cp.Prefix) {
            const clean = cp.Prefix;
            if (clean !== 'support/' && clean !== 'staff/') {
              const label = clean.replace(/\/$/, '');
              addFolder(label.charAt(0).toUpperCase() + label.slice(1), clean, false);
            }
          }
        }
      }

      // 2. Discover staff-specific folders under staff/
      const staffCmd = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'staff/',
        Delimiter: '/',
      });
      const staffRes = await this.s3Client.send(staffCmd);
      if (staffRes.CommonPrefixes) {
        for (const cp of staffRes.CommonPrefixes) {
          if (cp.Prefix && cp.Prefix !== 'staff/') {
            const sub = cp.Prefix.replace(/^staff\//, '').replace(/\/$/, '');
            const label = sub.replace(/[_-]/g, ' ');
            const capitalized = label.replace(/\b\w/g, (l) => l.toUpperCase());
            addFolder(`Staff: ${capitalized}`, cp.Prefix, true);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[MailService.listFolders] Could not list prefixes from S3: ${err.message}`);
    }

    return folders;
  }

  /**
   * Determine effective S3 folder prefix
   */
  resolvePrefix(folder?: string, staffEmail?: string): string {
    if (folder && folder.trim()) {
      let f = folder.trim();
      if (!f.endsWith('/')) f += '/';
      return f;
    }

    if (staffEmail && staffEmail.trim()) {
      const slug = staffEmail.trim().split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (slug) {
        return `staff/${slug}/`;
      }
    }

    return this.defaultPrefix;
  }

  /**
   * Multi-layer Spam / Junk Analysis:
   * 1. Evaluates native Amazon SES inbound verdict headers (x-ses-spam-verdict, x-ses-virus-verdict)
   * 2. Inspects authentication headers (SPF, DKIM, DMARC)
   * 3. Analyzes heuristics, phishing patterns, suspicious financial lure keywords, and disposable domains
   */
  analyzeSpam(parsed: ParsedMail): {
    isSpam: boolean;
    spamScore: number;
    spamVerdict: 'PASS' | 'FAIL' | 'GRAY' | 'UNKNOWN';
    virusVerdict: 'PASS' | 'FAIL' | 'UNKNOWN';
    spamReasons: string[];
    authResults: { spf?: string; dkim?: string; dmarc?: string };
  } {
    let spamScore = 0;
    const spamReasons: string[] = [];

    const getHeader = (name: string): string => {
      const val = parsed.headers?.get ? parsed.headers.get(name) : (parsed.headers as any)?.[name];
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object' && (val as any).value) return String((val as any).value);
      return String(val);
    };

    const sesSpamRaw = getHeader('x-ses-spam-verdict').toUpperCase().trim();
    const sesVirusRaw = getHeader('x-ses-virus-verdict').toUpperCase().trim();
    const authResultsRaw = getHeader('authentication-results').toLowerCase();
    const receivedSpfRaw = getHeader('received-spf').toLowerCase();

    const spamVerdict: 'PASS' | 'FAIL' | 'GRAY' | 'UNKNOWN' =
      sesSpamRaw === 'FAIL' ? 'FAIL' : sesSpamRaw === 'PASS' ? 'PASS' : sesSpamRaw === 'GRAY' ? 'GRAY' : 'UNKNOWN';

    const virusVerdict: 'PASS' | 'FAIL' | 'UNKNOWN' =
      sesVirusRaw === 'FAIL' ? 'FAIL' : sesVirusRaw === 'PASS' ? 'PASS' : 'UNKNOWN';

    // 1. SES Primary Security Verdicts
    if (spamVerdict === 'FAIL') {
      spamScore += 75;
      spamReasons.push('Amazon SES Spam Check: FAILED');
    } else if (spamVerdict === 'GRAY') {
      spamScore += 25;
      spamReasons.push('Amazon SES Spam Check: Suspicious (GRAY)');
    }

    if (virusVerdict === 'FAIL') {
      spamScore += 100;
      spamReasons.push('Amazon SES Antivirus: INFECTED / MALWARE');
    }

    // 2. SPF, DKIM, and DMARC Authentication Analysis
    const authResults = {
      spf: receivedSpfRaw.includes('pass') || authResultsRaw.includes('spf=pass')
        ? 'pass'
        : (receivedSpfRaw.includes('fail') || authResultsRaw.includes('spf=fail') ? 'fail' : 'neutral'),
      dkim: authResultsRaw.includes('dkim=pass')
        ? 'pass'
        : (authResultsRaw.includes('dkim=fail') ? 'fail' : 'neutral'),
      dmarc: authResultsRaw.includes('dmarc=pass')
        ? 'pass'
        : (authResultsRaw.includes('dmarc=fail') ? 'fail' : 'neutral'),
    };

    if (authResults.spf === 'fail') {
      spamScore += 25;
      spamReasons.push('SPF Verification: FAILED (Unauthorized sending server IP)');
    }
    if (authResults.dkim === 'fail') {
      spamScore += 25;
      spamReasons.push('DKIM Signature: FAILED (Message forged or altered in transit)');
    }
    if (authResults.dmarc === 'fail') {
      spamScore += 30;
      spamReasons.push('DMARC Alignment: FAILED (Sender domain impersonation detected)');
    }

    // 3. Heuristic Keyword & Phishing Analysis
    const subject = (parsed.subject || '').toLowerCase();
    const body = ((parsed.text || '') + ' ' + (parsed.html || '')).toLowerCase();
    const senderEmail = (parsed.from?.value?.[0]?.address || parsed.from?.text || '').toLowerCase();

    const highRiskKeywords = [
      { pattern: /\b(viagra|cialis|enhancement pills|weight loss secret)\b/i, score: 50, reason: 'High-risk adult/pharmaceutical spam content' },
      { pattern: /\b(crypto giveaway|bitcoin doubler|usdt bonus|airdrop reward|connect your wallet)\b/i, score: 45, reason: 'Cryptocurrency scam pattern' },
      { pattern: /\b(you have won|lottery winner|inheritance fund|western union transfer|claim your (prize|reward|grant))\b/i, score: 45, reason: 'Prize / inheritance advance fee scam phrase' },
      { pattern: /\b(urgent: account (suspended|blocked|locked)|verify your password|unauthorized login attempt|security alert: login required)\b/i, score: 40, reason: 'Urgent credential phishing lure' },
      { pattern: /\b(overdue invoice|payment remittance advice|wire remittance|unpaid balance due|invoice attached for payment)\b/i, score: 35, reason: 'Suspicious fake invoice / billing scam pattern' },
      { pattern: /\b(undelivered package|fedex delivery notification|dhl parcel tracking|postal parcel pending)\b/i, score: 35, reason: 'Package delivery phishing lure' },
      { pattern: /\b(100% free|risk free guaranteed|wire transfer immediately|send payment to)\b/i, score: 25, reason: 'Suspicious unsolicited solicitation' },
    ];

    for (const kw of highRiskKeywords) {
      if (kw.pattern.test(subject) || kw.pattern.test(body)) {
        spamScore += kw.score;
        spamReasons.push(kw.reason);
      }
    }

    // 4. Check for known disposable email provider domains using 4000+ domain dataset
    const senderDomain = senderEmail.split('@')[1] || '';
    if (senderDomain && DISPOSABLE_SET.has(senderDomain.toLowerCase())) {
      spamScore += 60;
      spamReasons.push(`Sent from disposable/anonymous email provider (@${senderDomain})`);
    }

    // 5. Check for dangerous attachment file extensions
    const dangerousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.vbs', '.js', '.hta', '.iso', '.jar', '.com', '.pif', '.wsf'];
    const hasMaliciousAttachment = (parsed.attachments || []).some((att) => {
      const fname = (att.filename || '').toLowerCase();
      return dangerousExtensions.some((ext) => fname.endsWith(ext));
    });
    if (hasMaliciousAttachment) {
      spamScore += 80;
      spamReasons.push('Contains high-risk executable or script attachment');
    }

    // 6. Check for Vidyaloans internal brand impersonation / spoofing
    const fromDisplayName = (parsed.from?.text || '').toLowerCase();
    if ((senderEmail.includes('vidyaloans') || fromDisplayName.includes('vidyaloans')) && (authResults.spf === 'fail' || authResults.dkim === 'fail')) {
      spamScore += 80;
      spamReasons.push('Domain spoofing attempt: Impersonating official Vidyaloans address');
    }

    const isSpam = spamScore >= 50 || spamVerdict === 'FAIL' || virusVerdict === 'FAIL';

    return {
      isSpam,
      spamScore: Math.min(100, spamScore),
      spamVerdict,
      virusVerdict,
      spamReasons,
      authResults,
    };
  }

  /**
   * List incoming emails from S3 under specified folder or default support prefix,
   * merged with persistent database read/star/spam/trash states for the current user.
   */
  async listSupport(folder?: string, staffEmail?: string, userId?: string): Promise<MailSummary[]> {
    const prefix = this.resolvePrefix(folder, staffEmail);
    this.logger.log(`[MailService.listSupport] Fetching emails for prefix: ${prefix} in ${this.bucketName}`);

    try {
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const listRes = await this.s3Client.send(listCmd);
      const objects = listRes.Contents || [];

      // Filter out directory placeholders
      const emailObjects = objects.filter((o) => o.Key && !o.Key.endsWith('/') && (o.Size || 0) > 0);

      const emailPromises = emailObjects.map(async (obj): Promise<MailSummary | null> => {
        try {
          const getCmd = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: obj.Key!,
          });
          const getRes = await this.s3Client.send(getCmd);
          if (!getRes.Body) return null;

          const buffer = await this.streamToBuffer(getRes.Body as Readable);
          const parsed: ParsedMail = await simpleParser(buffer);

          const fromText = parsed.from?.text || parsed.from?.value?.[0]?.address || 'Unknown Sender';
          const toText = Array.isArray(parsed.to)
            ? parsed.to.map((t) => t.text).join(', ')
            : (parsed.to?.text || parsed.to?.value?.[0]?.address || '');

          const subject = parsed.subject || '(No Subject)';
          const dateStr = parsed.date
            ? parsed.date.toISOString()
            : obj.LastModified
            ? obj.LastModified.toISOString()
            : new Date().toISOString();

          const textSnippet = (parsed.text || '')
            .slice(0, 140)
            .replace(/\s+/g, ' ')
            .trim();

          const id = Buffer.from(obj.Key!).toString('base64url');

          // Run Spam & Junk Analysis
          const spamAnalysis = this.analyzeSpam(parsed);

          return {
            id,
            key: obj.Key!,
            from: fromText,
            to: toText,
            subject,
            date: dateStr,
            size: obj.Size || buffer.length,
            read: false,
            starred: false,
            trashed: false,
            folder: prefix,
            snippet: textSnippet,
            isSpam: spamAnalysis.isSpam,
            spamScore: spamAnalysis.spamScore,
            spamVerdict: spamAnalysis.spamVerdict,
            virusVerdict: spamAnalysis.virusVerdict,
            spamReasons: spamAnalysis.spamReasons,
            authResults: spamAnalysis.authResults,
          };
        } catch (e: any) {
          this.logger.error(`[MailService.listSupport] Failed parsing email ${obj.Key}: ${e.message}`);
          return null;
        }
      });

      const parsedResults = await Promise.all(emailPromises);
      const validEmails = parsedResults.filter((e): e is MailSummary => e !== null);

      // Merge persistent database states (read, starred, spam overrides, trashed)
      if (userId && validEmails.length > 0) {
        try {
          const states = await this.prisma.staffEmailState.findMany({
            where: {
              userId,
              emailId: { in: validEmails.map((e) => e.id) },
            },
          });
          const stateMap = new Map(states.map((s) => [s.emailId, s]));
          for (const email of validEmails) {
            const st = stateMap.get(email.id);
            if (st) {
              email.read = st.isRead;
              email.starred = st.isStarred;
              email.trashed = st.isTrashed;
              email.userSpamOverride = st.isSpam;
              if (st.isSpam === true) {
                email.isSpam = true;
              } else if (st.isSpam === false) {
                email.isSpam = false;
              }
            }
          }
        } catch (dbErr: any) {
          this.logger.warn(`[MailService.listSupport] Could not load email states from DB: ${dbErr.message}`);
        }
      }

      // Sort newest first
      validEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return validEmails;
    } catch (err: any) {
      this.logger.error(`[MailService.listSupport] S3 Error for bucket ${this.bucketName}: ${err.message}`);
      return [];
    }
  }

  /**
   * Get single email detail by base64url encoded S3 key
   */
  async getMailById(id: string, userId?: string): Promise<MailDetail> {
    let key: string;
    try {
      key = Buffer.from(id, 'base64url').toString('utf8');
    } catch (e) {
      throw new BadRequestException('Invalid email ID format');
    }

    try {
      const getCmd = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const res = await this.s3Client.send(getCmd);
      if (!res.Body) throw new NotFoundException('Email body not found in S3');

      const buffer = await this.streamToBuffer(res.Body as Readable);
      const parsed: ParsedMail = await simpleParser(buffer);

      const fromText = parsed.from?.text || parsed.from?.value?.[0]?.address || 'Unknown Sender';
      const toText = Array.isArray(parsed.to)
        ? parsed.to.map((t) => t.text).join(', ')
        : (parsed.to?.text || parsed.to?.value?.[0]?.address || '');

      const ccText = Array.isArray(parsed.cc)
        ? parsed.cc.map((c) => c.text).join(', ')
        : (parsed.cc?.text || '');

      const bccText = Array.isArray(parsed.bcc)
        ? parsed.bcc.map((b) => b.text).join(', ')
        : (parsed.bcc?.text || '');

      const attachments: MailAttachment[] = (parsed.attachments || []).map((att) => ({
        filename: att.filename || 'attachment',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || (att.content ? att.content.length : 0),
        content: att.content ? att.content.toString('base64') : undefined,
      }));

      const dateStr = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

      const spamAnalysis = this.analyzeSpam(parsed);

      const mailDetail: MailDetail = {
        id,
        key,
        from: fromText,
        to: toText,
        cc: ccText,
        bcc: bccText,
        replyTo: parsed.replyTo?.text || undefined,
        subject: parsed.subject || '(No Subject)',
        date: dateStr,
        size: buffer.length,
        read: true,
        starred: false,
        trashed: false,
        html: parsed.html || (parsed.textAsHtml ? parsed.textAsHtml : undefined),
        text: parsed.text || '',
        snippet: (parsed.text || '').slice(0, 140).replace(/\s+/g, ' ').trim(),
        attachments,
        isSpam: spamAnalysis.isSpam,
        spamScore: spamAnalysis.spamScore,
        spamVerdict: spamAnalysis.spamVerdict,
        virusVerdict: spamAnalysis.virusVerdict,
        spamReasons: spamAnalysis.spamReasons,
        authResults: spamAnalysis.authResults,
      };

      // Merge persistent DB state if user ID provided
      if (userId) {
        try {
          const st = await this.prisma.staffEmailState.findUnique({
            where: {
              userId_emailId: { userId, emailId: id },
            },
          });
          if (st) {
            mailDetail.read = st.isRead;
            mailDetail.starred = st.isStarred;
            mailDetail.trashed = st.isTrashed;
            mailDetail.userSpamOverride = st.isSpam;
            if (st.isSpam === true) mailDetail.isSpam = true;
            else if (st.isSpam === false) mailDetail.isSpam = false;
          }
        } catch (dbErr: any) {
          this.logger.warn(`[MailService.getMailById] Could not fetch DB state: ${dbErr.message}`);
        }
      }

      return mailDetail;
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      this.logger.error(`[MailService.getMailById] Error loading key ${key}: ${err.message}`);
      throw new NotFoundException(`Email not found: ${err.message}`);
    }
  }

  /**
   * Update state (read, star, spam, trash) for a specific email by user
   */
  async updateEmailState(userId: string, emailId: string, dto: UpdateEmailStateDto) {
    const dataToUpdate: any = {};
    if (dto.isRead !== undefined) dataToUpdate.isRead = dto.isRead;
    if (dto.isStarred !== undefined) dataToUpdate.isStarred = dto.isStarred;
    if (dto.isSpam !== undefined) dataToUpdate.isSpam = dto.isSpam;
    if (dto.isTrashed !== undefined) dataToUpdate.isTrashed = dto.isTrashed;

    return this.prisma.staffEmailState.upsert({
      where: {
        userId_emailId: { userId, emailId },
      },
      update: dataToUpdate,
      create: {
        userId,
        emailId,
        isRead: dto.isRead ?? false,
        isStarred: dto.isStarred ?? false,
        isSpam: dto.isSpam ?? null,
        isTrashed: dto.isTrashed ?? false,
      },
    });
  }

  /**
   * Batch update state for multiple emails by user
   */
  async batchUpdateEmailState(userId: string, emailIds: string[], dto: UpdateEmailStateDto) {
    if (!emailIds || emailIds.length === 0) return { updated: 0 };
    await Promise.all(emailIds.map((id) => this.updateEmailState(userId, id, dto)));
    return { updated: emailIds.length };
  }

  /**
   * Get all email states for a user
   */
  async getUserEmailStates(userId: string) {
    return this.prisma.staffEmailState.findMany({
      where: { userId },
    });
  }

  /**
   * Send an outgoing email / reply via SES SMTP
   */
  async sendEmail(dto: SendEmailDto, currentUser?: any) {
    if (!dto.to || (Array.isArray(dto.to) && dto.to.length === 0)) {
      throw new BadRequestException('Recipient "to" is required');
    }
    if (!dto.subject) {
      throw new BadRequestException('Email subject is required');
    }

    const mailAttachments = (dto.attachments || []).map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }));

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.mailFrom,
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      replyTo: dto.replyTo || this.replyTo,
      subject: dto.subject,
      text: dto.text,
      html: dto.html || (dto.text ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${dto.text}</div>` : ''),
      attachments: mailAttachments,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`[MailService.sendEmail] Dispatched email messageId: ${info.messageId} to ${JSON.stringify(dto.to)}`);
      return {
        success: true,
        messageId: info.messageId,
        envelope: info.envelope,
      };
    } catch (err: any) {
      this.logger.error(`[MailService.sendEmail] SMTP Send Error: ${err.message}`);
      throw new BadRequestException(`Failed to dispatch email via SES SMTP: ${err.message}`);
    }
  }
}
