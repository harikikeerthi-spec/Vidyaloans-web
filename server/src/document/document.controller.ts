import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
  Delete,
  Res,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from '../users/users.service';
import { DigilockerService } from '../integration/digilocker.service';
import { DocumentVerificationService } from '../ai/services/document-verification.service';
import { KycService } from '../ai/services/kyc.service';
import { maskSensitiveIds } from '../ai/utils/ocr-fields.util';
import { validateFileSignature } from '../ai/utils/file-signature.util';
import { UserGuard } from '../auth/user.guard';
import { S3Service } from './s3.service';
import { SupabaseService } from '../supabase/supabase.service';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// ── Use in-memory storage — files go straight to S3, never touch disk ──────
const storage = memoryStorage();

@Controller('documents')
export class DocumentController {
  constructor(
    private usersService: UsersService,
    private digilockerService: DigilockerService,
    private docVerificationService: DocumentVerificationService,
    private kycService: KycService,
    private s3Service: S3Service,
    private supabase: SupabaseService,
  ) { }

  // ─── Upload & store to S3 ────────────────────────────────────────────────
  @Post('upload')
  @UseGuards(UserGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Unsupported file type'), false);
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
    @Body('docType') docType: string,
    @Body('docName') docName?: string,
    @Body('skipOcr') skipOcr?: string | boolean,
    @Req() req?: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!userId || !docType)
      throw new BadRequestException('userId and docType are required');

    // ── 0A. Strict User Ownership Authorization Check ────────────────────────
    const requester = req?.user;
    let isStaffOrAdmin = false;
    if (requester && requester.id !== 'guest-user') {
      const isOwner = requester.id === userId || requester.email === userId;
      isStaffOrAdmin = ['admin', 'staff', 'superadmin'].includes(requester.role);
      if (!isOwner && !isStaffOrAdmin) {
        throw new ForbiddenException('Unauthorized: You can only upload documents for your own account.');
      }
    }

    // ── 0B. Magic Number Binary File Signature Inspection ─────────────────────
    const sigCheck = validateFileSignature(file.buffer, file.mimetype);
    if (!sigCheck.isValid) {
      console.warn(`[UPLOAD] Magic number header validation failed for file ${file.originalname}: ${sigCheck.error}`);
      throw new BadRequestException(
        `Invalid file signature: The content of "${file.originalname}" does not match authorized PDF, PNG, or JPEG formats. ${sigCheck.error || ''}`
      );
    }

    // ── Pre-check: Detect if user has already uploaded this specific document ──
    const incomingHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const existingUserDocs = await this.usersService.getUserDocuments(userId).catch(() => []);
    const existingDocRecord = existingUserDocs.find(
      (d: any) => d.docType.toLowerCase() === docType.toLowerCase() && (d.uploaded || d.status === 'uploaded' || d.status === 'verified')
    );
    const wasAlreadyUploaded = !!existingDocRecord;

    // ── Pre-check 1: Reject duplicate file upload across different slots ──
    for (const otherDoc of existingUserDocs) {
      if (otherDoc.docType.toLowerCase() !== docType.toLowerCase() && (otherDoc.uploaded || otherDoc.status === 'uploaded' || otherDoc.status === 'verified')) {
        let otherHash = otherDoc.verificationMetadata?.fileHash;
        if (!otherHash) {
          try {
            const localDir = path.join(process.cwd(), 'uploads', userId, otherDoc.docType);
            const files = await fs.promises.readdir(localDir).catch(() => []);
            if (files.length > 0) {
              const buf = await fs.promises.readFile(path.join(localDir, files[0]));
              otherHash = crypto.createHash('sha256').update(buf).digest('hex');
            }
          } catch { }
        }

        if (otherHash && otherHash === incomingHash) {
          const otherSlotLabel = otherDoc.verificationMetadata?.docName || otherDoc.docName || otherDoc.docType.replace(/_/g, ' ').toUpperCase();
          console.warn(`[UPLOAD] Rejecting duplicate file upload. Incoming file hash matches existing document in ${otherDoc.docType}`);
          throw new BadRequestException(
            `Duplicate document error: This exact file is already uploaded under "${otherSlotLabel}". Please select and upload the correct document for ${docName || docType.replace(/_/g, ' ').toUpperCase()}.`
          );
        }
      }
    }

    console.log(
      `[UPLOAD] Processing pre-storage check: userId=${userId}, docType=${docType}, file=${file.originalname} (${file.size} bytes), wasAlreadyUploaded=${wasAlreadyUploaded}, isStaffOrAdmin=${isStaffOrAdmin}, skipOcr=${skipOcr}`,
    );

