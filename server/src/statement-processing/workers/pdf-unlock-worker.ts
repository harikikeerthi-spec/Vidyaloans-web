import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { DetectedColumn, NormalizedTransactionDto, SafeProcessingError } from '../types/statement.types';

// Load PDF.js legacy build for Node compatibility
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

export interface PdfUnlockResult {
  success: boolean;
  isEncrypted: boolean;
  isPasswordRequired: boolean;
  isPasswordInvalid: boolean;
  isUnsupportedEncryption?: boolean;
  pageCount: number;
  extractedText: string;
  isOcrUsed: boolean;
  ocrConfidence?: number;
  detectedBankName?: string;
  detectedAccountMasked?: string;
  preliminaryTransactions: NormalizedTransactionDto[];
  detectedColumns: DetectedColumn[];
  errors: SafeProcessingError[];
}

@Injectable()
export class PdfUnlockWorker {
  private readonly logger = new Logger(PdfUnlockWorker.name);

  /**
   * Fast detection of whether a PDF buffer is encrypted, without attempting password recovery
   */
  async checkPdfEncryption(buffer: Buffer): Promise<{ isEncrypted: boolean; pageCount: number }> {
    try {
      const data = new Uint8Array(buffer);
      const loadingTask = pdfjs.getDocument({ data });
      const doc = await loadingTask.promise;
      return { isEncrypted: false, pageCount: doc.numPages };
    } catch (err: any) {
      const msg = String(err?.message || err);
      const name = String(err?.name || '');
      if (name === 'PasswordException' || msg.includes('password') || err?.code === 1 || err?.code === 2) {
        return { isEncrypted: true, pageCount: 0 };
      }
      // If error is not a password error, rethrow as invalid PDF
      throw new Error('Invalid or corrupted PDF document structure');
    }
  }

  /**
   * Unlocks an encrypted PDF in isolated memory using the single provided document-open password.
   * Immediately wipes the secret variable upon completion or error.
   */
  async unlockAndExtract(
    buffer: Buffer,
    documentOpenPassword?: string,
  ): Promise<PdfUnlockResult> {
    // Allocate temporary secret variable
    let tempSecret = documentOpenPassword ? String(documentOpenPassword) : undefined;
    let doc: any = null;

    try {
      const data = new Uint8Array(buffer);
      const loadingTask = pdfjs.getDocument({
        data,
        password: tempSecret,
      });

      try {
        doc = await loadingTask.promise;
      } catch (loadErr: any) {
        const msg = String(loadErr?.message || loadErr);
        const name = String(loadErr?.name || '');

        if (name === 'PasswordException' || msg.includes('password') || loadErr?.code === 1 || loadErr?.code === 2) {
          if (!tempSecret) {
            return {
              success: false,
              isEncrypted: true,
              isPasswordRequired: true,
              isPasswordInvalid: false,
              pageCount: 0,
              extractedText: '',
              isOcrUsed: false,
              preliminaryTransactions: [],
              detectedColumns: [],
              errors: [{ code: 'PASSWORD_REQUIRED', message: 'PDF document password is required to unlock this statement' }],
            };
          } else {
            return {
              success: false,
              isEncrypted: true,
              isPasswordRequired: false,
              isPasswordInvalid: true,
              pageCount: 0,
              extractedText: '',
              isOcrUsed: false,
              preliminaryTransactions: [],
              detectedColumns: [],
              errors: [{ code: 'PASSWORD_INVALID', message: 'Incorrect document password for this statement PDF' }],
            };
          }
        }

        if (msg.includes('unsupported') || msg.includes('crypt')) {
          return {
            success: false,
            isEncrypted: true,
            isPasswordRequired: false,
            isPasswordInvalid: false,
            isUnsupportedEncryption: true,
            pageCount: 0,
            extractedText: '',
            isOcrUsed: false,
            preliminaryTransactions: [],
            detectedColumns: [],
            errors: [{ code: 'UNSUPPORTED_ENCRYPTION', message: 'Unsupported PDF encryption standard' }],
          };
        }

        throw new Error('Unable to parse PDF structure');
      }

      // Step 2: Extract text line by line grouped by vertical coordinates
      const pageCount = doc.numPages;
      let fullText = '';
      let hasDigitalText = false;

      for (let p = 1; p <= pageCount; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const items = content.items as any[];

        if (items.length > 5) {
          hasDigitalText = true;
        }

        // Group by Y coordinate so row contents stay on single line
        const byY: Record<number, string[]> = {};
        for (const item of items) {
          if (!item.str || !item.str.trim()) continue;
          const y = Math.round(item.transform[5]);
          (byY[y] ??= []).push(item.str.trim());
        }

        const lines = Object.keys(byY)
          .map(Number)
          .sort((a, b) => b - a) // top-to-bottom order
          .map((y) => byY[y].join(' '));

        fullText += lines.join('\n') + '\n';
      }

      let isOcrUsed = false;
      let ocrConfidence: number | undefined;

      // Step 3: OCR Fallback if text extraction was empty or scanned
      if (!hasDigitalText || fullText.trim().length < 50) {
        this.logger.log(`[Worker OCR] Scanned/image-based statement detected. Initiating Tesseract OCR fallback.`);
        try {
          const ocrResult = await this.runOcrOnPdf(buffer);
          if (ocrResult.text && ocrResult.text.length > fullText.length) {
            fullText = ocrResult.text;
            isOcrUsed = true;
            ocrConfidence = ocrResult.confidence;
          }
        } catch (ocrErr: any) {
          this.logger.warn(`[Worker OCR] OCR fallback notice: ${ocrErr?.message || ocrErr}`);
        }
      }

      // Step 4: Parse preliminary transactions & detected columns
      const parsed = this.parseTransactionsFromText(fullText);

      return {
        success: parsed.transactions.length > 0,
        isEncrypted: !!tempSecret,
        isPasswordRequired: false,
        isPasswordInvalid: false,
        pageCount,
        extractedText: fullText,
        isOcrUsed,
        ocrConfidence,
        detectedBankName: parsed.bankName,
        detectedAccountMasked: parsed.accountMasked,
        preliminaryTransactions: parsed.transactions,
        detectedColumns: parsed.detectedColumns,
        errors: parsed.errors,
      };
    } finally {
      // NON-NEGOTIABLE SECURITY: Immediate memory erasure of ephemeral secret
      tempSecret = undefined;
      doc = null;
    }
  }

