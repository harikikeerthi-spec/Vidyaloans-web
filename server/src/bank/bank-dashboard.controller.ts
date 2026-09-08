import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { StaffGuard } from '../auth/staff.guard';
import { BankRbacInterceptor } from './bank-rbac.middleware';
import { BankDashboardService } from './bank-dashboard.service';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('bank/dashboard')
@UseGuards(StaffGuard)
@UseInterceptors(BankRbacInterceptor)
export class BankDashboardController {
  constructor(
    private readonly dashboardService: BankDashboardService,
    private readonly supabase: SupabaseService
  ) {}

  // ==================== CONFIGURATION ====================

  @Get('products')
  async getProducts(@Request() req) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getBankProducts(bankId);
  }

  @Post('products')
  async addProduct(@Request() req, @Body() body: any) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.addBankProduct(bankId, body);
  }

  @Put('products/:productId')
  async updateProduct(@Param('productId') productId: string, @Body() body: any) {
    return this.dashboardService.updateBankProduct(productId, body);
  }

  @Get('branches')
  async getBranches(@Request() req) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getBankBranches(bankId);
  }

  @Post('branches')
  async addBranch(@Request() req, @Body() body: any) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.addBankBranch(bankId, body);
  }

  // ==================== FILE MANAGEMENT ====================

  @Post('files')
  async createFile(@Request() req, @Body() body: any) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.createFileEntry(body.applicationId, bankId, body, req.user);
  }

  @Get('files')
  async listFiles(@Request() req, @Query('status') status?: string, @Query('lanNumber') lanNumber?: string, @Query('bankId') queryBankId?: string) {
    // Allow filtering by bankId query param, or resolve from user context
    // resolveBankIdOrAll returns null for staff/admin → shows all banks
    const bankId = queryBankId || this.resolveBankIdOrAll(req);
    return this.dashboardService.listBankFiles(bankId, status, lanNumber);
  }

  @Get('files/:fileId')
  async getFile(@Param('fileId') fileId: string) {
    return this.dashboardService.getFileDetails(fileId);
  }

  @Post('files/:applicationId/log')
  async logFile(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.logFileWithLAN(applicationId, body.lanNumber, req.user);
  }

  @Get('files/:fileId/log')
  async getFileLog(@Param('fileId') fileId: string) {
    return this.dashboardService.getFileLog(fileId);
  }

  @Get('files/by-lan/:lanNumber')
  async getByLAN(@Param('lanNumber') lanNumber: string) {
    return this.dashboardService.getFilesByLAN(lanNumber);
  }

  // ==================== DOCUMENT MANAGEMENT ====================

  @Post('files/:fileId/documents')
  async uploadDocuments(
    @Request() req,
    @Param('fileId') fileId: string,
    @Body() body: any
  ) {
    return this.dashboardService.addDocumentToFile(fileId, body, req.user);
  }

  @Get('files/:fileId/documents')
  async getDocuments(@Param('fileId') fileId: string) {
    return this.dashboardService.getFileDocuments(fileId);
  }

  @Get('files/:fileId/documents/:documentId')
  async getDocument(@Param('fileId') fileId: string, @Param('documentId') documentId: string) {
    return this.dashboardService.getDocumentDetails(fileId, documentId);
  }

  @Get('files/:fileId/download')
  async downloadDocuments(@Param('fileId') fileId: string) {
    return this.dashboardService.downloadFileAsArchive(fileId);
  }

  // ==================== TIMELINE & AUDIT ====================

  @Get('files/:applicationId/timeline')
  async getFileTimeline(@Param('applicationId') applicationId: string) {
    return this.dashboardService.getFileTimeline(applicationId);
  }

  @Get('files/:applicationId/events')
  async getFileEvents(@Param('applicationId') applicationId: string, @Query('type') type?: string) {
    return this.dashboardService.getFileEvents(applicationId, type);
  }

  // ==================== LAN VALIDATION ====================

  @Post('lan/validate')
  async validateLAN(@Body() body: any) {
    return this.dashboardService.validateLANFormat(body.lanNumber);
  }

  @Get('lan/:lanNumber')
  async checkLAN(@Param('lanNumber') lanNumber: string) {
    return this.dashboardService.checkLANExists(lanNumber);
  }

  @Get('lan/:lanNumber/details')
  async getLANDetails(@Param('lanNumber') lanNumber: string) {
    return this.dashboardService.getLANDetails(lanNumber);
  }

  // ==================== ROI & FEES ====================

  @Put('applications/:applicationId/roi')
  async setROI(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.setROI(applicationId, body, req.user);
  }

  @Post('applications/:applicationId/processing-fee')
  async setProcessingFee(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.setProcessingFee(applicationId, body, req.user);
  }

  @Put('applications/:applicationId/processing-fee')
  async updateProcessingFee(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.updateProcessingFeeStatus(applicationId, body.status, body.details);
  }

  // ==================== SANCTION & DECISION ====================

  @Post('applications/:applicationId/sanction')
  async sanctionApplication(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.sanctionApplication(applicationId, body, req.user);
  }

  @Put('applications/:applicationId/sanction')
  async updateSanction(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.updateSanction(applicationId, body, req.user);
  }

  // ==================== DECISION (Task 12 & 13 — F4) ====================

  /**
   * POST /bank/dashboard/files/:id/decision
   * 4 decision types: APPROVED, REJECTED, CONDITIONAL_SANCTION, COUNTER_OFFER, PARTIAL_SANCTION
   * Per-type validation, auto status transition, full audit.
   */
  @Post('files/:id/decision')
  async recordDecision(
    @Request() req,
    @Param('id') fileId: string,
    @Body() body: any
  ) {
    return this.dashboardService.recordBankDecision(fileId, body, req.user);
  }

  /** GET allowed transitions for an application (drives frontend action buttons) */
  @Get('applications/:applicationId/allowed-transitions')
  async getAllowedTransitions(
    @Request() req,
    @Param('applicationId') applicationId: string
  ) {
    return this.dashboardService.getAllowedTransitionsForApp(applicationId, req.user);
  }

  /** POST transition status directly (for admin/super_admin overrides) */
  @Post('applications/:applicationId/transition')
  async transitionStatus(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: { targetStatus: string; reason?: string }
  ) {
    return this.dashboardService.transitionApplicationStatus(applicationId, body.targetStatus, req.user, body.reason);
  }

  @Post('applications/:applicationId/decision')
  async recordBankDecision(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.recordBankDecision(applicationId, body, req.user);
  }

  // ==================== QUERIES & CONSENTS ====================

  @Post('applications/:applicationId/query')
  async raiseQuery(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.raiseQuery(applicationId, body, req.user);
  }

  @Get('queries')
  async getQueries(@Request() req, @Query('applicationId') applicationId?: string) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getBankQueries(bankId, applicationId);
  }

  @Get('queries/:queryId')
  async getQuery(@Param('queryId') queryId: string) {
    return this.dashboardService.getQueryDetails(queryId);
  }

  @Post('queries/:queryId/response')
  async respondToQuery(
    @Request() req,
    @Param('queryId') queryId: string,
    @Body() body: any
  ) {
    return this.dashboardService.respondToQuery(queryId, body, req.user);
  }

  @Get('queries/:queryId/responses')
  async getQueryResponses(@Param('queryId') queryId: string) {
    return this.dashboardService.getQueryResponses(queryId);
  }

  @Put('queries/:queryId/resolve')
  async resolveQuery(
    @Request() req,
    @Param('queryId') queryId: string,
    @Body() body: any
  ) {
    return this.dashboardService.resolveQuery(queryId, req.user);
  }

  // ==================== CONSENT & REFERRAL ====================

  @Post('applications/:applicationId/consent')
  async recordConsent(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.recordConsent(applicationId, body, req.user);
  }

  @Get('applications/:applicationId/consent')
  async getConsent(@Param('applicationId') applicationId: string) {
    return this.dashboardService.getConsentStatus(applicationId);
  }

  @Post('applications/:applicationId/referral-fee')
  async updateReferralFee(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.updateReferralFee(applicationId, body, req.user);
  }

  // ==================== DISBURSEMENTS ====================

  @Post('applications/:applicationId/disbursement')
  async confirmDisbursement(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.confirmDisbursement(applicationId, body, req.user);
  }

  @Get('applications/:applicationId/disbursements')
  async getDisbursements(@Param('applicationId') applicationId: string) {
    return this.dashboardService.getDisbursements(applicationId);
  }

  @Get('disbursements')
  async getAllDisbursements(@Request() req) {
    const bankId = this.resolveBankId(req);
    const { data, error } = await this.supabase.getClient()
      .from('Disbursement')
      .select(`
        *,
        LoanApplication(id, firstName, lastName, amount)
      `)
      .eq('LoanApplication.bank', bankId)
      .order('disbursedAt', { ascending: false });
    return data || [];
  }

  // ==================== QUALITY RATING ====================

  @Post('applications/:applicationId/quality-rating')
  async rateQuality(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.dashboardService.rateFileQuality(applicationId, body, req.user);
  }

  // ==================== ANALYTICS ====================

  @Get('analytics/channel')
  async getChannelAnalytics(@Request() req) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getChannelAnalytics(bankId);
  }

  @Get('analytics/rejections')
  async getRejectionAnalytics(@Request() req) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getRejectionAnalytics(bankId);
  }

  @Get('analytics/pipeline')
  async getPipelineAnalytics(@Request() req) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getPipelineAnalytics(bankId);
  }

  @Get('analytics/aging')
  async getAgingAnalytics(@Request() req) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getAgingReport(bankId);
  }

  @Get('analytics/sla')
  async getSLAAnalytics(@Request() req) {
    const bankId = this.resolveBankId(req);
    return this.dashboardService.getSLAMetrics(bankId);
  }

  // ==================== AUDIT LOGS ====================

  @Get('applications/:applicationId/audit-logs')
  async getAuditLogs(@Param('applicationId') applicationId: string) {
    return this.dashboardService.getAuditLogs(applicationId);
  }

  // ==================== INTERNAL NOTES (F32) ====================

  /** POST /bank/dashboard/files/:id/notes — add internal note (same-bank only) */
  @Post('files/:id/notes')
  async addNote(
    @Request() req,
    @Param('id') fileId: string,
    @Body() body: { content: string; isPinned?: boolean }
  ) {
    return this.dashboardService.addNote(fileId, body, req.user);
  }

  /** GET /bank/dashboard/files/:id/notes — list notes (same-bank only) */
  @Get('files/:id/notes')
  async getNotes(
    @Request() req,
    @Param('id') fileId: string
  ) {
    return this.dashboardService.getNotes(fileId, req.user);
  }

  /** PUT /bank/dashboard/files/:id/notes/:noteId — update own note */
  @Put('files/:id/notes/:noteId')
  async updateNote(
    @Request() req,
    @Param('noteId') noteId: string,
    @Body() body: { content: string }
  ) {
    return this.dashboardService.updateNote(noteId, body.content, req.user);
  }

  /** DELETE /bank/dashboard/files/:id/notes/:noteId — delete own note */
  @Delete('files/:id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(
    @Request() req,
    @Param('noteId') noteId: string
  ) {
    await this.dashboardService.deleteNote(noteId, req.user);
  }

  // ==================== FILE TAGS (F43) ====================

  /** GET /bank/dashboard/tags — pre-built tag library */
  @Get('tags')
  getTagLibrary() {
    return { tags: this.dashboardService.getTagLibrary() };
  }

  /** POST /bank/dashboard/files/:id/tags — add a tag to a file */
  @Post('files/:id/tags')
  async addTag(
    @Request() req,
    @Param('id') fileId: string,
    @Body() body: { tag: string }
  ) {
    return this.dashboardService.addTag(fileId, body.tag, req.user);
  }

  /** DELETE /bank/dashboard/files/:id/tags/:tag — remove a tag */
  @Delete('files/:id/tags/:tag')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTag(
    @Request() req,
    @Param('id') fileId: string,
    @Param('tag') tag: string
  ) {
    await this.dashboardService.removeTag(fileId, tag, req.user);
  }

  /** GET /bank/dashboard/files?tag=PRIORITY — list files filtered by tag */
  @Get('files/by-tag/:tag')
  async getFilesByTag(
    @Request() req,
    @Param('tag') tag: string
  ) {
    const bankId = this.resolveBankIdOrAll(req);
    return this.dashboardService.getFilesByTag(tag, bankId);
  }

  // ==================== HELPER ====================

  private resolveBankId(req: any): string {
    return this.resolveBankIdOrAll(req) || 'credila';
  }

  private resolveBankIdOrAll(req: any): string | null {
    const headerBank = req.headers['x-bank-id'] || req.headers['x-selected-bank'];
    if (headerBank) {
      const hb = headerBank.toString().toLowerCase();
      if (hb.includes('avanse')) return 'avanse';
      if (hb.includes('poonawalla')) return 'poonawalla';
      if (hb.includes('credila') || hb.includes('hdfc')) return 'credila';
      if (hb.includes('idfc')) return 'idfc';
      if (hb.includes('auxilo')) return 'auxilo';
      return hb;
    }
    
    if (req.user?.bankId) return req.user.bankId;
    if (req.user?.bank) return req.user.bank;
    if (req.user?.bankName) return req.user.bankName;

    // Check email domain/address mapping first
    const email = req.user?.email;
    if (email) {
      const lowerEmail = email.toLowerCase().trim();
      if (lowerEmail.includes("auxilo") || lowerEmail === "luharika28@gmail.com") return "auxilo";
      if (lowerEmail.includes("avanse") || lowerEmail === "ropayi2211@aspensif.com") return "avanse";
      if (lowerEmail.includes("credila") || lowerEmail.includes("hdfc") || lowerEmail === "keerthichinnu0728@gmail.com") return "credila";
      if (lowerEmail.includes("idfc") || lowerEmail === "abhimadasu4@gmail.com") return "idfc";
      if (lowerEmail.includes("poonawalla") || lowerEmail === "farmatech@gmail.com") return "poonawalla";
    }

    if (req.user?.firstName) {
      const lowerName = req.user.firstName.toLowerCase();
      const validBanks = ['credila', 'auxilo', 'avanse', 'idfc', 'poonawalla', 'sbi', 'icici', 'axis'];
      if (validBanks.includes(lowerName)) {
        return lowerName;
      }
      const matched = validBanks.find(b => b.includes(lowerName) || lowerName.includes(b));
      if (matched) return matched;
    }
    
    // Staff/admin/super_admin users without a specific bank context see all banks
    const adminRoles = ['staff', 'admin', 'super_admin'];
    if (req.user?.role && adminRoles.includes(req.user.role)) {
      return null; // null means "all banks"
    }
    
    return null;
  }
}

