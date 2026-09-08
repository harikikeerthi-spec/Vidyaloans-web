import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  Header,
  Res,
  HttpStatus
} from '@nestjs/common';
import type { Response } from 'express';
import { StaffGuard } from '../auth/staff.guard';
import { BankRbacInterceptor } from './bank-rbac.middleware';
import { BankService } from './bank.service';
import { BankWorkflowService } from './bank-workflow.service';

@Controller('bank')
@UseGuards(StaffGuard)
@UseInterceptors(BankRbacInterceptor)
export class BankController {
  constructor(
    private readonly bankService: BankService,
    private readonly bankWorkflowService: BankWorkflowService,
  ) { }

  /**
   * Helper to resolve active bank name from selectedBank header/session or email domain
   */
  private resolveBankName(req: any): string {
    // 1. Direct JWT identity from dynamic authentication
    if (req.user?.bankName) return req.user.bankName;
    if (req.user?.bank && req.user.bank.length > 2 && !req.user.bank.includes('@')) {
      const lowerBank = req.user.bank.toLowerCase();
      if (lowerBank === 'idfc') return 'IDFC FIRST Bank';
      if (lowerBank === 'credila') return 'HDFC Credila';
      if (lowerBank === 'auxilo') return 'Auxilo Finserve';
      if (lowerBank === 'avanse') return 'Avanse Financial';
      if (lowerBank === 'poonawalla') return 'Poonawalla Fincorp';
      return req.user.bank;
    }

    const headerBank = req.headers['x-selected-bank'];
    if (headerBank) {
      const hStr = headerBank.toString().toLowerCase();
      if (hStr === 'idfc') return 'IDFC FIRST Bank';
      if (hStr === 'credila') return 'HDFC Credila';
      if (hStr === 'auxilo') return 'Auxilo Finserve';
      if (hStr === 'avanse') return 'Avanse Financial';
      if (hStr === 'poonawalla') return 'Poonawalla Fincorp';
      return headerBank.toString();
    }

    // Try user email mapping
    const email = req.user?.email;
    if (email) {
      const lowerEmail = email.toLowerCase().trim();
      if (lowerEmail.includes("auxilo") || lowerEmail === "luharika28@gmail.com") return "Auxilo Finserve";
      if (lowerEmail.includes("avanse") || lowerEmail === "ropayi2211@aspensif.com") return "Avanse Financial";
      if (lowerEmail.includes("credila") || lowerEmail.includes("hdfc") || lowerEmail === "keerthichinnu0728@gmail.com") return "HDFC Credila";
      if (lowerEmail.includes("idfc") || lowerEmail === "abhimadasu4@gmail.com") return "IDFC FIRST Bank";
      if (lowerEmail.includes("poonawalla") || lowerEmail === "farmatech@gmail.com") return "Poonawalla Fincorp";
    }

    // Fallback: extract from user profile (firstName carries bank mapping)
    if (req.user?.role === 'bank') {
      const bId = req.user.firstName;
      if (bId) {
        const lower = bId.toLowerCase();
        if (lower.includes('credila')) return 'HDFC Credila';
        if (lower.includes('poonawalla')) return 'Poonawalla Fincorp';
        if (lower.includes('idfc')) return 'IDFC FIRST Bank';
        if (lower.includes('avanse')) return 'Avanse Financial';
        if (lower.includes('auxilo')) return 'Auxilo Finserve';
        return bId;
      }
      return 'SBI';
    }
    return '';
  }

  // ==================== CATEGORY A: CORE OPERATIONS ====================

  @Get('incoming-files')
  async getIncomingFiles(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const bankName = this.resolveBankName(req);
    return this.bankService.getIncomingFiles(bankName, { limit, offset });
  }

  @Post('files/:id/log')
  async logFile(
    @Request() req,
    @Param('id') id: string,
    @Body('lanNumber') lanNumber: string
  ) {
    return this.bankService.logFile(id, lanNumber, req.user);
  }

  @Get('documents/:applicationId')
  async getDocuments(@Param('applicationId') applicationId: string) {
    return this.bankService.getDocuments(applicationId);
  }

  @Get('documents/:applicationId/zip')
  @Header('Content-Type', 'application/zip')
  async downloadDocumentsZip(
    @Param('applicationId') applicationId: string,
    @Res() res: Response
  ) {
    const zipData = await this.bankService.generateDocumentsZip(applicationId);
    res.setHeader('Content-Disposition', `attachment; filename=${zipData.fileName}`);
    res.status(HttpStatus.OK).send(zipData.buffer);
  }

