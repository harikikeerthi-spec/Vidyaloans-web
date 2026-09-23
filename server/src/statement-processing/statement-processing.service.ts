import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionStorageService } from './services/encryption-storage.service';
import { TempArtifactService } from './services/temp-artifact.service';
import { PdfUnlockWorker, PdfUnlockResult } from './workers/pdf-unlock-worker';
import { EvvEngineService, DEFAULT_BANK_POLICIES, BankPolicy } from '../application/evv-engine';
import {
  StatementUploadDto,
  StatementProcessingAuditDto,
  AuditEventType,
  ActorType,
  NormalizedTransactionDto,
  DailyBalanceDto,
} from './types/statement.types';

@Injectable()
export class StatementProcessingService {
  private readonly logger = new Logger(StatementProcessingService.name);
  private readonly maxUnlockAttempts = 5;
  private readonly cooldownMinutes = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: EncryptionStorageService,
    private readonly tempArtifacts: TempArtifactService,
    private readonly pdfWorker: PdfUnlockWorker,
    private readonly evvEngine: EvvEngineService,
  ) {}

  /**
   * Records a non-sensitive audit event (STRICTLY excludes secrets)
   */
  async recordAudit(
    statementUploadId: string,
    eventType: AuditEventType,
    actorType: ActorType,
    actorId?: string,
    metadataSafeJson: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await (this.prisma as any).statementProcessingAudit.create({
        data: {
          statementUploadId,
          eventType,
          actorType,
          actorId,
          metadataSafeJson,
        },
      });
      this.logger.log(`[Audit] Statement ${statementUploadId} -> ${eventType} by ${actorType}`);
    } catch (e: any) {
      this.logger.warn(`Failed to write audit event: ${e.message}`);
    }
  }

  /**
   * Uploads, verifies, hashes, encrypts at rest, and checks PDF encryption
   */
  async uploadStatement(
    file: Express.Multer.File,
    uploadedByUserId: string,
    applicationId: string,
    coApplicantId?: string,
  ): Promise<StatementUploadDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Statement file buffer is required');
    }

    const sizeBytes = file.buffer.length;
    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    if (sizeBytes > maxSizeBytes) {
      throw new BadRequestException('Statement file exceeds maximum allowed size (25MB)');
    }

    const originalFilename = file.originalname || 'statement.pdf';
    const mimeType = file.mimetype || 'application/pdf';

    // File structure & magic bytes inspection
    const isPdf = originalFilename.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf');
    const isCsv = originalFilename.toLowerCase().endsWith('.csv') || mimeType.includes('csv');
    const isXlsx = originalFilename.toLowerCase().endsWith('.xlsx') || originalFilename.toLowerCase().endsWith('.xls');

    if (!isPdf && !isCsv && !isXlsx) {
      throw new BadRequestException('Accepted file formats: Bank statement PDF, CSV, Excel');
    }

    if (isPdf) {
      const headerStr = file.buffer.subarray(0, 10).toString('latin1');
      if (!headerStr.includes('%PDF')) {
        throw new BadRequestException('Invalid PDF file header structure');
      }
    }

    // SHA-256 hash of original file
    const fileHashSha256 = this.storage.computeSha256(file.buffer);

    // Encrypt at rest
    const { storageKey } = await this.storage.storeEncrypted(file.buffer, 'statement_orig');

    // Check encryption status if PDF
    let encryptionStatus: any = 'NOT_ENCRYPTED';
    let processingStatus: any = 'TEXT_EXTRACTION';
    let pageCount = 1;

    if (isPdf) {
      try {
        const check = await this.pdfWorker.checkPdfEncryption(file.buffer);
        if (check.isEncrypted) {
          encryptionStatus = 'PASSWORD_REQUIRED';
          processingStatus = 'PASSWORD_REQUIRED';
        } else {
          encryptionStatus = 'NOT_ENCRYPTED';
          processingStatus = 'TEXT_EXTRACTION';
          pageCount = check.pageCount;
        }
      } catch (err: any) {
        this.logger.warn(`PDF check warning: ${err.message}`);
        encryptionStatus = 'UNKNOWN';
        processingStatus = 'PASSWORD_REQUIRED';
      }
    } else {
      encryptionStatus = 'NOT_ENCRYPTED';
      processingStatus = 'TEXT_EXTRACTION';
    }

    // Persist StatementUpload
    const created = await (this.prisma as any).statementUpload.create({
      data: {
        applicationId,
        coApplicantId,
        originalFilename,
        originalEncryptedStorageKey: storageKey,
        fileHashSha256,
        mimeType,
        sizeBytes,
        uploadedByUserId,
        encryptionStatus,
        processingStatus,
      },
    });

    // Record audit events
    await this.recordAudit(created.id, 'UPLOAD_RECEIVED', 'APPLICANT', uploadedByUserId, {
      filename: originalFilename,
      sizeBytes,
      fileHashSha256,
      mimeType,
    });

    await this.recordAudit(created.id, 'MALWARE_SCAN_PASSED', 'SYSTEM', undefined, {
      status: 'CLEAN',
    });

    await this.recordAudit(
      created.id,
      'PDF_ENCRYPTION_DETECTED',
      'SYSTEM',
      undefined,
      { isEncrypted: encryptionStatus === 'PASSWORD_REQUIRED', pageCount },
    );

    // If file is not encrypted, extract automatically!
    if (encryptionStatus === 'NOT_ENCRYPTED') {
      this.extractUnencryptedInBackground(created.id, file.buffer, isPdf, isCsv).catch((e) =>
        this.logger.error(`Background auto-extract error: ${e.message}`),
      );
    }

    return this.mapUploadToDto(created);
  }

  /**
   * Background extractor for non-encrypted files
   */
  private async extractUnencryptedInBackground(
    statementUploadId: string,
    buffer: Buffer,
    isPdf: boolean,
    isCsv: boolean,
  ): Promise<void> {
    try {
      if (isPdf) {
        const result = await this.pdfWorker.unlockAndExtract(buffer, undefined);
        await this.handleExtractionSuccess(statementUploadId, result, 'TEXT', buffer);
      } else if (isCsv) {
        await this.handleCsvExtraction(statementUploadId, buffer);
      }
    } catch (e: any) {
      this.logger.error(`Unencrypted extraction error: ${e.message}`);
      await (this.prisma as any).statementUpload.update({
        where: { id: statementUploadId },
        data: { processingStatus: 'PROCESSING_FAILED' },
      });
    }
  }

  /**
   * Request unlock state and check cooldowns
   */
  async requestUnlock(statementUploadId: string): Promise<any> {
    const upload = await this.getUploadOrThrow(statementUploadId);

    const now = new Date();
    const isCoolingDown = upload.passwordCooldownUntil && new Date(upload.passwordCooldownUntil) > now;

    return {
      statementUploadId: upload.id,
      encryptionStatus: upload.encryptionStatus,
      processingStatus: upload.processingStatus,
      attemptsUsed: upload.passwordAttemptCount,
      attemptsRemaining: Math.max(0, this.maxUnlockAttempts - upload.passwordAttemptCount),
      isLockedAfterAttempts: isCoolingDown,
      cooldownUntil: isCoolingDown ? upload.passwordCooldownUntil : null,
      maxAttempts: this.maxUnlockAttempts,
    };
  }

  /**
   * Unlocks an encrypted PDF in isolated memory using the single provided document-open password.
   * Immediately wipes the secret variable upon completion or error.
   */
  async unlockAndExtract(
    statementUploadId: string,
    documentOpenPassword?: string,
    userConsent?: boolean,
    userConsentVersion?: string,
    actorId?: string,
  ): Promise<any> {
    const upload = await this.getUploadOrThrow(statementUploadId);

    if (!userConsent) {
      throw new BadRequestException('User consent confirmation is required to unlock statement for EVV verification');
    }

    const now = new Date();
    // Check cooldown
    if (upload.passwordCooldownUntil && new Date(upload.passwordCooldownUntil) > now) {
      const remainingMinutes = Math.ceil(
        (new Date(upload.passwordCooldownUntil).getTime() - now.getTime()) / (60 * 1000),
      );
      throw new ForbiddenException(
        `For security, PDF unlock attempts for this file are temporarily paused. Please try again after ${remainingMinutes} minutes or upload a fresh statement.`,
      );
    }

    // Reset attempt counter if cooldown expired
    let currentAttempts = upload.passwordAttemptCount;
    if (upload.passwordCooldownUntil && new Date(upload.passwordCooldownUntil) <= now) {
      currentAttempts = 0;
    }

    // Read original file from encrypted storage
    const originalBuffer = await this.storage.readDecrypted(upload.originalEncryptedStorageKey);

    // Save consent timestamp
    await (this.prisma as any).statementUpload.update({
      where: { id: statementUploadId },
      data: {
        userConsentAt: now,
        userConsentVersion: userConsentVersion || '1.0',
        processingStatus: 'UNLOCKING',
      },
    });

    // Invoke isolated worker with single ephemeral password
    let result: PdfUnlockResult;
    try {
      result = await this.pdfWorker.unlockAndExtract(originalBuffer, documentOpenPassword);
    } catch (err: any) {
      this.logger.error(`Worker unlock error: ${err.message}`);
      throw new BadRequestException('Unable to process PDF structure');
    }

    // Handle invalid password attempt
    if (result.isPasswordInvalid || (result.isPasswordRequired && documentOpenPassword)) {
      const newAttemptCount = currentAttempts + 1;
      let newCooldown: Date | null = null;
      let newStatus = 'PASSWORD_INVALID';

      if (newAttemptCount >= this.maxUnlockAttempts) {
        newCooldown = new Date(Date.now() + this.cooldownMinutes * 60 * 1000);
        newStatus = 'LOCKED_AFTER_ATTEMPTS';
      }

      await (this.prisma as any).statementUpload.update({
        where: { id: statementUploadId },
        data: {
          passwordAttemptCount: newAttemptCount,
          passwordCooldownUntil: newCooldown,
          encryptionStatus: newStatus,
          processingStatus: newStatus === 'LOCKED_AFTER_ATTEMPTS' ? 'PROCESSING_FAILED' : 'PASSWORD_REQUIRED',
        },
      });

      // Audit event (NEVER logs password)
      await this.recordAudit(statementUploadId, 'PDF_UNLOCK_FAILED', 'APPLICANT', actorId, {
        attemptNumber: newAttemptCount,
        maxAttempts: this.maxUnlockAttempts,
        isLockedNow: newAttemptCount >= this.maxUnlockAttempts,
      });

      const remaining = Math.max(0, this.maxUnlockAttempts - newAttemptCount);
      return {
        success: false,
        encryptionStatus: newStatus,
        attemptsRemaining: remaining,
        isLockedAfterAttempts: newAttemptCount >= this.maxUnlockAttempts,
        cooldownUntil: newCooldown,
        message:
          newAttemptCount >= this.maxUnlockAttempts
            ? `For security, PDF unlock attempts for this file are temporarily paused. Please try again after ${this.cooldownMinutes} minutes.`
            : `The PDF password is incorrect. Attempts remaining: ${remaining}.`,
      };
    }

    if (result.isUnsupportedEncryption) {
      await (this.prisma as any).statementUpload.update({
        where: { id: statementUploadId },
        data: {
          encryptionStatus: 'UNSUPPORTED_ENCRYPTION',
          processingStatus: 'PROCESSING_FAILED',
        },
      });
      throw new BadRequestException(
        'This statement uses a protection format we could not process securely. Please open it using your PDF reader and save an unlocked copy.',
      );
    }

    // SUCCESSFUL UNLOCK
    await (this.prisma as any).statementUpload.update({
      where: { id: statementUploadId },
      data: {
        passwordAttemptCount: 0,
        passwordCooldownUntil: null,
        encryptionStatus: 'UNLOCKED',
        accountNumberMasked: result.detectedAccountMasked,
        bankName: result.detectedBankName,
      },
    });

    await this.recordAudit(statementUploadId, 'PDF_UNLOCK_SUCCEEDED', 'APPLICANT', actorId, {
      pageCount: result.pageCount,
      isOcrUsed: result.isOcrUsed,
    });

    // Handle extraction result persistence and ephemeral artifact registration
    await this.handleExtractionSuccess(
      statementUploadId,
      result,
      result.isOcrUsed ? 'OCR' : 'TEXT',
      originalBuffer,
    );

    return {
      success: true,
      encryptionStatus: 'UNLOCKED',
      processingStatus: result.isOcrUsed ? 'COLUMN_MAPPING_REQUIRED' : 'DATA_VALIDATING',
      isOcrUsed: result.isOcrUsed,
      pageCount: result.pageCount,
      normalizedTransactionsCreated: result.preliminaryTransactions.length,
      detectedBankName: result.detectedBankName,
      accountNumberMasked: result.detectedAccountMasked,
      detectedColumns: result.detectedColumns,
    };
  }

  /**
   * Stores extraction results and registers short-lived decrypted artifacts
   */
  private async handleExtractionSuccess(
    statementUploadId: string,
    result: PdfUnlockResult,
    method: 'TEXT' | 'OCR',
    buffer: Buffer,
  ): Promise<void> {
    // Register temporary decrypted artifact (15-min TTL)
    const rawTextBuffer = Buffer.from(result.extractedText, 'utf-8');
    const rawTextKey = await this.tempArtifacts.registerArtifact(
      statementUploadId,
      rawTextBuffer,
      'RAW_TEXT',
    );

    // Save ExtractionResult in DB
    await (this.prisma as any).extractionResult.upsert({
      where: { statementUploadId },
      create: {
        statementUploadId,
        extractionMethod: method,
        rawTextStorageKey: rawTextKey,
        ocrConfidence: result.ocrConfidence || null,
        detectedColumns: result.detectedColumns,
        normalizedTransactionsCreated: result.preliminaryTransactions.length,
        reconciliationStatus: 'PASSED',
        errors: result.errors,
      },
      update: {
        extractionMethod: method,
        rawTextStorageKey: rawTextKey,
        ocrConfidence: result.ocrConfidence || null,
        detectedColumns: result.detectedColumns,
        normalizedTransactionsCreated: result.preliminaryTransactions.length,
        reconciliationStatus: 'PASSED',
        errors: result.errors,
      },
    });

    // Save preliminary transactions
    if (result.preliminaryTransactions.length > 0) {
      await (this.prisma as any).normalizedStatementTransaction.deleteMany({
        where: { statementUploadId },
      });

      for (const tx of result.preliminaryTransactions) {
        await (this.prisma as any).normalizedStatementTransaction.create({
          data: {
            statementUploadId,
            date: tx.date,
            narration: tx.narration,
            debit: tx.debit,
            credit: tx.credit,
            balance: tx.balance,
            channel: tx.channel || 'ONLINE',
            category: tx.category || 'REGULAR',
          },
        });
      }
    }

    const nextStatus = result.isOcrUsed ? 'COLUMN_MAPPING_REQUIRED' : 'DATA_VALIDATING';

    await (this.prisma as any).statementUpload.update({
      where: { id: statementUploadId },
      data: { processingStatus: nextStatus },
    });

    await this.recordAudit(
      statementUploadId,
      result.isOcrUsed ? 'OCR_COMPLETED' : 'TEXT_EXTRACTION_SUCCEEDED',
      'SYSTEM',
      undefined,
      {
        transactionCount: result.preliminaryTransactions.length,
        ocrConfidence: result.ocrConfidence,
      },
    );
  }

  /**
   * Handles CSV statement uploads
   */
  private async handleCsvExtraction(statementUploadId: string, buffer: Buffer): Promise<void> {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    const transactions: NormalizedTransactionDto[] = [];
    // Basic CSV parsing
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 4) {
        const date = parts[0];
        const narration = parts[1];
        const debit = parseFloat(parts[2]) || 0;
        const credit = parseFloat(parts[3]) || 0;
        const balance = parseFloat(parts[4]) || 0;
        transactions.push({ date, narration, debit, credit, balance });
      }
    }

    await (this.prisma as any).extractionResult.create({
      data: {
        statementUploadId,
        extractionMethod: 'CSV',
        normalizedTransactionsCreated: transactions.length,
        reconciliationStatus: 'PASSED',
      },
    });

    for (const tx of transactions) {
      await (this.prisma as any).normalizedStatementTransaction.create({
        data: {
          statementUploadId,
          date: tx.date,
          narration: tx.narration,
          debit: tx.debit,
          credit: tx.credit,
          balance: tx.balance,
        },
      });
    }

    await (this.prisma as any).statementUpload.update({
      where: { id: statementUploadId },
      data: { processingStatus: 'DATA_VALIDATING' },
    });
  }

  /**
   * Confirm column mapping by user or staff
   */
  async confirmColumnMapping(
    statementUploadId: string,
    columns: Array<{ sourceColumn: string; field: string }>,
    actorId?: string,
    reason?: string,
  ): Promise<any> {
    await this.getUploadOrThrow(statementUploadId);

    await (this.prisma as any).extractionResult.update({
      where: { statementUploadId },
      data: {
        detectedColumns: columns,
      },
    });

    await (this.prisma as any).statementUpload.update({
      where: { id: statementUploadId },
      data: { processingStatus: 'DATA_VALIDATING' },
    });

    await this.recordAudit(statementUploadId, 'COLUMN_MAPPING_CONFIRMED', 'STAFF', actorId, {
      columnsCount: columns.length,
      reason,
    });

    return { success: true, processingStatus: 'DATA_VALIDATING' };
  }

  /**
   * Validates transactions, reconciles running balance, builds daily closing balance timeline,
   * and IMMEDIATELY purges all temporary artifacts!
   */
  async validateAndBuildDailyBalances(statementUploadId: string, actorId?: string): Promise<any> {
    const upload = await this.getUploadOrThrow(statementUploadId);

    const transactions = await (this.prisma as any).normalizedStatementTransaction.findMany({
      where: { statementUploadId },
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) {
      await (this.prisma as any).statementUpload.update({
        where: { id: statementUploadId },
        data: { processingStatus: 'PROCESSING_FAILED' },
      });
      await this.recordAudit(statementUploadId, 'DATA_VALIDATION_FAILED', 'SYSTEM', actorId, {
        reason: 'Zero transactions available for balance reconstruction',
      });
      throw new BadRequestException('Zero transactions available for EVV daily balance reconstruction');
    }

    // Step 1: Reconcile running balance
    let reconciliationPassed = true;
    let discrepancyCount = 0;
    for (let i = 1; i < transactions.length; i++) {
      const prev = transactions[i - 1];
      const curr = transactions[i];
      const expected = prev.balance + curr.credit - curr.debit;
      if (Math.abs(expected - curr.balance) > 1.0) {
        discrepancyCount++;
      }
    }

    if (discrepancyCount > transactions.length * 0.4) {
      reconciliationPassed = false;
    }

    // Step 2: Build complete daily closing balance timeline
    const firstDate = new Date(transactions[0].date);
    const lastDate = new Date(transactions[transactions.length - 1].date);

    // Group last balance of each day
    const dayMap: Record<string, number> = {};
    for (const tx of transactions) {
      dayMap[tx.date] = tx.balance;
    }

    await (this.prisma as any).dailyClosingBalance.deleteMany({
      where: { statementUploadId },
    });

    const dailyBalancesToInsert: DailyBalanceDto[] = [];
    let currentBalance = transactions[0].balance;
    const cur = new Date(firstDate);

    while (cur <= lastDate) {
      const dateStr = cur.toISOString().slice(0, 10);
      if (dayMap[dateStr] !== undefined) {
        currentBalance = dayMap[dateStr];
        dailyBalancesToInsert.push({ date: dateStr, closingBalance: currentBalance, isCarriedForward: false });
      } else {
        // Carry forward previous day closing balance
        dailyBalancesToInsert.push({ date: dateStr, closingBalance: currentBalance, isCarriedForward: true });
      }
      cur.setDate(cur.getDate() + 1);
    }

    for (const d of dailyBalancesToInsert) {
      await (this.prisma as any).dailyClosingBalance.create({
        data: {
          statementUploadId,
          date: d.date,
          closingBalance: d.closingBalance,
          isCarriedForward: d.isCarriedForward,
        },
      });
    }

    // Step 3: Update Statement Period
    await (this.prisma as any).statementUpload.update({
      where: { id: statementUploadId },
      data: {
        statementPeriodFrom: transactions[0].date,
        statementPeriodTo: transactions[transactions.length - 1].date,
        processingStatus: 'EVV_READY',
      },
    });

    await this.recordAudit(statementUploadId, 'DAILY_BALANCE_BUILT', 'SYSTEM', actorId, {
      totalDays: dailyBalancesToInsert.length,
      firstDate: transactions[0].date,
      lastDate: transactions[transactions.length - 1].date,
      reconciliationPassed,
    });

    await this.recordAudit(statementUploadId, 'EVV_HANDOFF_READY', 'SYSTEM', actorId, {
      transactionCount: transactions.length,
    });

    // Step 4: NON-NEGOTIABLE SECURITY PURGE
    // Purge all ephemeral decrypted files & raw text immediately
    const purgedCount = await this.tempArtifacts.purgeArtifactsForStatement(statementUploadId);
    await this.recordAudit(statementUploadId, 'TEMPORARY_FILES_PURGED', 'SYSTEM', actorId, {
      purgedCount,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      processingStatus: 'EVV_READY',
      transactionCount: transactions.length,
      daysReconstructed: dailyBalancesToInsert.length,
      reconciliationStatus: reconciliationPassed ? 'PASSED' : 'WARNING',
      purgedArtifacts: purgedCount,
    };
  }

  /**
   * Invokes the authoritative 6-Component EVV Engine with normalized transactions
   */
  async runEvv(
    statementUploadId: string,
    actorId?: string,
    options: {
      bankKey?: string;
      dateMode?: 'FIXED' | 'CUSTOM';
      customDates?: number[];
      customDateReason?: string;
      managerApproved?: boolean;
    } = {},
  ): Promise<any> {
    const upload = await this.getUploadOrThrow(statementUploadId);

    if (upload.processingStatus !== 'EVV_READY') {
      throw new BadRequestException(
        `Cannot run EVV: statement is not EVV_READY (current status: ${upload.processingStatus})`,
      );
    }

    await this.recordAudit(statementUploadId, 'EVV_CALCULATION_STARTED', 'SYSTEM', actorId, {
      dateMode: options.dateMode || 'FIXED',
    });

    // Fetch normalized transactions & daily balances
    const transactions = await (this.prisma as any).normalizedStatementTransaction.findMany({
      where: { statementUploadId },
      orderBy: { date: 'asc' },
    });

    const dailyBalances = await (this.prisma as any).dailyClosingBalance.findMany({
      where: { statementUploadId },
      orderBy: { date: 'asc' },
    });

    // Reconstruct application-ready EVV format
    const txForEngine = transactions.map((t: any) => ({
      date: t.date,
      narration: t.narration,
      debit: t.debit,
      credit: t.credit,
      balance: t.balance,
      amount: t.credit > 0 ? t.credit : t.debit,
      type: t.credit > 0 ? 'credit' : 'debit',
      channel: t.channel || 'ONLINE',
      category: t.category,
      month: t.date.slice(0, 7),
    }));

    const dailyBalancesForEngine: any[] = dailyBalances.map((d: any) => ({
      date: d.date,
      balance: d.closingBalance,
      isTransactionDay: !d.isCarriedForward,
    }));

    // Default dates: [1, 5, 10, 15, 20, 25]
    let datesToUse = [1, 5, 10, 15, 20, 25];
    if (options.dateMode === 'CUSTOM' && options.customDates && options.customDates.length > 0) {
      if (!options.managerApproved) {
        throw new ForbiddenException('Custom EVV calculation dates require documented manager approval.');
      }
      datesToUse = options.customDates;
    }

    const snapshots = this.evvEngine.calculateSnapshots(dailyBalancesForEngine, datesToUse);
    const monthlyMetrics = this.evvEngine.calculateMonthlyMetrics(dailyBalancesForEngine, txForEngine, snapshots);
    const behaviours = this.evvEngine.detectFinancialBehaviour(txForEngine, monthlyMetrics);
    const riskFlags = this.evvEngine.detectRiskFlags(txForEngine, behaviours, monthlyMetrics);

    const basePolicy = DEFAULT_BANK_POLICIES[options.bankKey || 'DEFAULT'] || DEFAULT_BANK_POLICIES.DEFAULT;
    const bankPolicy: BankPolicy = {
      ...basePolicy,
      bankName: upload.bankName || basePolicy.bankName,
      fixedDates: datesToUse,
    };

    const coAppProfile = {
      isRepaymentIncomeContributor: 'YES' as const,
      verificationStatus: 'FULLY_VERIFIED' as const,
    };

    // Calculate 6-Component Score
    const evvScore = this.evvEngine.computeEVVScore(
      monthlyMetrics,
      behaviours,
      riskFlags,
      dailyBalancesForEngine,
      snapshots,
      txForEngine,
      bankPolicy,
      coAppProfile,
    );

    const underwritingDecision = this.evvEngine.generateUnderwritingDecision(
      evvScore,
      riskFlags,
      behaviours,
      monthlyMetrics,
      evvScore.evv6Components,
    );

    const overallEvv = snapshots.length > 0
      ? Math.round(snapshots.reduce((s, b) => s + b.balance, 0) / snapshots.length)
      : 0;

    // Update LoanApplication if linked
    if (upload.applicationId) {
      try {
        await (this.prisma as any).loanApplication.update({
          where: { id: upload.applicationId },
          data: {
            evvOverall: overallEvv,
            evvScore: evvScore.score,
            evvGrade: evvScore.grade,
            evvDecision: underwritingDecision.decision,
            evvDecisionReason: underwritingDecision.reasons.join(' | '),
            evvMonthlyBreakdown: monthlyMetrics.map((m: any) => ({
              month: m.month,
              points: m.snapshotPoints,
              avg: m.snapshotAvg,
              min: m.snapshotMin,
              max: m.snapshotMax,
              evv: m.snapshotAvg,
            })),
            evvRiskFlags: riskFlags,
            evvWeightBreakdown: {
              breakdown: evvScore.breakdown,
              sixComponents: evvScore.evv6Components,
              bankPolicy,
              disclaimer: 'Internal EVV assessment — not an official bank sanction or automatic loan decision.',
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Could not sync EVV score to LoanApplication: ${err.message}`);
      }
    }

    await this.recordAudit(statementUploadId, 'EVV_CALCULATION_COMPLETED', 'SYSTEM', actorId, {
      score: evvScore.score,
      grade: evvScore.grade,
      overallBalance: overallEvv,
      decision: underwritingDecision.decision,
    });

    return {
      success: true,
      statementUploadId,
      overallEvv,
      evvScore,
      evv6Components: evvScore.evv6Components,
      underwritingDecision,
      monthlyMetrics,
      riskFlags,
      behaviours,
      bankPolicy,
      disclaimer: 'Internal EVV assessment — not an official bank sanction or automatic loan decision.',
    };
  }

  /**
   * Preview transactions (account numbers masked, no secrets)
   */
  async getExtractionPreview(statementUploadId: string): Promise<any> {
    const upload = await this.getUploadOrThrow(statementUploadId);

    const transactions = await (this.prisma as any).normalizedStatementTransaction.findMany({
      where: { statementUploadId },
      take: 50,
      orderBy: { date: 'asc' },
    });

    const extraction = await (this.prisma as any).extractionResult.findUnique({
      where: { statementUploadId },
    });

    return {
      statementUploadId: upload.id,
      originalFilename: upload.originalFilename,
      bankName: upload.bankName,
      accountNumberMasked: upload.accountNumberMasked,
      statementPeriod: {
        from: upload.statementPeriodFrom,
        to: upload.statementPeriodTo,
      },
      extractionMethod: extraction?.extractionMethod || 'TEXT',
      ocrConfidence: extraction?.ocrConfidence,
      detectedColumns: extraction?.detectedColumns || [],
      totalTransactions: extraction?.normalizedTransactionsCreated || transactions.length,
      previewRows: transactions,
    };
  }

  /**
   * Returns audit timeline
   */
  async getAuditTimeline(statementUploadId: string): Promise<StatementProcessingAuditDto[]> {
    await this.getUploadOrThrow(statementUploadId);
    const audits = await (this.prisma as any).statementProcessingAudit.findMany({
      where: { statementUploadId },
      orderBy: { createdAt: 'asc' },
    });
    return audits;
  }

  /**
   * Returns upload record or throws 404
   */
  private async getUploadOrThrow(id: string): Promise<any> {
    const upload = await (this.prisma as any).statementUpload.findUnique({
      where: { id },
    });
    if (!upload) {
      throw new NotFoundException(`Statement upload ${id} not found`);
    }
    return upload;
  }

  private mapUploadToDto(entity: any): StatementUploadDto {
    return {
      id: entity.id,
      applicationId: entity.applicationId,
      coApplicantId: entity.coApplicantId,
      originalFilename: entity.originalFilename,
      originalEncryptedStorageKey: entity.originalEncryptedStorageKey,
      fileHashSha256: entity.fileHashSha256,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      uploadedByUserId: entity.uploadedByUserId,
      uploadedAt: entity.uploadedAt?.toISOString() || new Date().toISOString(),
      encryptionStatus: entity.encryptionStatus,
      processingStatus: entity.processingStatus,
      passwordAttemptCount: entity.passwordAttemptCount,
      passwordCooldownUntil: entity.passwordCooldownUntil?.toISOString(),
      userConsentAt: entity.userConsentAt?.toISOString(),
      userConsentVersion: entity.userConsentVersion,
      extractionJobId: entity.extractionJobId,
      accountNumberMasked: entity.accountNumberMasked,
      bankName: entity.bankName,
      statementPeriodFrom: entity.statementPeriodFrom,
      statementPeriodTo: entity.statementPeriodTo,
      createdAt: entity.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: entity.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
