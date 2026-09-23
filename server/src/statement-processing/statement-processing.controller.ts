import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StatementProcessingService } from './statement-processing.service';
import { PasswordRedactionInterceptor } from './interceptors/password-redaction.interceptor';
import {
  UnlockAndExtractDto,
  ConfirmColumnMappingDto,
  RunEvvDto,
} from './types/statement.types';

@Controller('api/statements')
@UseInterceptors(PasswordRedactionInterceptor)
export class StatementProcessingController {
  constructor(private readonly statementService: StatementProcessingService) {}

  /**
   * POST /api/statements/upload
   * Accepts bank statement PDF/CSV/Excel, inspects encryption, and stores encrypted at rest
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStatement(
    @UploadedFile() file: Express.Multer.File,
    @Body('applicationId') applicationId: string,
    @Body('coApplicantId') coApplicantId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.body?.userId || 'applicant-self';
    const upload = await this.statementService.uploadStatement(
      file,
      userId,
      applicationId || 'app-default',
      coApplicantId,
    );
    return {
      success: true,
      statement: upload,
    };
  }

  /**
   * POST /api/statements/:statementId/request-unlock
   * Returns current unlock status and remaining safe attempts
   */
  @Post(':statementId/request-unlock')
  async requestUnlock(@Param('statementId') statementId: string) {
    return await this.statementService.requestUnlock(statementId);
  }

  /**
   * POST /api/statements/:statementId/unlock-and-extract
   * Securely unlocks PDF using provided document-open password in ephemeral worker memory
   */
  @Post(':statementId/unlock-and-extract')
  async unlockAndExtract(
    @Param('statementId') statementId: string,
    @Body() body: UnlockAndExtractDto,
    @Request() req: any,
  ) {
    const actorId = req.user?.id;
    return await this.statementService.unlockAndExtract(
      statementId,
      body.documentOpenPassword,
      body.userConsent,
      body.userConsentVersion,
      actorId,
    );
  }

  /**
   * GET /api/statements/:statementId/status
   * Checks processing status and encryption status
   */
  @Get(':statementId/status')
  async getStatus(@Param('statementId') statementId: string) {
    return await this.statementService.requestUnlock(statementId);
  }

  /**
   * GET /api/statements/:statementId/extraction-preview
   * Returns preview transactions with masked account numbers
   */
  @Get(':statementId/extraction-preview')
  async getExtractionPreview(@Param('statementId') statementId: string) {
    return await this.statementService.getExtractionPreview(statementId);
  }

  /**
   * POST /api/statements/:statementId/confirm-column-mapping
   * Confirms mapped columns for OCR or manual review
   */
  @Post(':statementId/confirm-column-mapping')
  async confirmColumnMapping(
    @Param('statementId') statementId: string,
    @Body() body: ConfirmColumnMappingDto,
    @Request() req: any,
  ) {
    const actorId = req.user?.id;
    return await this.statementService.confirmColumnMapping(
      statementId,
      body.columns,
      actorId,
      body.reason,
    );
  }

  /**
   * POST /api/statements/:statementId/validate-and-build-daily-balances
   * Reconciles balance, builds daily closing balance timeline, and purges all temporary files
   */
  @Post(':statementId/validate-and-build-daily-balances')
  async validateAndBuildDailyBalances(
    @Param('statementId') statementId: string,
    @Request() req: any,
  ) {
    const actorId = req.user?.id;
    return await this.statementService.validateAndBuildDailyBalances(statementId, actorId);
  }

  /**
   * POST /api/statements/:statementId/run-evv
   * Invokes the authoritative 6-Component EVV engine with clean normalized data
   */
  @Post(':statementId/run-evv')
  async runEvv(
    @Param('statementId') statementId: string,
    @Body() body: RunEvvDto,
    @Request() req: any,
  ) {
    const actorId = req.user?.id;
    return await this.statementService.runEvv(statementId, actorId, body);
  }

  /**
   * GET /api/statements/:statementId/audit
   * Returns non-sensitive audit timeline for managers/staff
   */
  @Get(':statementId/audit')
  async getAuditTimeline(@Param('statementId') statementId: string) {
    const audits = await this.statementService.getAuditTimeline(statementId);
    return {
      success: true,
      statementId,
      audits,
    };
  }

  /**
   * POST /api/statements/:statementId/purge-temporary-artifacts
   * Manually triggers immediate purge of temporary files
   */
  @Post(':statementId/purge-temporary-artifacts')
  async purgeTemporaryArtifacts(@Param('statementId') statementId: string) {
    return await this.statementService.validateAndBuildDailyBalances(statementId);
  }
}