  @Post('submit')
  async submitApplicationToBank(
    @Body() body: { applicationId: string; bankId: string; bankName: string; submittedBy: string; remarks?: string },
    @Request() req: any,
  ) {
    const submittedBy = body.submittedBy || req.user?.email || 'staff';
    return await this.bankWorkflowService.submitApplicationToBank(
      body.applicationId,
      body.bankId,
      body.bankName,
      submittedBy,
    );
  }

  @Post('submit-multiple')
  async submitApplicationToMultipleBanks(
    @Body() body: { applicationId: string; banks: Array<{ bankId: string; bankName: string }>; submittedBy: string },
    @Request() req: any,
  ) {
    const submittedBy = body.submittedBy || req.user?.email || 'staff';
    return await this.bankWorkflowService.submitApplicationToMultipleBanks(
      body.applicationId,
      body.banks,
      submittedBy,
    );
  }

  @Post('decisions')
  async submitDecision(
    @Request() req,
    @Body('applicationId') applicationId: string,
    @Body('decisionType') decisionType: string,
    @Body('details') details: any
  ) {
    return this.bankService.registerDecision(applicationId, decisionType, details, req.user);
  }

  @Post('queries')
  async raiseQuery(
    @Request() req,
    @Body() body: any
  ) {
    const applicationId = body?.applicationId || body?.appId || body?.id;
    const content = body?.content || body?.queryText || body?.description || body?.queryDescription || 'Document verification required';
    return this.bankService.raiseQuery(applicationId, content, req.user);
  }

  @Post('disbursements/confirm')
  async confirmDisbursement(
    @Request() req,
    @Body('applicationId') applicationId: string,
    @Body('disbursementAmount') disbursementAmount: number,
    @Body('trancheNumber') trancheNumber: number,
    @Body('transferMode') transferMode: string,
    @Body('utrNumber') utrNumber: string
  ) {
    return this.bankService.confirmDisbursement(
      applicationId,
      disbursementAmount,
      trancheNumber,
      transferMode,
      utrNumber,
      req.user
    );
  }

  // ==================== CATEGORY B: DECISION VARIATIONS ====================

  @Post('conditional-sanctions')
  async conditionalSanction(
    @Request() req,
    @Body('applicationId') applicationId: string,
    @Body('conditions') conditions: string[],
    @Body('deadline') deadline: string,
    @Body('remarks') remarks?: string
  ) {
    return this.bankService.registerDecision(
      applicationId,
      'conditional_sanction',
      { conditions, deadline, remarks },
      req.user
    );
  }

  @Post('conditional-sanctions/:applicationId')
  async saveConditionalSanctions(
    @Param('applicationId') applicationId: string,
    @Body('conditions') conditions: any[],
    @Body('deadline') deadline?: string
  ) {
    return this.bankService.saveConditionalSanctions(applicationId, conditions, deadline);
  }

  @Post('partial-sanctions')
  async partialSanction(
    @Request() req,
    @Body('applicationId') applicationId: string,
    @Body('sanctionAmount') sanctionAmount: number,
    @Body('shortfallAmount') shortfallAmount: number,
    @Body('reason') reason: string,
    @Body('remarks') remarks?: string
  ) {
    return this.bankService.registerDecision(
      applicationId,
      'sanction_approved', // Treated under sanction process flow
      { sanctionAmount, shortfallAmount, reason, remarks },
      req.user
    );
  }

  @Post('counter-offers')
  async counterOffer(
    @Request() req,
    @Body('applicationId') applicationId: string,
    @Body('offeredAmount') offeredAmount: number,
    @Body('offeredRate') offeredRate: number,
    @Body('offeredTenure') offeredTenure: number,
    @Body('remarks') remarks?: string
  ) {
    return this.bankService.registerDecision(
      applicationId,
      'counter_offer',
      { offeredAmount, offeredRate, offeredTenure, remarks },
      req.user
    );
  }

  // ==================== CATEGORY C: ANALYTICS ====================

  @Post('file-quality-score')
  async fileQualityScore(
    @Body('applicationId') applicationId: string,
    @Body('rating') rating: number,
    @Body('feedback') feedback: string
  ) {
    return this.bankService.submitFileQualityScore(applicationId, rating, feedback);
  }

  @Get('analytics/channel')
  async getChannelAnalytics(@Request() req) {
    const bankName = this.resolveBankName(req);
    return {
      success: true,
      bank: bankName,
      roiSpreads: [
        { product: 'Scholar Loan', rate: 9.25, type: 'Floating' },
        { product: 'Student Prime', rate: 10.50, type: 'Fixed' }
      ],
      rejectionsByCause: [
        { cause: 'CIBIL Score Shortfall', count: 18 },
        { cause: 'Collateral Value Insufficient', count: 9 }
      ]
    };
  }

