import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { SupabaseService } from '../supabase/supabase.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmailService } from '../auth/email.service';

export interface BankWorkflowConfig {
  maxQueryRetries: number;
  queryResponseDays: number;
  processingFeeDays: number;
  disbursementDays: number;
}

// Workflow states and valid transitions
const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  'SUBMITTED_TO_BANK': ['FILE_LOGGED', 'REJECTED'],
  'FILE_LOGGED': ['UNDER_REVIEW', 'REJECTED'],
  'UNDER_REVIEW': ['QUERY_RAISED', 'SANCTIONED', 'CONDITIONAL_SANCTION', 'COUNTER_OFFER', 'REJECTED'],
  'QUERY_RAISED': ['UNDER_REVIEW', 'REJECTED'],
  'SANCTIONED': ['PROCESSING_FEE', 'REJECTED'],
  'CONDITIONAL_SANCTION': ['SANCTIONED', 'REJECTED'],
  'COUNTER_OFFER': ['SANCTIONED', 'REJECTED'],
  'PROCESSING_FEE': ['DISBURSEMENT_PENDING', 'REJECTED'],
  'DISBURSEMENT_PENDING': ['DISBURSED', 'REJECTED'],
  'DISBURSED': [],
  'REJECTED': ['RESUBMIT_OTHER_BANK'],
  'RESUBMIT_OTHER_BANK': ['SUBMITTED_TO_BANK'],
};

@Injectable()
export class BankWorkflowService {
  constructor(
    private readonly db: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
  ) {}

  private async generateBankApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VTU-APP-${year}-`;
    
    try {
      const { data, error } = await this.db.client
        .from('LoanApplication')
        .select('applicationNumber')
        .like('applicationNumber', `${prefix}%`)
        .order('applicationNumber', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextSeq = 1;
      if (data && data.applicationNumber) {
        const parts = data.applicationNumber.split('-');
        if (parts.length === 4) {
          const currentSeq = parseInt(parts[3], 10);
          if (!isNaN(currentSeq)) {
            nextSeq = currentSeq + 1;
          }
        }
      }

      return `${prefix}${String(nextSeq).padStart(5, '0')}`;
    } catch (e) {
      const rand = Math.floor(10000 + Math.random() * 90000);
      return `${prefix}${rand}`;
    }
  }

  private async generateApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VL-APP-${year}-`;
    
    try {
      const { data, error } = await this.db.client
        .from('LoanApplication')
        .select('applicationNumber')
        .like('applicationNumber', `${prefix}%`)
        .order('applicationNumber', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextSeq = 1;
      if (data && data.applicationNumber) {
        const parts = data.applicationNumber.split('-');
        if (parts.length === 4) {
          const currentSeq = parseInt(parts[3], 10);
          if (!isNaN(currentSeq)) {
            nextSeq = currentSeq + 1;
          }
        }
      }

      return `${prefix}${String(nextSeq).padStart(5, '0')}`;
    } catch (e) {
      const rand = Math.floor(10000 + Math.random() * 90000);
      return `${prefix}${rand}`;
    }
  }

  /**
   * Share application with a bank (SUBMITTED_TO_BANK)
   */
  async submitApplicationToBank(
    applicationId: string,
    bankId: string,
    bankName: string,
    submittedBy: string,
  ) {
    // Get application
    const { data: application, error: appError } = await this.db.client
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      throw new NotFoundException('Application not found');
    }

    // Check if already submitted to this bank
    const { data: existing } = await this.db.client
      .from('BankSubmission')
      .select('*')
      .eq('applicationId', applicationId)
      .eq('bankId', bankId)
      .maybeSingle();

    let submission = existing;

