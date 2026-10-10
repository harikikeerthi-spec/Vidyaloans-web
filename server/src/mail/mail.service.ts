import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { simpleParser, ParsedMail } from 'mailparser';
import * as nodemailer from 'nodemailer';
import { Readable } from 'stream';
import { MailSummary, MailDetail, MailFolder, MailAttachment } from './interfaces/mail.interface';
import { SendEmailDto } from './dto/send-email.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { UpdateEmailStateDto } from './dto/update-email-state.dto';
import { DISPOSABLE_DOMAINS } from '../site-settings/disposable-domains';
import { PrismaService } from '../prisma/prisma.service';

const DISPOSABLE_SET = new Set(
  DISPOSABLE_DOMAINS.map((d: string) => d.toLowerCase().trim()),
);

@Injectable()
export class MailService implements OnModuleInit {
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

  async onModuleInit() {
    await this.ensureDraftEmailsTable();
  }

  async ensureDraftEmailsTable() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "draft_emails" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT,
          "senderEmail" TEXT,
          "senderName" TEXT,
          "to" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "subject" TEXT,
          "text" TEXT,
          "html" TEXT,
          "replyTo" TEXT,
          "attachments" JSONB,
          "priority" TEXT DEFAULT 'normal',
          "requestReadReceipt" BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "draft_emails_senderEmail_idx" ON "draft_emails"("senderEmail");
        CREATE INDEX IF NOT EXISTS "draft_emails_userId_idx" ON "draft_emails"("userId");
        CREATE INDEX IF NOT EXISTS "draft_emails_updatedAt_idx" ON "draft_emails"("updatedAt");
      `);
      this.logger.log('[MailService] Initialized "draft_emails" table in PostgreSQL database.');
    } catch (err: any) {
      this.logger.warn(`[MailService] Notice verifying draft_emails table: ${err.message}`);
    }
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
   * Count email objects in a given S3 prefix
   */
  async countPrefixObjects(prefix: string): Promise<number> {
    try {
      const clean = prefix.endsWith('/') ? prefix : `${prefix}/`;
      const cmd = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: clean,
        MaxKeys: 1000,
      });
      const res = await this.s3Client.send(cmd);
      return (res.Contents || []).filter(c => c.Key && c.Key !== clean && !c.Key.endsWith('/')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Create an S3 folder prefix in the incoming email bucket
   */
  async createFolder(folderPrefix: string): Promise<MailFolder> {
    let clean = folderPrefix.trim().toLowerCase().replace(/[^a-z0-9_\-\/]/g, '');
    if (!clean.endsWith('/')) clean += '/';
    if (!clean || clean === '/') {
      throw new BadRequestException('Invalid folder prefix name');
    }

    try {
      const putCmd = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: clean,
        Body: '',
      });
      await this.s3Client.send(putCmd);
      this.logger.log(`[MailService.createFolder] Created S3 prefix "${clean}" in bucket "${this.bucketName}"`);
      return {
        name: clean.replace(/\/$/, ''),
        prefix: clean,
        count: 0,
        isStaff: true,
      };
    } catch (err: any) {
      this.logger.error(`[MailService.createFolder] Failed to create S3 prefix "${clean}": ${err.message}`);
      throw new BadRequestException(`Could not create folder in S3: ${err.message}`);
    }
  }

  /**
   * Hydrates the user's assigned SES mailbox email, S3 prefix, and permissions from the database.
   */
  async ensureUserMailboxContext(currentUser?: any, userId?: string): Promise<void> {
    if (!currentUser && !userId) return;
    const uid = currentUser?.id || currentUser?.sub || userId;
    if (!uid) return;

    if (!currentUser?.mailboxPrefix || !currentUser?.mailboxEmail) {
      try {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: uid },
          select: {
            mailboxEmail: true,
            mailboxPrefix: true,
            canAccessSupport: true,
            firstName: true,
            lastName: true,
          },
        });
        if (dbUser && currentUser) {
          if (dbUser.mailboxEmail) currentUser.mailboxEmail = dbUser.mailboxEmail;
          if (dbUser.mailboxPrefix) currentUser.mailboxPrefix = dbUser.mailboxPrefix;
          if (dbUser.canAccessSupport !== undefined) currentUser.canAccessSupport = dbUser.canAccessSupport;
          if (dbUser.firstName && !currentUser.firstName) currentUser.firstName = dbUser.firstName;
          if (dbUser.lastName && !currentUser.lastName) currentUser.lastName = dbUser.lastName;
        }
      } catch (e: any) {
        this.logger.warn(`[MailService] Could not fetch staff user details from DB: ${e.message}`);
      }
    }
  }

  /**
   * Dynamically discover available folders in S3 bucket (root prefixes and staff/ prefixes)
   * If a staff member is requesting, only returns their assigned folder (and support/ if permitted).
   */
  async listFolders(currentUser?: any): Promise<MailFolder[]> {
    await this.ensureUserMailboxContext(currentUser);
    const userRole = (currentUser?.role || '').toLowerCase();
    const isStaff = userRole === 'staff';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // If staff user, strictly return only their isolated assigned mailbox
    if (isStaff && !isAdmin) {

      let staffPrefix = currentUser.mailboxPrefix;
      if (!staffPrefix) {
        if (currentUser.mailboxEmail) {
          const slug = currentUser.mailboxEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
          staffPrefix = `${slug}/`;
        } else if (currentUser.email) {
          const slug = currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
          staffPrefix = `staff/${slug}/`;
        } else {
          staffPrefix = this.defaultPrefix;
        }
      }
      if (!staffPrefix.endsWith('/')) staffPrefix += '/';

      const label = currentUser.mailboxEmail || currentUser.email;
      const staffCount = await this.countPrefixObjects(staffPrefix);

      // ONLY return the staff member's assigned mailbox — never other mailboxes
      return [
        { name: currentUser.mailboxEmail ? `My Mailbox (${currentUser.mailboxEmail})` : `My Mailbox (${label})`, prefix: staffPrefix, isStaff: true, count: staffCount },
      ];
    }

    const folders: MailFolder[] = [];
    const seen = new Set<string>();

    const addFolder = (
      name: string,
      prefix: string,
      isStaff: boolean = false,
      extra?: { assignedStaffName?: string; assignedStaffEmail?: string; assignedMailboxEmail?: string },
    ) => {
      const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
      if (!seen.has(cleanPrefix)) {
        seen.add(cleanPrefix);
        folders.push({
          name,
          prefix: cleanPrefix,
          isStaff,
          ...extra,
        });
      }
    };

    // Load registered staff users from DB to correlate assigned folders
    let staffUsers: any[] = [];
    try {
      staffUsers = await this.prisma.user.findMany({
        where: { role: 'staff' },
        select: { firstName: true, lastName: true, email: true, mailboxEmail: true, mailboxPrefix: true },
      });
    } catch (e: any) {
      this.logger.warn(`[MailService.listFolders] Could not load staff users from DB: ${e.message}`);
    }

    const getStaffForPrefix = (prefix: string) => {
      const clean = prefix.endsWith('/') ? prefix : `${prefix}/`;
      return staffUsers.find(
        (u) =>
          u.mailboxPrefix === clean ||
          (u.mailboxEmail && `${u.mailboxEmail.split('@')[0].toLowerCase()}/` === clean) ||
          (u.email && `staff/${u.email.split('@')[0].toLowerCase()}/` === clean),
      );
    };

    // Always include default support inbox for admins
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
              const assigned = getStaffForPrefix(clean);
              const label = clean.replace(/\/$/, '');
              const displayName = assigned?.mailboxEmail
                ? `Staff: ${assigned.mailboxEmail}`
                : label.charAt(0).toUpperCase() + label.slice(1);

              addFolder(displayName, clean, !!assigned, {
                assignedStaffName: assigned ? `${assigned.firstName || ''} ${assigned.lastName || ''}`.trim() : undefined,
                assignedStaffEmail: assigned?.email,
                assignedMailboxEmail: assigned?.mailboxEmail,
              });
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
            const assigned = getStaffForPrefix(cp.Prefix);
            const sub = cp.Prefix.replace(/^staff\//, '').replace(/\/$/, '');
            const label = sub.replace(/[_-]/g, ' ');
            const capitalized = label.replace(/\b\w/g, (l) => l.toUpperCase());
            addFolder(
              assigned?.mailboxEmail ? `Staff: ${assigned.mailboxEmail}` : `Staff: ${capitalized}`,
              cp.Prefix,
              true,
              {
                assignedStaffName: assigned ? `${assigned.firstName || ''} ${assigned.lastName || ''}`.trim() : undefined,
                assignedStaffEmail: assigned?.email,
                assignedMailboxEmail: assigned?.mailboxEmail,
              },
            );
          }
        }
      }

      // 3. Ensure any folders configured on registered staff are present in list
      for (const st of staffUsers) {
        if (st.mailboxPrefix) {
          addFolder(
            st.mailboxEmail ? `Staff: ${st.mailboxEmail}` : `Staff: ${st.firstName || 'Member'}`,
            st.mailboxPrefix,
            true,
            {
              assignedStaffName: `${st.firstName || ''} ${st.lastName || ''}`.trim(),
              assignedStaffEmail: st.email,
              assignedMailboxEmail: st.mailboxEmail,
            },
          );
        }
      }

      // Calculate object counts for each folder in parallel
      await Promise.all(
        folders.map(async (f) => {
          f.count = await this.countPrefixObjects(f.prefix);
        }),
      );
    } catch (err: any) {
      this.logger.warn(`[MailService.listFolders] Could not list prefixes from S3: ${err.message}`);
    }

    return folders;
  }

  /**
   * Determine effective S3 folder prefix, with enforcement of staff folder boundaries
   */
  resolvePrefix(folder?: string, staffEmail?: string, currentUser?: any): string {
    const userRole = (currentUser?.role || '').toLowerCase();
    const isStaff = userRole === 'staff';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (isStaff && !isAdmin) {
      let staffPrefix = currentUser.mailboxPrefix;
      if (!staffPrefix) {
        if (currentUser.mailboxEmail) {
          const slug = currentUser.mailboxEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
          staffPrefix = `${slug}/`;
        } else if (currentUser.email) {
          const slug = currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
          staffPrefix = `staff/${slug}/`;
        } else {
          staffPrefix = this.defaultPrefix;
        }
      }
      if (!staffPrefix.endsWith('/')) staffPrefix += '/';

      // Staff are strictly locked to their own assigned prefix — cannot access other prefixes
      return staffPrefix;
    }

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
  async listSupport(folder?: string, staffEmail?: string, userId?: string, currentUser?: any): Promise<MailSummary[]> {
    await this.ensureUserMailboxContext(currentUser, userId);
    const prefix = this.resolvePrefix(folder, staffEmail, currentUser);
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
        } catch (err: any) {
          this.logger.warn(`[MailService.listSupport] Failed to parse ${obj.Key}: ${err.message}`);
          return null;
        }
      });

      const parsedEmails = await Promise.all(emailPromises);
      let validEmails = parsedEmails.filter((e): e is MailSummary => e !== null);

      // Merge persistent per-user email state from DB if userId is available
      if (userId) {
        try {
          // Auto-purge trash emails older than 60 days
          const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
          await this.prisma.staffEmailState.deleteMany({
            where: {
              userId,
              isTrashed: true,
              updatedAt: { lt: sixtyDaysAgo },
            },
          }).catch(() => {});

          const userStates = await this.prisma.staffEmailState.findMany({
            where: { userId },
          });
          const stateMap = new Map<string, any>();
          userStates.forEach((s) => stateMap.set(s.emailId, s));

          validEmails = validEmails.map((email) => {
            const st = stateMap.get(email.id);
            if (st) {
              return {
                ...email,
                read: Boolean(st.isRead),
                starred: Boolean(st.isStarred),
                trashed: Boolean(st.isTrashed),
                userSpamOverride: st.isSpam,
              };
            }
            return email;
          });
        } catch (dbErr: any) {
          this.logger.warn(`[MailService.listSupport] Could not load staffEmailState: ${dbErr.message}`);
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
   * Compute aggregate mail statistics for current user / mailbox
   */
  async getMailStats(userId?: string, currentUser?: any) {
    try {
      const emails = await this.listSupport(undefined, undefined, userId, currentUser);

      const unread = emails.filter((e) => !e.read && !e.trashed && !e.isSpam).length;
      const read = emails.filter((e) => e.read && !e.trashed && !e.isSpam).length;
      const starred = emails.filter((e) => e.starred && !e.trashed).length;
      const spam = emails.filter((e) => e.isSpam && !e.trashed).length;
      const trash = emails.filter((e) => e.trashed).length;

      // Dynamic Drafts Count from Database
      let drafts = 0;
      try {
        await this.ensureDraftEmailsTable();
        const mailbox = (currentUser?.mailboxEmail || (currentUser?.email?.endsWith('@vidyaloans.in') ? currentUser.email : null) || currentUser?.email || '').trim().toLowerCase();
        const uid = userId || currentUser?.id || currentUser?.sub;
        let draftRows: any[] = [];
        if (mailbox || uid) {
          draftRows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*)::int as count FROM "draft_emails"
             WHERE (LOWER("senderEmail") = LOWER($1) OR ($2::TEXT IS NOT NULL AND "userId" = $2))`,
            mailbox,
            uid || null,
          );
        } else {
          draftRows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*)::int as count FROM "draft_emails"`,
          );
        }
        drafts = Number(draftRows?.[0]?.count || 0);
      } catch (dErr: any) {
        this.logger.warn(`[MailService.getMailStats] Notice querying drafts count: ${dErr.message}`);
      }

      // Dynamic Sent Count from Database
      let sent = 0;
      try {
        const mailbox = (currentUser?.mailboxEmail || (currentUser?.email?.endsWith('@vidyaloans.in') ? currentUser.email : null) || currentUser?.email || '').trim().toLowerCase();
        let sentRows: any[] = [];
        if (mailbox) {
          sentRows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*)::int as count FROM "sent_emails"
             WHERE LOWER("senderEmail") = LOWER($1)`,
            mailbox,
          );
        } else {
          sentRows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*)::int as count FROM "sent_emails"`,
          );
        }
        sent = Number(sentRows?.[0]?.count || 0);
      } catch (sErr: any) {}

      const totalBytes = emails.reduce((acc, e) => acc + (e.size || 0), 0);
      const trashBytes = emails.filter((e) => e.trashed).reduce((acc, e) => acc + (e.size || 0), 0);
      const spamBytes = emails.filter((e) => e.isSpam && !e.trashed).reduce((acc, e) => acc + (e.size || 0), 0);
      const inboxBytes = emails.filter((e) => !e.trashed && !e.isSpam).reduce((acc, e) => acc + (e.size || 0), 0);
      const quotaBytes = 15 * 1024 * 1024 * 1024; // 15 GB default enterprise mailbox quota

      return {
        total: emails.length,
        unread,
        read,
        sent,
        drafts,
        starred,
        spam,
        trash,
        storage: {
          usedBytes: totalBytes,
          quotaBytes,
          inboxBytes,
          spamBytes,
          trashBytes,
          percentage: Number(((totalBytes / quotaBytes) * 100).toFixed(2)),
          bucketName: this.bucketName,
        },
      };
    } catch (err: any) {
      this.logger.warn(`[MailService.getMailStats] Could not compute mail stats: ${err.message}`);
      return {
        total: 0,
        unread: 0,
        read: 0,
        starred: 0,
        spam: 0,
        trash: 0,
        storage: {
          usedBytes: 0,
          quotaBytes: 15 * 1024 * 1024 * 1024,
          inboxBytes: 0,
          spamBytes: 0,
          trashBytes: 0,
          percentage: 0,
          bucketName: this.bucketName,
        },
      };
    }
  }

  /**
   * Get single email detail by base64url encoded S3 key
   */
  async getMailById(id: string, userId?: string, currentUser?: any): Promise<MailDetail> {
    await this.ensureUserMailboxContext(currentUser, userId);

    // If ID is a sent email from database
    if (id.startsWith('sent_') || id.startsWith('sent-')) {
      try {
        const sentRows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "sent_emails" WHERE "id" = $1 LIMIT 1`,
          id,
        );
        if (sentRows.length > 0) {
          const s = sentRows[0];
          return {
            id: s.id,
            key: `sent/${s.id}`,
            from: s.senderName ? `"${s.senderName}" <${s.senderEmail}>` : s.senderEmail,
            to: Array.isArray(s.to) ? s.to.join(', ') : (s.to || ''),
            cc: Array.isArray(s.cc) ? s.cc.join(', ') : (s.cc || ''),
            bcc: Array.isArray(s.bcc) ? s.bcc.join(', ') : (s.bcc || ''),
            subject: s.subject || '(No Subject)',
            snippet: s.text ? s.text.substring(0, 160) : (s.html ? s.html.replace(/<[^>]+>/g, '').substring(0, 160) : ''),
            text: s.text,
            html: s.html || (s.text ? `<div style="white-space: pre-wrap;">${s.text}</div>` : ''),
            date: s.sentAt ? new Date(s.sentAt).toISOString() : new Date().toISOString(),
            size: 0,
            read: true,
            starred: false,
            isSpam: false,
            spamScore: 0,
            spamReasons: [],
            attachments: s.attachments ? (typeof s.attachments === 'string' ? JSON.parse(s.attachments) : s.attachments) : [],
          };
        }
      } catch (e: any) {
        this.logger.warn(`[MailService.getMailById] Error loading sent email by id: ${e.message}`);
      }
    }

    let key: string;
    try {
      key = Buffer.from(id, 'base64url').toString('utf8');
    } catch (e) {
      throw new BadRequestException('Invalid email ID format');
    }

    const userRole = (currentUser?.role || '').toLowerCase();
    const isStaff = userRole === 'staff';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (isStaff && !isAdmin) {
      const staffPrefix = currentUser.mailboxPrefix || 
        (currentUser.mailboxEmail ? `${currentUser.mailboxEmail.split('@')[0].toLowerCase()}/` : `staff/${currentUser.email.split('@')[0].toLowerCase()}/`);
      const allowedCommon = ['support/', 'incoming/', 'info/', this.defaultPrefix];
      const isAllowed = (staffPrefix && key.startsWith(staffPrefix)) || allowedCommon.some(p => key.startsWith(p)) || currentUser.canAccessSupport !== false;
      if (!isAllowed) {
        throw new ForbiddenException('You do not have permission to view this email.');
      }
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

      const subject = parsed.subject || '(No Subject)';
      const dateStr = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

      const attachments: MailAttachment[] = (parsed.attachments || []).map((att) => ({
        filename: att.filename || 'attachment',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || (att.content ? att.content.length : 0),
        content: att.content ? att.content.toString('base64') : undefined,
      }));

      // Run Spam & Junk Analysis
      const spamAnalysis = this.analyzeSpam(parsed);

      let detail: MailDetail = {
        id,
        key,
        from: fromText,
        to: toText,
        cc: ccText || undefined,
        bcc: bccText || undefined,
        replyTo: parsed.replyTo?.text || undefined,
        subject,
        date: dateStr,
        size: buffer.length,
        text: parsed.text || '',
        html: parsed.html || (parsed.text ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${parsed.text}</div>` : undefined),
        snippet: (parsed.text || '').slice(0, 140).replace(/\s+/g, ' ').trim(),
        attachments,
        folder: key.substring(0, key.lastIndexOf('/') + 1) || this.defaultPrefix,
        read: false,
        starred: false,
        trashed: false,
        isSpam: spamAnalysis.isSpam,
        spamScore: spamAnalysis.spamScore,
        spamVerdict: spamAnalysis.spamVerdict,
        virusVerdict: spamAnalysis.virusVerdict,
        spamReasons: spamAnalysis.spamReasons,
        authResults: spamAnalysis.authResults,
      };

      // When staff opens the email, record in DB that the mail was viewed and mark as read
      const effectiveUserId = userId || currentUser?.id || currentUser?.sub;
      detail = {
        ...detail,
        read: true,
      };

      if (effectiveUserId) {
        try {
          const st = await this.prisma.staffEmailState.upsert({
            where: {
              userId_emailId: { userId: effectiveUserId, emailId: id },
            },
            create: {
              userId: effectiveUserId,
              emailId: id,
              isRead: true,
              isStarred: false,
              isTrashed: false,
            },
            update: {
              isRead: true,
            },
          });
          detail = {
            ...detail,
            read: true,
            starred: Boolean(st.isStarred),
            trashed: Boolean(st.isTrashed),
            userSpamOverride: st.isSpam,
          };
          this.logger.log(`[MailService.getMailById] Automatically recorded email ${id} as READ in database for user ${effectiveUserId}`);
        } catch (dbErr: any) {
          this.logger.warn(`[MailService.getMailById] Could not record email as read in staffEmailState: ${dbErr.message}`);
        }
      }

      return detail;
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof BadRequestException || err instanceof ForbiddenException) throw err;
      this.logger.error(`[MailService.getMailById] Error loading key ${key}: ${err.message}`);
      throw new NotFoundException(`Could not read email: ${err.message}`);
    }
  }

  /**
   * Update read/star/trash/spam state for an email for a user
   */
  async updateEmailState(userId: string, emailId: string, dto: UpdateEmailStateDto) {
    const data: any = {};
    if (dto.isRead !== undefined) data.isRead = dto.isRead;
    if (dto.isStarred !== undefined) data.isStarred = dto.isStarred;
    if (dto.isTrashed !== undefined) data.isTrashed = dto.isTrashed;
    if (dto.isSpam !== undefined) data.isSpam = dto.isSpam;

    return this.prisma.staffEmailState.upsert({
      where: {
        userId_emailId: { userId, emailId },
      },
      create: {
        userId,
        emailId,
        isRead: dto.isRead ?? false,
        isStarred: dto.isStarred ?? false,
        isTrashed: dto.isTrashed ?? false,
        isSpam: dto.isSpam ?? null,
      },
      update: data,
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
   * Supports immediate dispatch or scheduled queueing
   */
  async sendEmail(dto: SendEmailDto, currentUser?: any) {
    await this.ensureUserMailboxContext(currentUser);
    if (!dto.to || (Array.isArray(dto.to) && dto.to.length === 0)) {
      throw new BadRequestException('Recipient "to" is required');
    }
    if (!dto.subject) {
      throw new BadRequestException('Email subject is required');
    }

    // ─── 1. Handle Delayed / Scheduled Send ─────────────────────────────────
    if (dto.scheduledAt) {
      const targetTime = new Date(dto.scheduledAt);
      if (!isNaN(targetTime.getTime()) && targetTime.getTime() > Date.now() + 15000) {
        const scheduled = await this.prisma.scheduledEmail.create({
          data: {
            userId: currentUser?.id || currentUser?.sub || null,
            to: Array.isArray(dto.to) ? dto.to : [dto.to],
            cc: Array.isArray(dto.cc) ? dto.cc : (dto.cc ? [dto.cc] : []),
            bcc: Array.isArray(dto.bcc) ? dto.bcc : (dto.bcc ? [dto.bcc] : []),
            subject: dto.subject,
            text: dto.text,
            html: dto.html,
            replyTo: dto.replyTo,
            attachments: dto.attachments ? (dto.attachments as any) : undefined,
            priority: dto.priority || 'normal',
            requestReadReceipt: !!dto.requestReadReceipt,
            scheduledAt: targetTime,
            status: 'PENDING',
          },
        });

        this.logger.log(
          `[MailService.sendEmail] Email queued in scheduled_emails table for ${targetTime.toISOString()} (Queue ID: ${scheduled.id})`,
        );

        if (dto.draftId) {
          try {
            await this.prisma.$executeRawUnsafe(
              `DELETE FROM "draft_emails" WHERE "id" = $1`,
              dto.draftId,
            );
            this.logger.log(`[MailService.sendEmail] Cleared draft ${dto.draftId} from database on schedule`);
          } catch {}
        }

        return {
          success: true,
          scheduled: true,
          scheduledId: scheduled.id,
          scheduledAt: scheduled.scheduledAt,
          message: `Email scheduled for dispatch on ${scheduled.scheduledAt.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST`,
        };
      }
    }

    // ─── 2. Immediate SES Dispatch ──────────────────────────────────────────
    return this.sendEmailImmediate(dto, currentUser);
  }

  /**
   * Helper to dispatch email immediately through AWS SES with MIME headers
   */
  async sendEmailImmediate(dto: SendEmailDto, currentUser?: any) {
    let senderEmail = this.mailFrom;
    let replyToEmail = this.replyTo;
    let activeMailbox: string | null = null;

    if (currentUser) {
      if (!currentUser.mailboxEmail) {
        try {
          const dbUser = await this.prisma.user.findUnique({
            where: { id: currentUser.id || currentUser.sub },
            select: { mailboxEmail: true, firstName: true, lastName: true },
          });
          if (dbUser?.mailboxEmail) {
            currentUser.mailboxEmail = dbUser.mailboxEmail;
          }
          if (dbUser?.firstName && !currentUser.firstName) currentUser.firstName = dbUser.firstName;
          if (dbUser?.lastName && !currentUser.lastName) currentUser.lastName = dbUser.lastName;
        } catch (e) {
          // ignore
        }
      }

      const userRole = (currentUser.role || '').toLowerCase();
      const isStaffOrAdmin = ['staff', 'admin', 'super_admin'].includes(userRole);
      activeMailbox = currentUser.mailboxEmail || (currentUser.email?.endsWith('@vidyaloans.in') ? currentUser.email : null);

      if (isStaffOrAdmin && activeMailbox) {
        const displayName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'VidyaLoans Staff';
        senderEmail = `"${displayName} (VidyaLoans)" <${activeMailbox}>`;
        replyToEmail = activeMailbox;
      }
    }

    const mailAttachments = (dto.attachments || []).map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
      contentType: att.contentType,
    }));

    // Build custom MIME headers for SES (Priority & Read Receipts)
    const customHeaders: Record<string, string> = {};

    // ─── Priority MIME Headers ────────────────────────────────────────────
    if (dto.priority === 'high') {
      customHeaders['X-Priority'] = '1 (Highest)';
      customHeaders['X-MSMail-Priority'] = 'High';
      customHeaders['Importance'] = 'High';
    } else if (dto.priority === 'low') {
      customHeaders['X-Priority'] = '5 (Lowest)';
      customHeaders['X-MSMail-Priority'] = 'Low';
      customHeaders['Importance'] = 'Low';
    } else {
      customHeaders['X-Priority'] = '3 (Normal)';
      customHeaders['X-MSMail-Priority'] = 'Normal';
      customHeaders['Importance'] = 'Normal';
    }

    // ─── Read Receipt MIME Headers ────────────────────────────────────────
    if (dto.requestReadReceipt) {
      const receiptTarget = (currentUser?.mailboxEmail) ? currentUser.mailboxEmail : (dto.replyTo || replyToEmail || senderEmail);
      customHeaders['Disposition-Notification-To'] = receiptTarget;
      customHeaders['Return-Receipt-To'] = receiptTarget;
      customHeaders['X-Confirm-Reading-To'] = receiptTarget;
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: senderEmail,
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      replyTo: (currentUser?.mailboxEmail) ? currentUser.mailboxEmail : (dto.replyTo || replyToEmail),
      subject: dto.subject,
      text: dto.text,
      html: dto.html || (dto.text ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${dto.text}</div>` : ''),
      attachments: mailAttachments,
      headers: customHeaders,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`[MailService.sendEmail] Dispatched email messageId: ${info.messageId} to ${JSON.stringify(dto.to)}`);

      // Persist sent email in database associated with this sender mailbox
      try {
        const extractCleanEmail = (str: string): string => {
          const match = str.match(/<([^>]+)>/);
          return (match ? match[1] : str).trim().toLowerCase();
        };
        const cleanSender = extractCleanEmail(activeMailbox || senderEmail || this.mailFrom);
        const displayName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'VidyaLoans Staff';
        const recordId = `sent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = new Date();
        const toArray = Array.isArray(dto.to) ? dto.to : [dto.to];
        const ccArray = dto.cc ? (Array.isArray(dto.cc) ? dto.cc : [dto.cc]) : [];
        const bccArray = dto.bcc ? (Array.isArray(dto.bcc) ? dto.bcc : [dto.bcc]) : [];
        const attachmentsSummary = (dto.attachments || []).map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
        }));

        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "sent_emails" (
            "id", "userId", "senderEmail", "senderName", "to", "cc", "bcc", "subject", "text", "html", "replyTo", "attachments", "priority", "requestReadReceipt", "messageId", "sentAt", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )`,
          recordId,
          currentUser?.id || currentUser?.sub || null,
          cleanSender,
          displayName,
          toArray,
          ccArray,
          bccArray,
          dto.subject || '(No Subject)',
          dto.text || null,
          dto.html || (dto.text ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${dto.text}</div>` : ''),
          dto.replyTo || replyToEmail || null,
          attachmentsSummary.length > 0 ? JSON.stringify(attachmentsSummary) : null,
          dto.priority || 'normal',
          Boolean(dto.requestReadReceipt),
          info.messageId || null,
          now,
          now,
          now,
        );
        this.logger.log(`[MailService.sendEmail] Stored sent email ${recordId} in database for mailbox "${cleanSender}"`);
      } catch (dbErr: any) {
        this.logger.warn(`[MailService.sendEmail] Non-fatal: could not store sent email in database: ${dbErr.message}`);
      }

      if (dto.draftId) {
        try {
          await this.prisma.$executeRawUnsafe(
            `DELETE FROM "draft_emails" WHERE "id" = $1`,
            dto.draftId,
          );
          this.logger.log(`[MailService.sendEmail] Cleared draft ${dto.draftId} from database on successful dispatch`);
        } catch (delErr: any) {
          this.logger.warn(`[MailService.sendEmail] Could not delete draft ${dto.draftId}: ${delErr.message}`);
        }
      }

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

  /**
   * Background worker running every minute to process due scheduled emails from the scheduled_emails queue table
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledEmails() {
    try {
      const now = new Date();
      const dueEmails = await this.prisma.scheduledEmail.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: now },
        },
        take: 25,
        orderBy: { scheduledAt: 'asc' },
      });

      if (!dueEmails.length) return;

      this.logger.log(
        `[ScheduledEmail Worker] Found ${dueEmails.length} due scheduled email(s) in queue ready for SES dispatch.`,
      );

      for (const email of dueEmails) {
        try {
          const res = await this.sendEmailImmediate(
            {
              to: email.to,
              cc: email.cc,
              bcc: email.bcc,
              subject: email.subject,
              text: email.text || undefined,
              html: email.html || undefined,
              replyTo: email.replyTo || undefined,
              attachments: (email.attachments as any) || undefined,
              priority: (email.priority as any) || 'normal',
              requestReadReceipt: email.requestReadReceipt,
            },
            { id: email.userId },
          );

          await this.prisma.scheduledEmail.update({
            where: { id: email.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              messageId: res.messageId,
            },
          });

          this.logger.log(
            `[ScheduledEmail Worker] Successfully dispatched scheduled email ${email.id} to ${JSON.stringify(email.to)} (MessageID: ${res.messageId})`,
          );
        } catch (err: any) {
          await this.prisma.scheduledEmail.update({
            where: { id: email.id },
            data: {
              status: 'FAILED',
              failedReason: err.message || 'SES dispatch error',
            },
          });
          this.logger.error(
            `[ScheduledEmail Worker] Failed to dispatch scheduled email ${email.id}: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('Connection terminated') ||
        errMsg.includes('connection closed') ||
        errMsg.includes('closed the connection') ||
        errMsg.includes('Connection terminated unexpectedly')
      ) {
        this.logger.warn(`[ScheduledEmail Worker] Database connection warming up / temporarily unreachable. Will retry on next tick.`);
      } else {
        this.logger.error(`[ScheduledEmail Worker] Queue processing error: ${errMsg}`);
      }
    }
  }

  /**
   * List scheduled emails for current user
   */
  async getScheduledEmails(userId?: string, currentUser?: any) {
    const isSuperAdmin = currentUser?.role?.toLowerCase()?.includes('admin');
    const uid = userId || currentUser?.id || currentUser?.sub;
    const where: any = {};
    if (!isSuperAdmin && uid) {
      where.userId = uid;
    }

    return this.prisma.scheduledEmail.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Cancel a scheduled email before it is sent
   */
  async cancelScheduledEmail(id: string, userId?: string, currentUser?: any) {
    const email = await this.prisma.scheduledEmail.findUnique({
      where: { id },
    });

    if (!email) {
      throw new NotFoundException('Scheduled email not found');
    }

    const isSuperAdmin = currentUser?.role?.toLowerCase()?.includes('admin');
    const uid = userId || currentUser?.id || currentUser?.sub;
    if (!isSuperAdmin && uid && email.userId && email.userId !== uid) {
      throw new ForbiddenException('Not authorized to cancel this scheduled email');
    }

    if (email.status !== 'PENDING') {
      throw new BadRequestException(`Cannot cancel email with status '${email.status}'`);
    }

    const updated = await this.prisma.scheduledEmail.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return updated;
  }

  /**
   * Daily Cron: Automatically purge trash emails older than 60 days across all users
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredTrashEmails() {
    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const res = await this.prisma.staffEmailState.deleteMany({
        where: {
          isTrashed: true,
          updatedAt: { lt: sixtyDaysAgo },
        },
      });
      if (res.count > 0) {
        this.logger.log(`[MailService.purgeExpiredTrashEmails] Automatically purged ${res.count} trash email records older than 60 days.`);
      }
    } catch (err: any) {
      this.logger.warn(`[MailService.purgeExpiredTrashEmails] Error purging expired trash: ${err.message}`);
    }
  }

  /**
   * Retrieves sent emails for a given mailbox from the database
   */
  async getSentEmails(mailboxEmail?: string, currentUser?: any, folder?: string) {
    await this.ensureUserMailboxContext(currentUser);

    let cleanTarget = (mailboxEmail || '').trim().toLowerCase();
    
    // If no explicit mailboxEmail provided, deduce from folder or user context
    if (!cleanTarget && folder) {
      const cleanFolder = folder.replace(/\/$/, '').toLowerCase();
      if (cleanFolder.includes('@')) {
        cleanTarget = cleanFolder;
      } else if (cleanFolder === 'support') {
        cleanTarget = 'support@vidyaloans.in';
      }
    }

    if (!cleanTarget) {
      cleanTarget = (currentUser?.mailboxEmail || currentUser?.email || 'support@vidyaloans.in').trim().toLowerCase();
    }

    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin = ['admin', 'super_admin'].includes(userRole);

    try {
      let rows: any[] = [];
      if (cleanTarget) {
        rows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "sent_emails"
           WHERE LOWER("senderEmail") = LOWER($1)
           ORDER BY "sentAt" DESC
           LIMIT 100`,
          cleanTarget,
        );
      } else if (isAdmin) {
        rows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "sent_emails"
           ORDER BY "sentAt" DESC
           LIMIT 100`,
        );
      }

      return rows.map((r) => ({
        id: r.id,
        key: `sent/${r.id}`,
        from: r.senderName ? `"${r.senderName}" <${r.senderEmail}>` : r.senderEmail,
        senderEmail: r.senderEmail,
        senderName: r.senderName,
        to: Array.isArray(r.to) ? r.to.join(', ') : (r.to || ''),
        cc: Array.isArray(r.cc) ? r.cc.join(', ') : (r.cc || ''),
        bcc: Array.isArray(r.bcc) ? r.bcc.join(', ') : (r.bcc || ''),
        subject: r.subject || '(No Subject)',
        snippet: r.text ? r.text.substring(0, 160) : (r.html ? r.html.replace(/<[^>]+>/g, '').substring(0, 160) : ''),
        body: r.html || r.text || '',
        text: r.text,
        html: r.html,
        date: r.sentAt ? new Date(r.sentAt).toISOString() : new Date().toISOString(),
        sentAt: r.sentAt,
        priority: r.priority || 'normal',
        requestReadReceipt: r.requestReadReceipt,
        messageId: r.messageId,
        attachments: r.attachments ? (typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments) : [],
        read: true,
        size: 0,
        isSpam: false,
        spamScore: 0,
        spamReasons: [],
      }));
    } catch (err: any) {
      this.logger.error(`[MailService.getSentEmails] Failed to query sent_emails: ${err.message}`);
      return [];
    }
  }

  /**
   * Save or update draft email in database with respective mailbox address
   */
  async saveDraft(dto: SaveDraftDto, currentUser?: any) {
    await this.ensureDraftEmailsTable();
    await this.ensureUserMailboxContext(currentUser);

    const draftId = dto.id && dto.id.trim() ? dto.id.trim() : `draft-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const userId = currentUser?.id || currentUser?.sub || null;

    let senderEmail = (dto.senderEmail || '').trim().toLowerCase();
    if (!senderEmail) {
      senderEmail = (
        currentUser?.mailboxEmail ||
        (currentUser?.email?.endsWith('@vidyaloans.in') ? currentUser.email : null) ||
        currentUser?.email ||
        'support@vidyaloans.in'
      ).trim().toLowerCase();
    }

    const senderName =
      dto.senderName ||
      `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() ||
      currentUser?.name ||
      'VidyaLoans Staff';

    const toArray = dto.to
      ? Array.isArray(dto.to)
        ? dto.to.map((t) => t.trim()).filter(Boolean)
        : dto.to.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    const ccArray = dto.cc
      ? Array.isArray(dto.cc)
        ? dto.cc.map((c) => c.trim()).filter(Boolean)
        : dto.cc.split(',').map((c) => c.trim()).filter(Boolean)
      : [];
    const bccArray = dto.bcc
      ? Array.isArray(dto.bcc)
        ? dto.bcc.map((b) => b.trim()).filter(Boolean)
        : dto.bcc.split(',').map((b) => b.trim()).filter(Boolean)
      : [];

    const bodyContent = dto.body || dto.html || dto.text || '';
    const text = dto.text || (bodyContent ? bodyContent.replace(/<[^>]+>/g, '').trim() : '');
    const html = dto.html || (bodyContent ? bodyContent : (text ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${text}</div>` : ''));

    const attachmentsJson =
      dto.attachments && Array.isArray(dto.attachments) && dto.attachments.length > 0
        ? JSON.stringify(
            dto.attachments.map((att) => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size || att.content?.length,
            })),
          )
        : null;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "draft_emails" (
        "id", "userId", "senderEmail", "senderName", "to", "cc", "bcc", "subject", "text", "html", "replyTo", "attachments", "priority", "requestReadReceipt", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("id") DO UPDATE SET
        "senderEmail" = EXCLUDED."senderEmail",
        "senderName" = EXCLUDED."senderName",
        "to" = EXCLUDED."to",
        "cc" = EXCLUDED."cc",
        "bcc" = EXCLUDED."bcc",
        "subject" = EXCLUDED."subject",
        "text" = EXCLUDED."text",
        "html" = EXCLUDED."html",
        "replyTo" = EXCLUDED."replyTo",
        "attachments" = EXCLUDED."attachments",
        "priority" = EXCLUDED."priority",
        "requestReadReceipt" = EXCLUDED."requestReadReceipt",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *`,
      draftId,
      userId,
      senderEmail,
      senderName,
      toArray,
      ccArray,
      bccArray,
      dto.subject || '(Untitled Draft)',
      text,
      html,
      dto.replyTo || null,
      attachmentsJson,
      dto.priority || 'normal',
      Boolean(dto.requestReadReceipt),
    );

    const saved = rows[0];
    this.logger.log(
      `[MailService.saveDraft] Saved dynamic draft "${saved.id}" with sender "${senderEmail}" and recipient "${toArray.join(', ')}" in database`,
    );

    return this.mapDraftRow(saved);
  }

  /**
   * Get draft emails stored in database for respective mailbox / user
   */
  async getDrafts(mailboxEmail?: string, currentUser?: any, folder?: string) {
    await this.ensureDraftEmailsTable();
    await this.ensureUserMailboxContext(currentUser);

    let cleanTarget = (mailboxEmail || '').trim().toLowerCase();
    if (!cleanTarget && folder) {
      const cleanFolder = folder.replace(/\/$/, '').toLowerCase();
      if (cleanFolder.includes('@')) {
        cleanTarget = cleanFolder;
      } else if (cleanFolder === 'support') {
        cleanTarget = 'support@vidyaloans.in';
      }
    }

    if (!cleanTarget) {
      cleanTarget = (
        currentUser?.mailboxEmail ||
        (currentUser?.email?.endsWith('@vidyaloans.in') ? currentUser.email : null) ||
        currentUser?.email ||
        'support@vidyaloans.in'
      ).trim().toLowerCase();
    }

    const userId = currentUser?.id || currentUser?.sub || null;
    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin = ['admin', 'super_admin'].includes(userRole);

    let rows: any[] = [];
    try {
      if (cleanTarget) {
        rows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "draft_emails"
           WHERE LOWER("senderEmail") = LOWER($1) OR ($2::TEXT IS NOT NULL AND "userId" = $2)
           ORDER BY "updatedAt" DESC
           LIMIT 100`,
          cleanTarget,
          userId,
        );
      } else if (isAdmin) {
        rows = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "draft_emails"
           ORDER BY "updatedAt" DESC
           LIMIT 100`,
        );
      }
    } catch (err: any) {
      this.logger.error(`[MailService.getDrafts] Failed to query draft_emails: ${err.message}`);
      return [];
    }

    return rows.map((r) => this.mapDraftRow(r));
  }

  /**
   * Get single draft by id
   */
  async getDraftById(id: string, currentUser?: any) {
    await this.ensureDraftEmailsTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "draft_emails" WHERE "id" = $1 LIMIT 1`,
      id,
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Draft email '${id}' not found`);
    }
    return this.mapDraftRow(rows[0]);
  }

  /**
   * Delete draft email by id from database
   */
  async deleteDraft(id: string, currentUser?: any) {
    await this.ensureDraftEmailsTable();
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "draft_emails" WHERE "id" = $1`,
      id,
    );
    this.logger.log(`[MailService.deleteDraft] Deleted draft ${id} from database`);
    return { success: true, id };
  }

  private mapDraftRow(r: any) {
    const toStr = Array.isArray(r.to) ? r.to.join(', ') : (r.to || '');
    const ccStr = Array.isArray(r.cc) ? r.cc.join(', ') : (r.cc || '');
    const bccStr = Array.isArray(r.bcc) ? r.bcc.join(', ') : (r.bcc || '');
    const body = r.html || r.text || '';
    const snippet = r.text
      ? r.text.substring(0, 160)
      : (r.html ? r.html.replace(/<[^>]+>/g, '').substring(0, 160) : '(Empty draft body)');

    return {
      id: r.id,
      key: `draft/${r.id}`,
      from: 'Draft',
      senderEmail: r.senderEmail,
      senderName: r.senderName,
      to: toStr,
      toArray: r.to || [],
      cc: ccStr,
      ccArray: r.cc || [],
      bcc: bccStr,
      bccArray: r.bcc || [],
      subject: r.subject || '(Untitled Draft)',
      body,
      text: r.text || '',
      html: r.html || '',
      snippet,
      replyTo: r.replyTo || '',
      priority: r.priority || 'normal',
      requestReadReceipt: Boolean(r.requestReadReceipt),
      attachments: r.attachments
        ? (typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments)
        : [],
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      date: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      isDraft: true,
      rawDraft: {
        id: r.id,
        to: toStr,
        cc: ccStr,
        bcc: bccStr,
        subject: r.subject || '',
        body,
        replyTo: r.replyTo || '',
        senderEmail: r.senderEmail,
        priority: r.priority || 'normal',
        requestReadReceipt: Boolean(r.requestReadReceipt),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      },
    };
  }
}

