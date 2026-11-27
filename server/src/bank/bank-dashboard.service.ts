import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoanStateMachine } from './loan-state-machine';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ==================== CONSTANTS ====================

export const DECISION_TYPES = ['APPROVED', 'REJECTED', 'CONDITIONAL_SANCTION', 'COUNTER_OFFER', 'PARTIAL_SANCTION'] as const;
export type DecisionType = typeof DECISION_TYPES[number];

export const REJECTION_CATEGORIES = ['CIBIL', 'INCOME', 'DOCS', 'FRAUD', 'POLICY', 'TECHNICAL', 'OTHER'] as const;
export type RejectionCategory = typeof REJECTION_CATEGORIES[number];

export const ROI_TYPES = ['FIXED', 'FLOATING', 'SUBSIDY'] as const;
export type RoiType = typeof ROI_TYPES[number];

export const FEE_MODES = ['ONLINE', 'CHEQUE', 'DD', 'WAIVER'] as const;
export type FeeMode = typeof FEE_MODES[number];

export const PREDEFINED_TAGS = [
  'PRIORITY', 'URGENT', 'QUERY_PENDING', 'DOCS_MISSING', 'HIGH_VALUE',
  'SUBSIDY_CASE', 'COLLATERAL', 'CO_APPLICANT', 'RESUBMISSION', 'ESCALATED',
  'SBI_SCHEME', 'VIDYA_LAKSHMI', 'ABROAD_STUDY', 'DOMESTIC_STUDY', 'FOLLOW_UP'
] as const;