    if (existing) {
      const { data: updatedSub } = await this.db.client
        .from('BankSubmission')
        .update({
          workflowStatus: 'SUBMITTED_TO_BANK',
          currentStage: 'SUBMITTED_TO_BANK',
          submittedBy,
          updatedAt: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updatedSub) submission = updatedSub;
    } else {
      // Create bank submission record
      const { data: newSub, error: submitError } = await this.db.client
        .from('BankSubmission')
        .insert({
          applicationId,
          bankId,
          bankName,
          submittedBy,
          workflowStatus: 'SUBMITTED_TO_BANK',
          currentStage: 'SUBMITTED_TO_BANK',
          statusHistory: [
            {
              fromStatus: null,
              toStatus: 'SUBMITTED_TO_BANK',
              changedAt: new Date().toISOString(),
              changedBy: submittedBy,
              reason: 'Application shared with bank',
            },
          ],
        })
        .select()
        .single();

      if (submitError) {
        throw submitError;
      }
      submission = newSub;
    }

    // Update LoanApplication with bank submission reference — generate VL-APP sequential number if not already assigned.
    let appNumber = application.applicationNumber;
    if (!appNumber) {
      appNumber = await this.generateApplicationNumber();
    }

    await this.db.client
      .from('LoanApplication')
      .update({
        bank: bankName,
        bankSubmissionId: submission.id,
        bankWorkflowStatus: 'SUBMITTED_TO_BANK',
        bankWorkflowStage: 'SUBMITTED_TO_BANK',
        submittedToBankAt: new Date().toISOString(),
        applicationNumber: appNumber,
        status: 'submitted_to_bank',
        stage: 'bank_review',
        progress: 70,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', applicationId);


    // Record in workflow history
    await this.recordWorkflowHistory(submission.id, applicationId, null, 'SUBMITTED_TO_BANK', submittedBy, 'Application shared with bank');

    // Fetch student's profile name and registered email
    let studentName = `${application.firstName || ''} ${application.lastName || ''}`.trim() || 'Student';
    let studentEmail = application.email || '';
    try {
      if (application.userId) {
        const { data: student } = await this.db.client
          .from('User')
          .select('email, firstName, lastName')
          .eq('id', application.userId)
          .single();
        if (student) {
          if (student.email) studentEmail = student.email;
          const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
          if (name) studentName = name;
        }
      }
    } catch (e: any) {
      console.warn('[BankWorkflowService] Failed to load student details for email:', e.message);
    }

    // Fetch bank registered email from Bank table
    let bankEmail = '';
    try {
      const { data: bankProfile } = await this.db.client
        .from('Bank')
        .select('email')
        .eq('shortName', bankId)
        .single();
      if (bankProfile?.email) {
        bankEmail = bankProfile.email;
      }
    } catch (e: any) {
      console.warn('[BankWorkflowService] Failed to load bank profile email:', e.message);
    }

    const fallbackEmails: Record<string, string> = {
      avanse: 'avansebank01@gmail.com',
      auxilo: 'auxilobank01@gmail.com',
      idfc: 'idfcbank01@gmail.com',
      poonawalla: 'poonawallabank01@gmail.com',
      credila: 'credilabank01@gmail.com',
    };
    const targetEmail = bankEmail || fallbackEmails[bankId] || `${bankId}bank01@gmail.com`;

    // 1. Send email alert to bank
    await this.emailService.sendNewApplicationNotificationToBank(targetEmail, bankName, application, studentName).catch(err => {
      console.error('[BankWorkflowService] Failed to send bank notification email:', err);
    });

    // 2. Send email alert to student registered mail ID
    if (studentEmail) {
      await this.emailService.sendApplicationSentToBankEmail(studentEmail, studentName, bankName, application).catch(err => {
        console.error('[BankWorkflowService] Failed to send student application email:', err);
      });
    }

    // Emit event
    this.eventEmitter.emit('bank.submission.created', {
      submissionId: submission.id,
      applicationId,
      bankId,
      bankName,
    });

    return { success: true, data: submission };
  }

  /**
   * Send (or re-send) the full application email package to the target bank.
   * This is triggered manually from the Incoming Queue "Send Mail" action.
   */
  async sendApplicationEmailToBank(
    applicationId: string,
    bankId: string,
    bankName: string,
    sentBy: string,
    recipientEmail?: string,
  ) {
    // Fetch application
    const { data: application, error: appError } = await this.db.client
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      throw new NotFoundException('Application not found');
    }

    // Fetch documents list from ApplicationDocument & UserDocument
    let documents: any[] = [];
    const attachments: any[] = [];

    try {
      const { data: appDocs } = await this.db.client
        .from('ApplicationDocument')
        .select('*')
        .eq('applicationId', applicationId);

      const { data: vaultDocs } = await this.db.client
        .from('UserDocument')
        .select('*')
        .eq('userId', application.userId);

      const vaultDocsMap = new Map((vaultDocs || []).map((v: any) => [v.docType, v]));
      const appDocTypes = new Set((appDocs || []).map((d: any) => d.docType));

      const mergedAppDocs = (appDocs || []).map((d: any) => {
        const vMatch = vaultDocsMap.get(d.docType);
        const finalPath = d.filePath || vMatch?.filePath || null;
        return {
          id: d.id,
          name: d.docName || d.fileName || d.docType,
          type: d.docType,
          status: d.status === 'not_uploaded' && vMatch ? (vMatch.status || 'uploaded') : d.status,
          url: finalPath,
          filePath: finalPath,
          fileName: d.fileName || vMatch?.fileName || d.docName,
        };
      });

      const extraVaultDocs = (vaultDocs || [])
        .filter((v: any) => !appDocTypes.has(v.docType) && v.filePath)
        .map((v: any) => ({
          id: `vault_${v.id}`,
          name: (v.docType || 'Document').replace(/_/g, ' ').toUpperCase(),
          type: v.docType,
          status: v.status || 'uploaded',
          url: v.filePath,
          filePath: v.filePath,
          fileName: v.fileName || v.docType,
        }));

      documents = [...mergedAppDocs, ...extraVaultDocs];

      // Prepare email file attachments for valid local files
      for (const doc of documents) {
        if (doc.filePath) {
          const absPath = resolve(doc.filePath);
          if (existsSync(absPath)) {
            attachments.push({
              filename: doc.fileName || `${doc.name}.pdf`,
              path: absPath,
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('[sendApplicationEmailToBank] Could not load documents:', e.message);
    }

    // Fetch student name
    let studentName = 'Student';
    try {
      const { data: student } = await this.db.client
        .from('User')
        .select('firstName, lastName, email, phone')
        .eq('id', application.userId)
        .single();
      if (student) {
        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
      }
    } catch (e: any) {
      console.warn('[sendApplicationEmailToBank] Failed to load student name:', e.message);
    }

    // Resolve target bank email
    let bankEmail = '';
    try {
      const { data: bankProfile } = await this.db.client
        .from('Bank')
        .select('email')
        .eq('shortName', bankId)
        .single();
      if (bankProfile?.email) bankEmail = bankProfile.email;
    } catch (e: any) {
      console.warn('[sendApplicationEmailToBank] Failed to load bank email:', e.message);
    }

    const fallbackEmails: Record<string, string> = {
      avanse: 'avansebank01@gmail.com',
      auxilo: 'auxilobank01@gmail.com',
      idfc: 'idfcbank01@gmail.com',
      poonawalla: 'poonawallabank01@gmail.com',
      credila: 'credilabank01@gmail.com',
    };
    const targetEmail = (recipientEmail && recipientEmail.trim()) || bankEmail || fallbackEmails[bankId] || `${bankId}bank01@gmail.com`;

    // Build enriched application object for email
    const enrichedApplication = {
      ...application,
      documents,
    };

    // Send the detailed application package email
    await this.emailService.sendApplicationPackageToBank(
      targetEmail,
      bankName,
      enrichedApplication,
      studentName,
      attachments,
    );

    return {
      success: true,
      message: `Application package emailed to ${bankName} at ${targetEmail}`,
      sentTo: targetEmail,
    };
  }

  /**
   * Log file (FILE_LOGGED) - Bank assigns LAN and logs file
   */
  async logFile(
    submissionId: string,
    lanNumber: string,
    loggedBy: string,
    notes?: string,
  ) {
    // Get submission
    const submission = await this.getSubmission(submissionId);

    // Validate transition
    if (!this.isValidTransition(submission.workflowStatus, 'FILE_LOGGED')) {
      throw new BadRequestException(
        `Cannot transition from ${submission.workflowStatus} to FILE_LOGGED`,
      );
    }

    // Check for duplicate LAN
    const { data: existingLan } = await this.db.client
      .from('BankSubmission')
      .select('id')
      .eq('lanNumber', lanNumber)
      .neq('id', submissionId)
      .single();

    if (existingLan) {
      throw new BadRequestException('LAN number already exists');
    }

    // Update submission
    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'FILE_LOGGED',
        currentStage: 'FILE_LOGGED',
        lanNumber,
        fileLoggedAt: new Date().toISOString(),
        fileLoggedBy: loggedBy,
        comments: notes,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    // Record in workflow history
    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      'SUBMITTED_TO_BANK',
      'FILE_LOGGED',
      loggedBy,
      `File logged with LAN: ${lanNumber}`,
    );

    // Update LoanApplication
    await this.db.client
      .from('LoanApplication')
      .update({
        bankWorkflowStatus: 'FILE_LOGGED',
        lanNumber,
      })
      .eq('id', submission.applicationId);

    this.eventEmitter.emit('bank.file.logged', {
      submissionId,
      applicationId: submission.applicationId,
      lanNumber,
      bankId: submission.bankId,
      bankName: submission.bankName,
    });

    return { success: true, data: updated };
  }

  /**
   * Move to UNDER_REVIEW
   */
  async moveToUnderReview(submissionId: string, changedBy: string, notes?: string) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'UNDER_REVIEW')) {
      throw new BadRequestException(
        `Cannot transition from ${submission.workflowStatus} to UNDER_REVIEW`,
      );
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'UNDER_REVIEW',
        currentStage: 'UNDER_REVIEW',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'UNDER_REVIEW',
      changedBy,
      notes || 'Application moved to under review',
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'UNDER_REVIEW' })
      .eq('id', submission.applicationId);

    return { success: true, data: updated };
  }

  /**
   * Raise query (QUERY_RAISED) with checklist, attachments, and threaded replies
   */
  async raiseQuery(
    submissionId: string,
    queryType: string,
    queryDescription: string,
    raisedBy: string,
    dueDate?: Date,
    docsChecklist: any[] = [],
    attachments: any[] = [],
  ) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'QUERY_RAISED')) {
      throw new BadRequestException(
        `Cannot raise query from ${submission.workflowStatus} status`,
      );
    }

    const queryId = require('crypto').randomUUID();
    const initialMessage = {
      id: require('crypto').randomUUID(),
      sender: raisedBy,
      message: queryDescription,
      timestamp: new Date().toISOString(),
      attachments: attachments || [],
    };

    // Create query record
    const { data: query, error: queryError } = await this.db.client
      .from('BankWorkflowQueryRequest')
      .insert({
        id: queryId,
        submissionId,
        applicationId: submission.applicationId,
        queryType,
        queryDescription,
        raisedBy,
        dueDate: dueDate?.toISOString(),
        status: 'PENDING',
        docsChecklist,
        attachments,
        messages: [initialMessage],
      })
      .select()
      .single();

    if (queryError) throw queryError;

    // Update submission to QUERY_RAISED
    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'QUERY_RAISED',
        currentStage: 'QUERY_RAISED',
        queriesRaised: (submission.queriesRaised || 0) + 1,
        lastQueryAt: new Date().toISOString(),
        queryResponsePending: true,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'QUERY_RAISED',
      raisedBy,
      `Query raised: ${queryType} - ${queryDescription}`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'QUERY_RAISED' })
      .eq('id', submission.applicationId);

    this.eventEmitter.emit('bank.query.raised', {
      submissionId,
      applicationId: submission.applicationId,
      queryId: query.id,
      bankId: submission.bankId,
      bankName: submission.bankName,
    });

    return { success: true, data: query };
  }

  /**
   * Respond to query
   */
  async respondToQuery(
    queryId: string,
    response: string,
    respondedBy: string,
    attachments: any[] = [],
    docsChecklist: any[] = [],
  ) {
    // Get query
    const { data: query, error: queryError } = await this.db.client
      .from('BankWorkflowQueryRequest')
      .select('*')
      .eq('id', queryId)
      .single();

    if (queryError || !query) {
      throw new NotFoundException('Query not found');
    }

    const currentMessages = query.messages || [];
    const newMessage = {
      id: require('crypto').randomUUID(),
      sender: respondedBy,
      message: response,
      timestamp: new Date().toISOString(),
      attachments: attachments || [],
    };
    const updatedMessages = [...currentMessages, newMessage];

    const currentAttachments = query.attachments || [];
    const updatedAttachments = [...currentAttachments, ...attachments];

    // Merge or overwrite docs checklist
    const updatedChecklist = docsChecklist && docsChecklist.length > 0 ? docsChecklist : query.docsChecklist || [];

    // Update query
    const { data: updatedQuery, error: updateError } = await this.db.client
      .from('BankWorkflowQueryRequest')
      .update({
        status: 'RESPONDED',
        response,
        respondedBy,
        respondedAt: new Date().toISOString(),
        messages: updatedMessages,
        attachments: updatedAttachments,
        docsChecklist: updatedChecklist,
      })
      .eq('id', queryId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Check if all queries for this submission are responded
    const { data: pendingQueries } = await this.db.client
      .from('BankWorkflowQueryRequest')
      .select('id')
      .eq('submissionId', query.submissionId)
      .eq('status', 'PENDING');

    // Move back to UNDER_REVIEW if all queries are responded
    if (!pendingQueries || pendingQueries.length === 0) {
      const { data: submission } = await this.db.client
        .from('BankSubmission')
        .select('*')
        .eq('id', query.submissionId)
        .single();

      await this.db.client
        .from('BankSubmission')
        .update({
          workflowStatus: 'UNDER_REVIEW',
          currentStage: 'UNDER_REVIEW',
          queryResponsePending: false,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', query.submissionId);

      await this.recordWorkflowHistory(
        query.submissionId,
        query.applicationId,
        'QUERY_RAISED',
        'UNDER_REVIEW',
        respondedBy,
        'All queries responded, moving back to under review',
      );

      await this.db.client
        .from('LoanApplication')
        .update({ bankWorkflowStatus: 'UNDER_REVIEW' })
        .eq('id', query.applicationId);
    }

    return { success: true, data: updatedQuery };
  }

  /**
   * Approve application (SANCTIONED)
   */
  async sanctionApplication(
    submissionId: string,
    sanctionDetails: {
      sanctionAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      roiSubsidy?: number;
      tenure: number;
      decisionNotes?: string;
    },
    decidedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'SANCTIONED')) {
      throw new BadRequestException(
        `Cannot sanction from ${submission.workflowStatus} status`,
      );
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'SANCTIONED',
        currentStage: 'SANCTIONED',
        decisionStatus: 'SANCTIONED',
        decisionMadeAt: new Date().toISOString(),
        decisionMadeBy: decidedBy,
        decisionNotes: sanctionDetails.decisionNotes,
        sanctionAmount: sanctionDetails.sanctionAmount,
        roiType: sanctionDetails.roiType,
        roiBase: sanctionDetails.roiBase,
        roiEffective: sanctionDetails.roiEffective,
        roiSubsidy: sanctionDetails.roiSubsidy,
        tenure: sanctionDetails.tenure,
        sanctionDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'SANCTIONED',
      decidedBy,
      `Application sanctioned for ₹${sanctionDetails.sanctionAmount}`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({
        bankWorkflowStatus: 'SANCTIONED',
        status: 'approved',
        sanctionAmount: sanctionDetails.sanctionAmount,
        roiType: sanctionDetails.roiType,
        roiBase: sanctionDetails.roiBase,
        roiEffective: sanctionDetails.roiEffective,
        roiSubsidy: sanctionDetails.roiSubsidy,
      })
      .eq('id', submission.applicationId);

    this.eventEmitter.emit('bank.application.sanctioned', {
      submissionId,
      applicationId: submission.applicationId,
      sanctionAmount: sanctionDetails.sanctionAmount,
    });

    return { success: true, data: updated };
  }

  /**
   * Conditional sanction
   */
  async conditionalSanctionApplication(
    submissionId: string,
    sanctionDetails: {
      sanctionAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      tenure: number;
      conditions: (string | { text: string; deadline?: string })[];
      decisionNotes?: string;
    },
    decidedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'CONDITIONAL_SANCTION')) {
      throw new BadRequestException(
        `Cannot conditionally sanction from ${submission.workflowStatus} status`,
      );
    }

    // Normalize conditions to structured objects with per-item status + deadline
    const structuredConditions = sanctionDetails.conditions.map((c, idx) => {
      if (typeof c === 'string') {
        return { index: idx, text: c, status: 'PENDING', deadline: null };
      }
      return { index: idx, text: c.text, status: 'PENDING', deadline: c.deadline || null };
    });

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'CONDITIONAL_SANCTION',
        currentStage: 'CONDITIONAL_SANCTION',
        decisionStatus: 'CONDITIONAL_SANCTION',
        decisionMadeAt: new Date().toISOString(),
        decisionMadeBy: decidedBy,
        decisionNotes: sanctionDetails.decisionNotes,
        sanctionAmount: sanctionDetails.sanctionAmount,
        roiType: sanctionDetails.roiType,
        roiBase: sanctionDetails.roiBase,
        roiEffective: sanctionDetails.roiEffective,
        tenure: sanctionDetails.tenure,
        conditions: structuredConditions,
        sanctionDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'CONDITIONAL_SANCTION',
      decidedBy,
      `Conditional sanction for ₹${sanctionDetails.sanctionAmount} with ${structuredConditions.length} condition(s)`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'CONDITIONAL_SANCTION' })
      .eq('id', submission.applicationId);

    this.eventEmitter.emit('bank.application.conditional_sanctioned', {
      submissionId,
      applicationId: submission.applicationId,
      conditionCount: structuredConditions.length,
    });

    return { success: true, data: updated };
  }

  /**
   * Update individual condition status (PENDING -> MET | WAIVED)
   * Task 17 — F8
   */
  async updateConditionStatus(
    submissionId: string,
    conditionIndex: number,
    status: 'PENDING' | 'MET' | 'WAIVED',
    updatedBy: string,
  ) {
    const VALID_CONDITION_STATUSES = ['PENDING', 'MET', 'WAIVED'];
    if (!VALID_CONDITION_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid condition status "${status}". Allowed: ${VALID_CONDITION_STATUSES.join(', ')}`);
    }

    const submission = await this.getSubmission(submissionId);
    if (submission.workflowStatus !== 'CONDITIONAL_SANCTION') {
      throw new BadRequestException('Submission is not in CONDITIONAL_SANCTION status.');
    }

    const conditions: any[] = submission.conditions || [];
    const condIdx = conditions.findIndex((c: any) => c.index === conditionIndex);
    if (condIdx === -1) {
      throw new NotFoundException(`Condition at index ${conditionIndex} not found.`);
    }

    conditions[condIdx] = { ...conditions[condIdx], status, updatedAt: new Date().toISOString() };

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({ conditions, updatedAt: new Date().toISOString() })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    // If all conditions are MET or WAIVED, log event
    const allMet = conditions.every((c: any) => c.status === 'MET' || c.status === 'WAIVED');
    if (allMet) {
      this.eventEmitter.emit('bank.conditions.all_met', { submissionId, applicationId: submission.applicationId });
    }

    return { success: true, data: updated, allConditionsMet: allMet };
  }

  /**
   * Accept a counter offer (transitions to SANCTIONED).
   * Task 17 — F10
   */
  async acceptCounterOffer(submissionId: string, acceptedBy: string) {
    const submission = await this.getSubmission(submissionId);

    if (submission.workflowStatus !== 'COUNTER_OFFER') {
      throw new BadRequestException('Submission is not in COUNTER_OFFER status.');
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'SANCTIONED',
        currentStage: 'SANCTIONED',
        decisionStatus: 'SANCTIONED',
        counterOfferAcceptedAt: new Date().toISOString(),
        counterOfferAcceptedBy: acceptedBy,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      'COUNTER_OFFER',
      'SANCTIONED',
      acceptedBy,
      'Counter offer accepted by applicant/co-applicant',
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'SANCTIONED', status: 'sanctioned' })
      .eq('id', submission.applicationId);

    this.eventEmitter.emit('bank.counter_offer.accepted', {
      submissionId,
      applicationId: submission.applicationId,
    });

    return { success: true, data: updated };
  }

  /**
   * Reject a counter offer (transitions to REJECTED).
   * Task 17 — F10
   */
  async rejectCounterOffer(submissionId: string, reason: string, rejectedBy: string) {
    const submission = await this.getSubmission(submissionId);

    if (submission.workflowStatus !== 'COUNTER_OFFER') {
      throw new BadRequestException('Submission is not in COUNTER_OFFER status.');
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'REJECTED',
        currentStage: 'REJECTED',
        decisionStatus: 'REJECTED',
        rejectionReason: reason,
        rejectionCategory: 'COUNTER_OFFER_REJECTED',
        decisionMadeAt: new Date().toISOString(),
        decisionMadeBy: rejectedBy,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      'COUNTER_OFFER',
      'REJECTED',
      rejectedBy,
      `Counter offer rejected: ${reason}`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'REJECTED', status: 'rejected' })
      .eq('id', submission.applicationId);

    return { success: true, data: updated };
  }

  /**
   * Partial Sanction — Task 18 (F9)
   * Calculates shortfall, transitions to PARTIAL_SANCTION, notifies staff.
   */
  async partialSanctionApplication(
    submissionId: string,
    details: {
      approvedAmount: number;
      requestedAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      tenure: number;
      decisionNotes?: string;
    },
    decidedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'CONDITIONAL_SANCTION')) {
      // PARTIAL_SANCTION uses same valid-from states as CONDITIONAL_SANCTION
      throw new BadRequestException(
        `Cannot issue partial sanction from ${submission.workflowStatus} status`,
      );
    }

    const shortfallAmount = Math.max(0, details.requestedAmount - details.approvedAmount);
    const now = new Date().toISOString();

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'CONDITIONAL_SANCTION',
        currentStage: 'CONDITIONAL_SANCTION',
        decisionStatus: 'PARTIAL_SANCTION',
        decisionMadeAt: now,
        decisionMadeBy: decidedBy,
        decisionNotes: details.decisionNotes,
        sanctionAmount: details.approvedAmount,
        roiType: details.roiType,
        roiBase: details.roiBase,
        roiEffective: details.roiEffective,
        tenure: details.tenure,
        conditions: [{ text: `Partial sanction: Shortfall of ₹${shortfallAmount} to be arranged separately.`, status: 'PENDING', deadline: null }],
        sanctionDate: now,
        updatedAt: now,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'PARTIAL_SANCTION',
      decidedBy,
      `Partial sanction: Approved ₹${details.approvedAmount} of ₹${details.requestedAmount} requested (shortfall ₹${shortfallAmount})`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'CONDITIONAL_SANCTION', status: 'partial_sanction' })
      .eq('id', submission.applicationId);

    // Route-to-bank notification: create staff query about shortfall
    await this.db.client.from('BankQuery').insert({
      applicationId: submission.applicationId,
      raisedBy: decidedBy,
      queryType: 'PARTIAL_SANCTION_SHORTFALL',
      description: `Partial sanction issued by ${decidedBy}. Approved: ₹${details.approvedAmount}, Requested: ₹${details.requestedAmount}, Shortfall: ₹${shortfallAmount}. Staff action required to arrange the remaining amount or explore alternate financing.`,
      requiredDocs: [],
      status: 'OPEN',
      raisedAt: now,
    });

    this.eventEmitter.emit('bank.application.partial_sanctioned', {
      submissionId,
      applicationId: submission.applicationId,
      approvedAmount: details.approvedAmount,
      shortfallAmount,
    });

    return { success: true, data: updated, shortfallAmount };
  }

  /**
   * Counter offer
   */
  async makeCounterOffer(
    submissionId: string,
    counterOfferDetails: {
      sanctionAmount: number;
      roiType: string;
      roiBase: number;
      roiEffective: number;
      tenure: number;
      terms: string;
    },
    decidedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'COUNTER_OFFER')) {
      throw new BadRequestException(
        `Cannot make counter offer from ${submission.workflowStatus} status`,
      );
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'COUNTER_OFFER',
        currentStage: 'COUNTER_OFFER',
        decisionStatus: 'COUNTER_OFFER',
        decisionMadeAt: new Date().toISOString(),
        decisionMadeBy: decidedBy,
        sanctionAmount: counterOfferDetails.sanctionAmount,
        roiType: counterOfferDetails.roiType,
        roiBase: counterOfferDetails.roiBase,
        roiEffective: counterOfferDetails.roiEffective,
        tenure: counterOfferDetails.tenure,
        counterOfferDetails: counterOfferDetails,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'COUNTER_OFFER',
      decidedBy,
      `Counter offer made: ₹${counterOfferDetails.sanctionAmount} @ ${counterOfferDetails.roiEffective}%`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'COUNTER_OFFER' })
      .eq('id', submission.applicationId);

    return { success: true, data: updated };
  }

  /**
   * Reject application
   */
  async rejectApplication(
    submissionId: string,
    rejectionDetails: {
      reason: string;
      category: string;
      decisionNotes?: string;
    },
    decidedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'REJECTED')) {
      throw new BadRequestException(
        `Cannot reject from ${submission.workflowStatus} status`,
      );
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'REJECTED',
        currentStage: 'REJECTED',
        decisionStatus: 'REJECTED',
        decisionMadeAt: new Date().toISOString(),
        decisionMadeBy: decidedBy,
        rejectionReason: rejectionDetails.reason,
        rejectionCategory: rejectionDetails.category,
        decisionNotes: rejectionDetails.decisionNotes,
        canResubmitToOtherBank: true,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'REJECTED',
      decidedBy,
      `Rejected: ${rejectionDetails.category} - ${rejectionDetails.reason}`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({
        bankWorkflowStatus: 'REJECTED',
        status: 'rejected',
      })
      .eq('id', submission.applicationId);

    this.eventEmitter.emit('bank.application.rejected', {
      submissionId,
      applicationId: submission.applicationId,
      reason: rejectionDetails.reason,
    });

    return { success: true, data: updated };
  }

  /**
   * Move to PROCESSING_FEE
   */
  async moveToProcessingFee(submissionId: string, feeAmount: number, changedBy: string) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'PROCESSING_FEE')) {
      throw new BadRequestException(
        `Cannot move to PROCESSING_FEE from ${submission.workflowStatus} status`,
      );
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'PROCESSING_FEE',
        currentStage: 'PROCESSING_FEE',
        processingFeeAmount: feeAmount,
        processingFeeStatus: 'PENDING',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'PROCESSING_FEE',
      changedBy,
      `Processing fee of ₹${feeAmount} pending`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'PROCESSING_FEE' })
      .eq('id', submission.applicationId);

    return { success: true, data: updated };
  }

  /**
   * Mark processing fee as paid and move to DISBURSEMENT_PENDING
   */
  async markFeeAsPaid(submissionId: string, changedBy: string) {
    const submission = await this.getSubmission(submissionId);

    if (submission.workflowStatus !== 'PROCESSING_FEE') {
      throw new BadRequestException('Submission not in PROCESSING_FEE status');
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'DISBURSEMENT_PENDING',
        currentStage: 'DISBURSEMENT_PENDING',
        processingFeeStatus: 'PAID',
        processingFeePaidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      'PROCESSING_FEE',
      'DISBURSEMENT_PENDING',
      changedBy,
      'Processing fee paid, moving to disbursement',
    );

    await this.db.client
      .from('LoanApplication')
      .update({ bankWorkflowStatus: 'DISBURSEMENT_PENDING' })
      .eq('id', submission.applicationId);

    return { success: true, data: updated };
  }

  /**
   * Confirm disbursement (DISBURSED)
   */
  async confirmDisbursement(
    submissionId: string,
    disbursementDetails: {
      amount: number;
      referenceNo: string;
    },
    confirmedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (!this.isValidTransition(submission.workflowStatus, 'DISBURSED')) {
      throw new BadRequestException(
        `Cannot disburse from ${submission.workflowStatus} status`,
      );
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'DISBURSED',
        currentStage: 'DISBURSED',
        disbursementStatus: 'COMPLETED',
        disbursementAmount: disbursementDetails.amount,
        disbursementReferenceNo: disbursementDetails.referenceNo,
        disbursementDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'DISBURSED',
      confirmedBy,
      `Disbursement confirmed: ₹${disbursementDetails.amount} (Ref: ${disbursementDetails.referenceNo})`,
    );

    const { data: updatedApp } = await this.db.client
      .from('LoanApplication')
      .update({
        bankWorkflowStatus: 'DISBURSED',
        status: 'disbursed',
        stage: 'disbursement',
        progress: 100,
        disbursedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submission.applicationId)
      .select('userId, bank')
      .single();

    this.eventEmitter.emit('bank.application.disbursed', {
      submissionId,
      applicationId: submission.applicationId,
      userId: updatedApp?.userId,
      amount: disbursementDetails.amount,
      bankId: updatedApp?.bank,
      utrNumber: disbursementDetails.referenceNo,
      trancheNumber: 1,
      transferMode: 'NEFT/RTGS',
    });

    return { success: true, data: updated };
  }

  /**
   * Allow resubmission to another bank
   */
  async allowResubmission(submissionId: string, authorizedBy: string) {
    const submission = await this.getSubmission(submissionId);

    if (submission.workflowStatus !== 'REJECTED') {
      throw new BadRequestException('Only rejected applications can be resubmitted');
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        canResubmitToOtherBank: true,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      'REJECTED',
      'RESUBMIT_OTHER_BANK',
      authorizedBy,
      'Application allowed to be resubmitted to another bank',
    );

    return { success: true, data: updated };
  }

  // ============== HELPER METHODS ==============

  private async getSubmission(submissionId: string) {
    const { data: submission, error } = await this.db.client
      .from('BankSubmission')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (error || !submission) {
      throw new NotFoundException('Bank submission not found');
    }

    return submission;
  }

  private isValidTransition(fromStatus: string, toStatus: string): boolean {
    const validTransitions = WORKFLOW_TRANSITIONS[fromStatus] || [];
    return validTransitions.includes(toStatus);
  }

  private async recordWorkflowHistory(
    submissionId: string,
    applicationId: string,
    fromStatus: string | null,
    toStatus: string,
    changedBy: string,
    changeReason: string,
  ) {
    await this.db.client
      .from('BankWorkflowHistory')
      .insert({
        submissionId,
        applicationId,
        fromStatus,
        toStatus,
        changedBy,
        changeReason,
        metadata: {
          changedAt: new Date().toISOString(),
        },
      });
  }

  /**
   * Get submission details with queries
   */
  async getSubmissionWithDetails(submissionId: string) {
    const submission = await this.getSubmission(submissionId);

    const { data: queries } = await this.db.client
      .from('BankWorkflowQueryRequest')
      .select('*')
      .eq('submissionId', submissionId)
      .order('createdAt', { ascending: false });

    const { data: history } = await this.db.client
      .from('BankWorkflowHistory')
      .select('*')
      .eq('submissionId', submissionId)
      .order('createdAt', { ascending: false });

    return {
      submission,
      queries: queries || [],
      history: history || [],
    };
  }

  /**
   * Get bank incoming applications
   */
  async getBankIncomingApplications(bankId: string, filters?: { status?: string; limit?: number; offset?: number }) {
    let query = this.db.client
      .from('BankSubmission')
      .select('*, application:LoanApplication(*)', { count: 'exact' })
      .eq('bankId', bankId)
      .order('submittedAt', { ascending: false });

    if (filters?.status) {
      query = query.eq('workflowStatus', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      data: data || [],
      pagination: {
        total: count || 0,
        limit: filters?.limit || 20,
        offset: filters?.offset || 0,
      },
    };
  }

  /**
   * Get workflow analytics for bank
   */
  async getBankWorkflowAnalytics(bankId: string) {
    const { data: submissions } = await this.db.client
      .from('BankSubmission')
      .select('workflowStatus, decisionStatus, disbursementStatus, sanctionAmount, disbursementAmount')
      .eq('bankId', bankId);

    if (!submissions) {
      return {
        totalApplications: 0,
        byStatus: {},
        byDecision: {},
        totalSanctioned: 0,
        totalDisbursed: 0,
        pendingDecision: 0,
      };
    }

    const byStatus = submissions.reduce(
      (acc, s) => {
        acc[s.workflowStatus] = (acc[s.workflowStatus] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byDecision = submissions.reduce(
      (acc, s) => {
        if (s.decisionStatus) {
          acc[s.decisionStatus] = (acc[s.decisionStatus] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalSanctioned = submissions
      .filter((s) => s.decisionStatus === 'SANCTIONED')
      .reduce((acc, s) => acc + (s.sanctionAmount || 0), 0);

    const totalDisbursed = submissions
      .filter((s) => s.disbursementStatus === 'COMPLETED')
      .reduce((acc, s) => acc + (s.disbursementAmount || 0), 0);

    const pendingDecision = (byStatus['UNDER_REVIEW'] || 0) + (byStatus['QUERY_RAISED'] || 0);

    return {
      totalApplications: submissions.length,
      byStatus,
      byDecision,
      totalSanctioned,
      totalDisbursed,
      pendingDecision,
    };
  }

  /**
   * Add message to query thread without status change (F6)
   */
  async addQueryMessage(
    queryId: string,
    message: string,
    sender: string,
    attachments: any[] = [],
  ) {
    const { data: query, error: queryError } = await this.db.client
      .from('BankWorkflowQueryRequest')
      .select('*')
      .eq('id', queryId)
      .single();

    if (queryError || !query) {
      throw new NotFoundException('Query not found');
    }

    const currentMessages = query.messages || [];
    const newMessage = {
      id: require('crypto').randomUUID(),
      sender,
      message,
      timestamp: new Date().toISOString(),
      attachments: attachments || [],
    };
    const updatedMessages = [...currentMessages, newMessage];

    const currentAttachments = query.attachments || [];
    const updatedAttachments = [...currentAttachments, ...attachments];

    const { data: updatedQuery, error: updateError } = await this.db.client
      .from('BankWorkflowQueryRequest')
      .update({
        messages: updatedMessages,
        attachments: updatedAttachments,
      })
      .eq('id', queryId)
      .select()
      .single();

    if (updateError) throw updateError;

    return { success: true, data: updatedQuery };
  }

  /**
   * Create Query Template (F42)
   */
  async createQueryTemplate(data: {
    bankId: string;
    templateName: string;
    queryType: string;
    queryDescription: string;
    docsChecklist?: any[];
  }) {
    const { data: template, error } = await this.db.client
      .from('BankQueryTemplate')
      .insert({
        bankId: data.bankId,
        templateName: data.templateName,
        queryType: data.queryType,
        queryDescription: data.queryDescription,
        docsChecklist: data.docsChecklist || [],
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: template };
  }

  /**
   * Get Query Templates per bank (F42)
   */
  async getQueryTemplatesByBank(bankId: string) {
    const { data: templates, error } = await this.db.client
      .from('BankQueryTemplate')
      .select('*')
      .eq('bankId', bankId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return { success: true, data: templates || [] };
  }

  /**
   * Update Query Template (F42)
   */
  async updateQueryTemplate(
    templateId: string,
    data: {
      templateName?: string;
      queryType?: string;
      queryDescription?: string;
      docsChecklist?: any[];
    },
  ) {
    const { data: template, error } = await this.db.client
      .from('BankQueryTemplate')
      .update({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: template };
  }

  /**
   * Delete Query Template (F42)
   */
  async deleteQueryTemplate(templateId: string) {
    const { error } = await this.db.client
      .from('BankQueryTemplate')
      .delete()
      .eq('id', templateId);

    if (error) throw error;
    return { success: true, message: 'Template deleted successfully' };
  }

  /**
   * Put submission on Hold (F33) - Pauses SLA timer
   */
  async setSubmissionHold(submissionId: string, reason: string, changedBy: string) {
    const submission = await this.getSubmission(submissionId);

    if (submission.isOnHold) {
      throw new BadRequestException('Submission is already on hold');
    }

    const now = new Date().toISOString();

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        isOnHold: true,
        holdReason: reason,
        holdSetAt: now,
        updatedAt: now,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      submission.workflowStatus,
      changedBy,
      `Submission placed on hold. Reason: ${reason}`,
    );

    // Trigger F16 notification
    const targetUserId = (submission.assignedStaffId && submission.assignedStaffId !== 'unassigned' && submission.assignedStaffId !== 'null')
      ? submission.assignedStaffId
      : (submission.staffId || 'staff');

    const notifData = {
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: targetUserId,
      title: `⏸️ Application On Hold: App ${submission.applicationId}`,
      body: `Application has been placed on hold by ${changedBy}. Reason: ${reason}`,
      type: 'hold',
      isRead: false,
      timestamp: new Date().toISOString(),
      metadata: {
        applicationId: submission.applicationId,
        status: 'hold'
      }
    };
    await this.db.client.from('Notification').insert(notifData);
    this.eventEmitter.emit('notification.created', notifData);

    return { success: true, data: updated };
  }

  /**
   * Resume submission from hold (F33) - Calculates and saves pause duration
   */
  async resumeSubmissionHold(submissionId: string, changedBy: string) {
    const submission = await this.getSubmission(submissionId);

    if (!submission.isOnHold) {
      throw new BadRequestException('Submission is not on hold');
    }

    const now = new Date();
    const holdSetAt = new Date(submission.holdSetAt);
    const holdDurationMs = Math.max(0, now.getTime() - holdSetAt.getTime());
    const totalPausedMs = BigInt(submission.slaPausedDurationMs || 0) + BigInt(holdDurationMs);

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        isOnHold: false,
        holdReason: null,
        holdSetAt: null,
        slaPausedDurationMs: totalPausedMs.toString(),
        updatedAt: now.toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      submission.workflowStatus,
      changedBy,
      `Submission hold resumed. Paused duration: ${Math.round(holdDurationMs / 1000 / 60)} minutes.`,
    );

    // Trigger F16 notification
    const targetResumeUserId = (submission.assignedStaffId && submission.assignedStaffId !== 'unassigned' && submission.assignedStaffId !== 'null')
      ? submission.assignedStaffId
      : (submission.staffId || 'staff');

    const notifData = {
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: targetResumeUserId,
      title: `▶️ Application Resumed: App ${submission.applicationId}`,
      body: `Application hold has been resumed by ${changedBy}.`,
      type: 'hold',
      isRead: false,
      timestamp: new Date().toISOString(),
      metadata: {
        applicationId: submission.applicationId,
        status: 'active'
      }
    };
    await this.db.client.from('Notification').insert(notifData);
    this.eventEmitter.emit('notification.created', notifData);

    return { success: true, data: updated };
  }

  /**
   * Bulk transfer / reassign assigned officer (F34)
   */
  async bulkTransferSubmissions(
    submissionIds: string[],
    officerId: string,
    officerName: string,
    changedBy: string,
  ) {
    const results: any[] = [];

    for (const id of submissionIds) {
      const submission = await this.getSubmission(id);

      const { data: updated, error } = await this.db.client
        .from('BankSubmission')
        .update({
          assignedOfficerId: officerId,
          assignedOfficerName: officerName,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await this.recordWorkflowHistory(
        id,
        submission.applicationId,
        submission.workflowStatus,
        submission.workflowStatus,
        changedBy,
        `Assigned officer updated to: ${officerName}`,
      );

      // Trigger F16 notification
      const notifData = {
        id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: officerId,
        title: `🔄 Application Assigned: App ${submission.applicationId}`,
        body: `Application has been transferred and assigned to you by ${changedBy}.`,
        type: 'transfer',
        isRead: false,
        timestamp: new Date().toISOString(),
        metadata: {
          applicationId: submission.applicationId,
          status: 'assigned'
        }
      };
      await this.db.client.from('Notification').insert(notifData);
      this.eventEmitter.emit('notification.created', notifData);

      results.push(updated);
    }

    return { success: true, count: results.length, data: results };
  }

  /**
   * Update processing fee status (PAID | WAIVED | REFUNDED)
   */
  async updateFeeStatus(
    submissionId: string,
    status: 'PAID' | 'WAIVED' | 'REFUNDED',
    paymentRef?: string,
    changedBy?: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    const updatePayload: any = {
      processingFeeStatus: status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'PAID') {
      updatePayload.processingFeePaidAt = new Date().toISOString();
      updatePayload.comments = paymentRef ? `Payment Ref: ${paymentRef}` : submission.comments;
    }

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update(updatePayload)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      submission.workflowStatus,
      changedBy || 'system',
      `Processing fee status updated to: ${status} ${paymentRef ? '(Ref: ' + paymentRef + ')' : ''}`,
    );

    return { success: true, data: updated };
  }

  /**
   * Schedule/add a new disbursement tranche (F7)
   */
  async scheduleDisbursementTranche(
    submissionId: string,
    amount: number,
    dueDate: Date,
    remarks?: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (submission.workflowStatus !== 'DISBURSEMENT_PENDING' && submission.workflowStatus !== 'DISBURSED') {
      throw new BadRequestException('Disbursements can only be scheduled in DISBURSEMENT_PENDING or DISBURSED stages.');
    }

    const sanctionAmount = submission.sanctionAmount || 0;
    const tranches: any[] = submission.disbursementTranches || [];

    // Calculate sum of completed/scheduled tranches
    const totalTranchesAmt = tranches
      .filter((t) => t.status !== 'CANCELLED')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const remainingAmount = sanctionAmount - totalTranchesAmt;

    if (amount > remainingAmount) {
      throw new BadRequestException(
        `Requested tranche amount of ₹${amount} exceeds the remaining un-scheduled sanction amount of ₹${remainingAmount}`,
      );
    }

    const nextTrancheNo = tranches.length + 1;

    const newTranche = {
      trancheNumber: nextTrancheNo,
      amount,
      status: 'PENDING',
      dueDate: dueDate.toISOString(),
      remarks: remarks || '',
      createdAt: new Date().toISOString(),
    };

    const updatedTranches = [...tranches, newTranche];

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        disbursementTranches: updatedTranches,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: updated,
      scheduledTranche: newTranche,
      remainingSanction: remainingAmount - amount,
    };
  }

  /**
   * Confirm a specific disbursement tranche (F7 - sequential check)
   */
  async confirmDisbursementTranche(
    submissionId: string,
    trancheNumber: number,
    referenceNo: string,
    confirmedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);
    const tranches: any[] = submission.disbursementTranches || [];

    const trancheIdx = tranches.findIndex((t) => t.trancheNumber === trancheNumber);
    if (trancheIdx === -1) {
      throw new NotFoundException(`Tranche ${trancheNumber} not found.`);
    }

    const targetTranche = tranches[trancheIdx];
    if (targetTranche.status === 'COMPLETED') {
      throw new BadRequestException(`Tranche ${trancheNumber} is already completed.`);
    }

    // Sequencing validation: verify all previous tranches (1 to trancheNumber - 1) are COMPLETED or CANCELLED
    for (let i = 1; i < trancheNumber; i++) {
      const prev = tranches.find((t) => t.trancheNumber === i);
      if (prev && prev.status === 'PENDING') {
        throw new BadRequestException(
          `Tranche sequencing violation: Tranche ${i} must be completed or cancelled before confirming Tranche ${trancheNumber}`,
        );
      }
    }

    // Mark as completed
    tranches[trancheIdx] = {
      ...targetTranche,
      status: 'COMPLETED',
      referenceNo,
      disbursementDate: new Date().toISOString(),
      confirmedBy,
    };

    // Calculate totals
    const sanctionAmount = submission.sanctionAmount || 0;
    const completedSum = tranches
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const remainingAmt = sanctionAmount - completedSum;

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        disbursementTranches: tranches,
        workflowStatus: 'DISBURSED', 
        currentStage: 'DISBURSED',
        disbursementStatus: remainingAmt <= 0 ? 'COMPLETED' : 'PROCESSING',
        disbursementAmount: completedSum,
        disbursementDate: new Date().toISOString(),
        disbursementReferenceNo: referenceNo,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      'DISBURSED',
      confirmedBy,
      `Disbursement tranche ${trancheNumber} of ₹${targetTranche.amount} confirmed (Ref: ${referenceNo})`,
    );

    // Update LoanApplication
    const isFullyDisbursed = remainingAmt <= 0;
    const { data: updatedApp, error: updateError } = await this.db.client
      .from('LoanApplication')
      .update({
        bankWorkflowStatus: 'DISBURSED',
        status: isFullyDisbursed ? 'disbursed' : 'partially_disbursed',
        stage: isFullyDisbursed ? 'disbursement' : 'sanction',
        progress: isFullyDisbursed ? 100 : 95,
        disbursedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submission.applicationId)
      .select('userId, bank')
      .single();

    if (updateError) throw updateError;

    // Emit disbursement event for PDF receipt generation and emailing
    this.eventEmitter.emit('bank.application.disbursed', {
      submissionId,
      applicationId: submission.applicationId,
      userId: updatedApp?.userId,
      amount: targetTranche.amount,
      bankId: updatedApp?.bank,
      utrNumber: referenceNo,
      trancheNumber: trancheNumber,
      transferMode: 'NEFT/RTGS',
    });

    return {
      success: true,
      data: updated,
      confirmedTranche: tranches[trancheIdx],
      remainingSanction: remainingAmt,
    };
  }

  /**
   * Get tranches summary with remaining calculation (F7)
   */
  async getTranchesSummary(submissionId: string) {
    const submission = await this.getSubmission(submissionId);
    const tranches: any[] = submission.disbursementTranches || [];

    const sanctionAmount = submission.sanctionAmount || 0;
    const totalDisbursed = tranches
      .filter((t) => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const remainingAmount = sanctionAmount - totalDisbursed;

    // Find next pending tranche due date
    const pendingTranches = tranches.filter((t) => t.status === 'PENDING');
    const nextTrancheDueDate = pendingTranches.length > 0 
      ? pendingTranches.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0].dueDate
      : null;

    return {
      sanctionAmount,
      totalDisbursed,
      remainingAmount,
      nextTrancheDueDate,
      tranches,
    };
  }

  /**
   * Amend active sanction terms with full audit log and field-level diff calculation (F35)
   */
  async amendSanctionTerms(
    submissionId: string,
    newTerms: {
      sanctionAmount?: number;
      roiEffective?: number;
      tenure?: number;
    },
    reason: string,
    effectiveDate: Date,
    amendedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    if (submission.workflowStatus !== 'SANCTIONED' && submission.workflowStatus !== 'PROCESSING_FEE' && submission.workflowStatus !== 'DISBURSEMENT_PENDING' && submission.workflowStatus !== 'DISBURSED') {
      throw new BadRequestException('Amendments can only be filed after initial sanction is issued.');
    }

    const originalTerms = {
      sanctionAmount: submission.sanctionAmount,
      roiEffective: submission.roiEffective,
      tenure: submission.tenure,
    };

    const diff: any = {};
    const updatePayload: any = {
      updatedAt: new Date().toISOString(),
    };

    if (newTerms.sanctionAmount !== undefined && newTerms.sanctionAmount !== originalTerms.sanctionAmount) {
      diff.sanctionAmount = { from: originalTerms.sanctionAmount, to: newTerms.sanctionAmount };
      updatePayload.sanctionAmount = newTerms.sanctionAmount;
    }
    if (newTerms.roiEffective !== undefined && newTerms.roiEffective !== originalTerms.roiEffective) {
      diff.roiEffective = { from: originalTerms.roiEffective, to: newTerms.roiEffective };
      updatePayload.roiEffective = newTerms.roiEffective;
    }
    if (newTerms.tenure !== undefined && newTerms.tenure !== originalTerms.tenure) {
      diff.tenure = { from: originalTerms.tenure, to: newTerms.tenure };
      updatePayload.tenure = newTerms.tenure;
    }

    if (Object.keys(diff).length === 0) {
      throw new BadRequestException('No terms were altered. Amendment skipped.');
    }

    const currentAmendments = submission.amendments || [];
    const amendmentRecord = {
      id: require('crypto').randomUUID(),
      originalTerms,
      newTerms: { ...originalTerms, ...newTerms },
      diff,
      reason,
      effectiveDate: effectiveDate.toISOString(),
      amendedBy,
      amendedAt: new Date().toISOString(),
    };
    const updatedAmendments = [...currentAmendments, amendmentRecord];

    updatePayload.amendments = updatedAmendments;

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update(updatePayload)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      submission.workflowStatus,
      amendedBy,
      `Sanction terms amended: ${reason}. Diff: ${JSON.stringify(diff)}`,
    );

    const appUpdate: any = {};
    if (newTerms.sanctionAmount !== undefined) appUpdate.sanctionAmount = newTerms.sanctionAmount;
    if (newTerms.roiEffective !== undefined) appUpdate.roiEffective = newTerms.roiEffective;

    await this.db.client
      .from('LoanApplication')
      .update(appUpdate)
      .eq('id', submission.applicationId);

    return {
      success: true,
      data: updated,
      amendment: amendmentRecord,
    };
  }

  /**
   * Request cancellation (F36)
   */
  async requestCancellation(submissionId: string, reason: string, requestedBy: string) {
    const submission = await this.getSubmission(submissionId);

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        cancellationReason: reason,
        cancellationRequestedBy: requestedBy,
        cancellationRequestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      submission.workflowStatus,
      submission.workflowStatus,
      requestedBy,
      `Cancellation requested. Reason: ${reason}`,
    );

    return { success: true, data: updated };
  }

  /**
   * Confirm cancellation and calculate stage-based fee refund (F36)
   */
  async confirmCancellation(submissionId: string, confirmedBy: string) {
    const submission = await this.getSubmission(submissionId);
    
    const feeAmount = submission.processingFeeAmount || 0;
    const stage = submission.workflowStatus;
    
    let refundPercent = 0;
    if (stage === 'SUBMITTED_TO_BANK') {
      refundPercent = 100;
    } else if (stage === 'FILE_LOGGED' || stage === 'UNDER_REVIEW' || stage === 'QUERY_RAISED') {
      refundPercent = 50;
    } else {
      refundPercent = 0;
    }

    const calculatedRefund = (feeAmount * refundPercent) / 100;

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        workflowStatus: 'REJECTED', 
        currentStage: 'REJECTED',
        decisionStatus: 'REJECTED',
        rejectionReason: submission.cancellationReason || 'Cancelled by request',
        rejectionCategory: 'CANCELLED',
        processingFeeStatus: calculatedRefund > 0 ? 'REFUNDED' : submission.processingFeeStatus,
        refundAmount: calculatedRefund,
        decisionMadeAt: new Date().toISOString(),
        decisionMadeBy: confirmedBy,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    await this.recordWorkflowHistory(
      submissionId,
      submission.applicationId,
      stage,
      'REJECTED',
      confirmedBy,
      `Cancellation confirmed. Stage: ${stage}. Fee: ₹${feeAmount}, refund: ${refundPercent}% (₹${calculatedRefund})`,
    );

    await this.db.client
      .from('LoanApplication')
      .update({
        bankWorkflowStatus: 'REJECTED',
        status: 'cancelled',
      })
      .eq('id', submission.applicationId);

    return {
      success: true,
      data: updated,
      refundPercent,
      refundAmount: calculatedRefund,
    };
  }

  /**
   * Submit 4-dimensional dossier quality rating (F12)
   */
  async submitQualityRating(
    submissionId: string,
    ratings: {
      documentation: number;
      credit: number;
      profile: number;
      communication: number;
    },
    comments: string,
    ratedBy: string,
  ) {
    const submission = await this.getSubmission(submissionId);

    const { documentation, credit, profile, communication } = ratings;
    if (
      documentation < 1 || documentation > 5 ||
      credit < 1 || credit > 5 ||
      profile < 1 || profile > 5 ||
      communication < 1 || communication > 5
    ) {
      throw new BadRequestException('Ratings must be between 1 and 5 stars for all dimensions.');
    }

    const overallAverage = (documentation + credit + profile + communication) / 4;

    const ratingObj = {
      documentation,
      credit,
      profile,
      communication,
      overallAverage,
      comments: comments || '',
      ratedBy,
      ratedAt: new Date().toISOString(),
    };

    const { data: updated, error } = await this.db.client
      .from('BankSubmission')
      .update({
        qualityRating: ratingObj,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: updated, rating: ratingObj };
  }

  /**
   * Risk Check: Fetch submissions to other partner banks and rejection history for the same student (F22)
   */
  async getCrossBankHistory(submissionId: string) {
    const targetSubmission = await this.getSubmission(submissionId);

    const { data: application, error: appError } = await this.db.client
      .from('LoanApplication')
      .select('userId')
      .eq('id', targetSubmission.applicationId)
      .single();

    if (appError || !application) {
      throw new NotFoundException('Parent loan application not found.');
    }

    const studentId = application.userId;

    const { data: studentApps, error: studentAppsError } = await this.db.client
      .from('LoanApplication')
      .select('id, applicationNumber')
      .eq('userId', studentId);

    if (studentAppsError || !studentApps || studentApps.length === 0) {
      return { studentId, currentSubmissionId: submissionId, historyCount: 0, history: [] };
    }

    const appIds = studentApps.map((a) => a.id);

    const { data: otherSubmissions, error: subError } = await this.db.client
      .from('BankSubmission')
      .select('id, applicationId, bankName, workflowStatus, submittedAt, decisionStatus, rejectionReason, rejectionCategory')
      .in('applicationId', appIds)
      .neq('id', submissionId);

    if (subError) throw subError;

    const history = (otherSubmissions || []).map((s) => {
      const parentApp = studentApps.find((a) => a.id === s.applicationId);
      return {
        ...s,
        applicationNumber: parentApp ? parentApp.applicationNumber : s.applicationId,
      };
    });

    return {
      studentId,
      currentSubmissionId: submissionId,
      historyCount: history.length,
      history,
    };
  }

  /**
   * Record explicit student-bank data access consent (F23)
   */
  async grantStudentConsent(
    studentId: string,
    bankId: string,
    isGranted: boolean,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { data, error } = await this.db.client
      .from('StudentBankConsent')
      .upsert(
        {
          studentId,
          bankId,
          isGranted,
          ipAddress: ipAddress || '0.0.0.0',
          userAgent: userAgent || 'Unknown',
          grantedAt: new Date().toISOString(),
        },
        { onConflict: 'studentId,bankId' }
      )
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  }

  /**
   * Verify whether consent is active (F23)
   */
  async verifyStudentConsent(studentId: string, bankId: string): Promise<boolean> {
    const { data, error } = await this.db.client
      .from('StudentBankConsent')
      .select('isGranted')
      .eq('studentId', studentId)
      .eq('bankId', bankId)
      .maybeSingle();

    if (error || !data) return false;
    return data.isGranted;
  }

  /**
   * Pipeline Funnel counts for charts (overall or per-bank)
   */
  async getPipelineFunnelAnalytics(bankId?: string) {
    let query = this.db.client
      .from('BankSubmission')
      .select('workflowStatus, decisionStatus');

    if (bankId) {
      query = query.eq('bankId', bankId);
    }

    const { data: submissions, error } = await query;
    if (error) throw error;

    const funnelStages = {
      SUBMITTED_TO_BANK: 0,
      FILE_LOGGED: 0,
      UNDER_REVIEW: 0,
      QUERY_RAISED: 0,
      SANCTIONED: 0,
      DISBURSEMENT_PENDING: 0,
      DISBURSED: 0,
      CANCELLED_OR_REJECTED: 0,
    };

    (submissions || []).forEach((s) => {
      const status = s.workflowStatus;
      if (status === 'SUBMITTED_TO_BANK') funnelStages.SUBMITTED_TO_BANK++;
      else if (status === 'FILE_LOGGED') funnelStages.FILE_LOGGED++;
      else if (status === 'UNDER_REVIEW') funnelStages.UNDER_REVIEW++;
      else if (status === 'QUERY_RAISED') funnelStages.QUERY_RAISED++;
      else if (status === 'SANCTIONED' || status === 'CONDITIONAL_SANCTION' || status === 'COUNTER_OFFER') funnelStages.SANCTIONED++;
      else if (status === 'PROCESSING_FEE' || status === 'DISBURSEMENT_PENDING') funnelStages.DISBURSEMENT_PENDING++;
      else if (status === 'DISBURSED') funnelStages.DISBURSED++;
      else if (status === 'REJECTED') funnelStages.CANCELLED_OR_REJECTED++;
    });

    return {
      success: true,
      bankId: bankId || 'all',
      funnel: funnelStages,
    };
  }

  /**
   * Get bank priorities sorted by priority
   */
  async getBankPriorities() {
    const { data, error } = await this.db.client
      .from('BankPriority')
      .select('*')
      .order('priority', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  }

  /**
   * Update or overwrite bank priorities
   */
  async updateBankPriorities(priorities: { priority: number; bankName: string; status: string }[]) {
    // 1. Delete all existing priorities
    const { error: deleteError } = await this.db.client
      .from('BankPriority')
      .delete()
      .neq('id', 'dummy-id-to-delete-all'); // delete all records

    if (deleteError) throw deleteError;

    // 2. Insert new priorities
    const toInsert = priorities.map((p) => ({
      priority: p.priority,
      bankName: p.bankName,
      status: p.status || 'Active',
      updatedAt: new Date().toISOString(),
    }));

    const { data, error: insertError } = await this.db.client
      .from('BankPriority')
      .insert(toInsert)
      .select();

    if (insertError) throw insertError;
    return { success: true, data };
  }

  /**
   * Share application with multiple banks simultaneously (ROUTED_MULTIPARTY)
   */
  async submitApplicationToMultipleBanks(
    applicationId: string,
    banks: { bankId: string; bankName: string }[],
    submittedBy: string,
  ) {
    if (!banks || banks.length === 0) {
      throw new BadRequestException('Select at least one bank for distribution');
    }

    // Get application
    const { data: application, error: appError } = await this.db.client
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      throw new NotFoundException('Application not found');
    }

    const createdSubmissions: any[] = [];

    // Fetch student's profile name and registered email
    let studentName = `${application.firstName || ''} ${application.lastName || ''}`.trim() || 'Student';
    let studentEmail = application.email || '';
    try {
      if (application.userId) {
        const { data: student } = await this.db.client
          .from('User')
          .select('email, firstName, lastName')
          .eq('id', application.userId)
          .single();
        if (student) {
          if (student.email) studentEmail = student.email;
          const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
          if (name) studentName = name;
        }
      }
    } catch (e: any) {
      console.warn('[BankWorkflowService] Failed to load student details for email:', e.message);
    }

    for (const bank of banks) {
      const { bankId, bankName } = bank;

      // Check if already submitted to this bank
      const { data: existing } = await this.db.client
        .from('BankSubmission')
        .select('id')
        .eq('applicationId', applicationId)
        .eq('bankId', bankId)
        .single();

      if (existing) {
        continue;
      }

      // Create bank submission record
      const { data: submission, error: submitError } = await this.db.client
        .from('BankSubmission')
        .insert({
          applicationId,
          bankId,
          bankName,
          submittedBy,
          workflowStatus: 'SUBMITTED_TO_BANK',
          currentStage: 'SUBMITTED_TO_BANK',
          statusHistory: [
            {
              fromStatus: null,
              toStatus: 'SUBMITTED_TO_BANK',
              changedAt: new Date().toISOString(),
              changedBy: submittedBy,
              reason: 'Application shared with bank via multiparty routing',
            },
          ],
        })
        .select()
        .single();

      if (submitError) {
        throw submitError;
      }

      // Record in workflow history
      await this.recordWorkflowHistory(submission.id, applicationId, null, 'SUBMITTED_TO_BANK', submittedBy, 'Application shared with bank via multiparty routing');

      // Fetch bank registered email from Bank table
      let bankEmail = '';
      try {
        const { data: bankProfile } = await this.db.client
          .from('Bank')
          .select('email')
          .eq('shortName', bankId)
          .single();
        if (bankProfile?.email) {
          bankEmail = bankProfile.email;
        }
      } catch (e: any) {
        console.warn('[BankWorkflowService] Failed to load bank profile email:', e.message);
      }

      const fallbackEmails: Record<string, string> = {
        avanse: 'avansebank01@gmail.com',
        auxilo: 'auxilobank01@gmail.com',
        idfc: 'idfcbank01@gmail.com',
        poonawalla: 'poonawallabank01@gmail.com',
        credila: 'credilabank01@gmail.com',
      };
      const targetEmail = bankEmail || fallbackEmails[bankId] || `${bankId}bank01@gmail.com`;

      // 1. Send email alert to bank
      await this.emailService.sendNewApplicationNotificationToBank(targetEmail, bankName, application, studentName).catch(err => {
        console.error('[BankWorkflowService] Failed to send bank notification email:', err);
      });

      // Emit event
      this.eventEmitter.emit('bank.submission.created', {
        submissionId: submission.id,
        applicationId,
        bankId,
        bankName,
      });

      createdSubmissions.push(submission);
    }

    // 2. Send email alert to student registered mail ID
    if (studentEmail && createdSubmissions.length > 0) {
      const bankNamesStr = banks.map(b => b.bankName).join(', ');
      await this.emailService.sendApplicationSentToBankEmail(studentEmail, studentName, bankNamesStr, application).catch(err => {
        console.error('[BankWorkflowService] Failed to send student application email for multi-bank:', err);
      });
    }

    // Update LoanApplication status to ROUTED_MULTIPARTY and bank to targeted list — preserve existing VTU-APP applicationNumber, or generate new VTU-APP sequential one if it's missing/not bank format.
    let appNumber = application.applicationNumber;
    if (!appNumber || (!appNumber.startsWith('VL-APP-') && !appNumber.startsWith('VTU-APP-'))) {
      appNumber = await this.generateApplicationNumber();
    }

    const bankNamesStr = banks.map(b => b.bankName).join(', ');
    const updatePayload: any = {
      status: 'ROUTED_MULTIPARTY',
      bankWorkflowStatus: 'SUBMITTED_TO_BANK',
      bankWorkflowStage: 'SUBMITTED_TO_BANK',
      submittedToBankAt: new Date().toISOString(),
      bank: bankNamesStr,
      applicationNumber: appNumber,
      stage: 'bank_review',
      progress: 70,
    };

    if (createdSubmissions.length > 0) {
      updatePayload.bankSubmissionId = createdSubmissions[0].id;
    }

    await this.db.client
      .from('LoanApplication')
      .update(updatePayload)
      .eq('id', applicationId);

    return { success: true, count: createdSubmissions.length, submissions: createdSubmissions };
  }
}

