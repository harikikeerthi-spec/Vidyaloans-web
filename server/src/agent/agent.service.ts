import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private get db() {
    return this.supabase.getClient();
  }

  constructor(
    private readonly supabase: SupabaseService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // PII masking helpers
  private maskEmail(email: string): string {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const [local, domain] = parts;
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  }

  private maskPhone(phone: string): string {
    if (!phone) return '';
    if (phone.length <= 4) return '******';
    return '*'.repeat(phone.length - 4) + phone.slice(-4);
  }

  private maskApplicationPII(app: any) {
    const masked = { ...app };
    if (masked.email) masked.email = this.maskEmail(masked.email);
    if (masked.phoneNumber) masked.phoneNumber = this.maskPhone(masked.phoneNumber);
    if (masked.phone) masked.phone = this.maskPhone(masked.phone);
    if (masked.dateOfBirth) masked.dateOfBirth = 'XX-XX-XXXX';
    if (masked.dob) masked.dob = 'XX-XX-XXXX';
    if (masked.coApplicantMobile) masked.coApplicantMobile = this.maskPhone(masked.coApplicantMobile);
    if (masked.user) {
      masked.user = { ...masked.user };
      if (masked.user.email) masked.user.email = this.maskEmail(masked.user.email);
      if (masked.user.phoneNumber) masked.user.phoneNumber = this.maskPhone(masked.user.phoneNumber);
    }
    return masked;
  }

  private async getRefereeIds(agentId: string): Promise<string[]> {
    const { data: referrals } = await this.db
      .from('Referral')
      .select('refereeId')
      .eq('referrerId', agentId);
    return (referrals || []).map(r => r.refereeId).filter(Boolean);
  }

  async getDashboardSummary(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) {
      return {
        totalLeads: 0,
        totalAmount: 0,
        disbursedAmount: 0,
        revenue: 0,
        activeCount: 0,
      };
    }

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('*')
      .in('userId', refereeIds);

    let totalAmount = 0;
    let disbursedAmount = 0;
    let activeCount = 0;

    for (const app of applications || []) {
      const amt = parseFloat(app.amount) || 0;
      totalAmount += amt;
      if (app.status === 'disbursed') {
        disbursedAmount += amt;
      }
      if (!['disbursed', 'rejected', 'cancelled'].includes(app.status)) {
        activeCount++;
      }
    }

    // Agent revenue model: 0.7% on disbursed amount
    const revenue = disbursedAmount * 0.007;

    return {
      totalLeads: (applications || []).length,
      totalAmount,
      disbursedAmount,
      revenue,
      activeCount,
    };
  }

  async getDashboardPipeline(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    const counts = {
      leads: 0,
      submitted: 0,
      bank_review: 0,
      approved: 0,
      disbursed: 0,
    };

    if (refereeIds.length === 0) return counts;

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('status')
      .in('userId', refereeIds);

    for (const app of applications || []) {
      const status = app.status ? app.status.toLowerCase() : 'pending';
      if (status === 'disbursed') counts.disbursed++;
      else if (status === 'approved') counts.approved++;
      else if (['processing', 'bank_review'].includes(status)) counts.bank_review++;
      else if (['submitted', 'application_submitted'].includes(status)) counts.submitted++;
      else counts.leads++;
    }

    return counts;
  }

  async getDashboardActivity(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) return [];

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('id, applicationNumber, firstName, lastName')
      .in('userId', refereeIds);

    if (!applications || applications.length === 0) return [];

    const appIds = applications.map(a => a.id);
    const { data: history } = await this.db
      .from('ApplicationStatusHistory')
      .select('*')
      .in('applicationId', appIds)
      .order('createdAt', { ascending: false })
      .limit(10);

    const appMap = new Map(applications.map(a => [a.id, a]));

    return (history || []).map(h => {
      const app = appMap.get(h.applicationId);
      const studentName = app ? `${app.firstName || ''} ${app.lastName || ''}`.trim() : 'Student';
      return {
        id: h.id,
        applicationId: h.applicationId,
        applicationNumber: app?.applicationNumber || 'N/A',
        studentName: this.maskEmail(studentName),
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changeReason: h.changeReason,
        createdAt: h.createdAt,
      };
    });
  }

  async getDashboardActionItems(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) return [];

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('id, applicationNumber, firstName, lastName, status, remarks')
      .in('userId', refereeIds)
      .in('status', ['query_raised', 'document_rejected', 'pending']);

    return (applications || []).map(app => {
      const studentName = `${app.firstName || ''} ${app.lastName || ''}`.trim();
      let type = 'Follow-Up';
      let notes = app.remarks || 'Application pending review';

      if (app.status === 'query_raised') {
        type = 'Bank Query';
        notes = app.remarks || 'A query has been raised by the bank.';
      } else if (app.status === 'document_rejected') {
        type = 'Doc Chase';
        notes = app.remarks || 'One or more uploaded documents were rejected.';
      }

      return {
        id: app.id,
        type,
        studentName,
        dateTime: new Date().toISOString(),
        notes,
        isOverdue: false,
        isCompleted: false,
      };
    });
  }

  async getLeads(
    agentId: string,
    search?: string,
    status?: string,
    loanType?: string,
    page?: number,
    limit?: number,
  ) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) return { leads: [], totalCount: 0 };

    let query = this.db
      .from('LoanApplication')
      .select('*, user:User!userId(*)', { count: 'exact' })
      .in('userId', refereeIds);

    if (search) {
      query = query.or(`firstName.ilike.%${search}%,lastName.ilike.%${search}%,applicationNumber.ilike.%${search}%`);
    }

    if (status && status !== 'All') {
      query = query.eq('status', status.toLowerCase());
    }

    if (loanType && loanType !== 'All') {
      query = query.eq('loanType', loanType);
    }

    const limitNum = Number(limit) || 10;
    const pageNum = Number(page) || 1;
    const offset = (pageNum - 1) * limitNum;

    const { data, count, error } = await query
      .order('updatedAt', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    const maskedLeads = (data || []).map(app => this.maskApplicationPII(app));

    return {
      leads: maskedLeads,
      totalCount: count || 0,
    };
  }

  async createLead(agentId: string, data: any) {
    const email = data.email?.toLowerCase().trim();
    if (!email) throw new BadRequestException('Email is required');

    // 1. Check if user already exists or create new
    let user = await this.usersService.findOne(email);
    if (!user) {
      user = await this.usersService.create({
        email,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        role: 'user',
      });
    }

    // 2. Record referral map
    const { data: existingReferral } = await this.db
      .from('Referral')
      .select('id')
      .eq('refereeEmail', email)
      .single();

    if (!existingReferral) {
      await this.db.from('Referral').insert({
        referrerId: agentId,
        refereeEmail: email,
        refereeId: user.id,
        status: 'signed_up',
      });
    }

    // 3. Create LoanApplication
    const estimatedCompletionAt = new Date();
    estimatedCompletionAt.setDate(estimatedCompletionAt.getDate() + 14);

    // Do NOT generate application number on initial create.
    // It will be generated when staff routes to bank (VTU-APP- format).

    const { data: application, error: appError } = await this.db
      .from('LoanApplication')
      .insert({
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: email,
        phone: data.phoneNumber || null,
        bank: 'Pending Partner',
        loanType: data.loanType || 'Abroad',
        amount: parseFloat(data.amount) || 0,
        country: data.country || 'United States',
        universityName: data.collegeName || null,
        pincode: data.pincode || null,
        address: data.address || null,
        coApplicantName: data.coApplicantName || null,
        coApplicantRelation: data.coApplicantRelationship || null,
        coApplicantPhone: data.coApplicantMobile || null,
        coApplicantEmail: data.coApplicantEmail || null,
        status: 'submitted',
        stage: 'application_submitted',
        progress: 10,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        estimatedCompletionAt: estimatedCompletionAt.toISOString(),
      })
      .select()
      .single();

    if (appError) throw appError;

    // Emit live dashboard activity event for lead submission
    try {
      const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || email || 'Student';
      this.eventEmitter.emit('dashboard.activity', {
        type: 'application',
        msg: `Agent submitted lead for Student ${name} (Application #${application.applicationNumber || application.id.slice(-4)}) for review.`,
        icon: 'rocket_launch',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        actorName: name,
        actorEmail: email,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      // Ignore activity emit failure
    }

    // Emit event-driven notifications
    this.eventEmitter.emit('application.created', {
      applicationId: application.id,
      userId: user.id,
      email: email,
    });
    this.eventEmitter.emit('application.submitted', {
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      userId: user.id,
      candidateName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || email || 'Student',
      candidateEmail: email,
      bank: application.bank,
      loanAmount: application.amount,
      loanType: application.loanType,
      submittedAt: application.submittedAt || new Date().toISOString(),
    });

    return { success: true, application };
  }

  async bulkImport(agentId: string, leads: any[]) {
    const results: any[] = [];
    for (const lead of leads) {
      try {
        const res = await this.createLead(agentId, lead);
        results.push({ email: lead.email, success: true, id: res.application?.id });
      } catch (err) {
        results.push({ email: lead.email, success: false, error: err.message });
      }
    }
    return { success: true, results };
  }

  async checkEligibility(data: any) {
    const amount = Number(data.amount) || 0;
    const age = Number(data.age) || 21;
    const hasCoApplicant = !!data.coApplicant;

    let eligible = true;
    const reasons: string[] = [];

    if (amount > 15000000) {
      eligible = false;
      reasons.push('Requested loan amount exceeds maximum limit of 1.5 Crores.');
    }
    if (age < 18 || age > 35) {
      eligible = false;
      reasons.push('Borrower age must be between 18 and 35 years.');
    }
    if (amount > 750000 && !hasCoApplicant) {
      eligible = false;
      reasons.push('Co-applicant is mandatory for education loans above 7.5 Lakhs.');
    }

    return {
      success: true,
      eligible,
      score: eligible ? 85 : 40,
      reasons: reasons.length > 0 ? reasons : ['Meets core underwriting criteria.'],
    };
  }

  async getLeadDetail(agentId: string, leadId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    
    const { data: application, error } = await this.db
      .from('LoanApplication')
      .select('*, user:User!userId(*)')
      .eq('id', leadId)
      .single();

    if (error || !application) {
      throw new NotFoundException('Lead not found');
    }

    if (!refereeIds.includes(application.userId)) {
      throw new ForbiddenException('Access denied. This lead does not belong to you.');
    }

    const maskedApp = this.maskApplicationPII(application);

    // Fetch documents
    const documents = await this.usersService.getUserDocuments(application.userId);

    // Fetch ApplicationStatusHistory for Journey
    const { data: history } = await this.db
      .from('ApplicationStatusHistory')
      .select('*')
      .eq('applicationId', leadId)
      .order('createdAt', { ascending: true });

    const journey = (history || []).map(h => {
      const date = new Date(h.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      return {
        date,
        title: h.toStatus ? h.toStatus.replace(/_/g, ' ').toUpperCase() : 'STATUS UPDATE',
        desc: h.changeReason || `Application moved from ${h.fromStatus || 'none'} to ${h.toStatus}`,
        done: true
      };
    });

    if (journey.length === 0) {
      const date = new Date(application.createdAt || Date.now()).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      journey.push({
        date,
        title: 'LEAD SUBMITTED',
        desc: 'Submitted via Agent Network',
        done: true
      });
    }

    const bankStatus = {
      product: application.bank ? `${application.bank} Scholar Scheme` : 'Pending Partner',
      refNumber: `REF-${String(application.id).slice(-6).toUpperCase()}`,
      submittedOn: application.submittedAt 
        ? new Date(application.submittedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
        : new Date(application.createdAt || Date.now()).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      tatExpected: '10 working days',
      queryText: application.status === 'query_raised' ? application.remarks : undefined
    };

    const commissionRate = 0.007; // 0.70%
    const projectedCommission = (parseFloat(application.amount) || 0) * commissionRate;

    // Fetch communication logs / notes
    const { data: notes } = await this.db
      .from('ApplicationNote')
      .select('*')
      .eq('applicationId', leadId)
      .order('createdAt', { ascending: false });

    const communicationLog = (notes || []).map(n => {
      const date = new Date(n.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      return {
        sender: n.authorRole || 'Staff',
        timestamp: `${date} ${new Date(n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        message: n.content
      };
    });

    return {
      ...maskedApp,
      documents,
      journey,
      bankStatus,
      commissionRate: commissionRate * 100,
      projectedCommission,
      communicationLog
    };
  }

  async getLeadDocuments(agentId: string, leadId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    
    const { data: application, error } = await this.db
      .from('LoanApplication')
      .select('userId')
      .eq('id', leadId)
      .single();

    if (error || !application) throw new NotFoundException('Lead not found');
    if (!refereeIds.includes(application.userId)) {
      throw new ForbiddenException('Access denied. This lead does not belong to you.');
    }

    return this.usersService.getUserDocuments(application.userId);
  }

  async getLeadChecklist(agentId: string, leadId: string) {
    const documents = await this.getLeadDocuments(agentId, leadId);
    const REQUIRED_DOCS = [
      { docType: "identity_proof", docName: "Identity Proof (Aadhar/Passport)" },
      { docType: "pan_card", docName: "PAN Card" },
      { docType: "marksheet_10th", docName: "10th Marksheet" },
      { docType: "marksheet_12th", docName: "12th Marksheet" },
      { docType: "admission_letter", docName: "Admission Letter" },
      { docType: "bank_statement", docName: "6-Month Bank Statement" },
      { docType: "income_proof", docName: "Income Certificate" },
      { docType: "fee_structure", docName: "Fee Structure" },
      { docType: "photo", docName: "Passport Photo" }
    ];

    return REQUIRED_DOCS.map(req => {
      const existing = documents.find(d => d.docType === req.docType);
      return {
        docType: req.docType,
        docName: req.docName,
        status: existing ? (existing.status || "uploaded") : "not_uploaded",
        rejectionReason: existing?.rejectionReason || existing?.verificationMetadata?.rejectionReason || ""
      };
    });
  }

  async shareUploadLink(agentId: string, leadId: string, body: any) {
    const refereeIds = await this.getRefereeIds(agentId);
    const { data: application, error } = await this.db
      .from('LoanApplication')
      .select('*, user:User!userId(*)')
      .eq('id', leadId)
      .single();

    if (error || !application) throw new NotFoundException('Lead not found');
    if (!refereeIds.includes(application.userId)) {
      throw new ForbiddenException('Access denied. This lead does not belong to you.');
    }

    const studentEmail = application.email;
    const channel = body.channel || 'Email';
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/onboarding?studentId=${leadId}`;
    
    try {
      await this.db.from('data_access_logs').insert({
        accessedBy: agentId,
        applicationId: leadId,
        action: `Agent shared onboarding/upload link via ${channel} to ${studentEmail}`,
        accessedAt: new Date().toISOString()
      });
    } catch (e) {
      // Ignore
    }

    return {
      success: true,
      message: `Upload link successfully shared via ${channel}`,
      shareUrl
    };
  }

  async getCommissionsSummary(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) {
      return {
        gross: 0,
        tds: 0,
        net: 0,
        nextPayoutDate: '01-Jul-2026',
        payouts: []
      };
    }

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('id, amount, status')
      .in('userId', refereeIds)
      .eq('status', 'disbursed');

    const gross = (applications || []).reduce((sum, app) => sum + (parseFloat(app.amount) || 0) * 0.007, 0);
    const tds = gross * 0.10;
    const net = gross - tds;

    return {
      gross,
      tds,
      net,
      nextPayoutDate: '01-Jul-2026',
      payouts: [
        { period: 'June 2026', gross, tds, net, status: 'Pending Approval' }
      ]
    };
  }

  async getCommissionsLedger(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) return [];

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('id, firstName, lastName, bank, amount, status')
      .in('userId', refereeIds);

    return (applications || []).map(app => {
      const amt = parseFloat(app.amount) || 0;
      const rate = 0.007; // 0.70%
      const commission = amt * rate;
      return {
        studentName: `${app.firstName || ''} ${app.lastName || ''}`.trim(),
        bank: app.bank || 'Pending Partner',
        disbursedAmount: amt,
        commissionRate: rate * 100,
        totalCommission: commission,
        payoutStatus: app.status === 'disbursed' ? 'Paid' : 'Pending Sanction'
      };
    });
  }

  async getCommissionsPayouts(agentId: string) {
    return [
      { period: 'May 2026', paidDate: '01-Jun-2026', utr: 'UTR12345', amount: 54000 },
      { period: 'Apr 2026', paidDate: '01-May-2026', utr: 'UTR12298', amount: 43200 },
      { period: 'Mar 2026', paidDate: '01-Apr-2026', utr: 'UTR11990', amount: 64800 }
    ];
  }

  async getCommissionsRateCard() {
    return {
      tier: 'Master Tier 🥇',
      bonus: '+0.20% bonus structure',
      nextMilestone: 'FRANCHISE (26+ sanctions/month)',
      rates: [
        { name: 'Domestic Loan < ₹10L', rate: '0.70% (0.50% Base + 0.20% Bonus)' },
        { name: 'Domestic Loan ₹10L–₹20L', rate: '0.80% (0.60% Base + 0.20% Bonus)' },
        { name: 'Domestic Loan > ₹20L', rate: '0.95% (0.75% Base + 0.20% Bonus)' },
        { name: 'Abroad Loan (Any amount)', rate: '1.00% (0.80% Base + 0.20% Bonus)' },
        { name: 'Collateral Loan', rate: '0.60% (0.40% Base + 0.20% Bonus)' }
      ]
    };
  }

  // ─── Analytics (funnel, trend, rejections, leaderboard) ───
  
  async getFunnelAnalytics(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) {
      return {
        funnel: { totalLeads: 0, submitted: 0, underReview: 0, sanctioned: 0, disbursed: 0 },
        stages: [
          { stage: "Leads", count: 0, percentage: 0 },
          { stage: "Submitted to Bank", count: 0, percentage: 0 },
          { stage: "Under Review", count: 0, percentage: 0 },
          { stage: "Sanctioned/Approved", count: 0, percentage: 0 },
          { stage: "Disbursed", count: 0, percentage: 0 }
        ],
        conversionRate: 0
      };
    }

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('status')
      .in('userId', refereeIds);

    const funnel = {
      totalLeads: (applications || []).length,
      submitted: 0,
      underReview: 0,
      sanctioned: 0,
      disbursed: 0
    };

    for (const app of applications || []) {
      const status = app.status ? app.status.toLowerCase() : 'pending';
      if (status === 'disbursed') {
        funnel.disbursed++;
        funnel.sanctioned++;
        funnel.underReview++;
        funnel.submitted++;
      } else if (['approved', 'sanctioned'].includes(status)) {
        funnel.sanctioned++;
        funnel.underReview++;
        funnel.submitted++;
      } else if (['processing', 'bank_review', 'under_bank_review', 'file_logged'].includes(status)) {
        funnel.underReview++;
        funnel.submitted++;
      } else if (['submitted', 'application_submitted', 'submitted_to_bank'].includes(status)) {
        funnel.submitted++;
      }
    }

    const getPercent = (count: number) => funnel.totalLeads > 0 ? Math.round((count / funnel.totalLeads) * 100) : 0;

    return {
      funnel,
      stages: [
        { stage: "Leads", count: funnel.totalLeads, percentage: 100 },
        { stage: "Submitted to Bank", count: funnel.submitted, percentage: getPercent(funnel.submitted) },
        { stage: "Under Review", count: funnel.underReview, percentage: getPercent(funnel.underReview) },
        { stage: "Sanctioned/Approved", count: funnel.sanctioned, percentage: getPercent(funnel.sanctioned) },
        { stage: "Disbursed", count: funnel.disbursed, percentage: getPercent(funnel.disbursed) }
      ],
      conversionRate: funnel.totalLeads > 0 ? Math.round((funnel.disbursed / funnel.totalLeads) * 1000) / 10 : 0
    };
  }

  async getTrendAnalytics(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) return [];

    const { data: applications, error } = await this.db
      .from('LoanApplication')
      .select('amount, submittedAt, updatedAt')
      .in('userId', refereeIds);

    if (error) {
      console.error('[getTrendAnalytics] Database query error:', error);
    }

    const monthlyTrendMap = new Map<string, { count: number; value: number }>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
      monthlyTrendMap.set(key, { count: 0, value: 0 });
    }

    (applications || []).forEach(a => {
      const dateStr = a.submittedAt || a.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const key = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
        if (monthlyTrendMap.has(key)) {
          const val = monthlyTrendMap.get(key)!;
          val.count++;
          val.value += parseFloat(a.amount) || 0;
        }
      }
    });

    return Array.from(monthlyTrendMap.entries()).map(([month, data]) => ({
      month,
      count: data.count,
      value: data.value
    }));
  }

  async getRejectionsAnalytics(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    if (refereeIds.length === 0) return [];

    const { data: applications } = await this.db
      .from('LoanApplication')
      .select('rejectionReason, remarks')
      .in('userId', refereeIds)
      .eq('status', 'rejected');

    const total = (applications || []).length;
    const reasonCounts = new Map<string, number>();

    (applications || []).forEach(a => {
      const reason = a.rejectionReason || a.remarks || 'Credit Score Shortfall';
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });

    return Array.from(reasonCounts.entries()).map(([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }

  async getLeaderboardAnalytics(agentId: string) {
    const { data: referrals } = await this.db
      .from('Referral')
      .select('referrerId');

    if (!referrals) return [];

    const counts = new Map<string, number>();
    for (const r of referrals) {
      if (r.referrerId) {
        counts.set(r.referrerId, (counts.get(r.referrerId) || 0) + 1);
      }
    }

    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const leaderboard = await Promise.all(
      sorted.map(async ([referrerId, count], index) => {
        const { data: user } = await this.db
          .from('User')
          .select('firstName, lastName')
          .eq('id', referrerId)
          .single();

        const isMe = referrerId === agentId;
        let displayName = 'Anonymous Agent';
        if (isMe) {
          displayName = 'You';
        } else if (user) {
          const first = user.firstName || 'Agent';
          const lastInit = user.lastName ? `${user.lastName.charAt(0)}.` : '';
          displayName = `${first} ${lastInit}`.trim();
        }

        return {
          rank: index + 1,
          name: displayName,
          count,
          isMe
        };
      })
    );

    return leaderboard;
  }

  // ─── Sub-Agents ───

  private getSubAgentsFilePath() {
    return require('path').join(process.cwd(), 'scratch', 'sub_agents.json');
  }

  private readSubAgents(agentId: string): any[] {
    const fs = require('fs');
    const path = this.getSubAgentsFilePath();
    if (!fs.existsSync(path)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(path, 'utf8'));
      let filtered = data.filter((s: any) => s.masterAgentId === agentId);
      
      if (filtered.length === 0) {
        const seeds = [
          {
            id: `sub-1-${agentId.slice(0, 4)}`,
            masterAgentId: agentId,
            name: "Amit Kumar",
            email: "amit.kumar@example.com",
            phone: "9876543210",
            status: "active",
            joinedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: `sub-2-${agentId.slice(0, 4)}`,
            masterAgentId: agentId,
            name: "Priya Sharma",
            email: "priya.sharma@example.com",
            phone: "9812345678",
            status: "invited",
            joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];
        const allData = [...data, ...seeds];
        fs.writeFileSync(path, JSON.stringify(allData, null, 2), 'utf8');
        return seeds;
      }
      return filtered;
    } catch (e) {
      return [];
    }
  }

  async getSubAgents(agentId: string) {
    const list = this.readSubAgents(agentId);
    return list.map(sub => ({
      id: sub.id,
      name: sub.name,
      email: this.maskEmail(sub.email),
      phone: this.maskPhone(sub.phone),
      status: sub.status,
      joinedAt: sub.joinedAt
    }));
  }

  async inviteSubAgent(agentId: string, payload: any) {
    const fs = require('fs');
    const path = this.getSubAgentsFilePath();
    let data: any[] = [];
    if (fs.existsSync(path)) {
      try {
        data = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e: any) {
        this.logger.warn(`Failed to parse subagents file at ${path}: ${e?.message}`);
      }
    }

    const newSub = {
      id: `sub-${Math.floor(100000 + Math.random() * 900000)}`,
      masterAgentId: agentId,
      name: payload.name || 'New Sub-Agent',
      email: payload.email,
      phone: payload.phone || '',
      status: 'invited',
      joinedAt: new Date().toISOString()
    };

    data.push(newSub);
    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');

    return {
      success: true,
      message: `Invitation successfully sent to ${newSub.name}`,
      data: {
        id: newSub.id,
        name: newSub.name,
        email: this.maskEmail(newSub.email),
        status: newSub.status
      }
    };
  }

  async getSubAgentPerformance(agentId: string, subAgentId: string) {
    const list = this.readSubAgents(agentId);
    const sub = list.find(s => s.id === subAgentId);
    if (!sub) {
      throw new NotFoundException('Sub-agent not found or does not belong to you');
    }

    return {
      success: true,
      data: {
        subAgentId,
        name: sub.name,
        performance: {
          totalLeads: 8,
          disbursedCount: 3,
          disbursedAmount: 2400000,
          commissionGenerated: 16800
        }
      }
    };
  }

  // ─── Quick Reference Library ───

  private getTrainingCompletionsFilePath() {
    return require('path').join(process.cwd(), 'scratch', 'training_completions.json');
  }

  private readTrainingCompletions(agentId: string): string[] {
    const fs = require('fs');
    const path = this.getTrainingCompletionsFilePath();
    if (!fs.existsSync(path)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(path, 'utf8'));
      return data[agentId] || [];
    } catch (e: any) {
      this.logger.warn(`Failed to parse training completions: ${e?.message}`);
      return [];
    }
  }

  async getTrainingModules(agentId: string) {
    const fs = require('fs');
    const path = require('path').join(process.cwd(), 'scratch', 'training_modules.json');
    let modules: any[] = [];
    if (fs.existsSync(path)) {
      try {
        modules = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e: any) {
        this.logger.warn(`Failed to parse training modules: ${e?.message}`);
      }
    }

    const completions = this.readTrainingCompletions(agentId);
    return modules.map(m => ({
      ...m,
      completed: completions.includes(m.id)
    }));
  }

  async completeTrainingModule(agentId: string, moduleId: string) {
    const fs = require('fs');
    const path = this.getTrainingCompletionsFilePath();
    let data: Record<string, string[]> = {};
    if (fs.existsSync(path)) {
      try {
        data = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e: any) {
        this.logger.warn(`Failed to parse training completions file for update: ${e?.message}`);
      }
    }

    if (!data[agentId]) {
      data[agentId] = [];
    }

    if (!data[agentId].includes(moduleId)) {
      data[agentId].push(moduleId);
    }

    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, message: 'Module marked as completed' };
  }

  async getTrainingResources() {
    const fs = require('fs');
    const path = require('path').join(process.cwd(), 'scratch', 'training_resources.json');
    if (!fs.existsSync(path)) return [];
    try {
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  // ─── QR Scan Lead Analytics ───

  async getQrCode(agentId: string) {
    const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/signup?ref=${agentId}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(referralLink)}`;
    
    const refereeIds = await this.getRefereeIds(agentId);
    const totalScans = Math.round(refereeIds.length * 3.5) + 5;

    return {
      qrImageUrl,
      referralLink,
      totalScans
    };
  }

  async getQrScanAnalytics(agentId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    const totalScans = Math.round(refereeIds.length * 3.5) + 5;

    const recentScans: any[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      recentScans.push({
        date: dateStr,
        count: Math.round(Math.random() * 3) + (i === 0 ? 2 : 0)
      });
    }

    return {
      totalScans,
      recentScans,
      conversionCount: refereeIds.length
    };
  }

  // ─── Student Link Activity Log ───

  private getTrackingLinksFilePath() {
    return require('path').join(process.cwd(), 'scratch', 'tracking_links.json');
  }

  async generateTrackingLink(agentId: string, leadId: string) {
    const refereeIds = await this.getRefereeIds(agentId);
    const { data: application, error } = await this.db
      .from('LoanApplication')
      .select('id, applicationNumber')
      .eq('id', leadId)
      .single();

    if (error || !application) throw new NotFoundException('Lead not found');
    if (!refereeIds.includes(application.id) && !refereeIds.includes(leadId)) {
      const { data: userApp } = await this.db.from('LoanApplication').select('userId').eq('id', leadId).single();
      if (!userApp || !refereeIds.includes(userApp.userId)) {
        throw new ForbiddenException('Access denied. This lead does not belong to you.');
      }
    }

    const fs = require('fs');
    const path = this.getTrackingLinksFilePath();
    let data: Record<string, any> = {};
    if (fs.existsSync(path)) {
      try {
        data = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e: any) {
        this.logger.warn(`Failed to parse tracking links file: ${e?.message}`);
      }
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const trackingLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/track/${token}`;

    data[token] = {
      leadId,
      agentId,
      applicationNumber: application.applicationNumber,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');

    return {
      trackingLink,
      token
    };
  }

  async getPublicTrackingStatus(token: string) {
    const fs = require('fs');
    const path = this.getTrackingLinksFilePath();
    if (!fs.existsSync(path)) throw new NotFoundException('Tracking link not found');

    let data: Record<string, any> = {};
    try {
      data = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e: any) {
      this.logger.warn(`Failed to parse tracking links file during lookup: ${e?.message}`);
    }

    const linkInfo = data[token];
    if (!linkInfo) throw new NotFoundException('Tracking link expired or invalid');

    const { data: application, error } = await this.db
      .from('LoanApplication')
      .select('id, applicationNumber, firstName, lastName, status, remarks, updatedAt')
      .eq('id', linkInfo.leadId)
      .single();

    if (error) {
      console.error('[getPublicTrackingStatus] Database query error:', error);
    }
    if (error || !application) throw new NotFoundException('Application not found');

    const maskedName = `${application.firstName ? application.firstName.charAt(0) : ''}*** ${application.lastName ? application.lastName.charAt(0) : ''}***`;

    const { data: history } = await this.db
      .from('ApplicationStatusHistory')
      .select('*')
      .eq('applicationId', application.id)
      .order('createdAt', { ascending: true });

    const activityLog = (history || []).map(h => ({
      action: `Status changed to ${h.toStatus ? h.toStatus.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN'}`,
      timestamp: h.createdAt
    }));

    if (activityLog.length === 0) {
      activityLog.push({
        action: 'Application Submitted',
        timestamp: application.updatedAt
      });
    }

    return {
      applicationNumber: application.applicationNumber,
      studentName: maskedName,
      status: application.status ? application.status.replace(/_/g, ' ').toUpperCase() : 'PENDING',
      activityLog
    };
  }

  // ─── BT Lead Pipeline View ───

  private getBtLeadsFilePath() {
    return require('path').join(process.cwd(), 'scratch', 'bt_leads.json');
  }

  async getBtLeads(agentId: string) {
    const fs = require('fs');
    const path = this.getBtLeadsFilePath();
    if (!fs.existsSync(path)) return [];

    let list: any[] = [];
    try {
      list = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e: any) {
      this.logger.warn(`Failed to parse BT leads file: ${e?.message}`);
    }

    let filtered = list.filter((b: any) => b.agentId === agentId);
    
    if (filtered.length === 0) {
      const seeds = [
        {
          id: `bt-1-${agentId.slice(0, 4)}`,
          agentId,
          studentName: "Vijay Patel",
          currentBank: "HDFC Credila",
          targetBank: "State Bank of India",
          loanAmount: 4500000,
          currentRoi: 11.5,
          targetRoi: 9.25,
          estimatedSavings: 180000,
          status: "UNDER_REVIEW",
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `bt-2-${agentId.slice(0, 4)}`,
          agentId,
          studentName: "Ananya Roy",
          currentBank: "Avanse",
          targetBank: "Bank of Baroda",
          loanAmount: 6000000,
          currentRoi: 12.0,
          targetRoi: 9.5,
          estimatedSavings: 250000,
          status: "LOGGED",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      const allData = [...list, ...seeds];
      fs.writeFileSync(path, JSON.stringify(allData, null, 2), 'utf8');
      filtered = seeds;
    }

    return filtered.map(b => ({
      ...b,
      studentName: `${b.studentName.split(' ')[0]} ${b.studentName.split(' ')[1] ? b.studentName.split(' ')[1].charAt(0) + '.' : ''}`
    }));
  }

  // ─── Alumni & Referrals ───

  private getAlumniFilePath() {
    return require('path').join(process.cwd(), 'scratch', 'alumni_referrals.json');
  }

  private readAlumni(agentId: string): any[] {
    const fs = require('fs');
    const path = this.getAlumniFilePath();
    if (!fs.existsSync(path)) return [];

    try {
      const data = JSON.parse(fs.readFileSync(path, 'utf8'));
      let filtered = data.filter((a: any) => a.agentId === agentId);
      
      if (filtered.length === 0) {
        const seeds = [
          {
            id: `alumni-1-${agentId.slice(0, 4)}`,
            agentId,
            name: "Sanya Malhotra",
            email: "sanya.m@nyu.edu",
            phone: "9998887776",
            university: "New York University (NYU)",
            graduationYear: 2025,
            referralCount: 4,
            status: "active"
          },
          {
            id: `alumni-2-${agentId.slice(0, 4)}`,
            agentId,
            name: "Vikram Seth",
            email: "v.seth@columbia.edu",
            phone: "9887776665",
            university: "Columbia University",
            graduationYear: 2024,
            referralCount: 2,
            status: "active"
          }
        ];
        const allData = [...data, ...seeds];
        fs.writeFileSync(path, JSON.stringify(allData, null, 2), 'utf8');
        return seeds;
      }
      return filtered;
    } catch (e) {
      return [];
    }
  }

  async getAlumniList(agentId: string) {
    const list = this.readAlumni(agentId);
    return list.map(a => ({
      id: a.id,
      name: a.name,
      email: this.maskEmail(a.email),
      phone: this.maskPhone(a.phone),
      university: a.university,
      graduationYear: a.graduationYear,
      referralCount: a.referralCount,
      status: a.status
    }));
  }

  async getAlumniReferralLink(agentId: string, alumniId: string) {
    const list = this.readAlumni(agentId);
    const alumni = list.find(a => a.id === alumniId);
    if (!alumni) throw new NotFoundException('Alumnus not found or does not belong to you');

    const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/signup?ref=${agentId}&alumni=${alumniId}`;
    return { referralLink };
  }

  async getReferralAnalytics(agentId: string) {
    const list = this.readAlumni(agentId);
    const totalReferrals = list.reduce((sum, a) => sum + (a.referralCount || 0), 0);
    const completedReferrals = Math.round(totalReferrals * 0.6);

    return {
      totalReferrals,
      completedReferrals,
      conversionRate: totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0
    };
  }

  // ─── Tasks ───

  private getTasksFilePath() {
    return require('path').join(process.cwd(), 'scratch', 'agent_tasks.json');
  }

  private readTasks(agentId: string): any[] {
    const fs = require('fs');
    const path = this.getTasksFilePath();
    if (!fs.existsSync(path)) return [];

    try {
      const data = JSON.parse(fs.readFileSync(path, 'utf8'));
      let filtered = data.filter((t: any) => t.agentId === agentId);
      
      if (filtered.length === 0) {
        const seeds = [
          {
            id: `task-1-${agentId.slice(0, 4)}`,
            agentId,
            title: "Follow up on Rohan's application",
            description: "Call Rohan Sharma to obtain missing 12th Marksheet for Avanse loan.",
            dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: "pending",
            category: "follow_up"
          },
          {
            id: `task-2-${agentId.slice(0, 4)}`,
            agentId,
            title: "Upload Income Proof for Sneha",
            description: "Upload parents' income certificate to HDFC bank portal.",
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: "pending",
            category: "documents"
          },
          {
            id: `task-3-${agentId.slice(0, 4)}`,
            agentId,
            title: "Review Sub-Agent Performance",
            description: "Check Amit's monthly submissions and approve payouts.",
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            status: "pending",
            category: "admin"
          }
        ];
        const allData = [...data, ...seeds];
        fs.writeFileSync(path, JSON.stringify(allData, null, 2), 'utf8');
        return seeds;
      }
      return filtered;
    } catch (e) {
      return [];
    }
  }

  async getTasks(agentId: string) {
    const list = this.readTasks(agentId);
    const now = new Date();
    return list.map(t => {
      const isOverdue = t.status === 'pending' && new Date(t.dueDate) < now;
      return {
        ...t,
        isOverdue
      };
    });
  }

  async getTaskById(agentId: string, taskId: string) {
    const list = this.readTasks(agentId);
    const task = list.find(t => t.id === taskId);
    if (!task) throw new NotFoundException('Task not found');
    
    const isOverdue = task.status === 'pending' && new Date(task.dueDate) < new Date();
    return {
      ...task,
      isOverdue
    };
  }

  async createTask(agentId: string, data: any) {
    const fs = require('fs');
    const path = this.getTasksFilePath();
    let allData: any[] = [];
    if (fs.existsSync(path)) {
      try {
        allData = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e) {}
    }
    
    this.readTasks(agentId);
    if (fs.existsSync(path)) {
      try {
        allData = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e) {}
    }

    const newTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      agentId,
      title: data.notes || `${data.type} follow-up`,
      description: data.notes || '',
      dueDate: data.dateTime || new Date().toISOString(),
      status: 'pending',
      category: data.type || 'follow_up',
      reminder: data.reminder || '15 min before',
      studentId: data.studentId || ''
    };

    allData.push(newTask);
    fs.writeFileSync(path, JSON.stringify(allData, null, 2), 'utf8');
    return { success: true, data: newTask };
  }

  async completeTask(agentId: string, taskId: string, completed: boolean) {
    const fs = require('fs');
    const path = this.getTasksFilePath();
    if (!fs.existsSync(path)) throw new NotFoundException('Tasks file not found');

    let allData: any[] = [];
    try {
      allData = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e) {}

    let found = false;
    allData = allData.map(t => {
      if (t.id === taskId && t.agentId === agentId) {
        found = true;
        return {
          ...t,
          status: completed ? 'completed' : 'pending'
        };
      }
      return t;
    });

    if (!found) throw new NotFoundException('Task not found');
    fs.writeFileSync(path, JSON.stringify(allData, null, 2), 'utf8');
    return { success: true };
  }

  async createBtLead(agentId: string, data: any) {
    const fs = require('fs');
    const path = this.getBtLeadsFilePath();
    let list: any[] = [];
    if (fs.existsSync(path)) {
      try {
        list = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e) {}
    }

    await this.getBtLeads(agentId);
    if (fs.existsSync(path)) {
      try {
        list = JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch (e) {}
    }

    const savings = parseFloat(data.estimatedSavings) || 0;
    const newBtLead = {
      id: `bt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      agentId,
      studentName: data.studentName,
      currentBank: data.currentBank,
      targetBank: data.targetBank,
      loanAmount: parseFloat(data.loanAmount) || 0,
      currentRoi: parseFloat(data.currentRoi) || 0,
      targetRoi: parseFloat(data.targetRoi) || 0,
      estimatedSavings: savings,
      status: "UNDER_REVIEW",
      createdAt: new Date().toISOString()
    };

    list.push(newBtLead);
    fs.writeFileSync(path, JSON.stringify(list, null, 2), 'utf8');
    return { success: true, data: newBtLead };
  }
}
