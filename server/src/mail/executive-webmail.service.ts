import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { randomUUID, createHash } from 'crypto';
import { S3Client, CopyObjectCommand, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { simpleParser } from 'mailparser';

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
    await this.ensureExecutiveStateTable();
    await this.ensureExecutiveInboundTable();
  }

  // Password hashing utility using SHA-256 + secret salt
  private hashPassword(password: string): string {
    const salt = this.config.get<string>('JWT_SECRET') || 'vidyaloans_executive_secure_salt_2026';
    return createHash('sha256').update(password + salt).digest('hex');
  }

  // Initialize DB tables
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

  async ensureExecutiveStateTable() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "executive_email_state" (
          "id" TEXT PRIMARY KEY,
          "userEmail" TEXT NOT NULL,
          "emailId" TEXT NOT NULL,
          "isRead" BOOLEAN NOT NULL DEFAULT false,
          "isStarred" BOOLEAN NOT NULL DEFAULT false,
          "isTrashed" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("userEmail", "emailId")
        );
        CREATE INDEX IF NOT EXISTS "executive_email_state_userEmail_idx" ON "executive_email_state"("userEmail");
        CREATE INDEX IF NOT EXISTS "executive_email_state_emailId_idx" ON "executive_email_state"("emailId");
      `);
    } catch (err: any) {
      this.logger.warn('[ExecutiveWebmailService] executive_email_state table notice: ' + err.message);
    }
  }

  async ensureExecutiveInboundTable() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "executive_inbound_emails" (
          "id" TEXT PRIMARY KEY,
          "mailboxEmail" TEXT NOT NULL,
          "messageId" TEXT,
          "from" TEXT NOT NULL,
          "to" TEXT,
          "cc" TEXT,
          "bcc" TEXT,
          "subject" TEXT NOT NULL,
          "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "snippet" TEXT,
          "text" TEXT,
          "html" TEXT,
          "attachments" JSONB,
          "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
          "isRead" BOOLEAN NOT NULL DEFAULT false,
          "isStarred" BOOLEAN NOT NULL DEFAULT false,
          "isTrashed" BOOLEAN NOT NULL DEFAULT false,
          "isSpam" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "executive_inbound_emails_mailboxEmail_idx" ON "executive_inbound_emails"("mailboxEmail");
        CREATE INDEX IF NOT EXISTS "executive_inbound_emails_date_idx" ON "executive_inbound_emails"("date");
      `);
    } catch (err: any) {
      this.logger.warn('[ExecutiveWebmailService] executive_inbound_emails table notice: ' + err.message);
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
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid executive token payload');
      }

      // Check current DB record to get latest s3Prefix and ensure account is active
      const cleanEmail = payload.email.toLowerCase().trim();
      const rows: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT "id", "email", "name", "title", "s3Prefix", "status"
        FROM "executive_mailboxes"
        WHERE LOWER("email") = '${cleanEmail}'
        LIMIT 1;
      `);

      const dbUser = rows && rows[0] ? rows[0] : null;
      let effectivePrefix = dbUser ? dbUser.s3Prefix : payload.s3Prefix;

      return {
        id: dbUser ? dbUser.id : (payload.id || payload.sub),
        email: payload.email,
        name: dbUser ? dbUser.name : (payload.name || 'Executive Official'),
        title: dbUser ? dbUser.title : (payload.title || 'Official'),
        s3Prefix: effectivePrefix || `${cleanEmail.split('@')[0]}/`,
        status: dbUser ? dbUser.status : 'active',
        createdAt: new Date(),
      };
    } catch (e: any) {
      throw new UnauthorizedException('Session expired or invalid. Please log in again.');
    }
  }

  /**
   * Automatically discovers and syncs incoming SES emails deposited in shared/catch-all
   * prefixes (like privacy/, incoming/, support/) into the official's dedicated folder.
   */
  private async syncInboundSES(cleanEmail: string, cleanPrefix: string): Promise<void> {
    const bucket = (this.mailService as any).bucketName || 'vidyaloans-incoming-emails';
    const s3: S3Client = (this.mailService as any).s3Client;
    if (!s3) return;

    const candidatePrefixes = ['privacy/', 'incoming/'];
    if (cleanPrefix !== 'support/') {
      candidatePrefixes.push('support/');
    }

    const username = cleanEmail.split('@')[0].toLowerCase();

    for (const prefix of candidatePrefixes) {
      if (prefix === cleanPrefix) continue;
      try {
        const listCmd = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 40,
        });
        const listRes = await s3.send(listCmd);
        const objects = (listRes.Contents || []).filter(
          (o: any) => o.Key && !o.Key.endsWith('/') && (o.Size || 0) > 600,
        );

        for (const obj of objects) {
          const fileName = obj.Key.split('/').pop();
          if (!fileName) continue;
          const targetKey = `${cleanPrefix}${fileName}`;

          try {
            // Check if already synced to avoid redundant downloads
            try {
              await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: targetKey }));
              continue; // Target already exists!
            } catch {
              // Not yet synced, proceed to inspect recipient
            }

            const getCmd = new GetObjectCommand({
              Bucket: bucket,
              Key: obj.Key,
            });
            const getRes = await s3.send(getCmd);
            if (!getRes.Body) continue;

            const chunks: Buffer[] = [];
            for await (const chunk of getRes.Body as any) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const buffer = Buffer.concat(chunks);
            const parsed = await simpleParser(buffer);

            const toText = Array.isArray(parsed.to)
              ? parsed.to.map((t: any) => t.text).join(' ').toLowerCase()
              : (parsed.to?.text || '').toLowerCase();
            const ccText = Array.isArray(parsed.cc)
              ? parsed.cc.map((t: any) => t.text).join(' ').toLowerCase()
              : (parsed.cc?.text || '').toLowerCase();

            const isMatch =
              toText.includes(cleanEmail) ||
              toText.includes(username) ||
              ccText.includes(cleanEmail) ||
              ccText.includes(username) ||
              (cleanEmail === 'support@vidyaloans.in' && (toText.includes('vidyaloans.in') || toText === ''));

            if (isMatch) {
              await s3.send(
                new CopyObjectCommand({
                  Bucket: bucket,
                  CopySource: `${bucket}/${obj.Key}`,
                  Key: targetKey,
                }),
              );
              this.logger.log(
                `[ExecutiveWebmail] Auto-synced inbound SES email ${obj.Key} -> ${targetKey} for ${cleanEmail}`,
              );
            }
          } catch (itemErr: any) {
            // Ignore individual parse/copy errors
          }
        }
      } catch (err: any) {
        this.logger.warn(`[ExecutiveWebmail] Notice scanning shared prefix ${prefix}: ${err.message}`);
      }
    }
  }

  // List emails for the logged-in official (Dynamically supports Inbox, Sent, Starred, Trash)
  async getInbox(user: ExecutiveMailboxUser, folder = 'inbox') {
    const cleanEmail = user.email.trim().toLowerCase();
    let cleanPrefix = user.s3Prefix || `${cleanEmail.split('@')[0]}/`;
    if (!cleanPrefix.endsWith('/')) cleanPrefix += '/';

    const currentUser = {
      id: user.id,
      email: cleanEmail,
      role: 'executive_official',
      mailboxEmail: cleanEmail,
      mailboxPrefix: cleanPrefix,
    };

    // ─── 1. SENT FOLDER: Fetch directly from database sent_emails table ──────
    if (folder === 'sent') {
      try {
        const sentRows = await this.mailService.getSentEmails(cleanEmail, currentUser, 'sent');
        this.logger.log(`[ExecutiveWebmail] Found ${sentRows.length} sent emails for ${cleanEmail}`);

        const mappedSent = sentRows.map((s: any) => ({
          id: s.id,
          key: s.key || `sent/${s.id}`,
          from: s.from || (s.senderName ? `"${s.senderName}" <${s.senderEmail}>` : s.senderEmail),
          to: s.to || '',
          subject: s.subject || '(No Subject)',
          date: s.date || s.sentAt || new Date().toISOString(),
          snippet: s.snippet || s.text || (s.html ? s.html.replace(/<[^>]+>/g, '').substring(0, 140) : ''),
          hasAttachments: Boolean(s.attachments && s.attachments.length > 0),
          isRead: true,
          isSent: true,
          isStarred: Boolean(s.starred),
          isTrashed: false,
        }));

        return {
          success: true,
          data: mappedSent,
          total: mappedSent.length,
        };
      } catch (err: any) {
        this.logger.error(`[ExecutiveWebmail] Error reading sent emails: ${err.message}`);
        return { success: true, data: [], total: 0 };
      }
    }

    // ─── 1.5 DRAFTS FOLDER: Fetch directly from database draft_emails table ───
    if (folder === 'drafts') {
      try {
        const drafts = await this.mailService.getDrafts(cleanEmail, currentUser);
        this.logger.log(`[ExecutiveWebmail] Found ${drafts.length} drafts for ${cleanEmail}`);

        const mappedDrafts = drafts.map((d: any) => ({
          id: d.id,
          key: `drafts/${d.id}`,
          from: d.senderEmail || cleanEmail,
          to: d.to || '',
          cc: d.cc || '',
          bcc: d.bcc || '',
          subject: d.subject || '(Untitled Draft)',
          date: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
          snippet: d.snippet || d.text || '',
          text: d.text || '',
          html: d.html || '',
          hasAttachments: Boolean(d.attachments && d.attachments.length > 0),
          isRead: true,
          isDraft: true,
          isStarred: false,
          isTrashed: false,
        }));

        return {
          success: true,
          data: mappedDrafts,
          total: mappedDrafts.length,
        };
      } catch (err: any) {
        this.logger.error(`[ExecutiveWebmail] Error reading drafts: ${err.message}`);
        return { success: true, data: [], total: 0 };
      }
    }

    // ─── 2. INBOX / STARRED / TRASH: Read S3 objects + merge user state ─────
    this.logger.log(`[ExecutiveWebmail] Fetching incoming emails for ${cleanEmail} in prefix: ${cleanPrefix}`);

    try {
      // Auto-sync any fresh inbound emails from shared SES receipt prefixes (privacy/, incoming/)
      await this.syncInboundSES(cleanEmail, cleanPrefix).catch((e) => {
        this.logger.warn(`[ExecutiveWebmail] syncInboundSES notice: ${e.message}`);
      });

      let emails = await this.mailService.listSupport(cleanPrefix, cleanEmail, user.id, currentUser).catch(() => []);

      // If folder has 0 emails and prefix starts with officials/, try without officials/
      if ((!emails || emails.length === 0) && cleanPrefix.startsWith('officials/')) {
        const altPrefix = cleanPrefix.replace(/^officials\//, '');
        emails = await this.mailService.listSupport(altPrefix, cleanEmail, user.id, currentUser).catch(() => []);
      }

      // Persist any retrieved emails with their dates into the database
      if (Array.isArray(emails) && emails.length > 0) {
        for (const e of emails) {
          try {
            const emailDate = e.date ? new Date(e.date) : new Date();
            await this.prisma.$executeRawUnsafe(
              `INSERT INTO "executive_inbound_emails" (
                "id", "mailboxEmail", "from", "to", "subject", "date", "snippet", "hasAttachments", "createdAt", "updatedAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
              ON CONFLICT ("id") DO UPDATE SET
                "date" = EXCLUDED."date",
                "updatedAt" = NOW();`,
              e.id,
              cleanEmail,
              e.from || '',
              e.to || '',
              e.subject || '(No Subject)',
              emailDate,
              e.snippet || '',
              Boolean(e.attachments && e.attachments.length > 0) || (e.snippet && e.snippet.includes('attachment')),
            );
          } catch {}
        }
      }

      // Query persistent database inbound emails
      const dbEmails: any[] = (await this.prisma
        .$queryRawUnsafe(
          `SELECT "id", "mailboxEmail", "from", "to", "subject", "date", "snippet", "hasAttachments", "isRead", "isStarred", "isTrashed", "isSpam"
           FROM "executive_inbound_emails"
           WHERE "mailboxEmail" = $1
           ORDER BY "date" DESC;`,
          cleanEmail,
        )
        .catch(() => [])) as any[];

      // Load persistent user email state (read, starred, trashed) from executive_email_state
      const states: any[] = (await this.prisma
        .$queryRawUnsafe(
          `SELECT "emailId", "isRead", "isStarred", "isTrashed"
           FROM "executive_email_state"
           WHERE "userEmail" = $1;`,
          cleanEmail,
        )
        .catch(() => [])) as any[];

      const stateMap = new Map<string, any>();
      states.forEach((s) => stateMap.set(s.emailId, s));

      // Use database emails if available, otherwise fallback to emails from S3
      const sourceList = dbEmails.length > 0 ? dbEmails : emails;

      // Map to consistent UI WebmailMessage model with accurate database dates
      let mapped = sourceList.map((e: any) => {
        const st = stateMap.get(e.id);
        const isoDate = e.date
          ? (e.date instanceof Date ? e.date.toISOString() : new Date(e.date).toISOString())
          : new Date().toISOString();

        return {
          id: e.id,
          key: e.key || e.id,
          from: e.from,
          to: e.to,
          subject: e.subject || '(No Subject)',
          date: isoDate,
          snippet: e.snippet || '',
          hasAttachments: Boolean(e.hasAttachments || (e.attachments && e.attachments.length > 0) || (e.snippet && e.snippet.includes('attachment'))),
          isRead: st ? Boolean(st.isRead) : Boolean(e.isRead ?? e.read),
          isStarred: st ? Boolean(st.isStarred) : Boolean(e.isStarred ?? e.starred),
          isTrashed: st ? Boolean(st.isTrashed) : Boolean(e.isTrashed ?? e.trashed),
          isSpam: Boolean(e.isSpam),
        };
      });

      // Apply folder filtering
      if (folder === 'starred') {
        mapped = mapped.filter((e) => e.isStarred && !e.isTrashed);
      } else if (folder === 'trash') {
        mapped = mapped.filter((e) => e.isTrashed);
      } else {
        // Standard Inbox: omit trashed emails
        mapped = mapped.filter((e) => !e.isTrashed);
      }

      return {
        success: true,
        data: mapped,
        total: mapped.length,
      };
    } catch (err: any) {
      this.logger.error(`[ExecutiveWebmail] Error reading incoming emails: ${err.message}`);
      return {
        success: true,
        data: [],
        total: 0,
      };
    }
  }

  // Get live aggregated mailbox counts for sidebar badges
  async getMailStats(user: ExecutiveMailboxUser) {
    const cleanEmail = user.email.trim().toLowerCase();
    let cleanPrefix = user.s3Prefix || `${cleanEmail.split('@')[0]}/`;
    if (!cleanPrefix.endsWith('/')) cleanPrefix += '/';

    const currentUser = {
      id: user.id,
      email: cleanEmail,
      role: 'executive_official',
      mailboxEmail: cleanEmail,
      mailboxPrefix: cleanPrefix,
    };

    try {
      const [incomingEmails, sentEmails, drafts] = await Promise.all([
        this.mailService.listSupport(cleanPrefix, cleanEmail, user.id, currentUser).catch(() => []),
        this.mailService.getSentEmails(cleanEmail, currentUser, 'sent').catch(() => []),
        this.mailService.getDrafts(cleanEmail, currentUser).catch(() => []),
      ]);

      const states: any[] = (await this.prisma
        .$queryRawUnsafe(
          `SELECT "emailId", "isRead", "isStarred", "isTrashed"
           FROM "executive_email_state"
           WHERE "userEmail" = $1;`,
          cleanEmail,
        )
        .catch(() => [])) as any[];

      const stateMap = new Map<string, any>();
      states.forEach((s) => stateMap.set(s.emailId, s));

      const mergedIncoming = incomingEmails.map((e: any) => {
        const st = stateMap.get(e.id);
        return {
          ...e,
          read: st ? Boolean(st.isRead) : Boolean(e.read),
          starred: st ? Boolean(st.isStarred) : Boolean(e.starred),
          trashed: st ? Boolean(st.isTrashed) : Boolean(e.trashed),
        };
      });

      const inboxCount = mergedIncoming.filter((e: any) => !e.trashed && !e.isSpam).length;
      const unreadCount = mergedIncoming.filter((e: any) => !e.read && !e.trashed && !e.isSpam).length;
      const starredCount = mergedIncoming.filter((e: any) => e.starred && !e.trashed).length;
      const trashCount = mergedIncoming.filter((e: any) => e.trashed).length;
      const sentCount = sentEmails.length;
      const draftCount = drafts.length;
      const totalBytes = (mergedIncoming as any[]).reduce((acc: number, e: any) => acc + (Number(e.size) || 0), 0);

      return {
        success: true,
        data: {
          inbox: inboxCount,
          unread: unreadCount,
          sent: sentCount,
          drafts: draftCount,
          starred: starredCount,
          trash: trashCount,
          storage: {
            usedBytes: totalBytes,
            quotaBytes: 15 * 1024 * 1024 * 1024,
            formattedUsed: `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
          },
        },
      };
    } catch (err: any) {
      this.logger.error(`[ExecutiveWebmail] Error computing stats: ${err.message}`);
      return {
        success: true,
        data: {
          inbox: 0,
          unread: 0,
          sent: 0,
          starred: 0,
          trash: 0,
          storage: { usedBytes: 0, quotaBytes: 15 * 1024 * 1024 * 1024, formattedUsed: '0 MB' },
        },
      };
    }
  }

  // Read single email content (from DB or S3 for incoming, or DB for sent)
  async getEmailDetail(user: ExecutiveMailboxUser, id: string) {
    const cleanEmail = user.email.trim().toLowerCase();
    const currentUser = {
      id: user.id,
      email: cleanEmail,
      role: 'executive_official',
      mailboxEmail: cleanEmail,
      mailboxPrefix: user.s3Prefix,
    };

    // 1. Sent emails: fetch directly from database sent_emails table
    if (id.startsWith('sent_') || id.startsWith('sent-')) {
      const sentRows: any[] = (await this.prisma
        .$queryRawUnsafe(`SELECT * FROM "sent_emails" WHERE "id" = $1 LIMIT 1;`, id)
        .catch(() => [])) as any[];
      if (sentRows.length > 0) {
        const s = sentRows[0];
        const sentDate = s.sentAt ? new Date(s.sentAt).toISOString() : new Date().toISOString();
        return {
          id: s.id,
          from: s.senderName ? `"${s.senderName}" <${s.senderEmail}>` : s.senderEmail,
          to: Array.isArray(s.to) ? s.to.join(', ') : (s.to || ''),
          cc: Array.isArray(s.cc) ? s.cc.join(', ') : (s.cc || ''),
          bcc: Array.isArray(s.bcc) ? s.bcc.join(', ') : (s.bcc || ''),
          subject: s.subject || '(No Subject)',
          date: sentDate,
          text: s.text || '',
          html: s.html || '',
          attachments: s.attachments || [],
          isSent: true,
          read: true,
        };
      }
    }

    // 1.5 Draft emails: fetch directly from database draft_emails table
    if (id.startsWith('draft_') || id.startsWith('draft-')) {
      const draftRows: any[] = (await this.prisma
        .$queryRawUnsafe(`SELECT * FROM "draft_emails" WHERE "id" = $1 LIMIT 1;`, id)
        .catch(() => [])) as any[];
      if (draftRows.length > 0) {
        const d = draftRows[0];
        const draftDate = d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString();
        return {
          id: d.id,
          from: d.senderEmail || cleanEmail,
          to: Array.isArray(d.to) ? d.to.join(', ') : (d.to || ''),
          cc: Array.isArray(d.cc) ? d.cc.join(', ') : (d.cc || ''),
          bcc: Array.isArray(d.bcc) ? d.bcc.join(', ') : (d.bcc || ''),
          subject: d.subject || '',
          date: draftDate,
          text: d.text || '',
          html: d.html || '',
          attachments: d.attachments || [],
          isDraft: true,
          read: true,
        };
      }
    }

    // 2. Incoming emails: check database executive_inbound_emails first
    const dbRows: any[] = (await this.prisma
      .$queryRawUnsafe(`SELECT * FROM "executive_inbound_emails" WHERE "id" = $1 LIMIT 1;`, id)
      .catch(() => [])) as any[];

    let detail = await this.mailService.getMailById(id, user.id, currentUser).catch(() => null);

    if (dbRows.length > 0) {
      const row = dbRows[0];
      const savedDate = row.date ? new Date(row.date).toISOString() : new Date().toISOString();
      if (!detail) {
        detail = {
          id: row.id,
          from: row.from,
          to: row.to || '',
          cc: row.cc || '',
          bcc: row.bcc || '',
          subject: row.subject || '(No Subject)',
          date: savedDate,
          text: row.text || '',
          html: row.html || '',
          attachments: row.attachments || [],
        };
      } else {
        detail.date = savedDate;
      }
    } else if (detail) {
      try {
        const detailDate = detail.date ? new Date(detail.date) : new Date();
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "executive_inbound_emails" (
            "id", "mailboxEmail", "from", "to", "cc", "bcc", "subject", "date", "text", "html", "attachments", "hasAttachments", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          ON CONFLICT ("id") DO UPDATE SET
            "date" = EXCLUDED."date",
            "text" = EXCLUDED."text",
            "html" = EXCLUDED."html",
            "attachments" = EXCLUDED."attachments",
            "updatedAt" = NOW();`,
          id,
          cleanEmail,
          detail.from || '',
          detail.to || '',
          detail.cc || '',
          detail.bcc || '',
          detail.subject || '(No Subject)',
          detailDate,
          detail.text || '',
          detail.html || '',
          detail.attachments ? JSON.stringify(detail.attachments) : null,
          Boolean(detail.attachments && detail.attachments.length > 0),
        );
      } catch {}
    }

    // Auto mark as read in persistent database state
    if (!id.startsWith('sent_') && !id.startsWith('sent-')) {
      await this.updateEmailState(user, id, { read: true }).catch(() => {});
    }

    return detail;
  }

  // Update read/starred/trash state
  async updateEmailState(user: ExecutiveMailboxUser, id: string, dto: { read?: boolean; starred?: boolean; trashed?: boolean }) {
    await this.ensureExecutiveStateTable();
    const cleanEmail = user.email.trim().toLowerCase();

    try {
      const existing: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT "id", "isRead", "isStarred", "isTrashed"
         FROM "executive_email_state"
         WHERE "userEmail" = $1 AND "emailId" = $2
         LIMIT 1;`,
        cleanEmail,
        id,
      );

      const isRead = dto.read !== undefined ? dto.read : (existing[0]?.isRead ?? false);
      const isStarred = dto.starred !== undefined ? dto.starred : (existing[0]?.isStarred ?? false);
      const isTrashed = dto.trashed !== undefined ? dto.trashed : (existing[0]?.isTrashed ?? false);

      if (existing.length > 0) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "executive_email_state"
           SET "isRead" = $1, "isStarred" = $2, "isTrashed" = $3, "updatedAt" = NOW()
           WHERE "userEmail" = $4 AND "emailId" = $5;`,
          isRead,
          isStarred,
          isTrashed,
          cleanEmail,
          id,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "executive_email_state" ("id", "userEmail", "emailId", "isRead", "isStarred", "isTrashed", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
          randomUUID(),
          cleanEmail,
          id,
          isRead,
          isStarred,
          isTrashed,
        );
      }

      return { success: true, message: 'Email state updated successfully' };
    } catch (err: any) {
      this.logger.warn(`[ExecutiveWebmail] Could not update email state: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  // Delete email or move to trash
  async deleteEmail(user: ExecutiveMailboxUser, id: string) {
    if (id.startsWith('sent_') || id.startsWith('sent-')) {
      try {
        await this.prisma.$executeRawUnsafe(`DELETE FROM "sent_emails" WHERE "id" = $1`, id);
        return { success: true, message: 'Sent email deleted permanently' };
      } catch (err: any) {
        throw new BadRequestException('Could not delete sent email: ' + err.message);
      }
    }

    if (id.startsWith('draft_') || id.startsWith('draft-')) {
      return this.deleteDraft(user, id);
    }

    // Move incoming email to trash
    await this.updateEmailState(user, id, { trashed: true });
    return { success: true, message: 'Email moved to trash' };
  }

  // Save or update draft in database
  async saveDraft(user: ExecutiveMailboxUser, dto: any) {
    const cleanEmail = user.email.trim().toLowerCase();
    const currentUser = {
      id: user.id,
      email: cleanEmail,
      role: 'executive_official',
      mailboxEmail: cleanEmail,
      mailboxPrefix: user.s3Prefix,
      firstName: user.name,
      lastName: '',
    };
    return this.mailService.saveDraft(dto, currentUser);
  }

  // Delete draft by id
  async deleteDraft(user: ExecutiveMailboxUser, id: string) {
    const cleanEmail = user.email.trim().toLowerCase();
    const currentUser = {
      id: user.id,
      email: cleanEmail,
      role: 'executive_official',
      mailboxEmail: cleanEmail,
      mailboxPrefix: user.s3Prefix,
    };
    return this.mailService.deleteDraft(id, currentUser);
  }

  // Send an official email via AWS SES SMTP with body, attachments, priority
  async sendEmail(
    user: ExecutiveMailboxUser,
    dto: {
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject: string;
      body?: string;
      text?: string;
      html?: string;
      content?: string;
      priority?: 'normal' | 'high' | 'low' | string;
      attachments?: Array<{ filename: string; contentType: string; content: string }>;
    },
  ) {
    if (!dto.to || !dto.subject) {
      throw new BadRequestException('Recipient (to) and subject are required');
    }

    const cleanEmail = user.email.trim().toLowerCase();
    const messageBody = dto.body || dto.text || dto.content || dto.html || '';

    // Convert plain text into clean HTML layout if HTML is not provided
    const htmlBody =
      dto.html ||
      `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1626; white-space: pre-wrap;">${messageBody}</div>`;

    const currentUser = {
      id: user.id,
      email: cleanEmail,
      role: 'executive_official',
      mailboxEmail: cleanEmail,
      mailboxPrefix: user.s3Prefix,
      firstName: user.name,
      lastName: '',
    };

    // Format attachments for nodemailer
    const attachments = (dto.attachments || []).map((att) => ({
      filename: att.filename,
      contentType: att.contentType,
      content: Buffer.from(att.content, 'base64'),
    }));

    const priorityVal = (dto.priority === 'high' || dto.priority === 'low' ? dto.priority : 'normal') as 'high' | 'normal' | 'low';

    return this.mailService.sendEmail(
      {
        to: dto.to,
        cc: dto.cc,
        bcc: dto.bcc,
        subject: dto.subject,
        text: messageBody,
        html: htmlBody,
        priority: priorityVal,
        attachments: attachments as any,
      },
      currentUser,
    );
  }

  // Change official account password
  async changePassword(user: ExecutiveMailboxUser, oldPass: string, newPass: string) {
    if (!oldPass || !newPass) {
      throw new BadRequestException('Current password and new password are required');
    }

    if (newPass.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    const hashedOld = this.hashPassword(oldPass.trim());
    const hashedNew = this.hashPassword(newPass.trim());

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT "id", "password"
      FROM "executive_mailboxes"
      WHERE "id" = '${user.id}'
      LIMIT 1;
    `);

    if (!rows || rows.length === 0 || rows[0].password !== hashedOld) {
      throw new BadRequestException('Current password entered is incorrect');
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE "executive_mailboxes"
      SET "password" = '${hashedNew}', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = '${user.id}';
    `);

    return {
      success: true,
      message: 'Official password updated successfully',
    };
  }
}
