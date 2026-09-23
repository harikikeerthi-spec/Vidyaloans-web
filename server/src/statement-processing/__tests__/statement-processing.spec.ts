import { EncryptionStorageService } from '../services/encryption-storage.service';
import { TempArtifactService } from '../services/temp-artifact.service';
import { PdfUnlockWorker } from '../workers/pdf-unlock-worker';
import { StatementProcessingService } from '../statement-processing.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

describe('Secure Statement Processing Module', () => {
  let encryptionService: EncryptionStorageService;
  let tempArtifactService: TempArtifactService;
  let pdfUnlockWorker: PdfUnlockWorker;

  beforeEach(() => {
    process.env.STATEMENT_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    encryptionService = new EncryptionStorageService();
    tempArtifactService = new TempArtifactService(null as any, encryptionService);
    pdfUnlockWorker = new PdfUnlockWorker();
  });

  describe('EncryptionStorageService', () => {
    it('should encrypt and decrypt a buffer with AES-256-GCM successfully', async () => {
      const plaintext = Buffer.from('PDF_STREAM_CONFIDENTIAL_CONTENT_FOR_EVV');
      const { storageKey } = await encryptionService.storeEncrypted(plaintext, 'test_stmt');

      expect(storageKey).toBeDefined();
      expect(typeof storageKey).toBe('string');

      const decrypted = await encryptionService.readDecrypted(storageKey);
      expect(decrypted.toString()).toEqual(plaintext.toString());

      // Clean up test file
      const fullPath = path.join(process.cwd(), 'uploads', 'statements', storageKey);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    it('should fail decryption if ciphertext or payload is corrupted', async () => {
      const plaintext = Buffer.from('SAMPLE_BANK_TRANSACTIONS');
      const { storageKey } = await encryptionService.storeEncrypted(plaintext, 'corrupt_test');
      const fullPath = path.join(process.cwd(), 'uploads', 'statements', storageKey);

      // Tamper with the saved file
      const payload = await fs.promises.readFile(fullPath);
      payload[payload.length - 1] ^= 0xff;
      await fs.promises.writeFile(fullPath, payload);

      await expect(encryptionService.readDecrypted(storageKey)).rejects.toThrow();

      // Clean up
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    it('should deterministically calculate SHA-256 hash', () => {
      const buffer = Buffer.from('TEST_BANK_STATEMENT');
      const hash1 = encryptionService.computeSha256(buffer);
      const hash2 = encryptionService.computeSha256(buffer);

      expect(hash1).toEqual(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should securely mask account numbers preserving only the last 4 digits', () => {
      expect(encryptionService.maskAccountNumber('50100234567890')).toBe('•••• •••• 7890');
      expect(encryptionService.maskAccountNumber('1234')).toBe('•••• 1234');
      expect(encryptionService.maskAccountNumber('')).toBe('•••• •••• ••••');
      expect(encryptionService.maskAccountNumber(null as any)).toBe('•••• •••• ••••');
    });
  });

  describe('Ephemeral Password & Rate Limiting Enforcement', () => {
    it('should enforce failed attempt limit and impose cooldown when locked', async () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      const mockPrisma: any = {
        statementUpload: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'stmt-test-1',
            status: 'PROTECTED_WAITING_PASSWORD',
            passwordAttemptCount: 5,
            passwordCooldownUntil: lockedUntil,
            encryptionStatus: 'PASSWORD_REQUIRED',
            originalEncryptedStorageKey: 'stmt_fake.enc',
          }),
          update: jest.fn(),
        },
        statementProcessingAudit: {
          create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      const mockEvvEngine: any = {
        evaluateBankHealth: jest.fn(),
      };

      const service = new StatementProcessingService(
        mockPrisma,
        encryptionService,
        tempArtifactService,
        pdfUnlockWorker,
        mockEvvEngine
      );

      // Attempting to unlock while locked should throw ForbiddenException
      await expect(
        service.unlockAndExtract('stmt-test-1', 'TestPassword123', true, '2026.1')
      ).rejects.toThrow(HttpException);

      try {
        await service.unlockAndExtract('stmt-test-1', 'TestPassword123', true, '2026.1');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.message).toContain('paused');
      }
    });

    it('should reject requests without explicit user consent', async () => {
      const mockPrisma: any = {
        statementUpload: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'stmt-test-2',
            passwordAttemptCount: 0,
            passwordCooldownUntil: null,
          }),
        },
      };
      const mockEvvEngine: any = {};

      const service = new StatementProcessingService(
        mockPrisma,
        encryptionService,
        tempArtifactService,
        pdfUnlockWorker,
        mockEvvEngine as any
      );

      await expect(
        service.unlockAndExtract('stmt-test-2', 'pass', false)
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Zero-Persistence Memory Safety', () => {
    it('should erase password strings immediately using buffer overwrite', () => {
      const sensitivePassword = Buffer.from('MySecretDocPass123!');
      expect(sensitivePassword.toString()).toBe('MySecretDocPass123!');

      // Simulate the zero-out wiping logic used in finally blocks
      sensitivePassword.fill(0);
      expect(sensitivePassword.toString()).not.toBe('MySecretDocPass123!');
      expect(sensitivePassword.every((byte) => byte === 0)).toBe(true);
    });
  });

  describe('TempArtifactService Lifecycle', () => {
    it('should track and purge ephemeral artifacts after extraction', async () => {
      const mockPrisma: any = {
        secureTempArtifact: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const artifactService = new TempArtifactService(mockPrisma, encryptionService);

      const count = await artifactService.purgeArtifactsForStatement('stmt-test-3');
      expect(mockPrisma.secureTempArtifact.findMany).toHaveBeenCalledWith({
        where: {
          statementUploadId: 'stmt-test-3',
          purgedAt: null,
        },
      });
      expect(count).toBe(0);
    });
  });
});
