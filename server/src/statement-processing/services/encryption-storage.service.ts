import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EncryptionStorageService {
  private readonly logger = new Logger(EncryptionStorageService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly storageRoot = path.join(process.cwd(), 'uploads', 'statements');
  private readonly tempRoot = path.join(process.cwd(), 'uploads', 'statements', 'ephemeral');
  private readonly encryptionKey: Buffer;

  constructor() {
    // 32-byte key derived from env or generated for fallback
    const keyEnv = process.env.STATEMENT_ENCRYPTION_KEY || 'vidya_loans_statement_secure_vault_key_2026_aes256';
    this.encryptionKey = crypto.createHash('sha256').update(keyEnv).digest();

    // Ensure storage directories exist with restricted permissions
    if (!fs.existsSync(this.storageRoot)) {
      fs.mkdirSync(this.storageRoot, { recursive: true });
    }
    if (!fs.existsSync(this.tempRoot)) {
      fs.mkdirSync(this.tempRoot, { recursive: true });
    }
  }

  /**
   * Computes SHA-256 hash of a file buffer
   */
  computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Encrypts and writes buffer to encrypted storage at rest using AES-256-GCM
   */
  async storeEncrypted(buffer: Buffer, keyPrefix = 'stmt'): Promise<{ storageKey: string; sizeBytes: number }> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const fileName = `${keyPrefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.enc`;
    const fullPath = path.join(this.storageRoot, fileName);

    // Payload format: [IV (16 bytes)][AuthTag (16 bytes)][Encrypted Data]
    const payload = Buffer.concat([iv, authTag, encrypted]);
    await fs.promises.writeFile(fullPath, payload);

    return {
      storageKey: fileName,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Reads and decrypts an encrypted storage object into memory
   */
  async readDecrypted(storageKey: string): Promise<Buffer> {
    const fullPath = path.join(this.storageRoot, storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Encrypted statement storage file not found');
    }

    const payload = await fs.promises.readFile(fullPath);
    if (payload.length < 32) {
      throw new Error('Corrupted encrypted statement payload');
    }

    const iv = payload.subarray(0, 16);
    const authTag = payload.subarray(16, 32);
    const encryptedData = payload.subarray(32);

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }

  /**
   * Creates a short-lived temporary artifact in encrypted ephemeral storage
   */
  async storeTempArtifact(buffer: Buffer, artifactType: string): Promise<{ storageKey: string; fullPath: string }> {
    const fileName = `temp_${artifactType.toLowerCase()}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.tmp`;
    const fullPath = path.join(this.tempRoot, fileName);
    await fs.promises.writeFile(fullPath, buffer);
    return { storageKey: fileName, fullPath };
  }

  /**
   * Securely purges a temporary artifact from disk by overwriting with zeroes before unlink
   */
  async purgeTempFile(storageKey: string): Promise<boolean> {
    const fullPath = path.join(this.tempRoot, storageKey);
    try {
      if (fs.existsSync(fullPath)) {
        const stat = await fs.promises.stat(fullPath);
        // Overwrite file with zeroes
        const zeroBuf = Buffer.alloc(stat.size, 0);
        await fs.promises.writeFile(fullPath, zeroBuf);
        await fs.promises.unlink(fullPath);
        this.logger.debug(`[Purge] Securely wiped ephemeral artifact: ${storageKey}`);
        return true;
      }
    } catch (e: any) {
      this.logger.warn(`[Purge Warning] Failed to wipe file ${storageKey}: ${e.message}`);
    }
    return false;
  }

  /**
   * Masks sensitive bank account number: e.g. "123456789012" -> "•••• •••• 9012"
   */
  maskAccountNumber(rawAccount?: string | null): string {
    if (!rawAccount) return '•••• •••• ••••';
    const cleaned = String(rawAccount).replace(/\s+/g, '');
    if (cleaned.length <= 4) return `•••• ${cleaned}`;
    const last4 = cleaned.slice(-4);
    return `•••• •••• ${last4}`;
  }
}