  @Get('analytics/rejections')
  async getRejectionAnalytics(@Request() req) {
    const bankName = this.resolveBankName(req);
    return {
      success: true,
      bank: bankName,
      totalRejections: 27,
      causes: [
        { label: 'Credit Score', count: 12 },
        { label: 'Program Ineligible', count: 15 }
      ]
    };
  }

  @Get('sla-tracker')
  async getSlaTracker(@Request() req) {
    const bankName = this.resolveBankName(req);
    return this.bankService.getSlaTrackingMetrics(bankName);
  }

  // ==================== CATEGORY D: CONFIGURATIONS ====================

  @Get('config/loan-products')
  async getLoanProducts(@Request() req) {
    const bankName = this.resolveBankName(req);
    return this.bankService.getProducts(bankName);
  }

  @Post('config/loan-products')
  async createLoanProduct(@Body() body: any) {
    return this.bankService.createProduct(body);
  }

  @Put('config/loan-products/:id')
  async updateLoanProduct(@Param('id') id: string, @Body() body: any) {
    return this.bankService.updateProduct(id, body);
  }

  @Get('config/branches')
  async getBranches(@Request() req) {
    const bankName = this.resolveBankName(req);
    return this.bankService.getBranches(bankName);
  }

  @Post('config/branches')
  async createBranch(@Body() body: any) {
    return this.bankService.createBranch(body);
  }

  @Get('config/officers')
  async getOfficers(@Request() req) {
    const bankName = this.resolveBankName(req);
    return this.bankService.getOfficers(bankName);
  }

  // ==================== NEW ENDPOINTS ====================

  @Get('applications/:id/detail')
  async getFileDetail(@Param('id') id: string) {
    return this.bankService.getFileDetail(id);
  }

  @Get('lookup/:lan')
  async lookupByLan(@Param('lan') lan: string) {
    return this.bankService.lookupByLan(lan);
  }

  @Get('my-files')
  async getMyFiles(@Request() req, @Query() filters: any) {
    const bankName = this.resolveBankName(req);
    return this.bankService.getMyFiles(bankName, filters);
  }

  @Put('decisions/:decisionId')
  async amendDecision(@Param('decisionId') decisionId: string, @Body('applicationId') applicationId: string, @Body('details') details: any, @Request() req) {
    return this.bankService.amendDecision(applicationId, decisionId, details, req.user);
  }

  @Post('applications/:id/sanction-letter')
  async uploadSanctionLetter(@Param('id') id: string, @Body('fileUrl') fileUrl: string, @Request() req) {
    return this.bankService.uploadSanctionLetter(id, fileUrl, req.user);
  }

  @Post('applications/:id/roi')
  async setRoi(@Param('id') id: string, @Body() roiData: any, @Request() req) {
    return this.bankService.setRoi(id, roiData, req.user);
  }

  @Post('applications/:id/fee')
  async setProcessingFee(@Param('id') id: string, @Body() feeData: any) {
    return this.bankService.setProcessingFee(id, feeData);
  }

  @Put('applications/:id/fee')
  async updateProcessingFee(@Param('id') id: string, @Body() updateData: any) {
    return this.bankService.updateProcessingFee(id, updateData);
  }

  @Get('queries/:queryId')
  async getQueryThread(@Param('queryId') queryId: string) {
    return this.bankService.getQueryThread(queryId);
  }

  @Post('queries/:queryId/resolve')
  async resolveQuery(@Param('queryId') queryId: string) {
    return this.bankService.resolveQuery(queryId);
  }

  @Get('analytics/metrics')
  async getAnalyticsMetrics(@Request() req) {
    const bankName = this.resolveBankName(req);
    return this.bankService.getAnalyticsMetrics(bankName);
  }

  @Get('export/csv')
  async exportApplicationsCsv(@Request() req) {
    const bankName = this.resolveBankName(req);
    return this.bankService.exportApplicationsCsv(bankName);
  }

  @Get('export/mis')
  async exportMisReports(@Request() req) {
    const bankName = this.resolveBankName(req);
    return this.bankService.exportMisReports(bankName);
  }

  @Post('applications/:applicationId/consent')
  async recordConsent(
    @Request() req,
    @Param('applicationId') applicationId: string,
    @Body() body: any
  ) {
    return this.bankService.recordConsent(applicationId, body, req.user);
  }

  @Get('applications/:applicationId/consent')
  async getConsent(@Param('applicationId') applicationId: string) {
    return this.bankService.getConsentStatus(applicationId);
  }
}