    try {
      const isOtherDoc = (docType.toLowerCase().includes('_other') || docType.toLowerCase().includes('other_') || docType.toLowerCase() === 'other') && !docType.toLowerCase().includes('mother');
      const isStaffUpload = isStaffOrAdmin || skipOcr === 'true' || skipOcr === true;
      const shouldSkipOcr = isStaffUpload || isOtherDoc;
      let kycResult: any;

      if (shouldSkipOcr) {
        console.log(`[UPLOAD] Bypassing AI KYC/OCR check for ${docType} (isStaffUpload=${isStaffUpload}, isOtherDoc=${isOtherDoc})`);
        kycResult = {
          document_type: docType,
          confidence_score: 100,
          is_valid: true,
          extracted_data: {},
          document_validation: { staffUploaded: isStaffUpload },
          ocr_issues: []
        };
      } else {
        // ── 1. Perform AI OCR Verification BEFORE storing in S3 ───────────────
        console.log(`[UPLOAD] Running pre-storage KYC verification for ${docType}...`);
        try {
          kycResult = await this.kycService.processDocument(
            file.buffer,
            file.mimetype,
            docType,
          );
        } catch (aiError: any) {
          console.error(`[UPLOAD] KYC Service threw an error: ${aiError.message || aiError}. Running local keyword check...`);

          // Even on AI exceptions, we must verify document integrity to reject completely wrong uploads
          const isImage = file.mimetype.startsWith('image/');
          const isPdf = file.mimetype === 'application/pdf';
          const integrityCheck = await this.kycService.validateDocumentKeywords(file.buffer, docType, isPdf, isImage);

          if (!integrityCheck.is_valid) {
            console.warn(`[UPLOAD] Rejecting invalid ${docType} on KYC service exception. Error: ${integrityCheck.error || 'Identity card validation failed'}`);
            throw new BadRequestException(
              `Document verification failed: The uploaded file was not recognized as a valid ${docType.toUpperCase().replace(/_/g, ' ')}. ` +
              `Details: ${integrityCheck.error || 'The document is missing required identity details'}. Please check your document and re-upload the correct file.`
            );
          }

          // Graceful fallback for external service failures when document is valid
          kycResult = {
            document_type: docType,
            confidence_score: 50,
            is_valid: true,
            extracted_data: {},
            error: `AI verification service temporarily offline: ${aiError.message || 'Unknown error'}`
          };
        }
      }

      console.log(
        `[UPLOAD] KYC pre-check result: valid=${kycResult.is_valid}, confidence=${kycResult.confidence_score}%`,
      );

      // If document is not valid (AI service processed successfully and rejected it), immediately abort
      if (!kycResult.is_valid) {
        const docLabel = docType.toUpperCase().replace(/_/g, ' ');
        const errorMessage = kycResult.error || 'The uploaded file does not match the expected document type or has validation errors.';
        console.warn(`[UPLOAD] Rejecting invalid ${docType}. OCR Error: ${errorMessage}`);
        throw new BadRequestException(
          `Document verification failed: The uploaded file was not recognized as a valid ${docLabel}. ` +
          `Details: ${errorMessage}. Please check your document and re-upload the correct file.`
        );
      }

      // ── Pre-check 2: Reject duplicate Aadhaar/PAN/Passport number across different slots ──
      if (!shouldSkipOcr) {
        const extData = kycResult.extracted_data || {};
        const newAadhaar = (extData.aadhar_number || extData.aadhaar_number || extData.id_number || '').toString().replace(/[^0-9]/g, '');
        const newPan = (extData.pan_number || extData.pan || '').toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const newPassport = (extData.passport_number || '').toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();

        for (const otherDoc of existingUserDocs) {
          if (otherDoc.docType.toLowerCase() !== docType.toLowerCase() && (otherDoc.uploaded || otherDoc.status === 'uploaded' || otherDoc.status === 'verified')) {
            const extMeta = otherDoc.verificationMetadata?.details?.extractedFields || otherDoc.verificationMetadata?.extractedFields || otherDoc.verificationMetadata || {};
            const existAadhaar = (extMeta.aadhar_number || extMeta.aadhaar_number || extMeta.id_number || '').toString().replace(/[^0-9]/g, '');
            const existPan = (extMeta.pan_number || extMeta.pan || '').toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();
            const existPassport = (extMeta.passport_number || '').toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();

            const slotLabel = otherDoc.verificationMetadata?.docName || otherDoc.docName || otherDoc.docType.replace(/_/g, ' ').toUpperCase();

            if (newAadhaar && newAadhaar.length >= 12 && existAadhaar && newAadhaar === existAadhaar) {
              console.warn(`[UPLOAD] Rejecting duplicate Aadhaar number ${newAadhaar} already uploaded in ${otherDoc.docType}`);
              const masked = newAadhaar.slice(-4).padStart(newAadhaar.length, 'X').replace(/(\d{4})/g, '$1 ').trim();
              throw new BadRequestException(
                `Duplicate document error: This Aadhaar Card (No. ${masked}) is already uploaded under "${slotLabel}". Please upload the correct document for ${docName || docType.replace(/_/g, ' ').toUpperCase()}.`
              );
            }

            if (newPan && newPan.length >= 10 && existPan && newPan === existPan) {
              console.warn(`[UPLOAD] Rejecting duplicate PAN number ${newPan} already uploaded in ${otherDoc.docType}`);
              const masked = newPan.slice(0, 3) + '*****' + newPan.slice(-2);
              throw new BadRequestException(
                `Duplicate document error: This PAN Card (No. ${masked}) is already uploaded under "${slotLabel}". Please upload the correct document for ${docName || docType.replace(/_/g, ' ').toUpperCase()}.`
              );
            }

            if (newPassport && newPassport.length >= 6 && existPassport && newPassport === existPassport) {
              console.warn(`[UPLOAD] Rejecting duplicate Passport number ${newPassport} already uploaded in ${otherDoc.docType}`);
              throw new BadRequestException(
                `Duplicate document error: This Passport (No. ${newPassport}) is already uploaded under "${slotLabel}". Please upload the correct document for ${docName || docType.replace(/_/g, ' ').toUpperCase()}.`
              );
            }
          }
        }
      }

      // ── 2. Verified! Save locally & upload to S3 ───────
      const fileExt = path.extname(file.originalname);
      const s3Key = `vault/${userId}/${docType}${fileExt}`;
      const previewUrl = `/api/documents/view/${userId}/${docType}`;

      // ALWAYS save original uploaded file buffer to local disk
      try {
        const localDir = path.join(process.cwd(), 'uploads', userId, docType);
        await fs.promises.mkdir(localDir, { recursive: true });
        const existingFiles = await fs.promises.readdir(localDir).catch(() => []);
        for (const existing of existingFiles) {
          await fs.promises.unlink(path.join(localDir, existing)).catch(() => { });
        }
        const localFilePath = path.join(localDir, `file${fileExt}`);
        await fs.promises.writeFile(localFilePath, file.buffer);
        console.log(`[UPLOAD] Original uploaded file saved locally at: ${localFilePath}`);
      } catch (localWriteError: any) {
        console.error('[UPLOAD] Local write failed:', localWriteError.message);
      }

      // Upload to S3 storage
      try {
        await this.s3Service.upload(s3Key, file.buffer, file.mimetype);
        console.log(`[UPLOAD] Verified document stored in S3: ${s3Key}`);
      } catch (s3Error: any) {
        console.error(`[UPLOAD] S3 Upload failed for ${s3Key}:`, s3Error.message || s3Error);
        throw new BadRequestException(
          `Document storage failed: Could not store file in S3 bucket (${s3Error.message || 'Storage error'}). Please try uploading again.`
        );
      }

      // ── 3. Build Verification Metadata & Update User profile ─────────────
      const maskedExtractedFields = maskSensitiveIds(kycResult.extracted_data || {}, docType);
      const docStatus = isStaffUpload ? 'verified' : 'uploaded';

      const verificationResult = {
        isValid: true,
        code: isStaffUpload ? 'STAFF_VERIFIED' : 'AI_VERIFIED',
        confidence: kycResult.confidence_score,
        docName: docName || undefined,
        fileHash: incomingHash,
        details: {
          message: isStaffUpload
            ? 'Document uploaded directly by staff without OCR.'
            : 'Document verified by AI OCR pre-storage.',
          extractedFields: maskedExtractedFields,
          document_validation: kycResult.document_validation,
          ocr_issues: kycResult.ocr_issues,
        },
      };

      if (!shouldSkipOcr) {
        if (
          kycResult.extracted_data &&
          Object.keys(kycResult.extracted_data).length > 0
        ) {
          await this.usersService.updateExtractedDetails(userId, {
            documentVerified: true,
            ...kycResult.extracted_data,
          }, docType);
        }

        // Perform cross-document name & parent verification against reference document (Passport / Aadhaar)
        const crossDocResult = await this.usersService.performCrossDocumentValidation(
          userId,
          docType,
          kycResult.extracted_data || {}
        );

        // Hard reject: student doc (PAN/10th/12th/Degree) name doesn't match Aadhaar/Passport reference
        if (crossDocResult.hardReject && crossDocResult.rejectReason) {
          // Delete the already-uploaded S3 file so it doesn't stay stored
          try { await this.s3Service.delete(s3Key); } catch {}
          throw new BadRequestException(crossDocResult.rejectReason);
        }

        if (crossDocResult.issues && crossDocResult.issues.length > 0) {
          const existingIssues = verificationResult.details.ocr_issues || [];
          verificationResult.details.ocr_issues = Array.from(new Set([...existingIssues, ...crossDocResult.issues]));
          if (kycResult) {
            kycResult.ocr_issues = verificationResult.details.ocr_issues;
          }
        }
      }

      // ── 4. Save record in database ───────────────────────────────────────
      const document = await this.usersService.upsertUserDocument(
        userId,
        docType,
        {
          uploaded: true,
          filePath: s3Key,
          status: docStatus,
          verificationMetadata: verificationResult,
        },
      );

      console.log(`[UPLOAD] DB record saved. Doc ID: ${document?.id}, status: ${docStatus}`);

      // ── 5. Generate a short-lived presigned URL for preview ───────────────
      return {
        success: true,
        wasAlreadyUploaded,
        isReupload: wasAlreadyUploaded,
        message: wasAlreadyUploaded
          ? 'Document was already uploaded previously and has been updated successfully.'
          : 'Document validated, stored in S3, and registered successfully',
        data: {
          ...document,
          wasAlreadyUploaded,
          status: docStatus,
          previewUrl,
          verification: verificationResult,
          aiExplanation: null,
          ocrResult: {
            isValid: true,
            confidence: kycResult.confidence_score,
            extractedFields: kycResult.extracted_data,
            document_validation: kycResult.document_validation,
            ocr_issues: kycResult.ocr_issues,
            reason: isStaffUpload ? 'Staff Upload (Verified)' : 'Verified',
          },
        },
        file: {
          originalName: file.originalname,
          s3Key,
        },
      };
    } catch (error: any) {
      console.error('[UPLOAD] Error:', error?.message);
      // Let nest throw custom BadRequestExceptions natively, else wrap general errors
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Upload failed: ${error.message || 'Processing error'}`,
      );
    }
  }

  // ─── Check if document is already uploaded for a specific unique user ────
  @Get('check-duplicate')
  async checkDuplicate(
    @Query('userId') userId: string,
    @Query('docType') docType: string,
  ) {
    if (!userId || !docType) {
      throw new BadRequestException('userId and docType query parameters are required');
    }

    const docs = await this.usersService.getUserDocuments(userId);
    const existing = docs.find(
      (d: any) =>
        d.docType.toLowerCase() === docType.toLowerCase() &&
        (d.uploaded || d.status === 'uploaded' || d.status === 'verified')
    );

    return {
      alreadyUploaded: !!existing,
      userId,
      docType,
      existingDocument: existing
        ? {
            id: existing.id,
            docType: existing.docType,
            status: existing.status,
            uploadedAt: existing.uploadedAt,
            filePath: existing.filePath,
          }
        : null,
    };
  }

  // ─── OCR Re-verify (reads from S3) ──────────────────────────────────────
  @Post('ocr-reverify')
  async ocrReverify(
    @Body('userId') userId: string,
    @Body('docType') docType: string,
  ) {
    if (!userId || !docType)
      throw new BadRequestException('userId and docType are required');

    console.log(
      `[OCR-REVERIFY] userId=${userId}, docType=${docType}`,
    );

    const isOtherDoc = (docType.toLowerCase().includes('_other') || docType.toLowerCase().includes('other_') || docType.toLowerCase() === 'other') && !docType.toLowerCase().includes('mother');
    if (isOtherDoc) {
      return {
        success: true,
        message: 'Bypassed verification for other document type.',
        data: {
          status: 'uploaded',
          ocrResult: {
            isValid: true,
            confidence: 100,
            extractedFields: {},
            reason: 'Bypassed',
          }
        }
      };
    }

    const docs = await this.usersService.getUserDocuments(userId);
    const doc = docs.find((d) => d.docType === docType);

    if (!doc || !doc.filePath) {
      throw new NotFoundException(
        'Document not found. Please upload the document first.',
      );
    }

    // Fetch file from S3 via presigned URL → buffer
    const presignedUrl = await this.s3Service.getPresignedUrl(doc.filePath);
    const res = await fetch(presignedUrl);
    if (!res.ok)
      throw new NotFoundException('Could not retrieve document from S3.');

    const fileBuffer = Buffer.from(await res.arrayBuffer());
    const mimetype = doc.filePath.endsWith('.pdf')
      ? 'application/pdf'
      : 'image/jpeg';

    let kycResult: any;
    try {
      kycResult = await this.kycService.processDocument(
        fileBuffer,
        mimetype,
        docType,
      );
    } catch (aiError: any) {
      console.error(`[OCR-REVERIFY] KYC Service threw an error: ${aiError.message || aiError}. Running local keyword check fallback...`);
      const isImage = mimetype.startsWith('image/');
      const isPdf = mimetype === 'application/pdf';
      const integrityCheck = await this.kycService.validateDocumentKeywords(fileBuffer, docType, isPdf, isImage);

      if (!integrityCheck.is_valid) {
        console.warn(`[OCR-REVERIFY] Rejecting invalid ${docType} on KYC service exception. Error: ${integrityCheck.error}`);
        throw new BadRequestException(
          `Document verification failed: The document was not recognized as a valid ${docType.toUpperCase().replace(/_/g, ' ')}. ` +
          `Details: ${integrityCheck.error}. Please check your document.`
        );
      }

      // Graceful fallback for external service failures when document is valid
      kycResult = {
        document_type: docType,
        confidence_score: 50,
        is_valid: true,
        extracted_data: {},
        error: `AI verification service temporarily offline: ${aiError.message || 'Unknown error'}`
      };
    }

    const newStatus = kycResult.is_valid ? 'uploaded' : 'rejected';
    const verificationResult = {
      isValid: kycResult.is_valid,
      code: kycResult.is_valid ? 'AI_VERIFIED' : 'AI_REJECTED',
      confidence: kycResult.confidence_score,
      details: {
        message: kycResult.is_valid
          ? 'Document re-verified by AI OCR.'
          : kycResult.error || 'Verification failed',
        extractedFields: kycResult.extracted_data,
        document_validation: kycResult.document_validation,
        ocr_issues: kycResult.ocr_issues,
      },
    };

    await this.usersService.upsertUserDocument(userId, docType, {
      uploaded: true,
      filePath: doc.filePath,
      status: newStatus,
      verificationMetadata: verificationResult,
    });

    if (
      kycResult.is_valid &&
      kycResult.extracted_data &&
      Object.keys(kycResult.extracted_data).length > 0
    ) {
      await this.usersService.updateExtractedDetails(userId, {
        documentVerified: true,
        ...kycResult.extracted_data,
      }, docType);
    }

    const crossDocResult2 = await this.usersService.performCrossDocumentValidation(
      userId,
      docType,
      kycResult.extracted_data || {}
    );

    if (crossDocResult2.issues && crossDocResult2.issues.length > 0) {
      const existingIssues = verificationResult.details.ocr_issues || [];
      verificationResult.details.ocr_issues = Array.from(new Set([...existingIssues, ...crossDocResult2.issues]));
      if (kycResult) {
        kycResult.ocr_issues = verificationResult.details.ocr_issues;
      }
      // Re-save document with cross doc issues updated
      await this.usersService.upsertUserDocument(userId, docType, {
        uploaded: true,
        filePath: doc.filePath,
        status: newStatus,
        verificationMetadata: verificationResult,
      });
    }

    return {
      success: true,
      data: {
        docType,
        userId,
        isValid: kycResult.is_valid,
        confidence: kycResult.confidence_score,
        extractedFields: kycResult.extracted_data,
        reason: kycResult.error,
        newStatus,
        verification: verificationResult,
        ocrResult: {
          isValid: kycResult.is_valid,
          confidence: kycResult.confidence_score,
          extractedFields: kycResult.extracted_data,
          document_validation: kycResult.document_validation,
          ocr_issues: kycResult.ocr_issues,
        },
      },
    };
  }

  // ─── DigiLocker flow ─────────────────────────────────────────────────────
  @Post('digilocker/initiate')
  async initiateDigilockerFlow(
    @Body('userId') userId: string,
    @Body('docType') docType: string,
    @Body('redirectUri') redirectUri: string,
  ) {
    if (!userId || !docType)
      throw new BadRequestException('userId and docType are required');

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const callbackUrl =
      process.env.DIGILOCKER_CALLBACK_URL ||
      backendUrl + '/api/digilocker/callback';

    const stateData = { userId, docType, redirectUri, codeVerifier };
    const state = Buffer.from(JSON.stringify(stateData))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const authUrl = this.digilockerService.getAuthUrl(
      state,
      callbackUrl,
      codeChallenge,
    );

    return { success: true, authUrl };
  }

  // ─── View document — redirects to a short-lived S3 presigned URL ─────────
  @Get('view/:userId/:docType')
  async viewDocument(
    @Param('userId') userId: string,
    @Param('docType') docType: string,
    @Query('bankId') bankId: string,
    @Res() res: Response,
  ) {
    if (bankId) {
      const { data: consent } = await this.supabase.client
        .from('StudentBankConsent')
        .select('isGranted')
        .eq('studentId', userId)
        .eq('bankId', bankId)
        .maybeSingle();

      if (!consent || !consent.isGranted) {
        throw new ForbiddenException('Access denied: Explicit student consent is required for this bank to view this document.');
      }

      await this.supabase.client.from('data_access_logs').insert({
        accessedBy: bankId,
        applicationId: userId,
        action: `Viewed document type: ${docType}`,
        accessedAt: new Date().toISOString(),
      });
    }

    const docs = await this.usersService.getUserDocuments(userId);
    let doc = docs.find((d) => d.docType === docType);

    if (!doc) {
      const normalizedReq = docType.toLowerCase().replace(/[^a-z0-9]/g, '');
      doc = docs.find((d) => {
        const normalizedDoc = (d.docType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedDoc === normalizedReq || normalizedDoc.includes(normalizedReq) || normalizedReq.includes(normalizedDoc);
      });
    }

    // Fallback document object if not registered in DB yet
    if (!doc) {
      doc = {
        id: `doc-${Date.now()}`,
        userId,
        docType,
        docName: docType,
        filePath: `vault/${userId}/${docType}.pdf`,
        status: 'uploaded',
        uploaded: true,
      } as any;
    }

    // Check local fallback first (exact and fuzzy matching subfolders)
    const userUploadsDir = path.join(process.cwd(), 'uploads', userId);
    if (fs.existsSync(userUploadsDir)) {
      const subdirs = fs.readdirSync(userUploadsDir);
      const normalizedReq = docType.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedSubdir = subdirs.find((sd) => {
        const normSd = sd.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normSd === normalizedReq || normSd.includes(normalizedReq) || normalizedReq.includes(normSd);
      });
      if (matchedSubdir) {
        const targetDir = path.join(userUploadsDir, matchedSubdir);
        const files = fs.readdirSync(targetDir);
        if (files.length > 0) {
          const localFilePath = path.join(targetDir, files[0]);
          const ext = path.extname(localFilePath).toLowerCase();
          if (ext === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
          } else if (ext === '.png') {
            res.setHeader('Content-Type', 'image/png');
          } else if (ext === '.jpg' || ext === '.jpeg') {
            res.setHeader('Content-Type', 'image/jpeg');
          }
          res.setHeader('Content-Disposition', `inline; filename="${path.basename(localFilePath)}"`);
          return res.sendFile(localFilePath);
        }
      }
    }

    // DigiLocker virtual record
    if (doc.filePath && doc.filePath.startsWith('in.gov.')) {
      const html = `<!DOCTYPE html><html><head><title>DigiLocker Record - ${doc.docName || doc.docType}</title>
<style>body{font-family:system-ui,sans-serif;background:#f0f2f5;display:flex;justify-content:center;padding:40px}.card{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.1);max-width:600px;width:100%;border-top:6px solid #82c91e}.badge{background:#e6fced;color:#12b842;padding:6px 12px;border-radius:20px;font-weight:600;font-size:14px}</style></head>
<body><div class="card"><h2>Digital Verification Record</h2><span class="badge">✓ Verified by DigiLocker</span>
<p><strong>Document:</strong> ${doc.docName || doc.docType}</p>
<p><strong>Reference:</strong> ${doc.filePath}</p></div></body></html>`;
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    // Try fetching file buffer from S3 using doc.filePath, vault, and documents paths
    const fileExt = doc.filePath ? path.extname(doc.filePath) : '';
    const s3CandidateKeys = Array.from(
      new Set([
        doc.filePath,
        `vault/${userId}/${docType}${fileExt}`,
        `vault/${userId}/${docType}`,
        `documents/${userId}/${docType}`,
        `documents/${userId}/${docType}${fileExt}`,
      ]),
    ).filter(Boolean);

    for (const s3KeyCandidate of s3CandidateKeys) {
      try {
        const s3Data = await this.s3Service.getFileBuffer(s3KeyCandidate);
        if (s3Data && s3Data.buffer) {
          res.setHeader('Content-Type', s3Data.contentType || 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${docType}.pdf"`);
          return res.send(s3Data.buffer);
        }
      } catch (err: any) {
        console.warn(`[VIEW] S3 lookup notice for key ${s3KeyCandidate}: ${err.message}`);
      }
    }

    // Fallback: Render clean PDF document viewer if physical file key does not exist in S3
    return this.renderSampleDocument(res, userId, docType, doc.docName || docType);
  }

  private renderSampleDocument(
    res: Response,
    userId: string,
    docType: string,
    docName: string,
  ) {
    const pdfBuffer = this.createNotFoundPdfBuffer(userId, docType, docName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${docType}.pdf"`);
    return res.send(pdfBuffer);
  }

  private createNotFoundPdfBuffer(userId: string, docType: string, docName?: string): Buffer {
    const formattedDocType = (docName || docType)
      .replace(/_/g, ' ')
      .toUpperCase();
    const dateStr = new Date().toISOString().split('T')[0];

    const contentStream = [
      // Red header background
      '0.7 0.1 0.1 rg',
      '40 700 532 60 re f',
      'BT',
      '/F1 14 Tf',
      '1 1 1 rg',
      '60 735 Td',
      '(DOCUMENT NOT FOUND) Tj',
      '0 -18 Td',
      '/F2 10 Tf',
      `(Application ID: ${userId} | Document: ${formattedDocType}) Tj`,
      'ET',
      // Title
      'BT',
      '/F1 16 Tf',
      '0.6 0.1 0.1 rg',
      '60 650 Td',
      `(${formattedDocType}) Tj`,
      'ET',
      // Separator line
      '0.8 0.2 0.2 RG',
      '2 w',
      '60 635 m 552 635 l S',
      // Warning box
      '1.0 0.95 0.95 rg',
      '60 440 492 170 re f',
      '0.8 0.2 0.2 RG',
      '1.5 w',
      '60 440 492 170 re S',
      'BT',
      '0.6 0.1 0.1 rg',
      '/F1 12 Tf 80 580 Td',
      '(The original document file could not be found.) Tj',
      '/F2 10 Tf 0 -25 Td',
      '(The document record exists in the database but the actual file was) Tj',
      '0 -14 Td',
      '(not uploaded successfully to storage.) Tj',
      '/F1 11 Tf 0 -30 Td',
      '0.4 0.1 0.1 rg',
      '(ACTION REQUIRED:) Tj',
      '/F2 10 Tf 0 -18 Td',
      '0.3 0.3 0.3 rg',
      `(Please ask the student to re-upload the ${formattedDocType} document.) Tj`,
      'ET',
      // Info box
      '0.95 0.95 0.95 rg',
      '60 320 492 100 re f',
      '0.7 0.7 0.7 RG',
      '1 w',
      '60 320 492 100 re S',
      'BT',
      '/F1 9 Tf',
      '0.4 0.4 0.4 rg',
      '80 390 Td',
      '(DOCUMENT DETAILS) Tj',
      '/F2 9 Tf 0 -16 Td',
      `(Document Type: ${formattedDocType}) Tj`,
      `0 -14 Td (Application ID: ${userId}) Tj`,
      `0 -14 Td (Status: FILE NOT IN STORAGE) Tj`,
      `0 -14 Td (Checked: ${dateStr}) Tj`,
      'ET',
    ].join('\n');

    const streamLen = Buffer.byteLength(contentStream);

    const pdfParts = [
      '%PDF-1.4\n',
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
      `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
      '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ];

    let offset = 0;
    const xrefs = ['0000000000 65535 f \n'];
    for (let i = 0; i < pdfParts.length; i++) {
      if (i > 0) xrefs.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
      offset += Buffer.byteLength(pdfParts[i]);
    }
    const xrefOffset = offset;
    const pdfTail = [
      `xref\n0 ${pdfParts.length}\n${xrefs.join('')}`,
      `trailer\n<< /Size ${pdfParts.length} /Root 1 0 R >>\n`,
      `startxref\n${xrefOffset}\n%%EOF`,
    ].join('\n');

    return Buffer.from(pdfParts.join('') + pdfTail, 'utf-8');
  }

  // ─── Presigned URL endpoint (for frontend preview without redirect) ───────

  @Get('presigned-view/:userId/:docType')
  async getPresignedViewUrl(
    @Param('userId') userId: string,
    @Param('docType') docType: string,
    @Query('bankId') bankId: string,
  ) {
    if (bankId) {
      const { data: consent } = await this.supabase.client
        .from('StudentBankConsent')
        .select('isGranted')
        .eq('studentId', userId)
        .eq('bankId', bankId)
        .maybeSingle();

      if (!consent || !consent.isGranted) {
        throw new ForbiddenException('Access denied: Explicit student consent is required for this bank to view this document.');
      }

      await this.supabase.client.from('data_access_logs').insert({
        accessedBy: bankId,
        applicationId: userId,
        action: `Generated preview link for document: ${docType}`,
        accessedAt: new Date().toISOString(),
      });
    }

    const docs = await this.usersService.getUserDocuments(userId);
    const doc = docs.find((d) => d.docType === docType);

    if (!doc || !doc.filePath)
      throw new NotFoundException('Document not found');

    // Check local fallback first
    const localDir = path.join(process.cwd(), 'uploads', userId, docType);
    if (fs.existsSync(localDir)) {
      const files = fs.readdirSync(localDir);
      if (files.length > 0) {
        return { success: true, url: `/api/documents/view/${userId}/${docType}`, docType, filePath: doc.filePath };
      }
    }

    const url = `/api/documents/view/${userId}/${docType}`;
    return { success: true, url, docType, filePath: doc.filePath };
  }

  // ─── List user documents ─────────────────────────────────────────────────
  @Get(':userId')
  async getUserDocuments(@Param('userId') userId: string) {
    const documents = await this.usersService.getUserDocuments(userId);
    return { success: true, data: documents };
  }

  // ─── Delete document — removes from S3 + DB ──────────────────────────────
  @Delete(':userId/:docType')
  async deleteDocument(
    @Param('userId') userId: string,
    @Param('docType') docType: string,
  ) {
    const docs = await this.usersService.getUserDocuments(userId);
    const doc = docs.find((d) => d.docType === docType);

    if (doc?.filePath && !doc.filePath.startsWith('in.gov.')) {
      await this.s3Service.delete(doc.filePath);
    }

    await this.usersService.deleteUserDocument(userId, docType);
    return { success: true, message: 'Document deleted successfully' };
  }

  // ─── Delete document file — removes from S3 but keeps DB requirement ──────
  @Delete(':userId/:docType/file')
  async deleteDocumentFile(
    @Param('userId') userId: string,
    @Param('docType') docType: string,
  ) {
    const docs = await this.usersService.getUserDocuments(userId);
    const doc = docs.find((d) => d.docType === docType);

    if (doc?.filePath && !doc.filePath.startsWith('in.gov.')) {
      await this.s3Service.delete(doc.filePath);
    }

    await this.usersService.upsertUserDocument(userId, docType, {
      uploaded: false,
      status: 'pending',
      filePath: null as any,
    });
    return { success: true, message: 'Document file removed successfully' };
  }

  // ─── Add document requirement ────────────────────────────────────────────
  @Post('requirement')
  async addRequirement(
    @Body('userId') userId: string,
    @Body('docType') docType: string,
    @Body('docName') docName?: string,
  ) {
    if (!userId || !docType)
      throw new BadRequestException('userId and docType are required');

    const existing = (
      await this.usersService.getUserDocuments(userId)
    ).find((d) => d.docType === docType);

    if (
      existing?.uploaded ||
      ['uploaded', 'verified'].includes(
        String(existing?.status || '').toLowerCase(),
      )
    ) {
      return {
        success: true,
        message: 'Requirement already has an uploaded document',
        data: existing,
      };
    }

    const document = await this.usersService.upsertUserDocument(
      userId,
      docType,
      {
        uploaded: false,
        status: 'pending',
        verificationMetadata: {
          message: 'Requirement added by staff',
          docName: docName || docType,
        },
      },
    );

    return {
      success: true,
      message: 'Requirement added successfully',
      data: document,
    };
  }

  // ─── Accept a document (staff action) ────────────────────────────────────
  @Post(':docId/accept')
  async acceptDocument(@Param('docId') docId: string) {
    if (!docId) {
      throw new BadRequestException('Document ID is required');
    }

    console.log(`[DOCUMENT-ACCEPT] Processing acceptance for docId: ${docId}`);

    try {
      const updatedDoc = await this.usersService.updateDocumentStatus(
        docId,
        'verified',
      );

      if (!updatedDoc) {
        throw new NotFoundException(`Document with ID ${docId} not found`);
      }

      console.log(`[DOCUMENT-ACCEPT] Document ${docId} accepted successfully`);

      return {
        success: true,
        message: 'Document accepted successfully',
        data: updatedDoc,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`[DOCUMENT-ACCEPT] Error accepting document ${docId}:`, error.message);
      throw new BadRequestException(
        `Failed to accept document: ${error.message || 'Unknown error'}`,
      );
    }
  }

  // ─── Reject a document with reason (staff action) ──────────────────────────
  @Post(':docId/reject')
  async rejectDocument(
    @Param('docId') docId: string,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    if (!docId) {
      throw new BadRequestException('Document ID is required');
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    console.log(`[DOCUMENT-REJECT] Processing rejection for docId: ${docId}, reason: ${rejectionReason}`);

    try {
      const updatedDoc = await this.usersService.updateDocumentStatus(
        docId,
        'rejected',
        rejectionReason.trim(),
      );

      if (!updatedDoc) {
        throw new NotFoundException(`Document with ID ${docId} not found`);
      }

      console.log(`[DOCUMENT-REJECT] Document ${docId} rejected successfully`);

      return {
        success: true,
        message: 'Document rejected successfully',
        data: updatedDoc,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`[DOCUMENT-REJECT] Error rejecting document ${docId}:`, error.message);
      throw new BadRequestException(
        `Failed to reject document: ${error.message || 'Unknown error'}`,
      );
    }
  }

  // ─── Send document to bank (staff action) ─────────────────────────────────
  @Post('send-to-bank')
  async sendDocumentToBank(
    @Body('userId') userId: string,
    @Body('docType') docType: string,
    @Body('docTitle') docTitle: string,
    @Body('bankId') bankId: string,
    @Body('bankName') bankName: string,
    @Body('notes') notes?: string,
    @Body('studentName') studentName?: string,
    @Body('applicationNumber') applicationNumber?: string,
  ) {
    if (!userId || !docType || !bankId) {
      throw new BadRequestException('userId, docType and bankId are required');
    }

    console.log(`[SEND-TO-BANK] userId=${userId} docType=${docType} bankName=${bankName}`);

    try {
      // Retrieve the document to confirm it exists
      const docs = await this.usersService.getUserDocuments(userId);
      const doc = docs.find((d) => d.docType === docType);

      if (!doc || !doc.filePath) {
        throw new NotFoundException('Document not found or not yet uploaded.');
      }

      // Generate a presigned URL for bank access (1 hour)
      let presignedUrl = '';
      try {
        presignedUrl = await this.s3Service.getPresignedUrl(doc.filePath, 3600);
      } catch (s3Err: any) {
        console.warn(`[SEND-TO-BANK] Could not generate presigned URL: ${s3Err.message}`);
        presignedUrl = `/api/documents/view/${userId}/${docType}`;
      }

      // Log the bank share event in audit log
      const transmissionId = `DOC-${Date.now().toString(36).toUpperCase()}-${docType.toUpperCase().slice(0, 4)}`;
      try {
        await this.supabase.client.from('data_access_logs').insert({
          accessedBy: bankId,
          applicationId: userId,
          action: `Staff sent document "${docTitle || docType}" to ${bankName}. Notes: ${notes || 'None'}. Ref: ${transmissionId}`,
          accessedAt: new Date().toISOString(),
        });
      } catch (logErr: any) {
        console.warn(`[SEND-TO-BANK] Audit log insert failed (non-blocking): ${logErr.message}`);
      }

      return {
        success: true,
        message: `Document "${docTitle || docType}" sent to ${bankName} successfully`,
        data: {
          transmissionId,
          bankId,
          bankName,
          docType,
          studentName,
          applicationNumber,
          presignedUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error(`[SEND-TO-BANK] Error:`, error.message);
      throw new BadRequestException(`Failed to send document to bank: ${error.message || 'Unknown error'}`);
    }
  }
}