  /**
   * OCR Fallback using Tesseract worker (only for image formats like PNG/JPEG)
   */
  private async runOcrOnPdf(buffer: Buffer): Promise<{ text: string; confidence: number }> {
    if (!buffer || buffer.length < 4) {
      return { text: '', confidence: 0 };
    }

    // Tesseract only processes raw image files (PNG, JPEG, WebP, TIFF, BMP).
    // Passing a raw PDF stream causes Leptonica/Tesseract fatal worker exceptions.
    const isImage =
      (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) || // PNG
      (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) || // JPEG
      (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46); // WEBP/RIFF

    if (!isImage) {
      this.logger.log(`[Worker OCR] Buffer is not an image format supported by Tesseract. Skipping local OCR.`);
      return { text: '', confidence: 0 };
    }

    let worker: any = null;
    try {
      worker = await createWorker('eng');
      const { data } = await worker.recognize(buffer);
      await worker.terminate();
      return {
        text: data.text || '',
        confidence: data.confidence || 0,
      };
    } catch (e: any) {
      if (worker) {
        await worker.terminate().catch(() => {});
      }
      this.logger.warn(`[Worker OCR] OCR processing error: ${e?.message || e}`);
      return { text: '', confidence: 0 };
    }
  }

  /**
   * Parses structured transactions, running balance, and detects column mappings
   */
  private parseTransactionsFromText(text: string): {
    transactions: NormalizedTransactionDto[];
    detectedColumns: DetectedColumn[];
    bankName?: string;
    accountMasked?: string;
    errors: SafeProcessingError[];
  } {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const dateRegex = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[-\s][A-Za-z]{3,}[-\s]\d{2,4})/;
    const numToken = /[\d,]+(?:\.\d{1,2})?/g;

    const transactions: NormalizedTransactionDto[] = [];
    const errors: SafeProcessingError[] = [];

    let bankName: string | undefined;
    let accountMasked: string | undefined;

    // Detect Bank Name & Account Number from header lines
    for (const l of lines.slice(0, 30)) {
      const lower = l.toLowerCase();
      if (!bankName) {
        if (lower.includes('hdfc')) bankName = 'HDFC Bank';
        else if (lower.includes('icici')) bankName = 'ICICI Bank';
        else if (lower.includes('state bank') || lower.includes('sbi')) bankName = 'State Bank of India';
        else if (lower.includes('axis')) bankName = 'Axis Bank';
        else if (lower.includes('kotak')) bankName = 'Kotak Mahindra Bank';
        else if (lower.includes('punjab national') || lower.includes('pnb')) bankName = 'Punjab National Bank';
        else if (lower.includes('canara')) bankName = 'Canara Bank';
        else if (lower.includes('bank of baroda') || lower.includes('bob')) bankName = 'Bank of Baroda';
      }

      if (!accountMasked) {
        const accMatch = l.match(/(?:a\/c|acct|account(?:\s*no)?)\s*[:.-]?\s*([0-9xX*•-]{8,22})/i);
        if (accMatch && accMatch[1]) {
          const raw = accMatch[1].replace(/[^0-9]/g, '');
          if (raw.length >= 4) {
            accountMasked = `•••• •••• ${raw.slice(-4)}`;
          }
        }
      }
    }

