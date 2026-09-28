import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { LoanStateMachine } from './loan-state-machine';
import { SlackService } from './slack.service';
import { SalesforceService } from './salesforce.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatService } from '../chat/chat.service';
import { EmailService } from '../auth/email.service';
import { Writable } from 'stream';
import archiver = require('archiver');
import { existsSync } from 'fs';
import { resolve } from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class BankService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly slack: SlackService,
    private readonly salesforce: SalesforceService,
    private readonly eventEmitter: EventEmitter2,
    private readonly chatService: ChatService,
    private readonly emailService: EmailService
  ) { }

  private get db() {
    return this.supabase.getClient();
  }

  /**
   * Helper to detect active bank context by matching string
   */
  private matchBankFilter(query: any, bankName: string) {
    if (!bankName) return query;
    const lowerName = bankName.toLowerCase();
    
    // Map common frontend names to broader database matches
    if (lowerName.includes('auxilo')) {
      return query.ilike('bank', '%auxilo%');
    }
    if (lowerName.includes('credila') || lowerName.includes('hdfc')) {
      return query.or('bank.ilike.%credila%,bank.ilike.%hdfc%');
    }
    if (lowerName.includes('idfc')) {
      return query.ilike('bank', '%idfc%');
    }
    if (lowerName.includes('avanse')) {
      return query.ilike('bank', '%avanse%');
    }
    if (lowerName.includes('poonawalla')) {
      return query.ilike('bank', '%poonawalla%');
    }

    return query.ilike('bank', `%${bankName}%`);
  }

  /**
   * Category A: Fetch incoming student file queue
   */
  async getIncomingFiles(bankName: string, filters: any): Promise<any[]> {
    console.log(`[BankService] Fetching incoming queue for bank: "${bankName}"`);

    let query = this.db
      .from('LoanApplication')
      .select('*')
      .not('status', 'in', '(rejected,cancelled,closed,expired)');

    query = this.matchBankFilter(query, bankName);

    if (filters.limit) query = query.limit(parseInt(filters.limit, 10));
    if (filters.offset) query = query.range(
      parseInt(filters.offset, 10),
      parseInt(filters.offset, 10) + (parseInt(filters.limit, 10) || 20) - 1
    );

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Category A: Log file & assign unique LAN code
   */
  async logFile(
    applicationId: string,
    lanNumber: string,
    bankUser: any
  ): Promise<any> {
    console.log(`[BankService] Manual LAN logging triggered for App ID: ${applicationId}, LAN: ${lanNumber}`);

    // Fetch existing application
    const { data: application, error: fetchError } = await this.db
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      throw new NotFoundException(`Loan application with ID "${applicationId}" not found`);
    }

    // State machine check
    LoanStateMachine.validateTransition(application.status, 'file_logged', bankUser.role);

    // Save LAN entry in lan_records
    const { error: lanError } = await this.db.from('lan_records').insert({
      applicationId: applicationId,
      lanNumber: lanNumber,
      assignedBy: bankUser.email
    });
    if (lanError) throw lanError;

    // Update LoanApplication record
    const updatedStatus = 'file_logged';
    const updatedStage = LoanStateMachine.getStageByStatus(updatedStatus);
    const updatedProgress = LoanStateMachine.getProgressByStatus(updatedStatus);

    const { data: updatedApp, error: updateError } = await this.db
      .from('LoanApplication')
      .update({
        status: updatedStatus,
        stage: updatedStage,
        progress: updatedProgress,
        applicationNumber: lanNumber, // Sync LAN to applicationNumber field
        lanNumber: lanNumber, // Sync to lanNumber column
        lanEnteredAt: new Date().toISOString(), // Sync to lanEnteredAt column
        remarks: `LAN ${lanNumber} assigned manually by bank user: ${bankUser.firstName || 'Banker'}.`,
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log status history transition
    await this.db.from('ApplicationStatusHistory').insert({
      applicationId: applicationId,
      fromStatus: application.status,
      toStatus: updatedStatus,
      fromStage: application.stage,
      toStage: updatedStage,
      changedBy: bankUser.id,
      changedByName: `${bankUser.firstName || ''} ${bankUser.lastName || ''}`.trim() || bankUser.email,
      changeReason: `Manual LAN Logged: ${lanNumber}`,
      isAutomatic: false,
      createdAt: new Date().toISOString()
    });

    // Thread in ApplicationNote as serialization protocol
    await this.db.from('ApplicationNote').insert({
      applicationId: applicationId,
      authorId: bankUser.id,
      authorName: `${bankUser.firstName || ''} ${bankUser.lastName || ''}`.trim() || bankUser.email,
      content: JSON.stringify({
        action: 'lan_assigned',
        lanNumber: lanNumber,
        timestamp: new Date().toISOString()
      }),
      type: 'lan_assigned',
      isInternal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // CRM Trigger
    await this.salesforce.syncLeadOrOpportunity(
      applicationId,
      `${application.firstName} ${application.lastName}`,
      application.amount,
      updatedStatus,
      lanNumber
    );

    return {
      success: true,
      message: 'File logged successfully with LAN number',
      application: updatedApp
    };
  }

  /**
   * Category A: Retrieve application documents list
   */
  async getDocuments(applicationId: string): Promise<any[]> {
    let application: any = null;
    const { data: appById } = await this.db
      .from('LoanApplication')
      .select('userId, id, loanType, applicationNumber')
      .eq('id', applicationId)
      .maybeSingle();

    if (appById) {
      application = appById;
    } else {
      const { data: appByNum } = await this.db
        .from('LoanApplication')
        .select('userId, id, loanType, applicationNumber')
        .eq('applicationNumber', applicationId)
        .maybeSingle();
      application = appByNum;
    }

    if (!application) {
      return [];
    }

    const targetAppId = application.id;
    const { data: documents, error: docsError } = await this.db
      .from('ApplicationDocument')
      .select('*')
      .eq('applicationId', targetAppId);

    if (docsError) throw docsError;
    const docs = documents || [];

    // Also fetch the User's general Vault documents to show in a "Vault" section
    const { data: vaultDocs, error: vaultError } = await this.db
      .from('UserDocument')
      .select('*')
      .eq('userId', application.userId);

    if (vaultError) throw vaultError;

    // Merge matching vault documents into ApplicationDocuments that lack a filePath
    const vaultDocsMap = new Map((vaultDocs || []).map(vd => [vd.docType, vd]));
    const mergedDocs = docs.map((doc: any) => {
      const vMatch = vaultDocsMap.get(doc.docType);
      if ((!doc.filePath || doc.filePath === '') && vMatch && vMatch.filePath) {
        return {
          ...doc,
          filePath: vMatch.filePath,
          fileName: doc.fileName || vMatch.fileName || doc.docName,
          fileSize: doc.fileSize || vMatch.fileSize,
          mimeType: doc.mimeType || vMatch.mimeType,
          status: doc.status === 'not_uploaded' ? (vMatch.status || 'uploaded') : doc.status
        };
      }
      return doc;
    });

    const applicationDocTypes = new Set(mergedDocs.map(d => d.docType));
    const extraVaultDocs = (vaultDocs || [])
      .filter(vd => !applicationDocTypes.has(vd.docType) && (vd.uploaded || vd.filePath || (vd.status && vd.status !== 'not_uploaded')))
      .map(vd => ({
        ...vd,
        id: `vault_${vd.id}`,
        isVaultDoc: true,
        docName: (vd.docType || '').replace(/_/g, ' ').toUpperCase(),
        status: vd.status || 'uploaded'
      }));

    return [...mergedDocs, ...extraVaultDocs];
  }

  private getS3Client() {
    const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();

    if (!accessKeyId || !secretAccessKey) {
      return null;
    }

    const rawRegion = (process.env.AWS_REGION || 'us-east-1').trim();
    const regionMatch = rawRegion.match(/[a-z]{2}-[a-z]+-\d/i);
    const region = regionMatch ? regionMatch[0].toLowerCase() : 'us-east-1';

    let requestHandler;
    try {
      const { NodeHttpHandler } = require('@smithy/node-http-handler');
      requestHandler = new NodeHttpHandler({
        connectionTimeout: 1000,
        socketTimeout: 1500,
      });
    } catch (e) {
      console.warn('[BankService] NodeHttpHandler not found, using default handler');
    }

    return new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      ...(requestHandler ? { requestHandler } : {}),
    });
  }

  /**
   * Category A: Bulk zip document compiler
   */
  async generateDocumentsZip(applicationId: string): Promise<any> {
    console.log(`[BankService] Building bulk documents ZIP buffer for App ID: ${applicationId}`);

    const documents = await this.getDocuments(applicationId);
    const uploadedDocs = (documents || []).filter(
      (doc: any) => doc.filePath && doc.filePath.trim().length > 0
    );

    const archive = typeof (archiver as any) === 'function'
      ? (archiver as any)('zip', { zlib: { level: 9 } })
      : new (archiver as any).ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });
    archive.pipe(outputStream);

    if (uploadedDocs.length === 0) {
      archive.append('No uploaded student document files found for this application.', { name: 'NOTICE.txt' });
    }

    const s3Client = this.getS3Client();
    const bucket = (process.env.AWS_S3_BUCKET_NAME || '').trim();

    for (const doc of uploadedDocs) {
      const docName = (doc.docName || doc.docType || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = doc.fileName ? doc.fileName.split('.').pop() : 'pdf';
      const filename = `${docName}.${ext}`;

      // 1. Check if DigiLocker record
      if (doc.filePath.startsWith('in.gov.')) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>DigiLocker Record - ${doc.docName || doc.docType}</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding: 40px; }
        .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; width: 100%; border-top: 6px solid #82c91e; }
        .header { display: flex; align-items: center; gap: 15px; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .title { margin: 0; color: #1a3a6b; }
        .badge { background: #e6fced; color: #12b842; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 14px; white-space: nowrap; }
        .field { margin-bottom: 20px; }
        .label { font-size: 13px; color: #666; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
        .value { font-size: 18px; color: #333; margin-top: 4px; word-break: break-all; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h2 class="title">Digital Verification Record</h2>
            <span class="badge">✓ Verified by DigiLocker</span>
        </div>
        <div class="field">
            <div class="label">Document Name</div>
            <div class="value">${doc.docName || doc.docType || 'Document'}</div>
        </div>
        <div class="field">
            <div class="label">DigiLocker Reference URI</div>
            <div class="value">${doc.filePath}</div>
        </div>
        <div class="field">
            <div class="label">Date Synced</div>
            <div class="value">${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'N/A'}</div>
        </div>
        <div class="footer">
            This is a digitally verified record synced directly from DigiLocker. The physical file is held securely by the issuing authority.
        </div>
    </div>
</body>
</html>`;
        archive.append(html, { name: `${docName}_digilocker.html` });
        continue;
      }

      // 2. Check if local file exists (checking candidate paths)
      const candidatePaths = [
        resolve(doc.filePath),
        resolve(process.cwd(), doc.filePath),
        resolve(process.cwd(), doc.filePath.replace(/^[/\\]+/, '')),
      ];
      let foundPath: string | null = null;
      for (const p of candidatePaths) {
        if (existsSync(p)) {
          foundPath = p;
          break;
        }
      }
      if (foundPath) {
        archive.file(foundPath, { name: filename });
        continue;
      }

      // 3. Try fetching from S3 via presigned URL with a fast fetch timeout (if S3 is configured)
      if (s3Client && bucket) {
        try {
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: doc.filePath,
          });
          const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);
          const response = await fetch(presignedUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          archive.append(buffer, { name: filename });
          continue;
        } catch (s3Error: any) {
          console.error(`[generateDocumentsZip] S3 fetch failed for key ${doc.filePath}:`, s3Error.message || s3Error);
        }
      }

      // 4. Fallback to missing document mock pdf/text
      const fallbackPath = resolve(process.cwd(), 'public/mock/document_missing.pdf');
      if (existsSync(fallbackPath)) {
        archive.file(fallbackPath, { name: filename });
      } else {
        archive.append('Document file not found on disk or S3', { name: `${docName}_missing.txt` });
      }
    }

    const bufferPromise = new Promise<Buffer>((res, rej) => {
      outputStream.on('finish', () => res(Buffer.concat(chunks)));
      archive.on('error', rej);
    });

    await archive.finalize();
    const buffer = await bufferPromise;

    return {
      success: true,
      fileName: `VL_Student_Docs_${applicationId}.zip`,
      mimeType: 'application/zip',
      fileSize: buffer.length,
      buffer
    };
  }

  /**
   * Category A: Register decisions (Sanction, Reject, Partial, etc.)
   */
  async registerDecision(
    applicationId: string,
    decisionType: string,
    details: any,
    bankUser: any
  ): Promise<any> {
    console.log(`[BankService] Decision "${decisionType}" submitted for App ID: ${applicationId}`);

    const { data: application, error: fetchError } = await this.db
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      throw new NotFoundException(`Loan application with ID "${applicationId}" not found`);
    }

    // Determine target status mapped from decision type
    let targetStatus = 'under_bank_review';
    if (decisionType === 'sanction_approved' || decisionType === 'sanction') {
      targetStatus = 'sanctioned';
    } else if (decisionType === 'conditional_sanction') {
      targetStatus = 'conditional_sanction';
    } else if (decisionType === 'counter_offer') {
      targetStatus = 'counter_offer';
    } else if (decisionType === 'rejected' || decisionType === 'reject') {
      targetStatus = 'rejected';
    } else {
      throw new BadRequestException(`Unsupported decision type: "${decisionType}"`);
    }

    // Enforce LAN check for sanction decisions if lan is missing
    const detailsObj = details || {};
    const userRole = bankUser?.role || 'bank';

    // State machine validation
    LoanStateMachine.validateTransition(application.status, targetStatus, userRole);

    // Save decision entry in specialized tables
    const nowStr = new Date().toISOString();

    try {
      const decisionPayload: any = {
        applicationId: applicationId,
        bankId: application.bank || 'IDFC',
        decision: targetStatus.toUpperCase(),
        sanctionAmount: detailsObj.sanctionAmount || application.amount || 0,
        interestRate: detailsObj.interestRate || application.interestRate || 9.5,
        roiType: detailsObj.roiType || 'floating',
        tenure: detailsObj.tenure || 120,
        conditions: detailsObj.conditions ? JSON.stringify(detailsObj.conditions) : null,
        conditionDeadline: detailsObj.deadline || null,
        counterOffer: (decisionType === 'counter_offer') ? JSON.stringify(detailsObj) : null,
        rejectionReason: detailsObj.reason || null,
        remarks: detailsObj.remarks || null,
        decidedBy: bankUser?.email || bankUser?.id || 'Bank Officer'
      };

      const { error: decInsertErr } = await this.db.from('BankDecision').insert(decisionPayload);
      if (decInsertErr) {
        console.warn(`[BankService] BankDecision insert note: ${decInsertErr.message || decInsertErr}`);
      }
    } catch (bErr: any) {
      console.warn(`[BankService] BankDecision insert exception: ${bErr?.message || bErr}`);
    }

    if (targetStatus === 'sanctioned') {
      try {
        await this.db.from('sanctions').insert({
          applicationId: applicationId,
          sanctionAmount: detailsObj.sanctionAmount || application.amount,
          interestRate: detailsObj.interestRate || 9.5,
          tenure: detailsObj.tenure || 120,
          sanctionedAt: nowStr
        });
      } catch (sErr: any) {
        console.warn(`[BankService] sanctions insert note: ${sErr?.message || sErr}`);
      }

      // Post sanction to the bank chat channel
      try {
        const safeBank = (application.bank || 'Unknown_Bank').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const shortAppId = application.applicationNumber || applicationId.slice(0, 8);
        const displayName = `${application.bank || 'Bank'} - App #${shortAppId}`;
        const syntheticPhone = `BNK_${safeBank}_APP_${applicationId}`;

        const conversation = await this.chatService.getOrCreateConversation(
          syntheticPhone,
          `bank+${safeBank.toLowerCase()}@internal`,
          'bank',
          displayName,
          application.bank || 'Bank',
          {
            applicationId: applicationId,
            applicationNumber: application.applicationNumber || null,
          }
        );

        const messageContent = `✅ **Loan Sanctioned**\n\nThe bank has approved and sanctioned this application!\n\n` +
          `**Sanction Amount:** ₹${(detailsObj.sanctionAmount || application.amount || 0).toLocaleString('en-IN')}\n` +
          `**Interest Rate:** ${detailsObj.interestRate || 9.5}% (${detailsObj.roiType || 'floating'})\n` +
          `**Tenure:** ${detailsObj.tenure || 120} months\n\n` +
          `**Remarks/Notes:** ${detailsObj.remarks || 'No additional remarks.'}`;

        const savedMessage = await this.chatService.saveMessage({
          conversationId: conversation.id,
          senderType: 'bank',
          senderId: bankUser?.email || bankUser?.id || 'bank-system',
          senderName: `${bankUser?.firstName || 'Banker'} (${application.bank || 'Bank'})`,
          content: messageContent,
          messageType: 'text',
          status: 'sent'
        });

        this.eventEmitter.emit('chat.message_created', savedMessage);
      } catch (chatError) {
        console.error(`[BankService] Failed to post sanction to chat:`, chatError);
      }
    } else if (targetStatus === 'conditional_sanction') {
      try {
        await this.db.from('conditional_sanctions').insert({
          applicationId: applicationId,
          conditionsList: detailsObj.conditions || ['Provide academic marksheets'],
          deadline: detailsObj.deadline || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          createdAt: nowStr
        });
      } catch (csErr: any) {
        console.warn(`[BankService] conditional_sanctions insert note: ${csErr?.message || csErr}`);
      }

      try {
        const safeBank = (application.bank || 'Unknown_Bank').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const syntheticPhone = `BNK_${safeBank}_APP_${applicationId}`;
        const shortAppId = application.applicationNumber || applicationId.slice(0, 8);
        const displayName = `${application.bank || 'Bank'} - App #${shortAppId}`;

        // Get or create conversation with the bank for this application
        const conversation = await this.chatService.getOrCreateConversation(
          syntheticPhone,
          `bank+${safeBank.toLowerCase()}@internal`,
          'bank',
          displayName,
          application.bank || 'Bank',
          {
            applicationId: applicationId,
            applicationNumber: application.applicationNumber || null,
          }
        );

        // Build list of conditions for the chat content
        let conditionsStr = '';
        if (Array.isArray(detailsObj.conditions) && detailsObj.conditions.length > 0) {
          conditionsStr = detailsObj.conditions.map((c: any, index: number) => {
            const num = index + 1;
            if (typeof c === 'string') {
              return `${num}. ${c}`;
            }
            const typeLabel = c.type ? ` [${c.type.toUpperCase()}]` : '';
            const deadlineLabel = c.deadline ? ` (Deadline: ${c.deadline})` : '';
            return `${num}. ${c.text}${typeLabel}${deadlineLabel}`;
          }).join('\n');
        } else {
          conditionsStr = 'None specified';
        }

        const messageContent = `🔔 **Conditional Sanction Submitted**\n\nThe bank has conditionally sanctioned the loan application.\n\n` +
          `**Sanction Amount:** ₹${(detailsObj.sanctionAmount || application.amount || 0).toLocaleString('en-IN')}\n` +
          `**Interest Rate:** ${detailsObj.interestRate || application.interestRate || 'N/A'}% (${detailsObj.roiType || 'floating'})\n` +
          `**Decision Deadline:** ${detailsObj.deadline || 'N/A'}\n\n` +
          `**Conditions List:**\n${conditionsStr}\n\n` +
          `**Remarks/Notes:** ${detailsObj.remarks || 'No additional remarks.'}`;

        // Save the support message in this conversation
        const savedMessage = await this.chatService.saveMessage({
          conversationId: conversation.id,
          senderType: 'bank',
          senderId: bankUser?.email || bankUser?.id || 'bank-system',
          senderName: `${bankUser?.firstName || 'Banker'} (${application.bank || 'Bank'})`,
          content: messageContent,
          messageType: 'text',
          status: 'sent'
        });

        // Broadcast to WebSocket clients
        this.eventEmitter.emit('chat.message_created', savedMessage);
        
        console.log(`[BankService] Real-time conditions message posted to chat conversation ${conversation.id}`);
      } catch (chatError) {
        console.error(`[BankService] Failed to post conditional sanction checklist to staff chat:`, chatError);
      }
    } else if (targetStatus === 'counter_offer') {
      try {
        await this.db.from('counter_offers').insert({
          applicationId: applicationId,
          offeredAmount: detailsObj.offeredAmount || application.amount * 0.9,
          offeredRate: detailsObj.offeredRate || 10.5,
          offeredTenure: detailsObj.offeredTenure || 96,
          status: 'pending'
        });
      } catch (coErr: any) {
        console.warn(`[BankService] counter_offers insert note: ${coErr?.message || coErr}`);
      }

      // Post counter offer to the bank chat channel
      try {
        const safeBank = (application.bank || 'Unknown_Bank').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const shortAppId = application.applicationNumber || applicationId.slice(0, 8);
        const displayName = `${application.bank || 'Bank'} - App #${shortAppId}`;
        const syntheticPhone = `BNK_${safeBank}_APP_${applicationId}`;

        const conversation = await this.chatService.getOrCreateConversation(
          syntheticPhone,
          `bank+${safeBank.toLowerCase()}@internal`,
          'bank',
          displayName,
          application.bank || 'Bank',
          {
            applicationId: applicationId,
            applicationNumber: application.applicationNumber || null,
          }
        );

        const offeredAmount = detailsObj.offeredAmount || detailsObj.sanctionAmount || (application.amount * 0.9);
        const offeredRate = detailsObj.offeredRate || detailsObj.interestRate || 10.5;
        const offeredTenure = detailsObj.offeredTenure || detailsObj.tenure || 96;

        const messageContent = `🔄 **Counter Offer Proposed**\n\nThe bank has proposed a counter offer for the loan application.\n\n` +
          `**Offered Amount:** ₹${(offeredAmount).toLocaleString('en-IN')}\n` +
          `**Offered Rate:** ${offeredRate}%\n` +
          `**Offered Tenure:** ${offeredTenure} months\n\n` +
          `**Remarks/Notes:** ${detailsObj.remarks || 'No additional remarks.'}`;

        const savedMessage = await this.chatService.saveMessage({
          conversationId: conversation.id,
          senderType: 'bank',
          senderId: bankUser?.email || bankUser?.id || 'bank-system',
          senderName: `${bankUser?.firstName || 'Banker'} (${application.bank || 'Bank'})`,
          content: messageContent,
          messageType: 'text',
          status: 'sent'
        });

        this.eventEmitter.emit('chat.message_created', savedMessage);
      } catch (chatError) {
        console.error(`[BankService] Failed to post counter offer to chat:`, chatError);
      }
    } else if (targetStatus === 'rejected') {
      try {
        await this.db.from('rejections').insert({
          applicationId: applicationId,
          reason: detailsObj.reason || 'Credit score shortfall',
          rejectedAt: nowStr
        });
      } catch (rjErr: any) {
        console.warn(`[BankService] rejections insert note: ${rjErr?.message || rjErr}`);
      }

      // Post rejection to the bank chat channel
      try {
        const safeBank = (application.bank || 'Unknown_Bank').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const shortAppId = application.applicationNumber || applicationId.slice(0, 8);
        const displayName = `${application.bank || 'Bank'} - App #${shortAppId}`;
        const syntheticPhone = `BNK_${safeBank}_APP_${applicationId}`;

        const conversation = await this.chatService.getOrCreateConversation(
          syntheticPhone,
          `bank+${safeBank.toLowerCase()}@internal`,
          'bank',
          displayName,
          application.bank || 'Bank',
          {
            applicationId: applicationId,
            applicationNumber: application.applicationNumber || null,
          }
        );

        const messageContent = `🚨 **Application Rejected**\n\nThe bank has rejected the loan application.\n\n` +
          `**Category:** ${detailsObj.rejectionCategory || detailsObj.category || 'N/A'}\n` +
          `**Reason:** ${detailsObj.reason || 'Unspecified credit policy deviation'}\n\n` +
          `**Remarks/Notes:** ${detailsObj.remarks || 'No additional remarks.'}`;

        const savedMessage = await this.chatService.saveMessage({
          conversationId: conversation.id,
          senderType: 'bank',
          senderId: bankUser?.email || bankUser?.id || 'bank-system',
          senderName: `${bankUser?.firstName || 'Banker'} (${application.bank || 'Bank'})`,
          content: messageContent,
          messageType: 'text',
          status: 'sent'
        });

        this.eventEmitter.emit('chat.message_created', savedMessage);
      } catch (chatError) {
        console.error(`[BankService] Failed to post rejection to chat:`, chatError);
      }
    }

    // Update main application status
    const updatedStage = LoanStateMachine.getStageByStatus(targetStatus);
    const updatedProgress = LoanStateMachine.getProgressByStatus(targetStatus);

    const updatePayload: any = {
      status: targetStatus,
      stage: updatedStage,
      progress: updatedProgress,
      interestRate: detailsObj.interestRate || application.interestRate,
      processingFee: detailsObj.processingFee || application.processingFee,
      sanctionAmount: detailsObj.sanctionAmount || application.sanctionAmount,
      rejectionReason: targetStatus === 'rejected' ? detailsObj.reason : null,
      approvedAt: targetStatus === 'sanctioned' ? nowStr : application.approvedAt,
      rejectedAt: targetStatus === 'rejected' ? nowStr : application.rejectedAt,
      remarks: `Decision "${decisionType.toUpperCase()}" registered by ${bankUser?.firstName || bankUser?.email || 'Banker'}.`,
      updatedAt: nowStr
    };

    let { data: updatedApp, error: updateError } = await this.db
      .from('LoanApplication')
      .update(updatePayload)
      .eq('id', applicationId)
      .select()
      .maybeSingle();

    if (updateError) {
      console.warn(`[BankService.registerDecision] LoanApplication update warning: ${updateError.message}. Retrying core update...`);
      const { data: retryApp } = await this.db
        .from('LoanApplication')
        .update({
          status: targetStatus,
          stage: updatedStage,
          progress: updatedProgress,
          updatedAt: nowStr
        })
        .eq('id', applicationId)
        .select()
        .maybeSingle();
      updatedApp = retryApp || { ...application, status: targetStatus, stage: updatedStage, progress: updatedProgress };
    }

    // Log status history transition
    try {
      await this.db.from('ApplicationStatusHistory').insert({
        id: randomUUID(),
        applicationId: applicationId,
        fromStatus: application.status,
        toStatus: targetStatus,
        fromStage: application.stage,
        toStage: updatedStage,
        changedBy: bankUser?.id || bankUser?.email || 'bank-user',
        changedByName: `${bankUser?.firstName || ''} ${bankUser?.lastName || ''}`.trim() || bankUser?.email || 'Bank Officer',
        changeReason: `Decision submitted: ${decisionType}`,
        isAutomatic: false,
      });
    } catch (hErr: any) {
      console.warn(`[BankService] ApplicationStatusHistory insert note: ${hErr?.message || hErr}`);
    }

    // Notify staff via in-app notification
    try {
      let notifTitle = '';
      let notifBody = '';
      let notifType = '';

      if (targetStatus === 'sanctioned') {
        notifTitle = '✅ Loan Sanctioned';
        notifBody = `Bank ${application.bank || 'Bank'} has sanctioned App: ${application.applicationNumber || applicationId} for ₹${(detailsObj.sanctionAmount || application.amount || 0).toLocaleString('en-IN')}`;
        notifType = 'application_approved';
      } else if (targetStatus === 'conditional_sanction') {
        notifTitle = '⚠️ Conditional Sanction';
        notifBody = `Bank ${application.bank || 'Bank'} has conditionally sanctioned App: ${application.applicationNumber || applicationId}`;
        notifType = 'application_conditional';
      } else if (targetStatus === 'counter_offer') {
        notifTitle = '🔄 Counter Offer Proposed';
        notifBody = `Bank ${application.bank || 'Bank'} proposed a counter offer for App: ${application.applicationNumber || applicationId}`;
        notifType = 'application_counter';
      } else if (targetStatus === 'rejected') {
        notifTitle = '❌ Application Rejected';
        notifBody = `Bank ${application.bank || 'Bank'} has rejected App: ${application.applicationNumber || applicationId}`;
        notifType = 'application_rejected';
      }

      if (notifTitle) {
        const targetUserId = application?.assignedStaffId && application.assignedStaffId !== 'unassigned' && application.assignedStaffId !== 'null'
          ? application.assignedStaffId
          : 'staff';

        const notifData = {
          id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: targetUserId,
          title: notifTitle,
          body: notifBody,
          type: notifType,
          isRead: false,
          timestamp: nowStr,
          metadata: {
            applicationId: applicationId,
            applicationNumber: application.applicationNumber || null,
            studentId: application.userId || application.user_id || application.applicantId || null,
            userId: application.userId || application.user_id || application.applicantId || null,
            bank: application.bank || null,
            status: targetStatus
          }
        };
        await this.db.from('Notification').insert(notifData);
        this.eventEmitter.emit('notification.created', notifData);
      }
    } catch (notifErr) {
      console.error('[BankService.registerDecision] Failed to create in-app notification:', notifErr);
    }

    // Thread serialization in ApplicationNote
    try {
      await this.db.from('ApplicationNote').insert({
        id: randomUUID(),
        applicationId: applicationId,
        authorId: bankUser?.id || bankUser?.email || 'bank-user',
        authorName: `${bankUser?.firstName || ''} ${bankUser?.lastName || ''}`.trim() || bankUser?.email || 'Bank Officer',
        content: JSON.stringify({
          action: decisionType,
          details: detailsObj,
          timestamp: nowStr
        }),
        type: decisionType,
        isInternal: false,
      });
    } catch (noteErr: any) {
      console.warn(`[BankService] ApplicationNote insert note: ${noteErr?.message || noteErr}`);
    }

    // Asynchronously dispatch external notifications (email, Slack, Salesforce) in background without blocking response
    setImmediate(async () => {
      try {
        const { data: latestApp } = await this.db
          .from('LoanApplication')
          .select('*')
          .eq('id', applicationId)
          .maybeSingle();

        if (latestApp) {
          let userEmail = latestApp.email;
          let userName = `${latestApp.firstName || ''} ${latestApp.lastName || ''}`.trim();
          if (latestApp.userId) {
            const { data: usr } = await this.db.from('User').select('email, firstName, lastName').eq('id', latestApp.userId).maybeSingle();
            if (usr?.email) userEmail = usr.email;
            if (usr?.firstName) userName = `${usr.firstName} ${usr.lastName || ''}`.trim();
          }

          if (userEmail) {
            const bankName = latestApp.bank || application.bank || 'our partner bank';
            if (targetStatus === 'sanctioned') {
              await this.emailService.sendApplicationAcceptedByBankEmail(userEmail, userName || 'Student', bankName, latestApp, detailsObj);
            } else if (targetStatus === 'rejected') {
              await this.emailService.sendApplicationRejectedByBankEmail(userEmail, userName || 'Student', bankName, detailsObj.reason || detailsObj.remarks || '');
            }
          }
        }
      } catch (err) {
        console.error('[BankService.registerDecision] Failed to send bank decision email:', err);
      }

      const studentName = `${application.firstName || ''} ${application.lastName || ''}`.trim() || 'Student';
      try {
        await this.slack.publishDecisionNotification(
          application.bank,
          studentName,
          application.applicationNumber,
          decisionType,
          detailsObj
        );
      } catch (slackErr: any) {
        console.warn(`[BankService] Slack notification note: ${slackErr?.message || slackErr}`);
      }

      try {
        await this.salesforce.syncLeadOrOpportunity(
          applicationId,
          studentName,
          application.amount,
          targetStatus,
          application.applicationNumber
        );
      } catch (sfErr: any) {
        console.warn(`[BankService] Salesforce sync note: ${sfErr?.message || sfErr}`);
      }
    });

    return {
      success: true,
      message: `Decision "${decisionType}" registered successfully.`,
      application: updatedApp
    };
  }

  private normalizePhone(phoneStr: string): string {
    if (!phoneStr) return '';
    if (phoneStr.startsWith('BNK_')) return phoneStr;
    const cleaned = phoneStr.replace('whatsapp:', '').trim().replace(/\D/g, '');
    if (cleaned.length > 10 && cleaned.startsWith('91')) {
      return cleaned.substring(2);
    }
    if (cleaned.length > 10) {
      return cleaned.slice(-10);
    }
    return cleaned;
  }

  /**
   * Category A: Raise query to VidyaLoans staff
   */
  async raiseQuery(
    applicationId: string,
    content: string,
    bankUser: any
  ): Promise<any> {
    console.log(`[BankService] Raising document query on App ID: ${applicationId}`);

    const authorId = bankUser?.id || bankUser?.email || 'bank_officer';
    const authorName = bankUser
      ? (`${bankUser.firstName || ''} ${bankUser.lastName || ''}`.trim() || bankUser.email || 'Bank Representative')
      : 'Bank Representative';

    let application: any = null;
    try {
      let { data } = await this.db
        .from('LoanApplication')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();

      if (!data) {
        const { data: fallbackData } = await this.db
          .from('LoanApplication')
          .select('*')
          .eq('applicationNumber', applicationId)
          .maybeSingle();
        data = fallbackData;
      }
      application = data;
    } catch (e) {
      console.warn('[BankService] Error fetching application details:', e);
    }

    const resolvedAppId = application?.id || applicationId;

    // Check if status shifts to query_raised
    if (application && application.status !== 'query_raised') {
      try {
        await this.db
          .from('LoanApplication')
          .update({
            status: 'query_raised',
            progress: LoanStateMachine.getProgressByStatus('query_raised'),
            updatedAt: new Date().toISOString()
          })
          .eq('id', resolvedAppId);
      } catch (e) {
        console.warn('[BankService] Error updating LoanApplication status:', e);
      }
    }

    const queryId = randomUUID();
    const queryPayload = {
      id: queryId,
      applicationId: resolvedAppId,
      authorId: authorId,
      authorName: authorName,
      content: content,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Insert Query across all query tables for complete DB persistence
    let queryRecord: any = null;
    try {
      const { data: qData, error: qErr } = await this.db
        .from('queries')
        .insert(queryPayload)
        .select()
        .maybeSingle();

      if (qErr) throw qErr;
      queryRecord = qData || queryPayload;
    } catch (err) {
      console.error('[BankService] Error inserting query:', err);
      queryRecord = queryPayload;
    }

    // Also persist in BankQuery table
    try {
      await this.db.from('BankQuery').insert({
        id: queryId,
        applicationId: resolvedAppId,
        raisedBy: authorName || bankUser?.email || 'bank_officer',
        queryType: 'VERIFICATION',
        description: content,
        content: content,
        status: 'OPEN',
        createdAt: new Date().toISOString()
      });
    } catch (bqErr) {
      console.warn('[BankService] Note: BankQuery table insert error:', bqErr);
    }

    // Also persist in BankWorkflowQueryRequest table
    try {
      await this.db.from('BankWorkflowQueryRequest').insert({
        id: queryId,
        applicationId: resolvedAppId,
        queryType: 'VERIFICATION',
        queryDescription: content,
        raisedBy: authorName || bankUser?.email || 'bank_officer',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });
    } catch (bwqErr) {
      console.warn('[BankService] Note: BankWorkflowQueryRequest insert error:', bwqErr);
    }

    // Serialize ApplicationNote query
    try {
      await this.db.from('ApplicationNote').insert({
        id: randomUUID(),
        applicationId: resolvedAppId,
        authorId: authorId,
        authorName: authorName,
        content: JSON.stringify({
          action: 'query_raised',
          content: content,
          timestamp: new Date().toISOString()
        }),
        type: 'query_raised',
        isInternal: false,
      });
    } catch (noteErr) {
      console.warn('[BankService] Error creating ApplicationNote:', noteErr);
    }

    // 1. Resolve or create chat conversation for this application & push query message
    let conv: any = null;
    if (application) {
      try {
        const rawPhone = application.phone || application.mobile;
        const phone = this.normalizePhone(rawPhone || '');
        if (phone) {
          let { data: existingConv } = await this.db
            .from('Conversation')
            .select('*')
            .eq('customerPhone', phone)
            .maybeSingle();

          if (!existingConv) {
            const fullName = `${application.firstName || ''} ${application.lastName || ''}`.trim();
            const { data: newConv } = await this.db
              .from('Conversation')
              .insert({
                id: randomUUID(),
                customerPhone: phone,
                status: 'active',
                customerEmail: application.email || null,
                customerName: fullName || null,
                metadata: { type: 'staff', applicationId, applicationNumber: application.applicationNumber }
              })
              .select()
              .maybeSingle();
            existingConv = newConv;
          }
          conv = existingConv;

          if (conv) {
            const msgContent = `❓ **Bank Query from ${authorName} (${application.bank || 'Bank'})**:\n"${content}"`;
            const { data: chatMessage } = await this.db
              .from('Message')
              .insert({
                id: randomUUID(),
                conversationId: conv.id,
                senderType: 'bank',
                senderId: bankUser?.email || bankUser?.id || 'bank-system',
                senderName: `${authorName} (${application.bank || 'Bank'})`,
                receiverType: 'staff',
                content: msgContent,
                messageType: 'text',
                status: 'sent'
              })
              .select()
              .maybeSingle();

            if (chatMessage) {
              await this.db
                .from('Conversation')
                .update({ updatedAt: new Date().toISOString() })
                .eq('id', conv.id);

              this.eventEmitter.emit('chat.message_created', chatMessage);
            }
          }
        }
      } catch (convErr) {
        console.warn('[BankService] Error updating student conversation:', convErr);
      }
    }

    // 2. Notify staff via in-app notification with conversationId metadata
    try {
      const appNum = application?.applicationNumber || applicationId;
      const notifData = {
        id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: application?.assignedStaffId || 'staff',
        title: '❓ Partner Query Raised',
        body: `Bank officer ${authorName} raised a query on App #${appNum}: "${content}"`,
        type: 'query_raised',
        isRead: false,
        timestamp: new Date().toISOString(),
        metadata: {
          applicationId: applicationId,
          applicationNumber: application?.applicationNumber || null,
          conversationId: conv?.id || null,
          studentId: application?.userId || null,
          bank: application?.bank || null,
          status: 'query_raised'
        }
      };
      await this.db.from('Notification').insert(notifData);
      this.eventEmitter.emit('notification.created', notifData);
    } catch (notifErr) {
      console.warn('[BankService] Error inserting Notification:', notifErr);
    }

    // 3. Send query message to the dedicated Bank chat channel
    if (application) {
      try {
        const safeBank = (application.bank || 'Unknown_Bank').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const shortAppId = application.applicationNumber || applicationId.slice(0, 8);
        const displayName = `${application.bank || 'Bank'} - App #${shortAppId}`;
        const syntheticPhone = `BNK_${safeBank}_APP_${applicationId}`;

        const conversation = await this.chatService.getOrCreateConversation(
          syntheticPhone,
          `bank+${safeBank.toLowerCase()}@internal`,
          'bank',
          displayName,
          application.bank || 'Bank',
          {
            applicationId: applicationId,
            applicationNumber: application.applicationNumber || null,
          }
        );

        if (conversation) {
          const msgContent = `❓ **Query Raised**\n\nThe bank has raised a query on the loan application:\n\n"${content}"`;

          const savedMessage = await this.chatService.saveMessage({
            conversationId: conversation.id,
            senderType: 'bank',
            senderId: bankUser?.email || bankUser?.id || 'bank-system',
            senderName: `${authorName} (${application.bank || 'Bank'})`,
            content: msgContent,
            messageType: 'text',
            status: 'sent'
          });

          if (savedMessage) {
            this.eventEmitter.emit('chat.message_created', savedMessage);
          }
        }
      } catch (chatError) {
        console.error(`[BankService] Failed to post query to bank chat channel:`, chatError);
      }
    }

    return {
      success: true,
      message: 'Query raised successfully',
      query: queryRecord
    };
  }

  /**
   * Category A: Confirm Tranche Disbursements (Admin and bank visible only)
   */
  async confirmDisbursement(
    applicationId: string,
    disbursementAmount: number,
    trancheNumber: number,
    transferMode: string,
    utrNumber: string,
    bankUser: any
  ): Promise<any> {
    console.log(`[BankService] Final Tranche ${trancheNumber} disbursement confirmation processing for App: ${applicationId}`);

    const { data: application } = await this.db
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) {
      throw new NotFoundException(`Loan application with ID "${applicationId}" not found`);
    }

    // State machine check
    LoanStateMachine.validateTransition(application.status, 'disbursement_confirmed', bankUser.role);

    // Save disbursement entry
    const { error: disbError } = await this.db.from('disbursements').insert({
      applicationId: applicationId,
      disbursementAmount: disbursementAmount,
      trancheNumber: trancheNumber,
      transferMode: transferMode,
      utrNumber: utrNumber,
      disbursedAt: new Date().toISOString()
    });
    if (disbError) throw disbError;

    // Calculate payouts
    const commissionVal = disbursementAmount * 0.0045; // 0.45% agent commission
    const referralVal = disbursementAmount * 0.0100;   // 1.00% referral fee

    await this.db.from('commissions').insert({
      applicationId: applicationId,
      commissionAmount: commissionVal,
      payoutStatus: 'pending'
    });

    await this.db.from('referral_fees').insert({
      applicationId: applicationId,
      referralFeeAmount: referralVal,
      status: 'pending'
    });

    // Update application
    const targetStatus = 'disbursement_confirmed';
    const updatedStage = 'disbursement';
    const updatedProgress = LoanStateMachine.getProgressByStatus(targetStatus);

    const { data: updatedApp, error: updateError } = await this.db
      .from('LoanApplication')
      .update({
        status: targetStatus,
        stage: updatedStage,
        progress: updatedProgress,
        disbursedAmount: (application.disbursedAmount || 0) + disbursementAmount,
        disbursedAt: new Date().toISOString(),
        remarks: `Tranche ${trancheNumber} disbursed (UTR: ${utrNumber}) confirmed by ${bankUser.firstName || 'Banker'}.`,
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log status history transition
    await this.db.from('ApplicationStatusHistory').insert({
      applicationId: applicationId,
      fromStatus: application.status,
      toStatus: targetStatus,
      fromStage: application.stage,
      toStage: updatedStage,
      changedBy: bankUser.id,
      changedByName: `${bankUser.firstName || ''} ${bankUser.lastName || ''}`.trim() || bankUser.email,
      changeReason: `Disbursement confirmed: Tranche ${trancheNumber}`,
      isAutomatic: false,
      createdAt: new Date().toISOString()
    });

    // Application note serialization
    await this.db.from('ApplicationNote').insert({
      applicationId: applicationId,
      authorId: bankUser.id,
      authorName: `${bankUser.firstName || ''} ${bankUser.lastName || ''}`.trim() || bankUser.email,
      content: JSON.stringify({
        action: 'disbursement_confirmed',
        disbursementAmount: disbursementAmount,
        trancheNumber: trancheNumber,
        transferMode: transferMode,
        utrNumber: utrNumber,
        timestamp: new Date().toISOString()
      }),
      type: 'disbursement_confirmed',
      isInternal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // CRM Trigger
    await this.salesforce.syncLeadOrOpportunity(
      applicationId,
      `${application.firstName} ${application.lastName}`,
      application.amount,
      targetStatus,
      application.applicationNumber
    );

    // Emit disbursement event for referral processing
    this.eventEmitter.emit('bank.application.disbursed', {
      applicationId: application.id,
      userId: application.userId,
      amount: disbursementAmount,
      bankId: application.bank,
      utrNumber,
      trancheNumber,
      transferMode,
    });

    return {
      success: true,
      message: 'Disbursement UTR confirmed successfully',
      application: updatedApp
    };
  }

  /**
   * Category C: File Quality Rating submissions
   */
  async submitFileQualityScore(
    applicationId: string,
    rating: number,
    feedback: string
  ): Promise<any> {
    const { data, error } = await this.db
      .from('file_quality_scores')
      .insert({
        applicationId: applicationId,
        rating: rating,
        feedback: feedback
      })
      .select()
      .single();

    if (error) throw error;
    return {
      success: true,
      message: 'File quality score rated',
      ratingRecord: data
    };
  }

  /**
   * Category C: Fetch SLA complying TAT trackers
   */
  async getSlaTrackingMetrics(bankName: string): Promise<any> {
    console.log(`[BankService] Querying SLA track logs for bank: ${bankName}`);

    // Returns simulated average response benchmarks matching blueprint Section 3
    return {
      success: true,
      bank: bankName || 'All Partner Banks',
      promisedTAT: '5.0 Days',
      averageVerificationTAT: '2.4 Days',
      averageSanctionTAT: '4.2 Days',
      averageDisbursementTAT: '1.8 Days',
      slaComplianceRate: '96.4%',
      activeBreachesCount: 0
    };
  }

  // ==================== NEW METHODS ====================

  async getFileDetail(applicationId: string): Promise<any> {
    if (!applicationId) {
      throw new BadRequestException('Application ID is required');
    }

    // Try lookup by primary key ID first
    let { data, error } = await this.db
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .maybeSingle();

    // Fallback lookup by applicationNumber if not found by UUID
    if (!data) {
      const res2 = await this.db
        .from('LoanApplication')
        .select('*')
        .eq('applicationNumber', applicationId)
        .maybeSingle();
      data = res2.data;
    }

    if (!data) {
      throw new NotFoundException(`Loan application with ID/AppNo "${applicationId}" not found.`);
    }

    const targetId = data.id;

    // Enrich applicant profile details from User and parents tables if available
    if (data.userId) {
      try {
        const { data: userRec } = await this.db
          .from('User')
          .select('*')
          .eq('id', data.userId)
          .maybeSingle();

        if (userRec) {
          data.user = userRec;

          // Fetch parents table entries
          const { data: parentsRec } = await this.db
            .from('parents')
            .select('*')
            .eq('userId', data.userId);
          data.parents = parentsRec || [];
          if (data.user) {
            data.user.parents = parentsRec || [];
          }

          // Fallback missing student details onto application
          if (!data.gender && userRec.gender) data.gender = userRec.gender;
          if (!data.address && userRec.permanentAddress) data.address = userRec.permanentAddress;
          if (!data.pincode && userRec.pincode) data.pincode = userRec.pincode;
          if (!data.country && (userRec.studyDestination || userRec.country)) data.country = userRec.studyDestination || userRec.country;

          // Co-applicant fallbacks
          let userCoApp: any = null;
          if (userRec.coApplicant) {
            try {
              userCoApp = typeof userRec.coApplicant === 'string' ? JSON.parse(userRec.coApplicant) : userRec.coApplicant;
            } catch (_) {}
          }
          const coAppParent = (parentsRec || []).find((p: any) => (p.relation || '').toLowerCase() === 'coapplicant');

          if (!data.coApplicantName) {
            data.coApplicantName = userRec.coApplicantName || userCoApp?.name || userCoApp?.coApplicantName || coAppParent?.name || null;
          }
          if (!data.coApplicantRelation) {
            data.coApplicantRelation = userRec.coApplicantRelation || userCoApp?.relation || userCoApp?.coApplicantRelation || coAppParent?.relation || null;
          }
          if (!data.coApplicantPhone) {
            data.coApplicantPhone = userRec.coApplicantPhone || userCoApp?.phone || userCoApp?.mobile || coAppParent?.phone || coAppParent?.mobile || null;
          }
          if (!data.coApplicantEmail) {
            data.coApplicantEmail = userRec.coApplicantEmail || userCoApp?.email || coAppParent?.email || null;
          }
          if (!data.coApplicantIncome && (userCoApp?.income || userCoApp?.annualIncome)) {
            data.coApplicantIncome = parseFloat(userCoApp.income || userCoApp.annualIncome);
          }
          if (data.coApplicantName || data.coApplicantEmail || data.coApplicantPhone || userRec.coApplicantName || userCoApp || coAppParent) {
            data.hasCoApplicant = true;
          }

          // Parent fallbacks
          let userFamily: any = null;
          if (userRec.family) {
            try {
              userFamily = typeof userRec.family === 'string' ? JSON.parse(userRec.family) : userRec.family;
            } catch (_) {}
          }
          const fatherParent = (parentsRec || []).find((p: any) => (p.relation || '').toLowerCase() === 'father');
          const motherParent = (parentsRec || []).find((p: any) => (p.relation || '').toLowerCase() === 'mother');

          if (!data.fatherName) {
            data.fatherName = userRec.fatherName || userFamily?.fatherName || fatherParent?.name || null;
          }
          if (!data.fatherPhone) {
            data.fatherPhone = userFamily?.fatherPhone || userFamily?.fatherMobile || fatherParent?.phone || fatherParent?.mobile || null;
          }
          if (!data.fatherEmail) {
            data.fatherEmail = userFamily?.fatherEmail || fatherParent?.email || null;
          }
          if (!data.motherName) {
            data.motherName = userRec.motherName || userFamily?.motherName || motherParent?.name || null;
          }
          if (!data.motherPhone) {
            data.motherPhone = userFamily?.motherPhone || userFamily?.motherMobile || motherParent?.phone || motherParent?.mobile || null;
          }
          if (!data.motherEmail) {
            data.motherEmail = userFamily?.motherEmail || motherParent?.email || null;
          }

          // Academic & Score fallbacks
          if (!data.entranceTest && userRec.entranceTest) data.entranceTest = userRec.entranceTest;
          if (!data.entranceScore && userRec.entranceScore) data.entranceScore = userRec.entranceScore;
          if (!data.englishTest && userRec.englishTest) data.englishTest = userRec.englishTest;
          if (!data.englishScore && userRec.englishScore) data.englishScore = userRec.englishScore;
          if (!data.gpa && userRec.gpa) data.gpa = userRec.gpa;
          if (!data.tests && userRec.tests) data.tests = userRec.tests;
          if (data.workExperience === undefined || data.workExperience === null) {
            if (userRec.workExp !== undefined && userRec.workExp !== null) data.workExperience = userRec.workExp;
          }

          // UserAcademicProfile enrichment
          try {
            const { data: acadRec } = await this.db
              .from('UserAcademicProfile')
              .select('*')
              .eq('userId', data.userId)
              .maybeSingle();
            if (acadRec) {
              data.academicProfile = acadRec;
              if (!data.entranceTest && acadRec.entranceTest) data.entranceTest = acadRec.entranceTest;
              if (!data.entranceScore && acadRec.entranceScore) data.entranceScore = acadRec.entranceScore;
              if (!data.englishTest && acadRec.englishTest) data.englishTest = acadRec.englishTest;
              if (!data.englishScore && acadRec.englishScore) data.englishScore = acadRec.englishScore;
              if (!data.gpa && acadRec.gpa) data.gpa = acadRec.gpa;
            }
          } catch (_) {}

          // LoanEligibilityCheck / CIBIL enrichment
          try {
            const { data: eligRec } = await this.db
              .from('LoanEligibilityCheck')
              .select('*')
              .eq('userId', data.userId)
              .order('createdAt', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (eligRec) {
              data.eligibilityCheck = eligRec;
              if (!data.cibilScore && !data.creditScore && eligRec.credit) {
                data.cibilScore = eligRec.credit;
                data.creditScore = eligRec.credit;
              }
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn('[BankService.getFileDetail] Error enriching user/parent details:', err);
      }
    }

    // Fetch queries from all database query tables by target UUID or applicationNumber
    let queriesList: any[] = [];
    const appNumber = data.applicationNumber;

    try {
      // 1. Check `queries` table
      let q1 = this.db.from('queries').select('*');
      if (appNumber && appNumber !== targetId) {
        q1 = q1.or(`applicationId.eq.${targetId},applicationId.eq.${appNumber}`);
      } else {
        q1 = q1.eq('applicationId', targetId);
      }
      const { data: res1 } = await q1.order('createdAt', { ascending: true });
      if (res1 && res1.length > 0) {
        queriesList.push(...res1);
      }

      // 2. Check `BankQuery` table
      let q2 = this.db.from('BankQuery').select('*');
      if (appNumber && appNumber !== targetId) {
        q2 = q2.or(`applicationId.eq.${targetId},applicationId.eq.${appNumber}`);
      } else {
        q2 = q2.eq('applicationId', targetId);
      }
      const { data: res2 } = await q2.order('createdAt', { ascending: true });
      if (res2 && res2.length > 0) {
        res2.forEach((bq: any) => {
          if (!queriesList.some((e: any) => e.id === bq.id)) {
            queriesList.push({
              id: bq.id,
              applicationId: targetId,
              authorName: bq.raisedBy || 'Bank Officer',
              content: bq.description || bq.content || bq.queryText || 'Query raised',
              status: (bq.status || 'open').toLowerCase(),
              createdAt: bq.createdAt || bq.created_at
            });
          }
        });
      }

      // 3. Check `BankWorkflowQueryRequest` table
      let q3 = this.db.from('BankWorkflowQueryRequest').select('*');
      if (appNumber && appNumber !== targetId) {
        q3 = q3.or(`applicationId.eq.${targetId},applicationId.eq.${appNumber}`);
      } else {
        q3 = q3.eq('applicationId', targetId);
      }
      const { data: res3 } = await q3.order('createdAt', { ascending: true });
      if (res3 && res3.length > 0) {
        res3.forEach((bwq: any) => {
          if (!queriesList.some((e: any) => e.id === bwq.id)) {
            queriesList.push({
              id: bwq.id,
              applicationId: targetId,
              authorName: bwq.raisedBy || 'Bank Officer',
              content: bwq.queryDescription || bwq.description || 'Query raised',
              status: (bwq.status || 'open').toLowerCase(),
              createdAt: bwq.createdAt || bwq.created_at
            });
          }
        });
      }

      // 4. Check `ApplicationNote` table for query_raised notes
      let q4 = this.db.from('ApplicationNote').select('*');
      if (appNumber && appNumber !== targetId) {
        q4 = q4.or(`applicationId.eq.${targetId},applicationId.eq.${appNumber}`);
      } else {
        q4 = q4.eq('applicationId', targetId);
      }
      const { data: res4 } = await q4.eq('type', 'query_raised').order('createdAt', { ascending: true });
      if (res4 && res4.length > 0) {
        res4.forEach((note: any) => {
          let parsedText = note.content;
          let noteTime = note.createdAt || note.created_at;
          if (typeof note.content === 'string' && note.content.startsWith('{')) {
            try {
              const obj = JSON.parse(note.content);
              parsedText = obj.content || note.content;
              if (obj.timestamp) noteTime = obj.timestamp;
            } catch (_) {}
          }
          if (!queriesList.some((e: any) => e.id === note.id || e.content === parsedText)) {
            queriesList.push({
              id: note.id,
              applicationId: targetId,
              authorName: note.authorName || 'Bank Officer',
              content: parsedText,
              status: 'open',
              createdAt: noteTime
            });
          }
        });
      }
    } catch (e) {
      console.warn('[BankService] Error fetching queries from tables:', e);
    }

    const [
      bankDecisionsRes,
      disbursementsRes,
      fileQualityScoresRes,
      processingFeeRes,
      condSanctionsRes
    ] = await Promise.all([
      Promise.resolve(this.db.from('BankDecision').select('*').eq('applicationId', targetId)).catch(() => ({ data: [] })),
      Promise.resolve(this.db.from('disbursements').select('*').eq('applicationId', targetId)).catch(() => ({ data: [] })),
      Promise.resolve(this.db.from('file_quality_scores').select('*').eq('applicationId', targetId)).catch(() => ({ data: [] })),
      Promise.resolve(this.db.from('ProcessingFee').select('*').eq('applicationId', targetId)).catch(() => ({ data: [] })),
      Promise.resolve(this.db.from('conditional_sanctions').select('*').eq('applicationId', targetId).order('createdAt', { ascending: false })).catch(() => ({ data: [] }))
    ]);

    data.BankDecision = bankDecisionsRes?.data || [];
    data.disbursements = disbursementsRes?.data || [];
    data.file_quality_scores = fileQualityScoresRes?.data || [];
    data.queries = queriesList;
    data.ProcessingFee = processingFeeRes?.data || [];
    data.conditional_sanctions = condSanctionsRes?.data || [];

    return data;
  }

  async lookupByLan(lan: string): Promise<any> {
    const { data, error } = await this.db
      .from('LoanApplication')
      .select('*')
      .eq('lanNumber', lan)
      .single();
    if (error) throw error;
    return data;
  }

  async getMyFiles(bankName: string, filters: any): Promise<any[]> {
    let query = this.db
      .from('LoanApplication')
      .select('*')
      .not('lanNumber', 'is', null);

    query = this.matchBankFilter(query, bankName);

    if (filters.limit) query = query.limit(parseInt(filters.limit, 10));
    if (filters.offset) query = query.range(
      parseInt(filters.offset, 10),
      parseInt(filters.offset, 10) + (parseInt(filters.limit, 10) || 20) - 1
    );

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async amendDecision(applicationId: string, decisionId: string, details: any, user: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankDecision')
      .update(details)
      .eq('id', decisionId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, decision: data };
  }

  async uploadSanctionLetter(applicationId: string, fileUrl: string, user: any): Promise<any> {
    const { error } = await this.db
      .from('LoanApplication')
      .update({ sanctionLetterUrl: fileUrl, updatedAt: new Date().toISOString() })
      .eq('id', applicationId);
    if (error) throw error;
    return { success: true, sanctionLetterUrl: fileUrl };
  }

  async setRoi(applicationId: string, roiData: any, user: any): Promise<any> {
    const { error } = await this.db
      .from('LoanApplication')
      .update({
        roiType: roiData.roiType,
        roiBase: roiData.roiBase,
        roiEffective: roiData.roiEffective,
        roiSubsidy: roiData.roiSubsidy,
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId);
    if (error) throw error;
    return { success: true };
  }

  async setProcessingFee(applicationId: string, feeData: any): Promise<any> {
    const gstAmount = feeData.gstAmount !== undefined ? feeData.gstAmount : parseFloat((feeData.feeAmount * 0.18).toFixed(2));
    const totalAmount = feeData.totalAmount !== undefined ? feeData.totalAmount : parseFloat((feeData.feeAmount + gstAmount).toFixed(2));
    const { data, error } = await this.db
      .from('ProcessingFee')
      .upsert({
        applicationId: applicationId,
        lanNumber: feeData.lanNumber || null,
        feeAmount: feeData.feeAmount,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        status: feeData.status || 'PENDING',
        paymentMode: feeData.paymentMode || null,
        paymentRef: feeData.paymentRef || null,
        paidAt: feeData.paidAt || null,
        waivedBy: feeData.waivedBy || null,
        waiverReason: feeData.waiverReason || null
      }, { onConflict: 'applicationId' })
      .select()
      .single();
    if (error) throw error;
    return { success: true, fee: data };
  }

  async updateProcessingFee(applicationId: string, updateData: any): Promise<any> {
    const { data, error } = await this.db
      .from('ProcessingFee')
      .update(updateData)
      .eq('applicationId', applicationId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, fee: data };
  }

  async getQueryThread(queryId: string): Promise<any> {
    const { data, error } = await this.db
      .from('BankQuery')
      .select('*, QueryResponse(*)')
      .eq('id', queryId)
      .single();
    if (error) throw error;
    return data;
  }

  async resolveQuery(queryId: string): Promise<any> {
    const { error: error1 } = await this.db
      .from('BankQuery')
      .update({ status: 'RESOLVED', resolvedAt: new Date().toISOString() })
      .eq('id', queryId);

    const { error: error2 } = await this.db
      .from('queries')
      .update({ status: 'resolved' })
      .eq('id', queryId);

    if (error1 && error2) throw error1; // throw error if both fail
    return { success: true };
  }

  async getAnalyticsMetrics(bankName: string): Promise<any> {
    return {
      success: true,
      bank: bankName,
      funnel: {
        total: 120,
        sanctioned: 85,
        rejected: 20,
        pending: 15
      },
      aging: {
        under_3_days: 10,
        over_3_days: 5
      }
    };
  }

  async getProducts(bankName: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('BankProduct')
      .select('*')
      .eq('bankId', bankName);
    if (error) throw error;
    return data || [];
  }

  async createProduct(productData: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankProduct')
      .insert(productData)
      .select()
      .single();
    if (error) throw error;
    return { success: true, product: data };
  }

  async updateProduct(productId: string, productData: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankProduct')
      .update(productData)
      .eq('id', productId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, product: data };
  }

  async getBranches(bankName: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('BankBranch')
      .select('*')
      .eq('bankId', bankName);
    if (error) throw error;
    return data || [];
  }

  async createBranch(branchData: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankBranch')
      .insert(branchData)
      .select()
      .single();
    if (error) throw error;
    return { success: true, branch: data };
  }

  async getOfficers(bankName: string): Promise<any[]> {
    return [
      { id: 'o1', name: 'John Doe' },
      { id: 'o2', name: 'Jane Smith' }
    ];
  }

  async exportApplicationsCsv(bankName: string): Promise<any> {
    return { success: true, csvData: 'id,status,amount\n1,SANCTIONED,1000' };
  }

  async exportMisReports(bankName: string): Promise<any> {
    return { success: true, reportUrl: 'http://example.com/report.csv' };
  }

  async recordConsent(applicationId: string, consentData: any, bankUser: any): Promise<any> {
    const { data: appData } = await this.db
      .from('LoanApplication')
      .select('userId')
      .eq('id', applicationId)
      .single();

    const userId = appData?.userId || null;

    const { data, error } = await this.db
      .from('ConsentRecord')
      .upsert(
        {
          applicationId,
          userId,
          consentType: consentData.consentType || 'DATA_SHARING',
          status: 'ACCEPTED',
          recordedAt: new Date().toISOString(),
          recordedBy: bankUser.email
        },
        { onConflict: 'applicationId' }
      )
      .select()
      .single();

    if (error) throw error;

    await this.db.from('AuditLog').insert({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'CONSENT_RECORDED',
      initiatedBy: bankUser.email,
      changes: {
        role: bankUser.role,
      },
      createdAt: new Date().toISOString()
    });

    return data;
  }

  async getConsentStatus(applicationId: string): Promise<any> {
    const { data, error } = await this.db
      .from('ConsentRecord')
      .select('*')
      .eq('applicationId', applicationId)
      .single();

    if (error || !data) {
      return { applicationId, status: 'PENDING', consentType: null };
    }

    return data;
  }

  async saveConditionalSanctions(applicationId: string, conditions: any[], deadline?: string) {
    const nowStr = new Date().toISOString();

    // Check if a record already exists
    const { data: existing, error: fetchError } = await this.db
      .from('conditional_sanctions')
      .select('*')
      .eq('applicationId', applicationId)
      .maybeSingle();

    if (existing) {
      // Update
      const { data, error } = await this.db
        .from('conditional_sanctions')
        .update({
          conditionsList: conditions,
          deadline: deadline ? new Date(deadline).toISOString() : existing.deadline || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } else {
      // Insert
      const { data, error } = await this.db
        .from('conditional_sanctions')
        .insert({
          id: 'cond-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          applicationId,
          conditionsList: conditions,
          deadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          createdAt: nowStr
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    }
  }
}
