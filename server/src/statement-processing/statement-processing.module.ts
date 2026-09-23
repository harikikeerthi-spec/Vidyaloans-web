import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApplicationModule } from '../application/application.module';
import { StatementProcessingController } from './statement-processing.controller';
import { StatementProcessingService } from './statement-processing.service';
import { EncryptionStorageService } from './services/encryption-storage.service';
import { TempArtifactService } from './services/temp-artifact.service';
import { PdfUnlockWorker } from './workers/pdf-unlock-worker';
import { PasswordRedactionInterceptor } from './interceptors/password-redaction.interceptor';

@Module({
  imports: [PrismaModule, ApplicationModule],
  controllers: [StatementProcessingController],
  providers: [
    StatementProcessingService,
    EncryptionStorageService,
    TempArtifactService,
    PdfUnlockWorker,
    PasswordRedactionInterceptor,
  ],
  exports: [StatementProcessingService, EncryptionStorageService],
})
export class StatementProcessingModule {}
