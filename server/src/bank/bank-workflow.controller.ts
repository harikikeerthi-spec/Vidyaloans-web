import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BankWorkflowService } from './bank-workflow.service';
import { StaffGuard } from '../auth/staff.guard';

@Controller('bank/workflow')
@UseGuards(StaffGuard)
export class BankWorkflowController {
  constructor(private readonly workflowService: BankWorkflowService) {}

  /**
   * Submit application to bank
   * POST /api/bank/workflow/submit
   */
  @Post('submit')
  async submitApplicationToBank(
    @Body() body: {
      applicationId: string;
      bankId: string;
      bankName: string;
      submittedBy: string;
      remarks?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.submitApplicationToBank(
        body.applicationId,
        body.bankId,
        body.bankName,
        body.submittedBy,
        body.remarks,
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Send application email to bank
   * POST /api/bank/workflow/send-application-email
   */
  @Post('send-application-email')
  async sendApplicationEmail(
    @Body() body: {
      applicationId: string;
      bankId: string;
      bankName: string;
      sentBy: string;
      recipientEmail?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.sendApplicationEmailToBank(
        body.applicationId,
        body.bankId,
        body.bankName,
        body.sentBy,
        body.recipientEmail,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Log file with LAN number
   * POST /api/bank/workflow/:submissionId/log-file
   */
  @Post(':submissionId/log-file')
  async logFile(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      lanNumber: string;
      loggedBy: string;
      notes?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.logFile(
        submissionId,
        body.lanNumber,
        body.loggedBy,
        body.notes,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Move to UNDER_REVIEW
   * PUT /api/bank/workflow/:submissionId/under-review
   */
  @Put(':submissionId/under-review')
  async moveToUnderReview(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      changedBy: string;
      notes?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.moveToUnderReview(
        submissionId,
        body.changedBy,
        body.notes,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Raise query with checklist, attachments, and threaded replies (F6)
   * POST /api/bank/workflow/:submissionId/query
   */
  @Post(':submissionId/query')
  async raiseQuery(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      queryType: string;
      queryDescription: string;
      raisedBy: string;
      dueDate?: string;
      docsChecklist?: any[];
      attachments?: any[];
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.raiseQuery(
        submissionId,
        body.queryType,
        body.queryDescription,
        body.raisedBy,
        body.dueDate ? new Date(body.dueDate) : undefined,
        body.docsChecklist || [],
        body.attachments || [],
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Respond to query with checklist updates and attachments (F6)
   * POST /api/bank/workflow/query/:queryId/respond
   */
  @Post('query/:queryId/respond')
  async respondToQuery(
    @Param('queryId') queryId: string,
    @Body() body: {
      response: string;
      respondedBy: string;
      attachments?: any[];
      docsChecklist?: any[];
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.respondToQuery(
        queryId,
        body.response,
        body.respondedBy,
        body.attachments || [],
        body.docsChecklist || [],
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Sanction application
   * POST /api/bank/workflow/:submissionId/sanction
   */
  @Post(':submissionId/sanction')
  async sanctionApplication(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      sanctionAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      roiSubsidy?: number;
      tenure: number;
      decisionNotes?: string;
      decidedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.sanctionApplication(
        submissionId,
        {
          sanctionAmount: body.sanctionAmount,
          roiType: body.roiType,
          roiBase: body.roiBase,
          roiEffective: body.roiEffective,
          roiSubsidy: body.roiSubsidy,
          tenure: body.tenure,
          decisionNotes: body.decisionNotes,
        },
        body.decidedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Conditional sanction
   * POST /api/bank/workflow/:submissionId/conditional-sanction
   */
  @Post(':submissionId/conditional-sanction')
  async conditionalSanctionApplication(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      sanctionAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      tenure: number;
      conditions: string[];
      decisionNotes?: string;
      decidedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.conditionalSanctionApplication(
        submissionId,
        {
          sanctionAmount: body.sanctionAmount,
          roiType: body.roiType,
          roiBase: body.roiBase,
          roiEffective: body.roiEffective,
          tenure: body.tenure,
          conditions: body.conditions,
          decisionNotes: body.decisionNotes,
        },
        body.decidedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Make counter offer
   * POST /api/bank/workflow/:submissionId/counter-offer
   */
  @Post(':submissionId/counter-offer')
  async makeCounterOffer(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      sanctionAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      tenure: number;
      terms: string;
      decidedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.makeCounterOffer(
        submissionId,
        {
          sanctionAmount: body.sanctionAmount,
          roiType: body.roiType,
          roiBase: body.roiBase,
          roiEffective: body.roiEffective,
          tenure: body.tenure,
          terms: body.terms,
        },
        body.decidedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Update individual condition status
   * PUT /api/bank/workflow/:submissionId/conditions/:index
   * Task 17 — F8: per-condition status (PENDING | MET | WAIVED)
   */
  @Put(':submissionId/conditions/:index')
  async updateConditionStatus(
    @Param('submissionId') submissionId: string,
    @Param('index') index: string,
    @Body() body: { status: 'PENDING' | 'MET' | 'WAIVED'; updatedBy: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.updateConditionStatus(
        submissionId,
        parseInt(index, 10),
        body.status,
        body.updatedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({ success: false, message: error.message });
    }
  }

  /**
   * Accept a counter offer
   * POST /api/bank/workflow/:submissionId/counter-offer/accept
   * Task 17 — F10
   */
  @Post(':submissionId/counter-offer/accept')
  async acceptCounterOffer(
    @Param('submissionId') submissionId: string,
    @Body() body: { acceptedBy: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.acceptCounterOffer(submissionId, body.acceptedBy);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({ success: false, message: error.message });
    }
  }

  /**
   * Reject a counter offer
   * POST /api/bank/workflow/:submissionId/counter-offer/reject
   * Task 17 — F10
   */
  @Post(':submissionId/counter-offer/reject')
  async rejectCounterOffer(
    @Param('submissionId') submissionId: string,
    @Body() body: { reason: string; rejectedBy: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.rejectCounterOffer(
        submissionId,
        body.reason,
        body.rejectedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({ success: false, message: error.message });
    }
  }

  /**
   * Partial sanction
   * POST /api/bank/workflow/:submissionId/partial-sanction
   * Task 18 — F9: shortfall calc, route-to-bank
   */
  @Post(':submissionId/partial-sanction')
  async partialSanctionApplication(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      approvedAmount: number;
      requestedAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      tenure: number;
      decisionNotes?: string;
      decidedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.partialSanctionApplication(
        submissionId,
        {
          approvedAmount: body.approvedAmount,
          requestedAmount: body.requestedAmount,
          roiType: body.roiType,
          roiBase: body.roiBase,
          roiEffective: body.roiEffective,
          tenure: body.tenure,
          decisionNotes: body.decisionNotes,
        },
        body.decidedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({ success: false, message: error.message });
    }
  }

  /**
   * Reject application
   * POST /api/bank/workflow/:submissionId/reject
   */
  @Post(':submissionId/reject')
  async rejectApplication(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      reason: string;
      category: string;
      decisionNotes?: string;
      decidedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.rejectApplication(
        submissionId,
        {
          reason: body.reason,
          category: body.category,
          decisionNotes: body.decisionNotes,
        },
        body.decidedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Move to PROCESSING_FEE
   * PUT /api/bank/workflow/:submissionId/processing-fee
   */
  @Put(':submissionId/processing-fee')
  async moveToProcessingFee(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      feeAmount: number;
      changedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.moveToProcessingFee(
        submissionId,
        body.feeAmount,
        body.changedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Mark processing fee as paid
   * PUT /api/bank/workflow/:submissionId/fee-paid
   */
  @Put(':submissionId/fee-paid')
  async markFeeAsPaid(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      changedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.markFeeAsPaid(
        submissionId,
        body.changedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Confirm disbursement
   * POST /api/bank/workflow/:submissionId/disburse
   */
  @Post(':submissionId/disburse')
  async confirmDisbursement(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      amount: number;
      referenceNo: string;
      confirmedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.confirmDisbursement(
        submissionId,
        {
          amount: body.amount,
          referenceNo: body.referenceNo,
        },
        body.confirmedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Allow resubmission to another bank
   * PUT /api/bank/workflow/:submissionId/allow-resubmission
   */
  @Put(':submissionId/allow-resubmission')
  async allowResubmission(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      authorizedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.allowResubmission(
        submissionId,
        body.authorizedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get submission details with queries and history
   * GET /api/bank/workflow/:submissionId
   */
  @Get(':submissionId')
  async getSubmissionDetails(
    @Param('submissionId') submissionId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.getSubmissionWithDetails(
        submissionId,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get bank incoming applications
   * GET /api/bank/workflow/bank/:bankId/incoming
   */
  @Get('bank/:bankId/incoming')
  async getBankIncomingApplications(
    @Param('bankId') bankId: string,
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const result = await this.workflowService.getBankIncomingApplications(
        bankId,
        {
          status,
          limit: limit ? parseInt(limit) : 20,
          offset: offset ? parseInt(offset) : 0,
        },
      );
      return res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get bank workflow analytics
   * GET /api/bank/workflow/bank/:bankId/analytics
   */
  @Get('bank/:bankId/analytics')
  async getBankWorkflowAnalytics(
    @Param('bankId') bankId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.getBankWorkflowAnalytics(bankId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Add message to query thread without status change (F6)
   * POST /api/bank/workflow/query/:queryId/message
   */
  @Post('query/:queryId/message')
  async addQueryMessage(
    @Param('queryId') queryId: string,
    @Body() body: {
      message: string;
      sender: string;
      attachments?: any[];
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.addQueryMessage(
        queryId,
        body.message,
        body.sender,
        body.attachments || [],
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Create Query Template (F42)
   * POST /api/bank/workflow/templates
   */
  @Post('templates')
  async createQueryTemplate(
    @Body() body: {
      bankId: string;
      templateName: string;
      queryType: string;
      queryDescription: string;
      docsChecklist?: any[];
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.createQueryTemplate(body);
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get Query Templates per bank (F42)
   * GET /api/bank/workflow/templates/bank/:bankId
   */
  @Get('templates/bank/:bankId')
  async getQueryTemplatesByBank(
    @Param('bankId') bankId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.getQueryTemplatesByBank(bankId);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Update Query Template (F42)
   * PUT /api/bank/workflow/templates/:templateId
   */
  @Put('templates/:templateId')
  async updateQueryTemplate(
    @Param('templateId') templateId: string,
    @Body() body: {
      templateName?: string;
      queryType?: string;
      queryDescription?: string;
      docsChecklist?: any[];
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.updateQueryTemplate(templateId, body);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Delete Query Template (F42)
   * DELETE /api/bank/workflow/templates/:templateId
   */
  @Post('templates/:templateId/delete')
  async deleteQueryTemplate(
    @Param('templateId') templateId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.deleteQueryTemplate(templateId);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Put submission on Hold (F33)
   * POST /api/bank/workflow/:submissionId/hold
   */
  @Post(':submissionId/hold')
  async setSubmissionHold(
    @Param('submissionId') submissionId: string,
    @Body() body: { reason: string; changedBy: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.setSubmissionHold(
        submissionId,
        body.reason,
        body.changedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Resume submission hold (F33)
   * POST /api/bank/workflow/:submissionId/resume
   */
  @Post(':submissionId/resume')
  async resumeSubmissionHold(
    @Param('submissionId') submissionId: string,
    @Body() body: { changedBy: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.resumeSubmissionHold(
        submissionId,
        body.changedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Bulk transfer submissions reassignment (F34)
   * POST /api/bank/workflow/transfer
   */
  @Post('transfer')
  async bulkTransferSubmissions(
    @Body() body: {
      submissionIds: string[];
      officerId: string;
      officerName: string;
      changedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.bulkTransferSubmissions(
        body.submissionIds,
        body.officerId,
        body.officerName,
        body.changedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Update processing fee status (PAID/WAIVED/REFUNDED)
   * PUT /api/bank/workflow/:submissionId/fee-status
   */
  @Put(':submissionId/fee-status')
  async updateFeeStatus(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      status: 'PAID' | 'WAIVED' | 'REFUNDED';
      paymentRef?: string;
      changedBy?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.updateFeeStatus(
        submissionId,
        body.status,
        body.paymentRef,
        body.changedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Add a new disbursement tranche (F7)
   * POST /api/bank/workflow/:submissionId/tranches
   */
  @Post(':submissionId/tranches')
  async scheduleDisbursementTranche(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      amount: number;
      dueDate: string;
      remarks?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.scheduleDisbursementTranche(
        submissionId,
        body.amount,
        new Date(body.dueDate),
        body.remarks,
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Confirm specific tranche (F7)
   * POST /api/bank/workflow/:submissionId/tranches/:trancheNumber/confirm
   */
  @Post(':submissionId/tranches/:trancheNumber/confirm')
  async confirmDisbursementTranche(
    @Param('submissionId') submissionId: string,
    @Param('trancheNumber') trancheNumber: string,
    @Body() body: {
      referenceNo: string;
      confirmedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.confirmDisbursementTranche(
        submissionId,
        parseInt(trancheNumber, 10),
        body.referenceNo,
        body.confirmedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get tranches summary (F7)
   * GET /api/bank/workflow/:submissionId/tranches
   */
  @Get(':submissionId/tranches')
  async getTranchesSummary(
    @Param('submissionId') submissionId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.getTranchesSummary(submissionId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Amend sanction terms with full audit diff storage (F35)
   * POST /api/bank/workflow/:submissionId/amend
   */
  @Post(':submissionId/amend')
  async amendSanctionTerms(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      newTerms: {
        sanctionAmount?: number;
        roiEffective?: number;
        tenure?: number;
      };
      reason: string;
      effectiveDate: string;
      amendedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.amendSanctionTerms(
        submissionId,
        body.newTerms,
        body.reason,
        new Date(body.effectiveDate),
        body.amendedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Request cancellation (F36)
   * POST /api/bank/workflow/:submissionId/cancel-request
   */
  @Post(':submissionId/cancel-request')
  async requestCancellation(
    @Param('submissionId') submissionId: string,
    @Body() body: { reason: string; requestedBy: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.requestCancellation(
        submissionId,
        body.reason,
        body.requestedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Confirm cancellation with dynamic stage refund (F36)
   * POST /api/bank/workflow/:submissionId/cancel-confirm
   */
  @Post(':submissionId/cancel-confirm')
  async confirmCancellation(
    @Param('submissionId') submissionId: string,
    @Body() body: { confirmedBy: string },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.confirmCancellation(
        submissionId,
        body.confirmedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Submit 4-dimensional quality ratings (F12)
   * POST /api/bank/workflow/:submissionId/rate
   */
  @Post(':submissionId/rate')
  async submitQualityRating(
    @Param('submissionId') submissionId: string,
    @Body() body: {
      ratings: {
        documentation: number;
        credit: number;
        profile: number;
        communication: number;
      };
      comments: string;
      ratedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.submitQualityRating(
        submissionId,
        body.ratings,
        body.comments,
        body.ratedBy,
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get Cross-Bank historical risk audit (F22)
   * GET /api/bank/workflow/:submissionId/cross-bank-history
   */
  @Get(':submissionId/cross-bank-history')
  async getCrossBankHistory(
    @Param('submissionId') submissionId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.getCrossBankHistory(submissionId);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Student Consent Record Grant (F23)
   * POST /api/bank/workflow/consent
   */
  @Post('consent')
  async grantStudentConsent(
    @Body() body: {
      studentId: string;
      bankId: string;
      isGranted: boolean;
      ipAddress?: string;
      userAgent?: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.grantStudentConsent(
        body.studentId,
        body.bankId,
        body.isGranted,
        body.ipAddress,
        body.userAgent,
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Verify Student Consent status (F23)
   * GET /api/bank/workflow/consent/verify
   */
  @Get('consent/verify')
  async verifyStudentConsent(
    @Query('studentId') studentId: string,
    @Query('bankId') bankId: string,
    @Res() res: Response,
  ) {
    try {
      const isGranted = await this.workflowService.verifyStudentConsent(studentId, bankId);
      return res.status(200).json({ success: true, isGranted });
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Funnel pipeline count analytics
   * GET /api/bank/workflow/funnel/analytics
   */
  @Get('funnel/analytics')
  async getPipelineFunnelAnalytics(
    @Query('bankId') bankId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.getPipelineFunnelAnalytics(bankId);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get all bank priorities sorted by priority sequence
   * GET /api/bank/workflow/priorities
   */
  @Get('priorities')
  async getBankPriorities(@Res() res: Response) {
    try {
      const result = await this.workflowService.getBankPriorities();
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Update bank priorities list
   * PUT /api/bank/workflow/priorities
   */
  @Put('priorities')
  async updateBankPriorities(
    @Body() body: { priorities: { priority: number; bankName: string; status: string }[] },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.updateBankPriorities(body.priorities);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Submit application to multiple banks
   * POST /api/bank/workflow/submit-multiple
   */
  @Post('submit-multiple')
  async submitApplicationToMultipleBanks(
    @Body() body: {
      applicationId: string;
      banks: { bankId: string; bankName: string }[];
      submittedBy: string;
    },
    @Res() res: Response,
  ) {
    try {
      const result = await this.workflowService.submitApplicationToMultipleBanks(
        body.applicationId,
        body.banks,
        body.submittedBy,
      );
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

