import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionStorageService } from './encryption-storage.service';

@Injectable()
export class TempArtifactService {
  private readonly logger = new Logger(TempArtifactService.name);
  private readonly defaultTtlMinutes = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: EncryptionStorageService,
  ) {}

  /**
   * Registers a temporary ephemeral artifact with 15-minute max TTL
   */
  async registerArtifact(
    statementUploadId: string,
    buffer: Buffer,
    artifactType: 'DECRYPTED_PDF' | 'OCR_IMAGE' | 'RAW_TEXT' | 'TEMP_CSV',
  ): Promise<string> {
    const { storageKey } = await this.storage.storeTempArtifact(buffer, artifactType);

    const expiresAt = new Date(Date.now() + this.defaultTtlMinutes * 60 * 1000);

    try {
      await (this.prisma as any).secureTempArtifact.create({
        data: {
          statementUploadId,
          storageKey,
          artifactType,
          expiresAt,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not record SecureTempArtifact in DB: ${err.message}`);
    }

    return storageKey;
  }

  /**
   * Actively purges all temporary artifacts for a given statement upload
   */
  async purgeArtifactsForStatement(statementUploadId: string): Promise<number> {
    this.logger.log(`[Temp Artifacts] Active purge requested for statement: ${statementUploadId}`);
    let purgedCount = 0;

    try {
      const artifacts = await (this.prisma as any).secureTempArtifact.findMany({
        where: {
          statementUploadId,
          purgedAt: null,
        },
      });

      for (const item of artifacts) {
        await this.storage.purgeTempFile(item.storageKey);
        await (this.prisma as any).secureTempArtifact.update({
          where: { id: item.id },
          data: { purgedAt: new Date() },
        });
        purgedCount++;
      }
    } catch (err: any) {
      this.logger.warn(`Active purge encountered non-fatal error: ${err.message}`);
    }

    return purgedCount;
  }

  /**
   * Periodic cron job running every 5 minutes to purge any expired ephemeral artifacts
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledCleanup(): Promise<void> {
    const now = new Date();
    try {
      const expired = await (this.prisma as any).secureTempArtifact.findMany({
        where: {
          expiresAt: { lt: now },
          purgedAt: null,
        },
      });

      if (expired.length === 0) return;

      this.logger.log(`[Scheduled Cleanup] Purging ${expired.length} expired ephemeral statement artifacts...`);

      for (const item of expired) {
        try {
          await this.storage.purgeTempFile(item.storageKey);
          await (this.prisma as any).secureTempArtifact.update({
            where: { id: item.id },
            data: { purgedAt: now },
          });
        } catch (e: any) {
          this.logger.error(`[HIGH PRIORITY ALERT] Critical failure purging ephemeral artifact ${item.id}: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Scheduled temp artifact cleanup cycle skipped: ${e.message}`);
    }
  }
}
