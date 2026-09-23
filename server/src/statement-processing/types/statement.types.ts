/**
 * Secure Bank Statement Processing & EVV Integration Types
 * Strictly excludes any persistent password or credentials.
 */

export type StatementEncryptionStatus =
  | 'UNKNOWN'
  | 'NOT_ENCRYPTED'
  | 'PASSWORD_REQUIRED'
  | 'UNLOCKING'
  | 'UNLOCKED'
  | 'PASSWORD_INVALID'
  | 'LOCKED_AFTER_ATTEMPTS'
  | 'UNSUPPORTED_ENCRYPTION';

export type StatementProcessingStatus =
  | 'UPLOADED'
  | 'SECURITY_SCANNING'
  | 'PASSWORD_REQUIRED'
  | 'UNLOCKING'
  | 'TEXT_EXTRACTION'
  | 'OCR_REQUIRED'
  | 'OCR_PROCESSING'
  | 'COLUMN_MAPPING_REQUIRED'
  | 'DATA_VALIDATING'
  | 'EVV_READY'
  | 'PROCESSING_FAILED';

export type AuditEventType =
  | 'UPLOAD_RECEIVED'
  | 'MALWARE_SCAN_PASSED'
  | 'PDF_ENCRYPTION_DETECTED'
  | 'PDF_PASSWORD_REQUESTED'
  | 'PDF_UNLOCK_FAILED'
  | 'PDF_UNLOCK_SUCCEEDED'
  | 'TEXT_EXTRACTION_SUCCEEDED'
  | 'OCR_STARTED'
  | 'OCR_COMPLETED'
  | 'COLUMN_MAPPING_CONFIRMED'
  | 'DATA_VALIDATION_FAILED'
  | 'DAILY_BALANCE_BUILT'
  | 'EVV_HANDOFF_READY'
  | 'TEMPORARY_FILES_PURGED'
  | 'EVV_CALCULATION_STARTED'
  | 'EVV_CALCULATION_COMPLETED';

export type ActorType = 'APPLICANT' | 'STAFF' | 'MANAGER' | 'SYSTEM';

export interface StatementUploadDto {
  id: string;
  applicationId: string;
  coApplicantId?: string;
  originalFilename: string;
  originalEncryptedStorageKey: string;
  fileHashSha256: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedAt: string;
  encryptionStatus: StatementEncryptionStatus;
  processingStatus: StatementProcessingStatus;
  passwordAttemptCount: number;
  passwordCooldownUntil?: string;
  userConsentAt?: string;
  userConsentVersion?: string;
  extractionJobId?: string;
  accountNumberMasked?: string;
  bankName?: string;
  statementPeriodFrom?: string;
  statementPeriodTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatementProcessingAuditDto {
  id: string;
  statementUploadId: string;
  eventType: AuditEventType;
  actorType: ActorType;
  actorId?: string;
  metadataSafeJson: Record<string, unknown>;
  createdAt: string;
}

export interface DetectedColumn {
  sourceColumn: string;
  suggestedField: 'DATE' | 'DESCRIPTION' | 'DEBIT' | 'CREDIT' | 'BALANCE' | 'IGNORE';
  confidence: number;
}

export interface SafeProcessingError {
  code: string;
  message: string;
  field?: string;
  rowNumber?: number;
}

export interface ExtractionResultDto {
  statementUploadId: string;
  extractionMethod: 'TEXT' | 'OCR' | 'CSV' | 'XLSX';
  rawTextStorageKey?: string;
  ocrConfidence?: number;
  detectedColumns: DetectedColumn[];
  normalizedTransactionsCreated: number;
  reconciliationStatus: 'PASSED' | 'WARNING' | 'FAILED';
  errors: SafeProcessingError[];
}

export interface SecureTempArtifactDto {
  id: string;
  statementUploadId: string;
  storageKey: string;
  artifactType: 'DECRYPTED_PDF' | 'OCR_IMAGE' | 'RAW_TEXT' | 'TEMP_CSV';
  createdAt: string;
  expiresAt: string;
  purgedAt?: string;
}

export interface NormalizedTransactionDto {
  id?: string;
  date: string; // YYYY-MM-DD
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  referenceNumber?: string;
  channel?: string;
  category?: string; // SALARY | BOUNCE | CASH_DEPOSIT | PASS_THROUGH | REGULAR
  staffClassification?: string;
}

export interface DailyBalanceDto {
  date: string; // YYYY-MM-DD
  closingBalance: number;
  isCarriedForward: boolean;
}

export class UnlockAndExtractDto {
  documentOpenPassword?: string;
  userConsent: boolean;
  userConsentVersion?: string;
}

export class ConfirmColumnMappingDto {
  columns: Array<{
    sourceColumn: string;
    field: 'DATE' | 'DESCRIPTION' | 'DEBIT' | 'CREDIT' | 'BALANCE' | 'IGNORE';
  }>;
  reason?: string;
}

export class RunEvvDto {
  bankKey?: string;
  dateMode?: 'FIXED' | 'CUSTOM';
  customDates?: number[];
  customDateReason?: string;
  managerApproved?: boolean;
}