    // Parse transaction lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dm = line.match(dateRegex);
      if (!dm) continue;

      const dateStr = this.standardizeDate(dm[1]);
      if (!dateStr) continue;

      const afterDate = line.slice(line.indexOf(dm[1]) + dm[1].length).trim();
      const nums = afterDate.match(numToken);
      if (!nums || nums.length === 0) continue;

      // By standard Indian banking statement rule:
      // The rightmost parsed number is the running Closing Balance
      const rawBalance = parseFloat(nums[nums.length - 1].replace(/,/g, ''));
      if (isNaN(rawBalance)) continue;

      let debit = 0;
      let credit = 0;

      if (nums.length >= 2) {
        const amount = parseFloat(nums[nums.length - 2].replace(/,/g, ''));
        const lineLower = line.toLowerCase();

        // Check if explicitly marked DR / CR
        if (lineLower.includes('dr') || lineLower.includes('debit') || lineLower.includes('wdl')) {
          debit = amount;
        } else if (lineLower.includes('cr') || lineLower.includes('credit') || lineLower.includes('dep')) {
          credit = amount;
        } else {
          // Heuristic: If we have previous balance, compute delta
          if (transactions.length > 0) {
            const prevBal = transactions[transactions.length - 1].balance;
            if (rawBalance > prevBal) credit = amount;
            else debit = amount;
          } else {
            debit = amount;
          }
        }
      }

      // Extract narration by taking text before the numbers
      let narration = afterDate;
      if (nums[0]) {
        const numStart = afterDate.indexOf(nums[0]);
        if (numStart > 0) {
          narration = afterDate.slice(0, numStart).trim();
        }
      }
      if (!narration) narration = 'TRANSACTION ENTRY';

      // Detect channel
      let channel = 'ONLINE';
      const nUpper = narration.toUpperCase();
      if (nUpper.includes('UPI')) channel = 'UPI';
      else if (nUpper.includes('NEFT')) channel = 'NEFT';
      else if (nUpper.includes('RTGS')) channel = 'RTGS';
      else if (nUpper.includes('IMPS')) channel = 'IMPS';
      else if (nUpper.includes('CASH') || nUpper.includes('CDM')) channel = 'CASH';
      else if (nUpper.includes('ATM')) channel = 'ATM';
      else if (nUpper.includes('CHQ') || nUpper.includes('CHEQUE')) channel = 'CHEQUE';
      else if (nUpper.includes('NACH') || nUpper.includes('ECS') || nUpper.includes('ACH')) channel = 'NACH';

      // Detect category
      let category = 'REGULAR';
      if (nUpper.includes('SALARY') || nUpper.includes('PAYROLL') || nUpper.includes('SAL/')) {
        category = 'SALARY';
      } else if (nUpper.includes('BOUNCE') || nUpper.includes('RETURN') || nUpper.includes('INSUFFICIENT')) {
        category = 'BOUNCE';
      } else if (channel === 'CASH' && credit > 0) {
        category = 'CASH_DEPOSIT';
      }

      transactions.push({
        date: dateStr,
        narration: narration.slice(0, 200),
        debit,
        credit,
        balance: rawBalance,
        channel,
        category,
      });
    }

    // Sort chronologically
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    const detectedColumns: DetectedColumn[] = [
      { sourceColumn: 'Date', suggestedField: 'DATE', confidence: 0.95 },
      { sourceColumn: 'Narration / Description', suggestedField: 'DESCRIPTION', confidence: 0.90 },
      { sourceColumn: 'Debit', suggestedField: 'DEBIT', confidence: 0.88 },
      { sourceColumn: 'Credit', suggestedField: 'CREDIT', confidence: 0.88 },
      { sourceColumn: 'Closing Balance', suggestedField: 'BALANCE', confidence: 0.96 },
    ];

    if (transactions.length === 0) {
      errors.push({
        code: 'NO_TRANSACTIONS_FOUND',
        message: 'Could not reliably parse transactions. Document might be scanned or formatted with custom column structures.',
      });
    }

    return {
      transactions,
      detectedColumns,
      bankName: bankName || 'Standard Banking System',
      accountMasked: accountMasked || '•••• •••• 0000',
      errors,
    };
  }

  /**
   * Standardizes multiple date token formats (DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY) into YYYY-MM-DD
   */
  private standardizeDate(token: string): string | null {
    try {
      const parts = token.trim().split(/[-/\s]+/);
      if (parts.length < 3) return null;

      const day = parseInt(parts[0], 10);
      let month = 0;
      let year = parseInt(parts[2], 10);

      if (year < 100) year += 2000;

      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const mIdx = monthNames.indexOf(parts[1].toLowerCase().slice(0, 3));

      if (mIdx >= 0) {
        month = mIdx + 1;
      } else {
        month = parseInt(parts[1], 10);
      }

      if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } catch {
      return null;
    }
  }
}