@Injectable()
export class BankDashboardService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private get db() {
    return this.supabase.getClient();
  }

  // ==================== PRODUCTS & CONFIGURATION ====================

  async getBankProducts(bankId: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('BankProduct')
      .select('*')
      .eq('bankId', bankId)
      .eq('isActive', true)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async addBankProduct(bankId: string, productData: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankProduct')
      .insert({
        bankId,
        productName: productData.productName,
        eligibility: productData.eligibility,
        maxAmount: productData.maxAmount,
        minAmount: productData.minAmount,
        roiMin: productData.roiMin,
        roiMax: productData.roiMax,
        processingFee: productData.processingFee,
        maxTenure: productData.maxTenure,
        moratoriumRule: productData.moratoriumRule,
        requiredDocs: productData.requiredDocs,
        isActive: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateBankProduct(productId: string, productData: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankProduct')
      .update(productData)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getBankBranches(bankId: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('BankBranch')
      .select('*')
      .eq('bankId', bankId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async addBankBranch(bankId: string, branchData: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankBranch')
      .insert({
        bankId,
        branchName: branchData.branchName,
        branchCode: branchData.branchCode,
        coverageAreas: branchData.coverageAreas,
        maxCapacity: branchData.maxCapacity
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==================== FILE LOGGING & LAN ====================

  async logFileWithLAN(applicationId: string, lanNumber: string, bankUser: any): Promise<any> {
    const { data: application, error: fetchError } = await this.db
      .from('LoanApplication')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const now = new Date().toISOString();

    // Update application with LAN - moves to Review stage
    const { data: updated, error: updateError } = await this.db
      .from('LoanApplication')
      .update({
        lanNumber,
        lanEnteredAt: now,
        fileLoggedBy: bankUser.id,
        status: 'file_logged',
        stage: 'bank_review',
        progress: 90,
        updatedAt: now
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Record status history transition to Review stage
    try {
      await this.db.from('ApplicationStatusHistory').insert({
        id: `ash-${Date.now()}-review`,
        applicationId,
        fromStatus: application.status || 'submitted_to_bank',
        toStatus: 'file_logged',
        fromStage: 'credit_check',
        toStage: 'bank_review',
        notes: `File logged with LAN: ${lanNumber}. Moved to Review stage.`,
        changedBy: bankUser.email || bankUser.id || 'Bank Officer',
        isAutomatic: true,
        createdAt: now,
      });
    } catch {
      // Non-fatal
    }

    // Log audit
    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'FILE_LOGGED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { lanNumber }
    });

    return updated;
  }

  async getFilesByLAN(lanNumber: string): Promise<any> {
    const { data, error } = await this.db
      .from('LoanApplication')
      .select(`
        *,
        BankDecision(*)
      `)
      .eq('lanNumber', lanNumber)
      .single();

    if (error || !data) {
      throw new NotFoundException(`File with LAN ${lanNumber} not found`);
    }

    return data;
  }

  // ==================== ROI & PROCESSING FEE ====================

  async setROI(applicationId: string, roiData: any, bankUser: any): Promise<any> {
    // Validate ROI type enum
    const roiType = (roiData.roiType || '').toUpperCase();
    if (!ROI_TYPES.includes(roiType as RoiType)) {
      throw new BadRequestException(`Invalid roiType "${roiType}". Must be one of: ${ROI_TYPES.join(', ')}`);
    }

    // Validate rate ranges
    const roiBase = Number(roiData.roiBase);
    if (isNaN(roiBase) || roiBase < 0 || roiBase > 30) {
      throw new BadRequestException('roiBase must be a number between 0 and 30 (%).');
    }

    // Compute effective ROI
    const roiSubsidy = Number(roiData.roiSubsidy || 0);
    const roiEffective = roiType === 'SUBSIDY'
      ? Math.max(0, roiBase - roiSubsidy)
      : (roiData.roiEffective != null ? Number(roiData.roiEffective) : roiBase);

    const { data: updated, error } = await this.db
      .from('LoanApplication')
      .update({
        roiType,
        roiBase,
        roiEffective,
        roiSubsidy: roiType === 'SUBSIDY' ? roiSubsidy : null,
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'ROI_SET',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { roiType, roiBase, roiEffective, roiSubsidy }
    });

    return updated;
  }

  async setProcessingFee(applicationId: string, feeData: any, bankUser: any): Promise<any> {
    // Validate mode enum
    const mode = (feeData.mode || '').toUpperCase() as FeeMode;
    if (!FEE_MODES.includes(mode)) {
      throw new BadRequestException(`Invalid fee mode "${mode}". Must be one of: ${FEE_MODES.join(', ')}`);
    }

    // Waiver path — skip GST calculation
    if (mode === 'WAIVER') {
      if (!feeData.waiverReason) {
        throw new BadRequestException('waiverReason is required when mode is WAIVER.');
      }
      const { data, error } = await this.db
        .from('ProcessingFee')
        .upsert(
          {
            applicationId,
            lanNumber: feeData.lanNumber,
            feeAmount: 0,
            gstAmount: 0,
            totalAmount: 0,
            mode,
            status: 'WAIVED',
            waivedBy: bankUser.email,
            waiverReason: feeData.waiverReason,
            createdAt: new Date().toISOString()
          },
          { onConflict: 'applicationId' }
        )
        .select()
        .single();
      if (error) throw error;

      await this.logAudit({
        entityType: 'DOCUMENT',
        entityId: applicationId,
        action: 'PROCESSING_FEE_WAIVED',
        performedBy: bankUser.email,
        role: bankUser.role,
        details: { waiverReason: feeData.waiverReason }
      });
      return data;
    }

    // Normal path with 18% GST
    const feeAmount = Number(feeData.feeAmount);
    if (isNaN(feeAmount) || feeAmount < 0) {
      throw new BadRequestException('feeAmount must be a non-negative number.');
    }
    const gstAmount = parseFloat((feeAmount * 0.18).toFixed(2));
    const totalAmount = parseFloat((feeAmount + gstAmount).toFixed(2));

    const { data, error } = await this.db
      .from('ProcessingFee')
      .upsert(
        {
          applicationId,
          lanNumber: feeData.lanNumber,
          feeAmount,
          gstAmount,
          totalAmount,
          mode,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        },
        { onConflict: 'applicationId' }
      )
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'DOCUMENT',
      entityId: applicationId,
      action: 'PROCESSING_FEE_SET',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { feeAmount, gstAmount, totalAmount, mode }
    });

    return data;
  }

  async updateProcessingFeeStatus(applicationId: string, status: string, details: any): Promise<any> {
    const update: any = { status };

    if (status === 'PAID') {
      update.paidAt = new Date().toISOString();
      update.paymentMode = details.paymentMode;
      update.paymentRef = details.paymentRef;
    } else if (status === 'WAIVED') {
      update.waivedBy = details.waivedBy;
      update.waiverReason = details.waiverReason;
    }

    const { data, error } = await this.db
      .from('ProcessingFee')
      .update(update)
      .eq('applicationId', applicationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==================== QUERIES & RESPONSES ====================

  async raiseQuery(applicationId: string, queryData: any, bankUser: any): Promise<any> {
    const { data, error } = await this.db
      .from('BankQuery')
      .insert({
        applicationId,
        raisedBy: bankUser.email,
        queryType: queryData.queryType,
        description: queryData.description,
        requiredDocs: queryData.requiredDocs,
        status: 'OPEN'
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'QUERY_RAISED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { queryType: queryData.queryType }
    });

    return data;
  }

  async respondToQuery(queryId: string, response: any, bankUser: any): Promise<any> {
    const { data, error } = await this.db
      .from('QueryResponse')
      .insert({
        queryId,
        respondedBy: bankUser.firstName || bankUser.email,
        message: response.message,
        attachments: response.attachments
      })
      .select()
      .single();

    if (error) throw error;

    // Check if all queries are resolved
    const { data: query } = await this.db
      .from('BankQuery')
      .select('applicationId')
      .eq('id', queryId)
      .single();

    await this.logAudit({
      entityType: 'LOAN',
      entityId: query?.applicationId,
      action: 'QUERY_RESPONDED',
      performedBy: bankUser.email,
      role: bankUser.role
    });

    return data;
  }

  async resolveQuery(queryId: string, bankUser: any): Promise<any> {
    const now = new Date().toISOString();

    const { data, error } = await this.db
      .from('BankQuery')
      .update({
        status: 'RESOLVED',
        resolvedAt: now
      })
      .eq('id', queryId)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: data.applicationId,
      action: 'QUERY_RESOLVED',
      performedBy: bankUser.email,
      role: bankUser.role
    });

    return data;
  }

  // ==================== DISBURSEMENT ====================

  async confirmDisbursement(applicationId: string, disbursementData: any, bankUser: any): Promise<any> {
    const { data, error } = await this.db
      .from('Disbursement')
      .insert({
        applicationId,
        trancheNumber: disbursementData.trancheNumber || 1,
        amount: disbursementData.amount,
        mode: disbursementData.mode,
        utrNumber: disbursementData.utrNumber,
        beneficiary: disbursementData.beneficiary,
        status: 'CONFIRMED',
        disbursedAt: new Date().toISOString(),
        confirmedBy: bankUser.email
      })
      .select()
      .single();

    if (error) throw error;

    // Update application status
    const { data: updatedApp, error: updateError } = await this.db
      .from('LoanApplication')
      .update({
        status: 'disbursed',
        stage: 'disbursement',
        progress: 100,
        disbursedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select('id, userId, bank')
      .single();

    if (updateError) throw updateError;

    // Emit disbursement event for PDF receipt generation and emailing
    this.eventEmitter.emit('bank.application.disbursed', {
      applicationId: applicationId,
      userId: updatedApp?.userId,
      amount: disbursementData.amount,
      bankId: updatedApp?.bank,
      utrNumber: disbursementData.utrNumber,
      trancheNumber: disbursementData.trancheNumber || 1,
      transferMode: disbursementData.mode || 'IMPS/NEFT/RTGS',
    });

    await this.logAudit({
      entityType: 'DISBURSEMENT',
      entityId: data.id,
      action: 'DISBURSEMENT_CONFIRMED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { amount: disbursementData.amount, tranche: disbursementData.trancheNumber }
    });

    return data;
  }

  async getDisbursements(applicationId: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('Disbursement')
      .select('*')
      .eq('applicationId', applicationId)
      .order('trancheNumber', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // ==================== QUALITY RATING ====================

  async rateFileQuality(applicationId: string, ratingData: any, bankUser: any): Promise<any> {
    const overall = Math.round(
      (ratingData.completeness + ratingData.accuracy + ratingData.clarity) / 3
    );

    const { data, error } = await this.db
      .from('FileQualityRating')
      .upsert(
        {
          applicationId,
          completeness: ratingData.completeness,
          accuracy: ratingData.accuracy,
          clarity: ratingData.clarity,
          overall,
          comments: ratingData.comments,
          ratedBy: bankUser.email
        },
        { onConflict: 'applicationId' }
      )
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'DOCUMENT',
      entityId: applicationId,
      action: 'QUALITY_RATED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { overall }
    });

    return data;
  }

  // ==================== ANALYTICS ====================

  private applyBankFilter(query: any, bankId: string | null) {
    if (!bankId) return query;
    const lower = bankId.toLowerCase();
    const BANK_MAPPING: Record<string, string[]> = {
      'credila': ['HDFC Credila', 'Credila', 'hdfc'],
      'hdfc credila': ['HDFC Credila', 'Credila', 'hdfc'],
      'poonawalla': ['Poonawalla Fincorp', 'Poonawalla'],
      'poonawalla fincorp': ['Poonawalla Fincorp', 'Poonawalla'],
      'idfc': ['IDFC First Bank', 'IDFC FIRST Bank', 'IDFC'],
      'idfc first bank': ['IDFC First Bank', 'IDFC FIRST Bank', 'IDFC'],
      'avanse': ['Avanse Financial Services', 'Avanse Financial', 'Avanse'],
      'avanse financial services': ['Avanse Financial Services', 'Avanse Financial', 'Avanse'],
      'avanse financial': ['Avanse Financial Services', 'Avanse Financial', 'Avanse'],
      'auxilo': ['Auxilo Finserve', 'Auxilo'],
      'auxilo finserve': ['Auxilo Finserve', 'Auxilo']
    };

    const searchTerms = BANK_MAPPING[lower] || [bankId];
    if (searchTerms.length === 1) {
      return query.ilike('bank', `%${searchTerms[0]}%`);
    } else {
      const orConditions = searchTerms.map(term => `bank.ilike.%${term}%`).join(',');
      return query.or(orConditions);
    }
  }

  async getChannelAnalytics(bankId: string): Promise<any> {
    let q = this.db
      .from('LoanApplication')
      .select('id, status, amount, createdAt');
    q = this.applyBankFilter(q, bankId);
    const { data: applications, error } = await q;

    if (error) throw error;

    const statusCounts = (applications || []).reduce((acc: any, app: any) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {});

    const totalAmount = (applications || []).reduce((sum: number, app: any) => sum + (app.amount || 0), 0);

    return {
      totalApplications: (applications || []).length,
      statusBreakdown: statusCounts,
      totalAmount,
      averageAmount: (applications || []).length > 0 ? totalAmount / (applications || []).length : 0
    };
  }

  async getRejectionAnalytics(bankId: string): Promise<any> {
    const { data, error } = await this.db
      .from('BankDecision')
      .select('rejectionReason, decidedAt')
      .eq('bankId', bankId)
      .eq('decision', 'REJECTED');

    if (error) throw error;

    const reasonCounts = (data || []).reduce((acc: any, decision: any) => {
      const reason = decision.rejectionReason || 'UNSPECIFIED';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    return {
      totalRejections: data?.length || 0,
      reasonBreakdown: reasonCounts,
      rejectionRate: 0 // Calculate based on total applications
    };
  }

  async getPipelineAnalytics(bankId: string): Promise<any> {
    // Kanban columns: grouped by pipeline stage with counts and totals
    const KANBAN_COLUMNS: { id: string; label: string; statuses: string[] }[] = [
      { id: 'pre_login',    label: 'Pre-Login',    statuses: ['pending', 'docs_received', 'draft'] },
      { id: 'submitted',   label: 'Submitted',    statuses: ['staff_verified', 'submitted_to_bank', 'submitted', 'application_submitted'] },
      { id: 'verification',label: 'Verification', statuses: ['file_logged', 'under_bank_review', 'query_raised', 'processing', 'under_review', 'docs_uploaded'] },
      { id: 'sanctioned',  label: 'Sanctioned',   statuses: ['approved', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanctioned'] },
      { id: 'disbursed',   label: 'Disbursed',    statuses: ['disbursement_confirmed', 'closed', 'disbursed'] },
      { id: 'rejected',    label: 'Rejected',     statuses: ['rejected', 'expired', 'cancelled'] },
    ];

    let q = this.db
      .from('LoanApplication')
      .select('id, status, amount, firstName, lastName, lanNumber, bank, createdAt, updatedAt');
    q = this.applyBankFilter(q, bankId);

    const { data, error } = await q;

    if (error) throw error;
    const apps = data || [];

    const columns = KANBAN_COLUMNS.map(col => {
      const colApps = apps.filter(a => col.statuses.includes((a.status || '').toLowerCase()));
      return {
        id: col.id,
        label: col.label,
        count: colApps.length,
        totalAmount: colApps.reduce((s: number, a: any) => s + (a.amount || 0), 0),
        applications: colApps.slice(0, 20).map((a: any) => ({
          id: a.id,
          name: `${a.firstName || ''} ${a.lastName || ''}`.trim(),
          amount: a.amount,
          status: a.status,
          lanNumber: a.lanNumber,
          updatedAt: a.updatedAt,
        }))
      };
    });

    return {
      bankId,
      totalApplications: apps.length,
      totalAmount: apps.reduce((s: number, a: any) => s + (a.amount || 0), 0),
      columns
    };
  }

  async getAgingReport(bankId: string): Promise<any> {
    let q = this.db
      .from('LoanApplication')
      .select('id, createdAt, status, firstName, lastName, amount, lanNumber')
      .not('status', 'in', '(closed,rejected,expired,disbursement_confirmed)');
    q = this.applyBankFilter(q, bankId);

    const { data: applications, error } = await q;

    if (error) throw error;

    const now = new Date();
    // Task-spec buckets: 0-3d, 4-7d, 8-14d, 15+d
    const buckets: Record<string, { count: number; applications: any[] }> = {
      '0-3d':  { count: 0, applications: [] },
      '4-7d':  { count: 0, applications: [] },
      '8-14d': { count: 0, applications: [] },
      '15+d':  { count: 0, applications: [] },
    };

    (applications || []).forEach(app => {
      const created = new Date(app.createdAt);
      const ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const entry = {
        id: app.id,
        name: `${app.firstName || ''} ${app.lastName || ''}`.trim(),
        amount: app.amount,
        status: app.status,
        lanNumber: app.lanNumber,
        ageDays
      };

      if (ageDays <= 3)       { buckets['0-3d'].count++;  buckets['0-3d'].applications.push(entry); }
      else if (ageDays <= 7)  { buckets['4-7d'].count++;  buckets['4-7d'].applications.push(entry); }
      else if (ageDays <= 14) { buckets['8-14d'].count++; buckets['8-14d'].applications.push(entry); }
      else                    { buckets['15+d'].count++;  buckets['15+d'].applications.push(entry); }
    });

    return { bankId, buckets };
  }

  async getSLAMetrics(bankId: string): Promise<any> {
    const { data: decisions, error } = await this.db
      .from('BankDecision')
      .select('applicationId, decidedAt')
      .eq('bankId', bankId);

    if (error) throw error;

    // Calculate average TAT for different stages
    const hasDecisions = decisions && decisions.length > 0;
    const avgTAT = hasDecisions 
      ? Math.max(0, Math.floor((new Date().getTime() - (decisions.reduce((sum: number, d: any) => sum + new Date(d.decidedAt).getTime(), 0) / decisions.length)) / (1000 * 60 * 60 * 24))) + ' days'
      : '—';

    return {
      totalDecisions: decisions?.length || 0,
      averageTAT: avgTAT
    };
  }

  // ==================== AUDIT LOG ====================

  private async logAudit(auditData: any): Promise<void> {
    const { error } = await this.db.from('AuditLog').insert({
      id: randomUUID(),
      entityType: auditData.entityType,
      entityId: auditData.entityId,
      action: auditData.action,
      initiatedBy: auditData.performedBy,
      changes: {
        ...(auditData.details || {}),
        role: auditData.role,
      },
      createdAt: new Date().toISOString()
    });
    if (error) {
      console.error('[BankDashboardService] Failed to create audit log:', error);
    }
  }

  async getAuditLogs(applicationId: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('AuditLog')
      .select('*')
      .eq('entityId', applicationId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ==================== FILE MANAGEMENT ====================

  async createFileEntry(applicationId: string, bankId: string, fileData: any, bankUser: any): Promise<any> {
    const { data, error } = await this.db
      .from('FileEntry')
      .insert({
        applicationId,
        bankId,
        fileName: fileData.fileName,
        category: fileData.category || 'GENERAL',
        status: 'DRAFT',
        createdBy: bankUser.email,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'FILE',
      entityId: data.id,
      action: 'FILE_CREATED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { fileName: fileData.fileName }
    });

    return data;
  }

  async listBankFiles(bankId: string | null, status?: string, lanNumber?: string): Promise<any[]> {
    // Self-healing database mechanism:
    // Synchronize LoanApplications matching this bankId with FileEntry records
    try {
      const BANK_MAPPING: Record<string, string[]> = {
        'credila': ['HDFC Credila', 'Credila'],
        'hdfc credila': ['HDFC Credila', 'Credila'],
        'poonawalla': ['Poonawalla Fincorp', 'Poonawalla'],
        'poonawalla fincorp': ['Poonawalla Fincorp', 'Poonawalla'],
        'idfc': ['IDFC First Bank', 'IDFC FIRST Bank', 'IDFC'],
        'idfc first bank': ['IDFC First Bank', 'IDFC FIRST Bank', 'IDFC'],
        'avanse': ['Avanse Financial Services', 'Avanse Financial', 'Avanse'],
        'avanse financial services': ['Avanse Financial Services', 'Avanse Financial', 'Avanse'],
        'avanse financial': ['Avanse Financial Services', 'Avanse Financial', 'Avanse'],
        'auxilo': ['Auxilo Finserve', 'Auxilo'],
        'auxilo finserve': ['Auxilo Finserve', 'Auxilo']
      };

      let appQuery = this.db.from('LoanApplication')
        .select('*');

      if (bankId) {
        // Filter by specific bank
        const searchTerms = BANK_MAPPING[bankId.toLowerCase()] || [bankId];
        if (searchTerms.length === 1) {
          appQuery = appQuery.ilike('bank', `%${searchTerms[0]}%`);
        } else {
          const orConditions = searchTerms.map(term => `bank.ilike.%${term}%`).join(',');
          appQuery = appQuery.or(orConditions);
        }
      }
      // When bankId is null, fetch ALL applications (no bank filter)

      const { data: applications } = await appQuery;

      if (applications && applications.length > 0) {
        for (const app of applications) {
          // Resolve the normalized bankId for this application
          const appBankId = bankId || this.normalizeBankName(app.bank);

          let existingQuery = this.db
            .from('FileEntry')
            .select('id')
            .eq('applicationId', app.id);

          if (appBankId) {
            existingQuery = existingQuery.eq('bankId', appBankId);
          }

          const { data: existing } = await existingQuery.maybeSingle();

          if (!existing) {
            await this.db.from('FileEntry').insert({
              applicationId: app.id,
              bankId: appBankId || app.bank || 'unknown',
              fileName: `${app.firstName || 'Student'}_${app.lastName || ''}_Dossier`.trim(),
              category: 'EDUCATION_LOAN',
              status: app.status === 'file_logged' ? 'ACTIVE' : 'DRAFT',
              createdBy: 'system@vidhyaloans.com',
              createdAt: app.createdAt || new Date().toISOString(),
              updatedAt: app.updatedAt || new Date().toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.error('[listBankFiles] Self-healing error:', err.message);
    }

    let query = this.db
      .from('FileEntry')
      .select('*, LoanApplication!inner(id, firstName, lastName, amount, status, lanNumber, priority, assignedOfficer, bank)');

    // Only filter by bankId if a specific bank is requested
    if (bankId) {
      query = query.eq('bankId', bankId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (lanNumber) {
      query = query.eq('LoanApplication.lanNumber', lanNumber);
    }

    const { data, error } = await query.order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Normalize a bank name from LoanApplication.bank to a short bankId key
   */
  private normalizeBankName(bankName: string | null): string {
    if (!bankName) return 'unknown';
    const lower = bankName.toLowerCase();

    const REVERSE_MAPPING: Record<string, string> = {
      'hdfc credila': 'credila',
      'credila': 'credila',
      'hdfc': 'credila',
      'poonawalla fincorp': 'poonawalla',
      'poonawalla': 'poonawalla',
      'idfc first bank': 'idfc',
      'idfc': 'idfc',
      'avanse financial services': 'avanse',
      'avanse financial': 'avanse',
      'avanse': 'avanse',
      'auxilo finserve': 'auxilo',
      'auxilo': 'auxilo',
      'incred': 'incred',
      'sbi': 'sbi',
      'icici': 'icici',
      'axis': 'axis',
    };

    // Exact match first
    if (REVERSE_MAPPING[lower]) return REVERSE_MAPPING[lower];

    // Partial match
    for (const [key, value] of Object.entries(REVERSE_MAPPING)) {
      if (lower.includes(key)) return value;
    }

    return bankName;
  }

  async getFileDetails(fileId: string): Promise<any> {
    let { data, error } = await this.db
      .from('FileEntry')
      .select('*, LoanApplication(*), documents:FileDocument(*)')
      .eq('id', fileId)
      .maybeSingle();

    if (!data || error) {
      // Fallback: search by applicationId
      const { data: fallbackData } = await this.db
        .from('FileEntry')
        .select('*, LoanApplication(*), documents:FileDocument(*)')
        .eq('applicationId', fileId)
        .maybeSingle();
      
      if (fallbackData) {
        return fallbackData;
      }
      
      // Fallback 2: check LoanApplication directly
      const { data: app } = await this.db
        .from('LoanApplication')
        .select('*')
        .eq('id', fileId)
        .maybeSingle();
      
      if (app) {
        return {
          id: fileId,
          applicationId: app.id,
          bankId: app.bank || 'credila',
          fileName: `${app.firstName || 'Student'}_${app.lastName || ''}_Dossier`.trim(),
          category: 'EDUCATION_LOAN',
          status: app.status === 'file_logged' ? 'ACTIVE' : 'DRAFT',
          createdBy: 'system@vidhyaloans.com',
          createdAt: app.createdAt || new Date().toISOString(),
          updatedAt: app.updatedAt || new Date().toISOString(),
          LoanApplication: app,
          documents: []
        };
      }
      
      throw new NotFoundException(`File ${fileId} not found`);
    }
    return data;
  }

  async getFileLog(fileId: string): Promise<any> {
    // Search first by fileId in FileEntry
    let { data: file } = await this.db
      .from('FileEntry')
      .select('*, LoanApplication(*)')
      .eq('id', fileId)
      .maybeSingle();

    if (!file) {
      // Fallback: search by applicationId
      const { data: fallbackFile } = await this.db
        .from('FileEntry')
        .select('*, LoanApplication(*)')
        .eq('applicationId', fileId)
        .maybeSingle();
      file = fallbackFile;
    }

    let application = file?.LoanApplication;

    if (!application) {
      // Fallback: search LoanApplication directly
      const { data: app } = await this.db
        .from('LoanApplication')
        .select('*')
        .eq('id', fileId)
        .maybeSingle();
      application = app;
    }

    if (!application) {
      throw new NotFoundException(`File/Application ${fileId} not found`);
    }

    return {
      lanNumber: application.lanNumber || 'PENDING',
      lanEnteredAt: application.lanEnteredAt || application.updatedAt || new Date().toISOString(),
      priority: application.priority || 'NORMAL',
      assignedOfficer: application.assignedOfficer || application.fileLoggedBy || 'UNASSIGNED',
      applicationId: application.id,
      fileId: file?.id || null
    };
  }
  async addDocumentToFile(fileId: string, docData: any, bankUser: any): Promise<any> {
    const { data, error } = await this.db
      .from('FileDocument')
      .insert({
        fileId,
        documentType: docData.documentType,
        fileName: docData.fileName,
        fileUrl: docData.fileUrl,
        fileSize: docData.fileSize,
        uploadedBy: bankUser.email,
        uploadedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update file status
    await this.db
      .from('FileEntry')
      .update({ status: 'ACTIVE', updatedAt: new Date().toISOString() })
      .eq('id', fileId);

    await this.logAudit({
      entityType: 'DOCUMENT',
      entityId: fileId,
      action: 'DOCUMENT_ADDED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { documentType: docData.documentType }
    });

    return data;
  }

  async getFileDocuments(fileId: string): Promise<any[]> {
    let { data: file } = await this.db
      .from('FileEntry')
      .select('id, applicationId')
      .eq('id', fileId)
      .maybeSingle();

    if (!file) {
      const { data: fallbackFile } = await this.db
        .from('FileEntry')
        .select('id, applicationId')
        .eq('applicationId', fileId)
        .maybeSingle();
      file = fallbackFile;
    }

    const applicationId = file?.applicationId || fileId;
    const { data: application } = await this.db
      .from('LoanApplication')
      .select('id, userId')
      .eq('id', applicationId)
      .maybeSingle();

    const [fileDocsResult, appDocsResult, vaultDocsResult] = await Promise.all([
      file?.id
        ? this.db.from('FileDocument').select('*').eq('fileId', file.id)
        : Promise.resolve({ data: [], error: null } as any),
      application?.id
        ? this.db.from('ApplicationDocument').select('*').eq('applicationId', application.id)
        : Promise.resolve({ data: [], error: null } as any),
      application?.userId
        ? this.db.from('UserDocument').select('*').eq('userId', application.userId)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (fileDocsResult.error) throw fileDocsResult.error;
    if (appDocsResult.error) throw appDocsResult.error;
    if (vaultDocsResult.error) throw vaultDocsResult.error;

    const normalize = (doc: any, source: 'file' | 'application' | 'vault') => {
      const status = String(doc.status || '').toLowerCase();
      const verified = Boolean(
        doc.verified === true ||
        doc.isVerified === true ||
        doc.verifiedAt ||
        status === 'verified' ||
        status === 'approved'
      );

      return {
        id: source === 'vault' ? `vault_${doc.id}` : doc.id,
        name: doc.fileName || doc.filename || doc.docName || doc.documentName || doc.documentType || doc.docType || 'Document',
        type: doc.documentType || doc.docType || doc.mimeType || doc.fileType || 'document',
        size: doc.fileSize || doc.size || null,
        date: doc.uploadedAt || doc.createdAt || doc.updatedAt || null,
        verified,
        status: doc.status || (verified ? 'verified' : 'uploaded'),
        source,
        url: doc.fileUrl || doc.filePath || doc.s3Url || doc.url || null,
        metadata: doc.verificationMetadata || doc.metadata || null,
      };
    };

    const docs = [
      ...(fileDocsResult.data || []).map((doc: any) => normalize(doc, 'file')),
      ...(appDocsResult.data || []).map((doc: any) => normalize(doc, 'application')),
      ...(vaultDocsResult.data || [])
        .filter((doc: any) => doc.uploaded || doc.filePath || doc.fileUrl || doc.s3Url)
        .map((doc: any) => normalize(doc, 'vault')),
    ];

    const seen = new Set<string>();
    return docs
      .filter((doc) => {
        const key = [doc.type, doc.url, doc.name].join('|').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }

  async getDocumentDetails(fileId: string, documentId: string): Promise<any> {
    const { data, error } = await this.db
      .from('FileDocument')
      .select('*')
      .eq('fileId', fileId)
      .eq('id', documentId)
      .single();

    if (error) throw new NotFoundException(`Document ${documentId} not found`);
    return data;
  }

  async downloadFileAsArchive(fileId: string): Promise<any> {
    const { data: documents, error: docError } = await this.db
      .from('FileDocument')
      .select('*')
      .eq('fileId', fileId);

    if (docError) throw docError;

    return {
      success: true,
      documentCount: documents?.length || 0,
      downloadUrl: `/bank/files/${fileId}/archive`,
      documents: documents || []
    };
  }

  // ==================== TIMELINE & EVENTS ====================

  async getFileTimeline(applicationId: string): Promise<any[]> {
    // Resolve the applicationId: it may be a FileEntry id or a LoanApplication id
    let resolvedAppId = applicationId;
    const { data: fileEntry } = await this.db
      .from('FileEntry')
      .select('id, applicationId')
      .eq('id', applicationId)
      .maybeSingle();
    if (fileEntry?.applicationId) {
      resolvedAppId = fileEntry.applicationId;
    }

    // Fetch all data sources in parallel
    const [
      auditRes,
      appRes,
      queriesRes,
      decisionsRes,
      disbursementsRes,
      feesRes,
      fileEntriesRes,
      docsRes,
    ] = await Promise.all([
      // 1. AuditLog entries (match on entityId = applicationId OR fileEntry id)
      this.db
        .from('AuditLog')
        .select('*')
        .or(`entityId.eq.${resolvedAppId}${fileEntry ? `,entityId.eq.${fileEntry.id}` : ''}`)
        .order('createdAt', { ascending: false }),

      // 2. LoanApplication itself (for lifecycle timestamps)
      this.db
        .from('LoanApplication')
        .select('id, status, stage, date, updatedAt, submittedAt, reviewStartedAt, approvedAt, rejectedAt, disbursedAt, lanEnteredAt, sanctionDate, fileLoggedAt, lanNumber, firstName, lastName, bank, assignedOfficer, rejectionReason')
        .eq('id', resolvedAppId)
        .maybeSingle(),

      // 3. BankQuery
      this.db
        .from('BankQuery')
        .select('id, queryType, description, status, raisedBy, raisedAt, resolvedAt')
        .eq('applicationId', resolvedAppId)
        .order('raisedAt', { ascending: false }),

      // 4. BankDecision
      this.db
        .from('BankDecision')
        .select('id, decision, sanctionAmount, interestRate, roiType, conditions, rejectionReason, remarks, decidedBy, decidedAt')
        .eq('applicationId', resolvedAppId)
        .order('decidedAt', { ascending: false }),

      // 5. Disbursement
      this.db
        .from('Disbursement')
        .select('id, trancheNumber, amount, mode, utrNumber, beneficiary, status, disbursedAt, confirmedBy')
        .eq('applicationId', resolvedAppId)
        .order('disbursedAt', { ascending: false }),

      // 6. ProcessingFee
      this.db
        .from('ProcessingFee')
        .select('id, feeAmount, gstAmount, totalAmount, status, paymentMode, paymentRef, paidAt, waivedBy, waiverReason, createdAt')
        .eq('applicationId', resolvedAppId),

      // 7. FileEntry (creation events)
      this.db
        .from('FileEntry')
        .select('id, fileName, category, status, createdBy, createdAt')
        .eq('applicationId', resolvedAppId)
        .order('createdAt', { ascending: false }),

      // 8. FileDocuments (uploaded to any FileEntry linked to this application)
      fileEntry?.id
        ? this.db
            .from('FileDocument')
            .select('id, documentType, fileName, fileSize, uploadedBy, uploadedAt')
            .eq('fileId', fileEntry.id)
            .order('uploadedAt', { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const events: any[] = [];

    // --- 1. Audit log entries ---
    for (const log of auditRes.data || []) {
      events.push({
        timestamp: log.createdAt,
        category: 'audit',
        action: log.action,
        entityType: log.entityType,
        performedBy: log.initiatedBy,
        details: log.changes,
      });
    }

    // --- 2. Application lifecycle milestones ---
    const app = appRes.data;
    if (app) {
      const milestones: { field: string; action: string; label: string }[] = [
        { field: 'date', action: 'APPLICATION_CREATED', label: 'Application created' },
        { field: 'submittedAt', action: 'APPLICATION_SUBMITTED', label: 'Application submitted' },
        { field: 'fileLoggedAt', action: 'FILE_LOGGED', label: 'File logged with bank' },
        { field: 'lanEnteredAt', action: 'LAN_ASSIGNED', label: `LAN assigned: ${app.lanNumber || ''}` },
        { field: 'reviewStartedAt', action: 'REVIEW_STARTED', label: 'Bank review started' },
        { field: 'sanctionDate', action: 'APPLICATION_SANCTIONED', label: 'Application sanctioned' },
        { field: 'approvedAt', action: 'APPLICATION_APPROVED', label: 'Application approved' },
        { field: 'rejectedAt', action: 'APPLICATION_REJECTED', label: 'Application rejected' },
        { field: 'disbursedAt', action: 'APPLICATION_DISBURSED', label: 'Loan disbursed' },
      ];

      for (const m of milestones) {
        const ts = app[m.field];
        if (ts) {
          events.push({
            timestamp: ts,
            category: 'milestone',
            action: m.action,
            entityType: 'LOAN',
            performedBy: null,
            details: {
              label: m.label,
              status: app.status,
              assignedOfficer: app.assignedOfficer,
              ...(m.field === 'rejectedAt' && app.rejectionReason ? { rejectionReason: app.rejectionReason } : {}),
              ...(m.field === 'lanEnteredAt' ? { lanNumber: app.lanNumber } : {}),
            },
          });
        }
      }
    }

    // --- 3. Bank queries ---
    for (const q of queriesRes.data || []) {
      events.push({
        timestamp: q.raisedAt,
        category: 'query',
        action: 'QUERY_RAISED',
        entityType: 'QUERY',
        performedBy: q.raisedBy,
        details: { queryType: q.queryType, description: q.description, queryId: q.id },
      });
      if (q.resolvedAt) {
        events.push({
          timestamp: q.resolvedAt,
          category: 'query',
          action: 'QUERY_RESOLVED',
          entityType: 'QUERY',
          performedBy: null,
          details: { queryType: q.queryType, queryId: q.id },
        });
      }
    }

    // --- 4. Bank decisions ---
    for (const d of decisionsRes.data || []) {
      events.push({
        timestamp: d.decidedAt,
        category: 'decision',
        action: `BANK_DECISION_${(d.decision || 'UNKNOWN').toUpperCase()}`,
        entityType: 'DECISION',
        performedBy: d.decidedBy,
        details: {
          decision: d.decision,
          sanctionAmount: d.sanctionAmount,
          interestRate: d.interestRate,
          conditions: d.conditions,
          remarks: d.remarks,
          rejectionReason: d.rejectionReason,
        },
      });
    }

    // --- 5. Disbursements ---
    for (const dis of disbursementsRes.data || []) {
      events.push({
        timestamp: dis.disbursedAt,
        category: 'disbursement',
        action: 'DISBURSEMENT_CONFIRMED',
        entityType: 'DISBURSEMENT',
        performedBy: dis.confirmedBy,
        details: {
          trancheNumber: dis.trancheNumber,
          amount: dis.amount,
          mode: dis.mode,
          utrNumber: dis.utrNumber,
          beneficiary: dis.beneficiary,
          status: dis.status,
        },
      });
    }

    // --- 6. Processing fees ---
    for (const fee of feesRes.data || []) {
      events.push({
        timestamp: fee.createdAt,
        category: 'fee',
        action: 'PROCESSING_FEE_SET',
        entityType: 'FEE',
        performedBy: null,
        details: {
          feeAmount: fee.feeAmount,
          gstAmount: fee.gstAmount,
          totalAmount: fee.totalAmount,
          status: fee.status,
        },
      });
      if (fee.paidAt) {
        events.push({
          timestamp: fee.paidAt,
          category: 'fee',
          action: 'PROCESSING_FEE_PAID',
          entityType: 'FEE',
          performedBy: null,
          details: {
            totalAmount: fee.totalAmount,
            paymentMode: fee.paymentMode,
            paymentRef: fee.paymentRef,
          },
        });
      }
      if (fee.waivedBy) {
        events.push({
          timestamp: fee.createdAt, // no separate waivedAt column
          category: 'fee',
          action: 'PROCESSING_FEE_WAIVED',
          entityType: 'FEE',
          performedBy: fee.waivedBy,
          details: { waiverReason: fee.waiverReason },
        });
      }
    }

    // --- 7. File entries ---
    for (const fe of fileEntriesRes.data || []) {
      events.push({
        timestamp: fe.createdAt,
        category: 'file',
        action: 'FILE_CREATED',
        entityType: 'FILE',
        performedBy: fe.createdBy,
        details: { fileName: fe.fileName, category: fe.category, status: fe.status },
      });
    }

    // --- 8. File documents ---
    for (const doc of docsRes.data || []) {
      events.push({
        timestamp: doc.uploadedAt,
        category: 'document',
        action: 'DOCUMENT_UPLOADED',
        entityType: 'DOCUMENT',
        performedBy: doc.uploadedBy,
        details: { documentType: doc.documentType, fileName: doc.fileName, fileSize: doc.fileSize },
      });
    }

    // Deduplicate: if an audit log entry has the same action + similar timestamp as a
    // table-derived event, prefer the table-derived event (richer data) and drop the audit dupe
    const nonAuditKeys = new Set(
      events
        .filter(e => e.category !== 'audit')
        .map(e => `${e.action}|${e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 16) : ''}`)
    );

    const deduped = events.filter(e => {
      if (e.category !== 'audit') return true;
      const key = `${e.action}|${e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 16) : ''}`;
      return !nonAuditKeys.has(key);
    });

    // Sort chronologically descending (newest first)
    deduped.sort((a, b) => {
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tB - tA;
    });

    return deduped;
  }

  async getFileEvents(applicationId: string, type?: string): Promise<any[]> {
    let query = this.db
      .from('AuditLog')
      .select('*')
      .eq('entityId', applicationId);

    if (type) {
      query = query.eq('action', type);
    }

    const { data, error } = await query.order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ==================== LAN VALIDATION ====================

  async validateLANFormat(lanNumber: string): Promise<any> {
    // LAN format: typically starts with a prefix (e.g., 'LAN') followed by numbers
    const lanRegex = /^([A-Z]{2,4})[0-9]{6,10}$/;
    
    if (!lanNumber || !lanRegex.test(lanNumber)) {
      return {
        valid: false,
        message: 'Invalid LAN format. Expected format: [PREFIX][6-10 digits]',
        example: 'LAN123456'
      };
    }

    return {
      valid: true,
      message: 'Valid LAN format',
      lanNumber
    };
  }

  async checkLANExists(lanNumber: string): Promise<any> {
    const { data, error } = await this.db
      .from('LoanApplication')
      .select('id, status, firstName, lastName, amount')
      .eq('lanNumber', lanNumber)
      .single();

    if (error || !data) {
      return {
        exists: false,
        lanNumber,
        message: 'LAN not found in system'
      };
    }

    return {
      exists: true,
      lanNumber,
      application: data
    };
  }

  async getLANDetails(lanNumber: string): Promise<any> {
    const { data: application, error: appError } = await this.db
      .from('LoanApplication')
      .select(`
        *,
        BankDecision(*),
        FileEntry(*),
        Disbursement(*),
        ProcessingFee(*),
        BankQuery(*)
      `)
      .eq('lanNumber', lanNumber)
      .single();

    if (appError || !application) {
      throw new NotFoundException(`LAN ${lanNumber} not found`);
    }

    return application;
  }

  // ==================== SANCTION & DECISION ====================

  async sanctionApplication(applicationId: string, sanctionData: any, bankUser: any): Promise<any> {
    const { data: updated, error } = await this.db
      .from('LoanApplication')
      .update({
        status: 'sanctioned',
        sanctionAmount: sanctionData.sanctionAmount,
        sanctionExpiry: sanctionData.sanctionExpiry,
        sanctionDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'APPLICATION_SANCTIONED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { sanctionAmount: sanctionData.sanctionAmount }
    });

    return updated;
  }

  async updateSanction(applicationId: string, sanctionData: any, bankUser: any): Promise<any> {
    const { data: updated, error } = await this.db
      .from('LoanApplication')
      .update({
        sanctionAmount: sanctionData.sanctionAmount,
        sanctionExpiry: sanctionData.sanctionExpiry,
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'SANCTION_UPDATED',
      performedBy: bankUser.email,
      role: bankUser.role
    });

    return updated;
  }

  async recordBankDecision(applicationId: string, decisionData: any, bankUser: any): Promise<any> {
    // ---- Task 12 & 13: 4-type validation ----
    const decision = (decisionData.decision || '').toUpperCase() as DecisionType;
    if (!DECISION_TYPES.includes(decision)) {
      throw new BadRequestException(
        `Invalid decision type "${decision}". Allowed: ${DECISION_TYPES.join(', ')}`
      );
    }

    // Per-type required field validation
    if (decision === 'REJECTED') {
      if (!decisionData.rejectionReason || !decisionData.rejectionCategory) {
        throw new BadRequestException('rejectionReason and rejectionCategory are required for REJECTED decisions.');
      }
      const cat = (decisionData.rejectionCategory || '').toUpperCase() as RejectionCategory;
      if (!REJECTION_CATEGORIES.includes(cat)) {
        throw new BadRequestException(`Invalid rejectionCategory "${cat}". Allowed: ${REJECTION_CATEGORIES.join(', ')}`);
      }
    }
    if (decision === 'APPROVED') {
      if (!decisionData.sanctionAmount || decisionData.sanctionAmount <= 0) {
        throw new BadRequestException('sanctionAmount (> 0) is required for APPROVED decisions.');
      }
    }
    if (decision === 'CONDITIONAL_SANCTION') {
      if (!Array.isArray(decisionData.conditions) || decisionData.conditions.length === 0) {
        throw new BadRequestException('conditions[] array is required for CONDITIONAL_SANCTION decisions.');
      }
      if (!decisionData.sanctionAmount || decisionData.sanctionAmount <= 0) {
        throw new BadRequestException('sanctionAmount (> 0) is required for CONDITIONAL_SANCTION decisions.');
      }
    }
    if (decision === 'COUNTER_OFFER') {
      if (!decisionData.counterOfferTerms) {
        throw new BadRequestException('counterOfferTerms (JSON object) is required for COUNTER_OFFER decisions.');
      }
    }
    if (decision === 'PARTIAL_SANCTION') {
      if (!decisionData.sanctionAmount || decisionData.sanctionAmount <= 0) {
        throw new BadRequestException('sanctionAmount (> 0) is required for PARTIAL_SANCTION decisions.');
      }
      if (!decisionData.requestedAmount || decisionData.requestedAmount <= 0) {
        throw new BadRequestException('requestedAmount (> 0) is required for PARTIAL_SANCTION decisions.');
      }
    }

    // Fetch current application status for state machine validation
    const { data: currentApp, error: fetchError } = await this.db
      .from('LoanApplication')
      .select('status, stage')
      .eq('id', applicationId)
      .single();
    if (fetchError || !currentApp) throw new NotFoundException(`Application ${applicationId} not found`);

    // Determine target status from decision type
    const decisionStatusMap: Record<DecisionType, string> = {
      APPROVED:              'sanctioned',
      REJECTED:              'rejected',
      CONDITIONAL_SANCTION:  'conditional_sanction',
      COUNTER_OFFER:         'counter_offer',
      PARTIAL_SANCTION:      'partial_sanction',
    };
    const targetStatus = decisionStatusMap[decision];

    // Validate transition via state machine
    LoanStateMachine.validateTransition(currentApp.status, targetStatus, bankUser.role);

    // Normalise conditions to per-item objects for CONDITIONAL_SANCTION
    let conditions = decisionData.conditions || null;
    if (decision === 'CONDITIONAL_SANCTION' && Array.isArray(conditions)) {
      conditions = conditions.map((c: any) =>
        typeof c === 'string'
          ? { text: c, status: 'PENDING', deadline: decisionData.conditionDeadline || null }
          : { text: c.text || c, status: c.status || 'PENDING', deadline: c.deadline || null }
      );
    }

    const now = new Date().toISOString();
    const shortfall = decision === 'PARTIAL_SANCTION'
      ? (Number(decisionData.requestedAmount) - Number(decisionData.sanctionAmount))
      : null;

    const { data, error } = await this.db
      .from('BankDecision')
      .insert({
        applicationId,
        bankId: bankUser.bankId || null,
        decision,
        sanctionAmount: decisionData.sanctionAmount || null,
        requestedAmount: decisionData.requestedAmount || null,
        shortfallAmount: shortfall,
        roiType: decisionData.roiType || null,
        interestRate: decisionData.interestRate || null,
        conditions,
        counterOfferTerms: decisionData.counterOfferTerms || null,
        rejectionReason: decisionData.rejectionReason || null,
        rejectionCategory: decisionData.rejectionCategory ? (decisionData.rejectionCategory as string).toUpperCase() : null,
        sanctionLetterUrl: decisionData.sanctionLetterUrl || null,
        remarks: decisionData.remarks || null,
        decidedBy: bankUser.email,
        decidedAt: now,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto status transition via state machine (already validated above)
    const isSanctionDecision = ['APPROVED', 'CONDITIONAL_SANCTION', 'PARTIAL_SANCTION', 'COUNTER_OFFER'].includes(decision);
    const newStage = isSanctionDecision ? 'sanction' : (decision === 'REJECTED' ? currentApp.stage : 'bank_review');
    const newProgress = isSanctionDecision ? 95 : (decision === 'REJECTED' ? 0 : 90);

    await this.db
      .from('LoanApplication')
      .update({
        status: targetStatus,
        stage: newStage,
        progress: newProgress,
        ...(isSanctionDecision ? { approvedAt: now } : {}),
        updatedAt: now
      })
      .eq('id', applicationId);

    // For partial sanction — notify staff about shortfall
    if (decision === 'PARTIAL_SANCTION' && shortfall !== null && shortfall > 0) {
      await this.db.from('BankQuery').insert({
        applicationId,
        raisedBy: bankUser.email,
        queryType: 'PARTIAL_SANCTION_SHORTFALL',
        description: `Partial sanction issued. Approved: ₹${decisionData.sanctionAmount}, Requested: ₹${decisionData.requestedAmount}, Shortfall: ₹${shortfall}. Staff action required.`,
        requiredDocs: [],
        status: 'OPEN',
        raisedAt: now,
      });
    }

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: `BANK_DECISION_${decision}`,
      performedBy: bankUser.email,
      role: bankUser.role,
      details: {
        decision,
        targetStatus,
        sanctionAmount: decisionData.sanctionAmount,
        rejectionCategory: decisionData.rejectionCategory,
        shortfallAmount: shortfall,
      }
    });

    return { ...data, targetStatus };
  }

  /**
   * Centralized state transition method — validates and applies a status change.
   * All status mutations should go through here.
   */
  async transitionApplicationStatus(
    applicationId: string,
    targetStatus: string,
    bankUser: any,
    reason?: string
  ): Promise<any> {
    const { data: currentApp, error } = await this.db
      .from('LoanApplication')
      .select('status, id')
      .eq('id', applicationId)
      .single();
    if (error || !currentApp) throw new NotFoundException(`Application ${applicationId} not found`);

    LoanStateMachine.validateTransition(currentApp.status, targetStatus, bankUser.role);

    const now = new Date().toISOString();
    const updatedStage = LoanStateMachine.getStageByStatus(targetStatus);
    const updatedProgress = LoanStateMachine.getProgressByStatus(targetStatus);

    const { data: updated, error: updateError } = await this.db
      .from('LoanApplication')
      .update({
        status: targetStatus,
        stage: updatedStage,
        progress: updatedProgress,
        updatedAt: now
      })
      .eq('id', applicationId)
      .select()
      .single();
    if (updateError) throw updateError;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'STATUS_TRANSITIONED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { fromStatus: currentApp.status, toStatus: targetStatus, reason }
    });

    return updated;
  }

  /**
   * Returns allowed next transitions for a given application (used by frontend action buttons).
   */
  async getAllowedTransitionsForApp(applicationId: string, bankUser: any): Promise<any> {
    const { data: app, error } = await this.db
      .from('LoanApplication')
      .select('status')
      .eq('id', applicationId)
      .single();
    if (error || !app) throw new NotFoundException(`Application ${applicationId} not found`);

    const allowed = LoanStateMachine.getAllowedTransitions(app.status, bankUser.role);
    return {
      currentStatus: app.status,
      allowedTransitions: allowed,
      isTerminal: LoanStateMachine.isTerminalState(app.status)
    };
  }

  // ==================== QUERIES - ENHANCED ====================

  async getBankQueries(bankId: string, applicationId?: string): Promise<any[]> {
    let query = this.db
      .from('BankQuery')
      .select(`
        *,
        LoanApplication:applicationId(id, firstName, lastName)
      `);

    if (applicationId) {
      query = query.eq('applicationId', applicationId);
    }

    const { data, error } = await query.order('raisedAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getQueryDetails(queryId: string): Promise<any> {
    const { data, error } = await this.db
      .from('BankQuery')
      .select(`
        *,
        responses:QueryResponse(*)
      `)
      .eq('id', queryId)
      .single();

    if (error) throw new NotFoundException(`Query ${queryId} not found`);
    return data;
  }

  async getQueryResponses(queryId: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('QueryResponse')
      .select('*')
      .eq('queryId', queryId)
      .order('respondedAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ==================== CONSENT & REFERRAL ====================

  async recordConsent(applicationId: string, consentData: any, bankUser: any): Promise<any> {
    const { data: appData } = await this.db
      .from('LoanApplication')
      .select('userId')
      .eq('id', applicationId)
      .single();

    const userId = appData?.userId || null;

    const { data, error } = await this.db
      .from('ConsentRecord')
      .upsert(
        {
          applicationId,
          userId,
          consentType: consentData.consentType,
          status: 'ACCEPTED',
          recordedAt: new Date().toISOString(),
          recordedBy: bankUser.email
        },
        { onConflict: 'applicationId' }
      )
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'CONSENT_RECORDED',
      performedBy: bankUser.email,
      role: bankUser.role
    });

    return data;
  }

  async getConsentStatus(applicationId: string): Promise<any> {
    const { data, error } = await this.db
      .from('ConsentRecord')
      .select('*')
      .eq('applicationId', applicationId)
      .single();

    if (error || !data) {
      return { applicationId, status: 'PENDING', consentType: null };
    }

    return data;
  }

  async updateReferralFee(applicationId: string, feeData: any, bankUser: any): Promise<any> {
    const { data: updated, error } = await this.db
      .from('LoanApplication')
      .update({
        referralFee: feeData.referralFee,
        agentCommission: feeData.agentCommission,
        updatedAt: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'LOAN',
      entityId: applicationId,
      action: 'REFERRAL_FEE_UPDATED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: {
        referralFee: feeData.referralFee,
        agentCommission: feeData.agentCommission
      }
    });

    return updated;
  }

  // ==================== INTERNAL NOTES (F32) ====================

  /**
   * Add an internal bank note to a file. Restricted to same bankId.
   * Notes are stored in the BankFileNote table (falls back to BankQuery-style storage).
   */
  async addNote(fileId: string, noteData: any, bankUser: any): Promise<any> {
    const bankId = bankUser.bankId || bankUser.firstName?.toLowerCase() || 'unknown';
    const now = new Date().toISOString();

    // Resolve to applicationId
    const appId = await this.resolveApplicationId(fileId);

    const { data, error } = await this.db
      .from('BankFileNote')
      .insert({
        applicationId: appId,
        bankId,
        content: noteData.content,
        isPinned: noteData.isPinned || false,
        createdBy: bankUser.email,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'FILE',
      entityId: appId,
      action: 'NOTE_ADDED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { noteId: data.id }
    });

    return data;
  }

  /**
   * Get internal notes for a file, restricted to same bankId.
   */
  async getNotes(fileId: string, bankUser: any): Promise<any[]> {
    const bankId = bankUser.bankId || bankUser.firstName?.toLowerCase() || 'unknown';
    const appId = await this.resolveApplicationId(fileId);

    const { data, error } = await this.db
      .from('BankFileNote')
      .select('*')
      .eq('applicationId', appId)
      .eq('bankId', bankId)
      .order('isPinned', { ascending: false })
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Update a note (author-only).
   */
  async updateNote(noteId: string, content: string, bankUser: any): Promise<any> {
    const { data: existing, error: fetchErr } = await this.db
      .from('BankFileNote')
      .select('createdBy, bankId')
      .eq('id', noteId)
      .single();

    if (fetchErr || !existing) throw new NotFoundException(`Note ${noteId} not found`);
    if (existing.createdBy !== bankUser.email && bankUser.role !== 'super_admin') {
      throw new BadRequestException('You can only edit your own notes.');
    }

    const { data, error } = await this.db
      .from('BankFileNote')
      .update({ content, updatedAt: new Date().toISOString() })
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a note (author-only or super_admin).
   */
  async deleteNote(noteId: string, bankUser: any): Promise<void> {
    const { data: existing, error: fetchErr } = await this.db
      .from('BankFileNote')
      .select('createdBy')
      .eq('id', noteId)
      .single();

    if (fetchErr || !existing) throw new NotFoundException(`Note ${noteId} not found`);
    if (existing.createdBy !== bankUser.email && bankUser.role !== 'super_admin') {
      throw new BadRequestException('You can only delete your own notes.');
    }

    const { error } = await this.db.from('BankFileNote').delete().eq('id', noteId);
    if (error) throw error;
  }

  // ==================== FILE TAGS (F43) ====================

  /** Pre-built tag library */
  getTagLibrary(): string[] {
    return [...PREDEFINED_TAGS];
  }

  /**
   * Add a tag to a FileEntry's tags array.
   */
  async addTag(fileId: string, tag: string, bankUser: any): Promise<any> {
    const normalizedTag = tag.toUpperCase().replace(/\s+/g, '_');
    const { data: entry, error: fetchErr } = await this.db
      .from('FileEntry')
      .select('id, tags, bankId')
      .eq('id', fileId)
      .maybeSingle();

    if (fetchErr || !entry) throw new NotFoundException(`File ${fileId} not found`);

    const existingTags: string[] = entry.tags || [];
    if (existingTags.includes(normalizedTag)) {
      return { id: entry.id, tags: existingTags }; // idempotent
    }

    const updatedTags = [...existingTags, normalizedTag];
    const { data, error } = await this.db
      .from('FileEntry')
      .update({ tags: updatedTags, updatedAt: new Date().toISOString() })
      .eq('id', fileId)
      .select('id, tags')
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'FILE',
      entityId: fileId,
      action: 'TAG_ADDED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { tag: normalizedTag }
    });

    return data;
  }

  /**
   * Remove a tag from a FileEntry's tags array.
   */
  async removeTag(fileId: string, tag: string, bankUser: any): Promise<any> {
    const normalizedTag = tag.toUpperCase().replace(/\s+/g, '_');
    const { data: entry, error: fetchErr } = await this.db
      .from('FileEntry')
      .select('id, tags')
      .eq('id', fileId)
      .maybeSingle();

    if (fetchErr || !entry) throw new NotFoundException(`File ${fileId} not found`);

    const updatedTags = (entry.tags || []).filter((t: string) => t !== normalizedTag);
    const { data, error } = await this.db
      .from('FileEntry')
      .update({ tags: updatedTags, updatedAt: new Date().toISOString() })
      .eq('id', fileId)
      .select('id, tags')
      .single();

    if (error) throw error;

    await this.logAudit({
      entityType: 'FILE',
      entityId: fileId,
      action: 'TAG_REMOVED',
      performedBy: bankUser.email,
      role: bankUser.role,
      details: { tag: normalizedTag }
    });

    return data;
  }

  /**
   * List files filtered by a specific tag.
   */
  async getFilesByTag(tag: string, bankId: string | null): Promise<any[]> {
    const normalizedTag = tag.toUpperCase().replace(/\s+/g, '_');
    let query = this.db
      .from('FileEntry')
      .select('*, LoanApplication(id, firstName, lastName, amount, status, lanNumber)')
      .contains('tags', [normalizedTag]);

    if (bankId) query = query.eq('bankId', bankId);

    const { data, error } = await query.order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Resolves a fileId or applicationId to a LoanApplication.id.
   */
  private async resolveApplicationId(id: string): Promise<string> {
    // Try FileEntry first
    const { data: fe } = await this.db
      .from('FileEntry')
      .select('applicationId')
      .eq('id', id)
      .maybeSingle();
    if (fe?.applicationId) return fe.applicationId;

    // Try as applicationId directly
    const { data: app } = await this.db
      .from('LoanApplication')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (app) return app.id;

    throw new NotFoundException(`Application/File ${id} not found`);
  }
}
