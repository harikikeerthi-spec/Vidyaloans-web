import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DigilockerService } from '../integration/digilocker.service';
import { DocumentVerificationService } from '../ai/services/document-verification.service';
import { ApplicationReviewService } from '../ai/services/application-review.service';
import { EmailService } from '../auth/email.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EvvEngineService } from './evv-engine';
import { BankWorkflowService } from '../bank/bank-workflow.service';
import { S3Service } from '../document/s3.service';
import * as path from 'path';
import * as fs from 'fs';
import { AssignmentService } from '../assignment/assignment.service';

const APPLICATION_STAGES = {
  application_submitted: { order: 1, label: 'Application Submitted', progress: 10 },
  document_verification: { order: 2, label: 'Documents', progress: 30 },
  credit_check: { order: 3, label: 'Credit Check', progress: 50 },
  bank_review: { order: 4, label: 'Bank Review', progress: 70 },
  sanction: { order: 5, label: 'Sanction', progress: 90 },
  disbursement: { order: 6, label: 'Disbursement', progress: 100 },
};

const REQUIRED_DOCUMENTS = {
  education: [
    { docType: 'identity_proof', docName: 'Identity Proof (Aadhar/Passport)', isRequired: true },
    { docType: 'address_proof', docName: 'Address Proof', isRequired: true },
    { docType: 'photo', docName: 'Passport Size Photo', isRequired: true },
    { docType: 'admission_letter', docName: 'Admission Letter', isRequired: true },
    { docType: 'fee_structure', docName: 'Fee Structure', isRequired: true },
    { docType: 'academic_records', docName: '10th & 12th Marksheets', isRequired: true },
    { docType: 'income_proof', docName: 'Co-Applicant Income Proof', isRequired: false },
    { docType: 'bank_statement', docName: 'Bank Statements (6 months)', isRequired: false },
  ],
  home: [
    { docType: 'identity_proof', docName: 'Identity Proof (Aadhar/PAN)', isRequired: true },
    { docType: 'address_proof', docName: 'Address Proof', isRequired: true },
    { docType: 'income_proof', docName: 'Income Proof', isRequired: true },
    { docType: 'bank_statement', docName: 'Bank Statements (6 months)', isRequired: true },
    { docType: 'property_documents', docName: 'Property Documents', isRequired: true },
    { docType: 'salary_slips', docName: 'Salary Slips (3 months)', isRequired: true },
  ],
  personal: [
    { docType: 'identity_proof', docName: 'Identity Proof (Aadhar/PAN)', isRequired: true },
    { docType: 'address_proof', docName: 'Address Proof', isRequired: true },
    { docType: 'income_proof', docName: 'Income Proof', isRequired: true },
    { docType: 'bank_statement', docName: 'Bank Statements (3 months)', isRequired: true },
  ],
  business: [
    { docType: 'identity_proof', docName: 'Identity Proof (Aadhar/PAN)', isRequired: true },
    { docType: 'address_proof', docName: 'Business Address Proof', isRequired: true },
    { docType: 'business_registration', docName: 'Business Registration', isRequired: true },
    { docType: 'financial_statements', docName: 'Financial Statements', isRequired: true },
    { docType: 'bank_statement', docName: 'Bank Statements (12 months)', isRequired: true },
    { docType: 'itr', docName: 'ITR (3 years)', isRequired: true },
  ],
  vehicle: [
    { docType: 'identity_proof', docName: 'Identity Proof (Aadhar/PAN)', isRequired: true },
    { docType: 'address_proof', docName: 'Address Proof', isRequired: true },
    { docType: 'income_proof', docName: 'Income Proof', isRequired: true },
    { docType: 'bank_statement', docName: 'Bank Statements (3 months)', isRequired: true },
    { docType: 'vehicle_quotation', docName: 'Vehicle Quotation', isRequired: true },
  ],
};

@Injectable()
export class ApplicationService {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(
    private supabase: SupabaseService,
    private digilockerService: DigilockerService,
    private verificationService: DocumentVerificationService,
    private applicationReviewService: ApplicationReviewService,
    private emailService: EmailService,
    private eventEmitter: EventEmitter2,
    private s3Service: S3Service,
    private evvEngine: EvvEngineService,
    private workflowService: BankWorkflowService,
    private assignmentService: AssignmentService,
  ) { }

  private parseDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const trimmed = String(dateStr).trim();
    if (!trimmed) return null;

    // Try native parsing first
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      if (year >= 1900 && year <= 2100) return d.toISOString();
    }

    // Try DD-MM-YYYY or DD/MM/YYYY
    const parts = trimmed.split(/[-/]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year >= 1900 && year <= 2100) {
        const parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) return parsedDate.toISOString();
      }
    }

    return null;
  }

  private isCountryUniversityMismatch(selectedCountry: string | null | undefined, universityName: string | null | undefined): { isMismatch: boolean; detectedCountry?: string } {
    if (!selectedCountry || !universityName) return { isMismatch: false };

    const normalizeCountry = (c: string) => {
      const low = (c || '').toLowerCase().trim();
      if (low.includes('usa') || low.includes('united states') || low.includes('america')) return 'USA';
      if (low.includes('uk') || low.includes('united kingdom') || low.includes('britain') || low.includes('england') || low.includes('scotland') || low.includes('wales')) return 'UK';
      if (low.includes('canada')) return 'Canada';
      if (low.includes('australia')) return 'Australia';
      if (low.includes('germany') || low.includes('deutschland')) return 'Germany';
      if (low.includes('ireland')) return 'Ireland';
      if (low.includes('new zealand')) return 'New Zealand';
      if (low.includes('france')) return 'France';
      if (low.includes('singapore')) return 'Singapore';
      if (low.includes('india')) return 'India';
      return c.trim();
    };

    const normTargetCountry = normalizeCountry(selectedCountry);
    const uni = universityName.toLowerCase().trim();

    const KNOWN_UNIVERSITIES: { country: string; keywords: string[] }[] = [
      {
        country: 'USA',
        keywords: [
          'harvard', 'stanford', 'mit', 'massachusetts institute of technology', 'columbia university',
          'nyu', 'new york university', 'cornell', 'yale', 'princeton', 'ucla', 'uc berkeley',
          'northeastern university', 'usc', 'university of southern california', 'carnegie mellon',
          'purdue', 'texas a&m', 'university of texas', 'georgia tech', 'penn state', 'northwestern',
          'johns hopkins', 'duke', 'chicago', 'arizona state', 'boston university'
        ],
      },
      {
        country: 'UK',
        keywords: [
          'oxford', 'cambridge', 'imperial college', 'ucl', 'university college london',
          'king\'s college london', 'kcl', 'university of edinburgh', 'university of manchester',
          'warwick', 'bristol', 'glasgow', 'birmingham', 'leeds', 'sheffield', 'nottingham'
        ],
      },
      {
        country: 'Canada',
        keywords: [
          'university of toronto', 'ubc', 'university of british columbia', 'mcgill',
          'waterloo', 'mcmaster', 'university of alberta', 'western university', 'simon fraser',
          'concordia', 'york university'
        ],
      },
      {
        country: 'Australia',
        keywords: [
          'university of melbourne', 'university of sydney', 'unsw', 'university of new south wales',
          'monash', 'university of queensland', 'anu', 'australian national university',
          'western australia', 'adelaide'
        ],
      },
      {
        country: 'Germany',
        keywords: [
          'tum', 'technical university of munich', 'lmu munich', 'rwth aachen',
          'heidelberg university', 'hu berlin', 'humboldt', 'free university of berlin',
          'university of stuttgart', 'tu darmstadt', 'tu dresden', 'bonn', 'karlsruhe'
        ],
      },
      {
        country: 'Ireland',
        keywords: [
          'trinity college dublin', 'tcd', 'university college dublin', 'ucd',
          'university of galway', 'university of limerick', 'dcu', 'dublin city university'
        ],
      },
    ];

    for (const group of KNOWN_UNIVERSITIES) {
      if (group.keywords.some(kw => uni.includes(kw))) {
        if (group.country !== normTargetCountry) {
          return { isMismatch: true, detectedCountry: group.country };
        }
      }
    }

    return { isMismatch: false };
  }

  private async validateApplicationConstraints(userId: string, currentAppId: string | null, bank: string, country: string, universityName: string, isStaffOrAdmin: boolean = false) {
    const { data: existingApps, error } = await this.db
      .from('LoanApplication')
      .select('id, bank, country, universityName, status')
      .eq('userId', userId)
      .neq('status', 'cancelled')
      .neq('status', 'rejected');

    if (error) throw error;

    // Limit to 1 active application per student for self-service student applications (bypassed for Staff/Admin)
    if (!isStaffOrAdmin && !currentAppId && existingApps && existingApps.length >= 1) {
      throw new BadRequestException('Only 1 active loan application is permitted per student. You already have an application in progress.');
    }

    // Check Country vs. University matching constraint
    const mismatch = this.isCountryUniversityMismatch(country, universityName);
    if (mismatch.isMismatch) {
      throw new BadRequestException(
        `Validation Error: "${universityName}" is located in ${mismatch.detectedCountry}, which does not match your selected destination country (${country}). Please select a university in ${country} or update the destination country.`
      );
    }

    // 2. Check duplicate details for the same bank
    if (!isStaffOrAdmin && bank && bank !== 'Any Bank' && bank !== 'ANY BANK' && bank !== '—' && bank !== 'Pending Partner') {
      const duplicate = existingApps?.find(app => {
        if (currentAppId && app.id === currentAppId) return false;

        const normalize = (b: string) => {
            const low = String(b || '').toLowerCase().trim();
            if (low.includes('hdfc') || low.includes('credila')) return 'hdfc';
            if (low.includes('idfc')) return 'idfc';
            if (low.includes('auxilo')) return 'auxilo';
            if (low.includes('avanse')) return 'avanse';
            if (low.includes('poonawalla')) return 'poonawalla';
            return low;
        };

        const existingNorm = normalize(app.bank || '');
        const targetNorm = normalize(bank);

        return existingNorm !== 'any bank' && existingNorm !== '—' && existingNorm !== 'pending partner' && existingNorm === targetNorm;
      });

      if (duplicate) {
        throw new BadRequestException(`An active application to ${bank} already exists for this student. You cannot apply to the same bank twice.`);
      }
    }
  }

  async createApplication(userId: string, data: any, isStaffOrAdmin: boolean = false) {
    const targetBank = data.bank;
    const targetCountry = data.country;
    const targetUniversity = data.universityName || data.university;

    await this.validateApplicationConstraints(userId, null, targetBank, targetCountry, targetUniversity, isStaffOrAdmin);

    const estimatedCompletionAt = new Date();
    estimatedCompletionAt.setDate(estimatedCompletionAt.getDate() + 14);

    const insertPayload: any = {
        userId,
        // applicationNumber is intentionally NOT set here.
        // It will be assigned only when staff submits to a bank (submitApplicationToBank).
        bank: data.bank,
        loanType: data.loanType,
        amount: parseFloat(data.amount),
        tenure: data.tenure ? parseInt(data.tenure) : null,
        purpose: data.purpose,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: this.parseDate(data.dateOfBirth),

        gender: data.gender,
        nationality: data.nationality,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        country: data.country,
        employmentType: data.employmentType,
        employerName: data.employerName,
        jobTitle: data.jobTitle,
        annualIncome: data.annualIncome ? parseFloat(data.annualIncome) : null,
        workExperience: data.workExperience ? parseInt(data.workExperience) : null,
        universityName: data.universityName || data.university,
        courseName: data.courseName || data.courseType || data.course,
        courseDuration: data.courseDuration ? parseInt(data.courseDuration) : null,
        courseStartDate: this.parseDate(data.courseStartDate),

        admissionStatus: data.admissionStatus,
        hasCoApplicant: data.hasCoApplicant || false,
        coApplicantName: data.coApplicantName,
        coApplicantRelation: data.coApplicantRelation,
        coApplicantPhone: data.coApplicantPhone,
        coApplicantEmail: data.coApplicantEmail,
        coApplicantIncome: data.coApplicantIncome ? parseFloat(data.coApplicantIncome) : null,
        fatherName: data.fatherName,
        fatherPhone: data.fatherPhone,
        fatherEmail: data.fatherEmail,
        motherName: data.motherName,
        motherPhone: data.motherPhone,
        motherEmail: data.motherEmail,
        hasCollateral: data.hasCollateral || false,
        collateralType: data.collateralType,
        collateralValue: data.collateralValue ? parseFloat(data.collateralValue) : null,
        collateralDetails: data.collateralDetails,
        status: data.status === 'draft' ? 'draft' : (data.status || 'submitted'),
        stage: 'application_submitted',
        progress: data.status === 'draft' ? 10 : 15,
        submittedAt: data.status === 'draft' ? null : new Date().toISOString(),
        estimatedCompletionAt: estimatedCompletionAt.toISOString(),
    };

    const { data: application, error } = await this.db
      .from('LoanApplication')
      .insert(insertPayload)
      .select('*, user:User!userId(id, email, firstName, lastName, tests)')
      .single();

    if (error) throw error;

    // Sync target intake, destination, and university to User profile
    const targetUni = data.universityName || data.university || data.targetUniversity;
    if (userId && (data.intakeSeason || data.country || targetUni)) {
      try {
        await this.db
          .from('User')
          .update({
            ...(data.intakeSeason ? { intakeSeason: data.intakeSeason } : {}),
            ...(data.country ? { studyDestination: data.country } : {}),
            ...(targetUni ? { targetUniversity: targetUni } : {}),
          })
          .eq('id', userId);
      } catch (err) {
        console.error('Failed to sync target intake/destination/university to User profile:', err);
      }
    }

    await this.createStatusHistory(application.id, { toStatus: application.status, toStage: application.stage, notes: 'Application created', isAutomatic: true });
    await this.initializeRequiredDocuments(application.id, application.userId, data.loanType);

    // Emit application created event for staff notifications ONLY if not a draft
    if (application.status !== 'draft') {
      try {
        const name = `${application.firstName || ''} ${application.lastName || ''}`.trim() || application.email || 'Student';
        this.eventEmitter.emit('application.created', {
          applicationId: application.id,
          applicationNumber: application.applicationNumber,
          userId: application.userId,
          candidateName: name,
          candidateEmail: application.email,
          bank: application.bank,
          loanAmount: application.amount,
          loanType: data.loanType,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('Failed to emit application.created event:', e);
      }

      // Emit live dashboard activity event for new application creation
      try {
        const name = `${application.firstName || ''} ${application.lastName || ''}`.trim() || application.email || 'Student';
        const targetUni = application.universityName || 'Target University';
        this.eventEmitter.emit('dashboard.activity', {
          type: 'application',
          msg: `Student ${name} submitted a new Loan Application for ${targetUni}.`,
          icon: 'assignment',
          color: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          actorName: name,
          actorEmail: application.email,
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('Failed to emit activity event for application creation:', e);
      }

      // Send loan submission email to the student
      try {
        const email = application.user?.email || application.email;
        if (email) {
          const firstName = application.firstName || application.user?.firstName || '';
          const lastName = application.lastName || application.user?.lastName || '';
          const userName = `${firstName} ${lastName}`.trim() || 'Student';
          const bankName = application.bank || 'our partner bank';
          await this.emailService.sendLoanSubmissionEmail(email, userName, bankName, application);
        }
      } catch (e) {
        console.error('Failed to send loan submission email on application creation:', e);
      }

      // Send loan tracking email to the registered student email
      try {
        const registeredEmail = application.user?.email || application.email;
        if (registeredEmail) {
          const firstName = application.user?.firstName || application.firstName || '';
          const lastName = application.user?.lastName || application.lastName || '';
          const userName = `${firstName} ${lastName}`.trim() || 'Student';
          const bankName = application.bank || 'our partner bank';
          await this.emailService.sendLoanTrackingEmail(registeredEmail, userName, bankName, application);
        }
      } catch (e) {
        console.error('Failed to send loan tracking email on application creation:', e);
      }

      // -------------------------------------------------------------
      // NEW: Auto-assign loan to eligible staff via AssignmentEngine
      // -------------------------------------------------------------
      try {
        await this.assignmentService.assignLoan(application.id, 'system');
      } catch (e) {
        console.error('Failed to auto-assign loan application:', e);
      }
    }

    return { success: true, data: application, message: 'Application created successfully' };
  }

  async submitApplication(applicationId: string, userId: string) {
    const application = await this.getApplicationById(applicationId);
    if (application.userId !== userId) throw new BadRequestException('Unauthorized to submit this application');
    if (application.status !== 'draft') throw new BadRequestException('Only draft applications can be submitted');

    const { data: updated, error } = await this.db
      .from('LoanApplication')
      .update({ status: 'submitted', submittedAt: new Date().toISOString(), progress: 15 })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    await this.createStatusHistory(applicationId, { fromStatus: 'draft', toStatus: 'submitted', notes: 'Application submitted for review', isAutomatic: true });

    // Emit live dashboard activity event for application submission!
    try {
      const name = `${application.firstName || ''} ${application.lastName || ''}`.trim() || application.email || 'Student';
      this.eventEmitter.emit('dashboard.activity', {
        type: 'application',
        msg: `Student ${name} submitted Application #${application.applicationNumber || application.id.slice(-4)} for review.`,
        icon: 'rocket_launch',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        actorName: name,
        actorEmail: application.email,
        createdAt: new Date().toISOString()
      });
      
      // Emit application submitted event for staff notifications
      this.eventEmitter.emit('application.submitted', {
        applicationId: application.id,
        applicationNumber: application.applicationNumber,
        userId: application.userId,
        candidateName: name,
        candidateEmail: application.email,
        bank: application.bank,
        loanAmount: application.amount,
        loanType: application.loanType,
        submittedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to emit events for application submission:', e);
    }

    // Send loan submission email to the student
    try {
      const email = application.user?.email || application.email;
      if (email) {
        const firstName = application.firstName || application.user?.firstName || '';
        const lastName = application.lastName || application.user?.lastName || '';
        const userName = `${firstName} ${lastName}`.trim() || 'Student';
        const bankName = application.bank || 'our partner bank';
        await this.emailService.sendLoanSubmissionEmail(email, userName, bankName, application);
      }
    } catch (e) {
      console.error('Failed to send loan submission email on application submission:', e);
    }

    // Send loan tracking email to the registered student email
    try {
      const registeredEmail = application.user?.email || application.email;
      if (registeredEmail) {
        const firstName = application.user?.firstName || application.firstName || '';
        const lastName = application.user?.lastName || application.lastName || '';
        const userName = `${firstName} ${lastName}`.trim() || 'Student';
        const bankName = application.bank || 'our partner bank';
        await this.emailService.sendLoanTrackingEmail(registeredEmail, userName, bankName, application);
      }
      } catch (e) {
        console.error('Failed to send loan tracking email on application submission:', e);
      }

      // -------------------------------------------------------------
      // NEW: Auto-assign loan to eligible staff via AssignmentEngine
      // -------------------------------------------------------------
      try {
        await this.assignmentService.assignLoan(applicationId, 'system');
      } catch (e) {
        console.error('Failed to auto-assign loan application on submission:', e);
      }

    return { success: true, data: updated, message: 'Application submitted successfully' };
  }

  async startApplicationReview(applicationId: string) {
    const now = new Date().toISOString();
    const { data: updated, error } = await this.db
      .from('LoanApplication')
      .update({ reviewStartedAt: now })
      .eq('id', applicationId)
      .select('*, user:User!userId(id, email, firstName, lastName, tests)')
      .single();

    if (error) throw error;

    // Send the email to the student
    try {
      const email = updated.user?.email || updated.email;
      if (email) {
        const firstName = updated.firstName || updated.user?.firstName || '';
        const lastName = updated.lastName || updated.user?.lastName || '';
        const userName = `${firstName} ${lastName}`.trim() || 'Student';
        await this.emailService.sendStaffReviewStartedEmail(email, userName, updated);
      }
    } catch (e) {
      console.error('Failed to send staff review started email:', e);
    }

    // Also add to status history
    try {
      await this.createStatusHistory(applicationId, {
        fromStatus: updated.status,
        toStatus: updated.status,
        fromStage: updated.stage,
        toStage: updated.stage,
        notes: 'VidyaLoan team started review of the application',
        isAutomatic: true
      });
    } catch (e) {
      console.error('Failed to record review start status history:', e);
    }

    return updated;
  }

  async getApplicationById(applicationId: string) {
    const { data: application } = await this.db
      .from('LoanApplication')
      .select('*, user:User!userId(id, email, firstName, lastName, phoneNumber, dateOfBirth, studyDestination, intakeSeason, tests, pincode), documents:ApplicationDocument(*), statusHistory:ApplicationStatusHistory(*), notes:ApplicationNote(id, content, type, isInternal, createdAt)')
      .eq('id', applicationId)
      .single();

    if (!application) throw new NotFoundException('Application not found');

    // Sort nested arrays
    if (application.documents) application.documents.sort((a: any, b: any) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
    if (application.statusHistory) application.statusHistory.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (application.notes) application.notes = application.notes.filter((n: any) => !n.isInternal).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Fetch related BankDecision and queries manually to prevent schema cache failures
    try {
      const [
        { data: bankDecisions },
        { data: queries },
        { data: bankQueries },
        { data: bankSubmissions }
      ] = await Promise.all([
        this.db.from('BankDecision').select('*').eq('applicationId', applicationId),
        this.db.from('queries').select('*').eq('applicationId', applicationId),
        this.db.from('BankQuery').select('*').eq('applicationId', applicationId),
        this.db.from('BankSubmission').select('*').eq('applicationId', applicationId)
      ]);
      application.BankDecision = bankDecisions || [];
      application.bankSubmissions = bankSubmissions || [];
      
      const allQueries = [...(queries || [])];
      if (bankQueries && bankQueries.length > 0) {
        bankQueries.forEach((bq: any) => {
          if (!allQueries.some(q => q.id === bq.id)) {
            allQueries.push({
              id: bq.id,
              authorName: bq.raisedBy || 'Banker',
              content: bq.description,
              status: bq.status?.toLowerCase() || 'open',
              createdAt: bq.raisedAt || bq.createdAt,
              resolvedAt: bq.resolvedAt,
              queryType: bq.queryType
            });
          }
        });
      }
      application.queries = allQueries;
    } catch (e) {
      console.error('Failed to load bank decisions and queries for application:', e);
      application.BankDecision = [];
      application.queries = [];
      application.bankSubmissions = [];
    }

    return application;
  }

  async getApplicationByNumber(applicationNumber: string) {
    const { data: application } = await this.db
      .from('LoanApplication')
      .select('*, user:User!userId(id, email, firstName, lastName, phoneNumber, dateOfBirth, studyDestination, intakeSeason, tests), documents:ApplicationDocument(*), statusHistory:ApplicationStatusHistory(*)')
      .eq('applicationNumber', applicationNumber)
      .single();

    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async getUserApplications(userId: string, filters?: { status?: string; loanType?: string; limit?: number; offset?: number }) {
    let query = this.db
      .from('LoanApplication')
      .select('*, documents:ApplicationDocument(id, docType, status)', { count: 'exact' })
      .eq('userId', userId)
      .order('submittedAt', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.loanType) query = query.eq('loanType', filters.loanType);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data: applications, count } = await query;
    let resultList = applications || [];

    if (resultList.length > 0) {
      try {
        const rawStaffIds = resultList.map((app: any) => app.assignedStaffId).filter(Boolean);
        const uniqueStaffIds = Array.from(new Set(rawStaffIds));

        if (uniqueStaffIds.length > 0) {
          const staffMap: Record<string, any> = {};

          const orConds = uniqueStaffIds.map((id: string) => id.includes('@') ? `email.eq.${id}` : `id.eq.${id}`).join(',');
          const { data: staffUsers, error: userQueryErr } = await this.db
            .from('User')
            .select('id, firstName, lastName, email, mobile, phoneNumber, role')
            .or(orConds);

          if (userQueryErr) {
            console.warn('[ApplicationService.getUserApplications] User query warning:', userQueryErr.message);
          }

          (staffUsers || []).forEach((u: any) => {
            const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Support Staff';
            const staffObj = {
              id: u.id,
              name: fullName,
              email: u.email || '',
              phone: u.phoneNumber || u.mobile || '',
              role: (u.role === 'admin' || u.role === 'super_admin' ? 'Senior Loan Officer & Admin' : 'Senior Education Loan Advisor'),
            };
            if (u.id) staffMap[u.id.toLowerCase()] = staffObj;
            if (u.email) staffMap[u.email.toLowerCase()] = staffObj;
          });

          try {
            const { data: staffProfiles, error: spErr } = await this.db.from('StaffProfile').select('*');
            if (!spErr && staffProfiles) {
              (staffProfiles || []).forEach((sp: any) => {
                const fullName = sp.fullName || sp.name;
                if (fullName) {
                  const staffObj = {
                    id: sp.linkedUserId || sp.staffId || sp.id,
                    name: fullName,
                    email: sp.email || '',
                    phone: sp.phoneNumber || sp.phone || sp.mobile || '',
                    role: sp.role || sp.designation || sp.department || 'Education Loan Processing Specialist',
                  };
                  if (sp.id) staffMap[sp.id.toLowerCase()] = staffObj;
                  if (sp.staffId) staffMap[sp.staffId.toLowerCase()] = staffObj;
                  if (sp.linkedUserId) staffMap[sp.linkedUserId.toLowerCase()] = staffObj;
                  if (sp.email) staffMap[sp.email.toLowerCase()] = staffObj;
                }
              });
            }
          } catch (_) {}

          resultList = resultList.map((app: any) => {
            if (app.assignedStaffId) {
              const key = String(app.assignedStaffId).toLowerCase();
              const staff = staffMap[key];
              if (staff) {
                return {
                  ...app,
                  assignedStaffName: staff.name,
                  assignedStaffEmail: staff.email,
                  assignedStaffPhone: staff.phone,
                  assignedStaffRole: staff.role,
                  assignedStaff: staff,
                };
              }
            }
            return app;
          });
        }
      } catch (err: any) {
        console.warn('[ApplicationService.getUserApplications] Staff details enrichment warning:', err?.message);
      }
    }

    return { success: true, data: resultList, pagination: { total: count || 0, limit: filters?.limit || 20, offset: filters?.offset || 0 } };
  }

  async updateApplication(applicationId: string, userId: string, data: any) {
    const application = await this.getApplicationById(applicationId);
    if (application.userId !== userId) throw new BadRequestException('Unauthorized to update this application');
    if (!['draft', 'documents_pending'].includes(application.status)) throw new BadRequestException('Application cannot be modified in current status');

    const targetBank = data.bank !== undefined ? data.bank : application.bank;
    const targetCountry = data.country !== undefined ? data.country : application.country;
    const targetUniversity = (data.universityName || data.university) !== undefined ? (data.universityName || data.university) : application.universityName;

    await this.validateApplicationConstraints(userId, applicationId, targetBank, targetCountry, targetUniversity);

    const updatePayload: any = {
      ...data,
      amount: data.amount ? parseFloat(data.amount) : undefined,
      tenure: data.tenure ? parseInt(data.tenure) : undefined,
      annualIncome: data.annualIncome ? parseFloat(data.annualIncome) : undefined,
      dateOfBirth: data.dateOfBirth ? this.parseDate(data.dateOfBirth) : undefined,
      courseStartDate: data.courseStartDate ? this.parseDate(data.courseStartDate) : undefined,
      universityName: data.universityName || data.university || undefined,
      courseName: data.courseName || data.courseType || data.course || undefined,
    };

    const { data: updated, error } = await this.db
      .from('LoanApplication')
      .update(updatePayload)
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    // Sync target intake and destination to User profile on update
    if (application.userId && (data.intakeSeason !== undefined || data.country !== undefined)) {
      try {
        await this.db
          .from('User')
          .update({
            ...(data.intakeSeason !== undefined ? { intakeSeason: data.intakeSeason } : {}),
            ...(data.country !== undefined ? { studyDestination: data.country } : {}),
          })
          .eq('id', application.userId);
      } catch (err) {
        console.error('Failed to sync target intake/destination to User profile on update:', err);
      }
    }

    return { success: true, data: updated, message: 'Application updated successfully' };
  }

  async adminUpdateApplication(applicationId: string, data: any, user?: any) {
    const application = await this.getApplicationById(applicationId);

    const targetBank = data.bank !== undefined ? data.bank : application.bank;
    const targetCountry = (data.country || data.studyDestination || data.countryOfStudy || data.destinationCountry) !== undefined
      ? (data.country || data.studyDestination || data.countryOfStudy || data.destinationCountry)
      : application.country;
    const targetUniversity = (data.universityName || data.university || data.targetUniversity) !== undefined
      ? (data.universityName || data.university || data.targetUniversity)
      : application.universityName;

    await this.validateApplicationConstraints(application.userId, applicationId, targetBank, targetCountry, targetUniversity, true);

    const updatePayload: any = { ...data };

    // Generate application number ONLY when application is officially submitted to a bank.
    // Do NOT generate for 'approved' or stage changes — the bank workflow service handles number
    // generation in submitApplicationToBank() to ensure the number is tied to an actual bank submission.
    const isSubmittedToBank = (data.status === 'submitted_to_bank');
    if (isSubmittedToBank && !application.applicationNumber) {
      updatePayload.applicationNumber = await this.generateApplicationNumber();
    }

    // Standardize aliases to exact DB column names on LoanApplication table
    if (data.universityName || data.university || data.targetUniversity) {
      updatePayload.universityName = data.universityName || data.university || data.targetUniversity;
    }
    if (data.country || data.studyDestination || data.countryOfStudy || data.destinationCountry) {
      updatePayload.country = data.country || data.studyDestination || data.countryOfStudy || data.destinationCountry;
    }
    if (data.courseName || data.course) {
      updatePayload.courseName = data.courseName || data.course;
    }

    // Remove alias keys that are not actual database columns on LoanApplication
    delete updatePayload.university;
    delete updatePayload.targetUniversity;
    delete updatePayload.studyDestination;
    delete updatePayload.countryOfStudy;
    delete updatePayload.destinationCountry;
    delete updatePayload.course;

    // Convert numeric fields if present
    if (data.amount !== undefined) updatePayload.amount = data.amount ? parseFloat(data.amount) : null;
    if (data.tenure !== undefined) updatePayload.tenure = data.tenure ? parseInt(data.tenure) : null;
    if (data.sanctionAmount !== undefined) updatePayload.sanctionAmount = data.sanctionAmount ? parseFloat(data.sanctionAmount) : null;
    if (data.disbursedAmount !== undefined) updatePayload.disbursedAmount = data.disbursedAmount ? parseFloat(data.disbursedAmount) : null;
    if (data.interestRate !== undefined) updatePayload.interestRate = data.interestRate ? parseFloat(data.interestRate) : null;
    if (data.sanctionedInterestRate !== undefined) updatePayload.sanctionedInterestRate = data.sanctionedInterestRate ? parseFloat(data.sanctionedInterestRate) : null;
    if (data.processingFee !== undefined) updatePayload.processingFee = data.processingFee ? parseFloat(data.processingFee) : null;
    if (data.roiBase !== undefined) updatePayload.roiBase = data.roiBase ? parseFloat(data.roiBase) : null;
    if (data.roiEffective !== undefined) updatePayload.roiEffective = data.roiEffective ? parseFloat(data.roiEffective) : null;
    if (data.roiSubsidy !== undefined) updatePayload.roiSubsidy = data.roiSubsidy ? parseFloat(data.roiSubsidy) : null;

    // Clean up undefined properties to avoid Supabase errors
    Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });

    let updated: any = null;
    const { data: updatedRes, error } = await this.db
      .from('LoanApplication')
      .update(updatePayload)
      .eq('id', applicationId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn(`[ApplicationService.adminUpdateApplication] Full payload update warning: ${error.message}. Retrying with core columns...`);
      const corePayload = { ...updatePayload };
      delete corePayload.coApplicantEmail;
      delete corePayload.coApplicantPhone;
      delete corePayload.coApplicantRelation;
      delete corePayload.coApplicantName;
      delete corePayload.fatherName;
      delete corePayload.motherName;
      const { data: retryData, error: retryErr } = await this.db
        .from('LoanApplication')
        .update(corePayload)
        .eq('id', applicationId)
        .select()
        .maybeSingle();

      if (retryErr) {
        console.error('[ApplicationService.adminUpdateApplication] DB Error after retry:', retryErr);
        throw retryErr;
      }
      updated = retryData || application;
    } else {
      updated = updatedRes || application;
    }

    // Sync targetUniversity and studyDestination to User profile record
    if (application.userId && (updatePayload.universityName || updatePayload.country)) {
      try {
        const userSync: any = {};
        if (updatePayload.universityName) userSync.targetUniversity = updatePayload.universityName;
        if (updatePayload.country) userSync.studyDestination = updatePayload.country;
        await this.db.from('User').update(userSync).eq('id', application.userId);
      } catch (uErr: any) {
        console.warn('[ApplicationService.adminUpdateApplication] Failed to sync User profile:', uErr.message);
      }
    }

    if (data.remarks !== undefined && data.remarks !== application.remarks) {
      // Find the new notes that were added by splitting by newline
      const oldRemarks = application.remarks || '';
      const newRemarks = data.remarks || '';
      
      const oldLines = oldRemarks.split('\n');
      const newLines = newRemarks.split('\n');
      const addedLines = newLines.filter(line => !oldLines.includes(line) && line.trim());

      if (addedLines.length > 0) {
        // Emit event for notification
        const addedRemarkText = addedLines.join('\n');
        this.eventEmitter.emit('bank.note.added', {
          applicationId: application.id,
          applicationNumber: application.applicationNumber,
          userId: application.userId,
          candidateName: `${application.firstName || ''} ${application.lastName || ''}`.trim() || 'Candidate',
          remarks: addedRemarkText,
          updatedBy: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Bank Partner',
          userRole: user?.role || 'bank'
        });
      }
    }

    // Sync target intake and destination to User profile on admin update
    if (application.userId && (data.intakeSeason !== undefined || data.country !== undefined)) {
      try {
        await this.db
          .from('User')
          .update({
            ...(data.intakeSeason !== undefined ? { intakeSeason: data.intakeSeason } : {}),
            ...(data.country !== undefined ? { studyDestination: data.country } : {}),
          })
          .eq('id', application.userId);
      } catch (err) {
        console.error('Failed to sync target intake/destination to User profile on admin update:', err);
      }
    }

    return { success: true, data: updated, message: 'Application updated successfully' };
  }

  async cancelApplication(applicationId: string, userId: string, reason?: string) {
    const application = await this.getApplicationById(applicationId);
    if (application.userId !== userId) throw new BadRequestException('Unauthorized to cancel this application');
    if (['approved', 'disbursed', 'cancelled'].includes(application.status)) throw new BadRequestException('Application cannot be cancelled in current status');

    const { data: updated } = await this.db.from('LoanApplication').update({ status: 'cancelled', remarks: reason }).eq('id', applicationId).select().single();
    await this.createStatusHistory(applicationId, { fromStatus: application.status, toStatus: 'cancelled', notes: reason || 'Application cancelled by user', isAutomatic: false });
    return { success: true, data: updated, message: 'Application cancelled successfully' };
  }

  async getApplicationTracking(applicationId: string, userId?: string) {
    const { data: application } = await this.db
      .from('LoanApplication')
      .select('*, statusHistory:ApplicationStatusHistory(*), documents:ApplicationDocument(id, docType, docName, status)')
      .eq('id', applicationId)
      .single();

    if (!application) throw new NotFoundException('Application not found');
    if (userId && application.userId !== userId) throw new BadRequestException('Unauthorized to view this application');

    const statusHistory = (application.statusHistory || []).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const stages = Object.entries(APPLICATION_STAGES).map(([key, value]) => {
      const currentStageOrder = APPLICATION_STAGES[application.stage as keyof typeof APPLICATION_STAGES]?.order || 0;
      const isCompleted = value.order < currentStageOrder;
      const isCurrent = key === application.stage;
      return { key, label: value.label, order: value.order, isCompleted, isCurrent, completedAt: isCompleted ? statusHistory.find((h: any) => h.toStage === key)?.createdAt : null };
    });

    const docs = application.documents || [];
    const documentsStatus = {
      total: docs.length,
      pending: docs.filter((d: any) => d.status === 'pending').length,
      verified: docs.filter((d: any) => d.status === 'verified').length,
      rejected: docs.filter((d: any) => d.status === 'rejected').length,
    };

    return {
      success: true,
      data: { applicationId: application.id, applicationNumber: application.applicationNumber, status: application.status, currentStage: application.stage, progress: application.progress, stages, timeline: statusHistory, documents: documentsStatus, estimatedCompletion: application.estimatedCompletionAt, submittedAt: application.submittedAt, lastUpdated: application.updatedAt },
    };
  }

  async trackApplication(applicationNumber: string) {
    const { data: application } = await this.db
      .from('LoanApplication')
      .select('id, applicationNumber, loanType, bank, amount, status, stage, progress, submittedAt, estimatedCompletionAt, updatedAt')
      .eq('applicationNumber', applicationNumber)
      .single();

    if (!application) throw new NotFoundException('Application not found');

    const stages = Object.entries(APPLICATION_STAGES).map(([key, value]) => {
      const currentStageOrder = APPLICATION_STAGES[application.stage as keyof typeof APPLICATION_STAGES]?.order || 0;
      return { key, label: value.label, order: value.order, isCompleted: value.order < currentStageOrder, isCurrent: key === application.stage };
    });

    return { success: true, data: { ...application, stages } };
  }


  private normalizeLoanType(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('education') || t.includes('study') || t.includes('undergraduate') || t.includes('postgraduate') || t.includes('doctoral')) return 'education';
    if (t.includes('home') || t.includes('property')) return 'home';
    if (t.includes('personal')) return 'personal';
    if (t.includes('business')) return 'business';
    if (t.includes('vehicle') || t.includes('car')) return 'vehicle';
    return 'personal';
  }

  private async initializeRequiredDocuments(applicationId: string, userId: string, loanType: string) {
    const normalizedType = this.normalizeLoanType(loanType);
    const requiredDocs = REQUIRED_DOCUMENTS[normalizedType as keyof typeof REQUIRED_DOCUMENTS] || REQUIRED_DOCUMENTS.personal;
    
    console.log(`[DOCS] Initializing documents for application ${applicationId}, userId ${userId}, type ${loanType} (normalized: ${normalizedType})`);
    
    // Fetch user's existing vault documents to auto-populate if possible
    const { data: vaultDocs } = await this.db.from('UserDocument').select('*').eq('userId', userId);
    
    for (const doc of requiredDocs) {
      // Find if user already has this document in their vault
      const matchingVaultDoc = vaultDocs?.find(vd => vd.docType === doc.docType && vd.uploaded);
      
      await this.db.from('ApplicationDocument').insert({ 
        applicationId, 
        docType: doc.docType, 
        docName: doc.docName, 
        fileName: matchingVaultDoc?.fileName || '', 
        filePath: matchingVaultDoc?.filePath || '', 
        status: matchingVaultDoc ? 'pending' : 'not_uploaded', 
        isRequired: doc.isRequired 
      });
    }
  }

  async uploadDocument(applicationId: string, userId: string, documentData: { docType: string; docName: string; fileName: string; filePath: string; fileSize?: number; mimeType?: string }) {
    const application = await this.getApplicationById(applicationId);
    if (application.userId !== userId) throw new BadRequestException('Unauthorized to upload documents');

    const { data: existingDoc } = await this.db.from('ApplicationDocument').select('id').eq('applicationId', applicationId).eq('docType', documentData.docType).single();

    let document: any;
    if (existingDoc) {
      const { data, error } = await this.db.from('ApplicationDocument').update({ ...documentData, status: 'pending', uploadedAt: new Date().toISOString() }).eq('id', existingDoc.id).select().single();
      if (error) throw error;
      document = data;
    } else {
      const { data, error } = await this.db.from('ApplicationDocument').insert({ applicationId, ...documentData, status: 'pending' }).select().single();
      if (error) throw error;
      document = data;
    }

    try {
      const verificationResult = await this.digilockerService.verifyDocument(document.filePath, document.docType);
      let updateData: any = {};
      if (verificationResult.isValid) {
        updateData = { status: 'verified', digilockerTxId: verificationResult.txId, verifiedAt: new Date().toISOString(), verifiedBy: 'Digilocker System', verificationMetadata: verificationResult.details };
      } else {
        const explanation = await this.verificationService.explainRejection(document.docType, verificationResult.code || 'Unknown Error');
        updateData = { status: 'rejected', aiExplanation: explanation, rejectionReason: verificationResult.code || 'Verification Failed', verificationMetadata: verificationResult.details };
      }
      const { data: updated } = await this.db.from('ApplicationDocument').update(updateData).eq('id', document.id).select().single();
      document = updated;
    } catch (error) {
      console.error('Document verification process failed:', error);
    }

    // Emit document uploaded event for staff notifications
    try {
      const candidateName = `${application.firstName || ''} ${application.lastName || ''}`.trim() || application.email || 'Candidate';
      this.eventEmitter.emit('document.uploaded', {
        applicationId,
        applicationNumber: application.applicationNumber,
        userId: application.userId,
        candidateName,
        candidateEmail: application.email,
        documentType: documentData.docType,
        documentName: documentData.docName,
        status: document.status,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to emit document.uploaded event:', e);
    }

    return { success: true, data: document, message: 'Document uploaded successfully' };
  }

  async getApplicationDocuments(applicationId: string, userId?: string) {
    const application = await this.getApplicationById(applicationId);
    if (userId && application.userId !== userId) {
      throw new BadRequestException('Unauthorized to view documents');
    }

    let { data: documents } = await this.db.from('ApplicationDocument').select('*').eq('applicationId', applicationId).order('isRequired', { ascending: false });

    // Lazy initialization for older applications
    if (!documents || documents.length === 0) {
      await this.initializeRequiredDocuments(application.id, application.userId, application.loanType);
      const { data: newDocs } = await this.db.from('ApplicationDocument').select('*').eq('applicationId', applicationId).order('isRequired', { ascending: false });
      documents = newDocs;
    }

    const docs = documents || [];
    
    // Also fetch the User's general Vault documents to show in a "Vault" section
    const { data: vaultDocs } = await this.db.from('UserDocument').select('*').eq('userId', application.userId);

    const vaultDocsMap = new Map((vaultDocs || []).map(vd => [vd.docType, vd]));
    const mergedDocs = docs.map((doc: any) => {
      const vMatch = vaultDocsMap.get(doc.docType);
      if ((!doc.filePath || doc.filePath === '') && vMatch && vMatch.filePath) {
        return {
          ...doc,
          filePath: vMatch.filePath,
          fileName: doc.fileName || vMatch.fileName || doc.docName,
          fileSize: doc.fileSize || vMatch.fileSize,
          mimeType: doc.mimeType || vMatch.mimeType,
          status: doc.status === 'not_uploaded' ? (vMatch.status || 'uploaded') : doc.status
        };
      }
      return doc;
    });

    // Merge or tag vault documents that aren't already in the application
    const applicationDocTypes = new Set(mergedDocs.map(d => d.docType));
    const extraVaultDocs = (vaultDocs || [])
      .filter(vd => !applicationDocTypes.has(vd.docType) && (vd.uploaded || vd.filePath || (vd.status && vd.status !== 'not_uploaded')))
      .map(vd => ({
        ...vd,
        id: `vault_${vd.id}`,
        isVaultDoc: true,
        docName: (vd.docType || '').replace(/_/g, ' ').toUpperCase(),
        status: vd.status || 'uploaded'
      }));

    const allDocs = [...mergedDocs, ...extraVaultDocs];

    const grouped = {
      pending: allDocs.filter((d: any) => d.status === 'pending' && d.filePath),
      verified: allDocs.filter((d: any) => d.status === 'verified' || d.status === 'approved'),
      rejected: allDocs.filter((d: any) => d.status === 'rejected'),
      notUploaded: allDocs.filter((d: any) => !d.filePath && !d.isVaultDoc),
      vault: extraVaultDocs
    };

    return { 
      success: true, 
      data: allDocs, 
      grouped, 
      summary: { 
        total: docs.length, 
        vaultTotal: extraVaultDocs.length,
        uploaded: docs.filter((d: any) => d.filePath).length, 
        pending: grouped.pending.length, 
        verified: grouped.verified.length, 
        rejected: grouped.rejected.length, 
        notUploaded: grouped.notUploaded.length 
      } 
    };
  }

  async getSingleDocument(applicationId: string, documentId: string) {
    const docsResult = await this.getApplicationDocuments(applicationId);
    let doc = docsResult.data?.find((d: any) =>
      String(d.id) === String(documentId) ||
      String(d.id) === `vault_${documentId}` ||
      String(d.id).replace('vault_', '') === String(documentId).replace('vault_', '')
    );

    if (!doc || !doc.filePath) {
      const realId = documentId.replace('vault_', '');
      const { data: uDoc } = await this.db.from('UserDocument').select('*').eq('id', realId).maybeSingle();
      if (uDoc && uDoc.filePath) {
        doc = {
          ...uDoc,
          docName: uDoc.docType ? uDoc.docType.replace(/_/g, ' ').toUpperCase() : 'Document',
          filePath: uDoc.filePath,
          fileName: uDoc.fileName || uDoc.docType
        };
      }
    }
    return doc;
  }

  async syncApplicationDocuments(applicationId: string, adminId?: string) {
    const application = await this.getApplicationById(applicationId);
    
    // Fetch user's existing vault documents
    const { data: vaultDocs } = await this.db.from('UserDocument').select('*').eq('userId', application.userId);
    const { data: appDocs } = await this.db.from('ApplicationDocument').select('*').eq('applicationId', applicationId);
    
    const appDocsMap = new Map(appDocs?.map(d => [d.docType, d]) || []);
    const normalizedType = this.normalizeLoanType(application.loanType);
    const requiredDocs = REQUIRED_DOCUMENTS[normalizedType as keyof typeof REQUIRED_DOCUMENTS] || REQUIRED_DOCUMENTS.personal;
    
    let syncedCount = 0;
    
    for (const req of requiredDocs) {
      const existing = appDocsMap.get(req.docType);
      const vaultMatch = vaultDocs?.find(vd => vd.docType === req.docType && vd.uploaded);
      
      if (vaultMatch) {
        if (!existing || !existing.filePath) {
          // Update or insert
          const updateData = {
            applicationId,
            docType: req.docType,
            docName: req.docName,
            fileName: vaultMatch.fileName || '',
            filePath: vaultMatch.filePath || '',
            status: 'pending',
            isRequired: req.isRequired
          };
          
          if (existing) {
            await this.db.from('ApplicationDocument').update(updateData).eq('id', existing.id);
          } else {
            await this.db.from('ApplicationDocument').insert(updateData);
          }
          syncedCount++;
        }
      } else if (!existing) {
        // Just create the requirement placeholder
        await this.db.from('ApplicationDocument').insert({
          applicationId,
          docType: req.docType,
          docName: req.docName,
          status: 'not_uploaded',
          isRequired: req.isRequired
        });
      }
    }
    
    return { success: true, message: `Synchronized ${syncedCount} documents from vault`, syncedCount };
  }

  async deleteDocument(documentId: string, userId: string) {
    const { data: document } = await this.db
      .from('ApplicationDocument')
      .select('*, application:LoanApplication!applicationId(userId)')
      .eq('id', documentId)
      .single();

    if (!document) throw new NotFoundException('Document not found');
    if (document.application.userId !== userId) throw new BadRequestException('Unauthorized to delete this document');
    if (document.status === 'verified') throw new BadRequestException('Verified documents cannot be deleted');

    if (document.isRequired) {
      await this.db.from('ApplicationDocument').update({ fileName: '', filePath: '', fileSize: null, mimeType: null, status: 'pending' }).eq('id', documentId);
    } else {
      await this.db.from('ApplicationDocument').delete().eq('id', documentId);
    }

    return { success: true, message: 'Document deleted successfully' };
  }

  async autoAssignUnassignedLoans() {
    try {
      const { data: unassignedLoans } = await this.db
        .from('LoanApplication')
        .select('id, applicationNumber, assignedStaffId')
        .or('assignedStaffId.is.null,assignedStaffId.eq.unassigned,assignedStaffId.eq.,assignedStaffId.eq.null');

      if (unassignedLoans && unassignedLoans.length > 0) {
        console.log(`[AutoAssign] Found ${unassignedLoans.length} unassigned loan applications. Assigning via round-robin...`);
        for (const loan of unassignedLoans) {
          try {
            await this.assignmentService.assignLoan(loan.id, 'auto_assign_system');
          } catch (e) {
            console.error(`[AutoAssign] Failed to assign loan ${loan.id}:`, e);
          }
        }
      }
    } catch (e) {
      console.error('[AutoAssign] Error in autoAssignUnassignedLoans:', e);
    }
  }

  async getAllApplications(filters?: { status?: string; stage?: string; loanType?: string; bank?: string; search?: string; fromDate?: string; toDate?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; userId?: string; excludeStatus?: string; assignedStaffId?: string; staffEmail?: string; includeUnassigned?: boolean }) {
    try {
      console.log('[ApplicationService.getAllApplications] Filters:', JSON.stringify(filters));

      // NOTE: Auto-assignment is triggered directly when each application is created/submitted
      // and via the explicit admin "Auto-Assign Unassigned" button. Do NOT call it here
      // as getAllApplications is invoked on every page load causing race conditions.

      let query = this.db
        .from('LoanApplication')
        .select('*, user:User!userId(id, email, firstName, lastName, phoneNumber, dateOfBirth, studyDestination, intakeSeason, tests), documents:ApplicationDocument(id, status), ProcessingFee(*)', { count: 'exact' });

      // ── Strict per-staff isolation ──────────────────────────────────────
      // When a non-admin staff member makes the request, return ONLY applications
      // assigned strictly to them (by user ID, email, or staff profile ID).
      if (filters?.assignedStaffId) {
        let candidateIds: string[] = [filters.assignedStaffId];
        if (filters.staffEmail) {
          candidateIds.push(filters.staffEmail);
          candidateIds.push(filters.staffEmail.toLowerCase());
        }

        // 1. Resolve the User record by email or by the raw staffId — get their real UUID
        try {
          const orFilter = [
            filters.assignedStaffId ? `id.eq.${filters.assignedStaffId}` : null,
            filters.staffEmail ? `email.eq.${filters.staffEmail}` : null,
          ].filter(Boolean).join(',');

          if (orFilter) {
            const { data: userRecord } = await this.db
              .from('User')
              .select('id, email')
              .or(orFilter)
              .maybeSingle();

            if (userRecord) {
              if (userRecord.id) candidateIds.push(userRecord.id);
              if (userRecord.email) candidateIds.push(userRecord.email);
            }
          }
        } catch (_) {}

        // 2. Resolve via StaffProfile — get all IDs associated with this staff member's profile
        try {
          const { data: profiles } = await this.db
            .from('StaffProfile')
            .select('id, linkedUserId, email');

          if (profiles && profiles.length > 0) {
            profiles.forEach((p: any) => {
              const pEmail = (p.email || '').toLowerCase();
              const reqEmail = (filters.staffEmail || '').toLowerCase();
              const pLink = (p.linkedUserId || '').toLowerCase();
              const reqStaffId = (filters.assignedStaffId || '').toLowerCase();
              const pId = (p.id || '').toLowerCase();

              if (pLink === reqStaffId || pId === reqStaffId || (reqEmail && pEmail === reqEmail)) {
                if (p.id) candidateIds.push(p.id);
                if (p.linkedUserId) candidateIds.push(p.linkedUserId);
                if (p.email) candidateIds.push(p.email);
              }
            });
          }
        } catch (_) {}

        const uniqueIds = Array.from(new Set(candidateIds.filter(Boolean)));
        console.log(`[ApplicationService] Staff filter — candidateIds: ${uniqueIds.join(', ')}`);
        const orConditions = uniqueIds.map(id => `assignedStaffId.eq.${id}`);
        query = query.or(orConditions.join(','));
      }

      // Apply sorting
      const sortCol = filters?.sortBy || 'updatedAt';
      const isAsc = filters?.sortOrder === 'asc';
      query = query.order(sortCol, { ascending: isAsc });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.excludeStatus) query = query.neq('status', filters.excludeStatus);
      if (filters?.stage) query = query.eq('stage', filters.stage);
      if (filters?.loanType) query = query.eq('loanType', filters.loanType);
      if (filters?.bank) {
        const b = filters.bank.toLowerCase();
        let searchPatterns: string[] = [];
        if (b.includes('avanse')) searchPatterns = ['%avanse%'];
        else if (b.includes('auxilo')) searchPatterns = ['%auxilo%'];
        else if (b.includes('idfc')) searchPatterns = ['%idfc%'];
        else if (b.includes('credila') || b.includes('hdfc')) searchPatterns = ['%credila%', '%hdfc%'];
        else if (b.includes('poonawalla')) searchPatterns = ['%poonawalla%'];
        else searchPatterns = [`%${filters.bank}%`];

        // Also query BankSubmission table to get application IDs assigned/shared with this bank
        let submittedAppIds: string[] = [];
        try {
          let subQuery = this.db.from('BankSubmission').select('applicationId');
          const subOrs: string[] = [];
          searchPatterns.forEach((p) => {
            subOrs.push(`bankId.ilike.${p}`);
            subOrs.push(`bankName.ilike.${p}`);
          });
          subQuery = subQuery.or(subOrs.join(','));
          const { data: subData } = await subQuery;
          if (subData && subData.length > 0) {
            submittedAppIds = subData.map((s: any) => s.applicationId).filter(Boolean);
          }
        } catch (e) {
          console.warn('[getAllApplications] BankSubmission query warning:', e);
        }

        const bankOrs: string[] = [];
        searchPatterns.forEach((p) => {
          bankOrs.push(`bank.ilike.${p}`);
        });
        if (submittedAppIds.length > 0) {
          const uniqueIds = Array.from(new Set(submittedAppIds));
          uniqueIds.forEach((id) => {
            bankOrs.push(`id.eq.${id}`);
          });
        }
        query = query.or(bankOrs.join(','));
      }
      
      if (filters?.search) {
        const search = filters.search;
        query = query.or(`applicationNumber.ilike.%${search}%,firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`);
      }
      
      if (filters?.fromDate) query = query.gte('submittedAt', filters.fromDate);
      if (filters?.toDate) query = query.lte('submittedAt', filters.toDate);

      // Filter by specific userId if provided (e.g., staff profile view for a single user)
      if (filters?.userId) query = query.eq('userId', filters.userId);

      const limit = filters?.limit || 1000;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      console.log(`[ApplicationService.getAllApplications] Executing query: sort=${sortCol}, limit=${limit}, offset=${offset}`);
      
      let { data: applications, count, error } = await query;

      if (error) {
        console.error('[ApplicationService.getAllApplications] Supabase Error, executing clean fallback query:', error);
        let fallbackQuery = this.db
          .from('LoanApplication')
          .select('*, user:User!userId(id, email, firstName, lastName, phoneNumber, dateOfBirth, studyDestination, intakeSeason, tests)', { count: 'exact' });

        if (filters?.status) fallbackQuery = fallbackQuery.eq('status', filters.status);
        if (filters?.excludeStatus) fallbackQuery = fallbackQuery.neq('status', filters.excludeStatus);
        if (filters?.stage) fallbackQuery = fallbackQuery.eq('stage', filters.stage);
        if (filters?.loanType) fallbackQuery = fallbackQuery.eq('loanType', filters.loanType);

        fallbackQuery = fallbackQuery.order(sortCol, { ascending: isAsc }).range(offset, offset + limit - 1);
        const fallbackRes = await fallbackQuery;
        applications = fallbackRes.data || [];
        count = fallbackRes.count || (applications?.length || 0);
      }

      console.log(`[ApplicationService.getAllApplications] Success. Count: ${count}, Data size: ${applications?.length}`);

      // Enrich assigned staff details (name, email, role)
      if (applications && applications.length > 0) {
        try {
          const rawStaffIds = applications.map((app: any) => app.assignedStaffId).filter(Boolean);
          const uniqueStaffIds = Array.from(new Set(rawStaffIds)) as string[];
          if (uniqueStaffIds.length > 0) {
            const staffUserIds = uniqueStaffIds.filter(id => !id.includes('@'));
            const staffEmails = uniqueStaffIds.filter(id => id.includes('@'));

            const fetchedStaffList: any[] = [];
            if (staffUserIds.length > 0) {
              const { data: uList } = await this.db
                .from('User')
                .select('id, email, firstName, lastName, role')
                .in('id', staffUserIds);
              if (uList) fetchedStaffList.push(...uList);
            }
            if (staffEmails.length > 0) {
              const { data: eList } = await this.db
                .from('User')
                .select('id, email, firstName, lastName, role')
                .in('email', staffEmails);
              if (eList) fetchedStaffList.push(...eList);
            }

            if (fetchedStaffList.length > 0) {
              const staffMap = new Map<string, any>();
              fetchedStaffList.forEach((s: any) => {
                if (s.id) staffMap.set(String(s.id).toLowerCase(), s);
                if (s.email) staffMap.set(String(s.email).toLowerCase(), s);
              });

              applications.forEach((app: any) => {
                if (app.assignedStaffId) {
                  const key = String(app.assignedStaffId).toLowerCase();
                  const staff = staffMap.get(key);
                  if (staff) {
                    const name = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email;
                    app.assignedStaffName = name;
                    app.assignedStaffEmail = staff.email;
                    app.assignedStaffRole = staff.role;
                    app.staffName = name;
                  }
                }
              });
            }
          }
        } catch (e) {
          console.warn('[getAllApplications] Failed to enrich staff details:', e);
        }
      }
      
      return { 
        success: true, 
        data: applications || [], 
        pagination: { 
          total: count || 0, 
          limit, 
          offset 
        } 
      };
    } catch (error) {
      console.error('[ApplicationService.getAllApplications] Fatal Exception:', error);
      // Return empty instead of crashing to avoid 500
      return { 
        success: false, 
        data: [], 
        pagination: { total: 0, limit: 20, offset: 0 },
        message: 'Internal server error during application retrieval'
      };
    }
  }

  async updateApplicationStatus(applicationId: string, adminId: string, adminName: string, data: { status?: string; stage?: string; progress?: number; remarks?: string; rejectionReason?: string; bank?: string }, role?: string) {
    const application = await this.getApplicationById(applicationId);
    const updateData: any = {};
    const historyData: any = { changedBy: adminId, changedByName: adminName };

    const isAuthorizedToChangeStatus = ['staff', 'admin', 'super_admin', 'bank', 'partner_bank'].includes(role || '');

    if (data.status && data.status !== application.status) {
      if (!isAuthorizedToChangeStatus) {
        // If not authorized to change status, we only proceed if status is actually the SAME (just saving remarks)
        // In the frontend we pass selectedApp.status for admins.
      } else {
        updateData.status = data.status;
        historyData.fromStatus = application.status;
        historyData.toStatus = data.status;
        if (data.status === 'rejected' && data.rejectionReason) updateData.remarks = data.rejectionReason;
        if (data.status === 'approved') { updateData.stage = 'sanction'; updateData.progress = 90; }
        else if (data.status === 'submitted_to_bank' || data.status === 'routed_multiparty') {
          updateData.stage = 'bank_review';
          updateData.progress = Math.max(application.progress || 0, 70);
          updateData.submittedToBankAt = application.submittedToBankAt || new Date().toISOString();
          updateData.bankWorkflowStatus = 'SUBMITTED_TO_BANK';
        }
        else if (data.status === 'rejected') { updateData.progress = 0; }
        else if (data.status === 'processing') { updateData.stage = 'document_verification'; updateData.progress = 40; }
        else if (data.status === 'disbursed' || data.status === 'disbursement_confirmed') { updateData.stage = 'disbursement'; updateData.progress = 100; }
      }
    }

    if (data.stage && data.stage !== application.stage) {
      if (isAuthorizedToChangeStatus) {
        updateData.stage = data.stage;
        updateData.progress = APPLICATION_STAGES[data.stage as keyof typeof APPLICATION_STAGES]?.progress || application.progress;
        historyData.fromStage = application.stage;
        historyData.toStage = data.stage;
      }
    }

    if (data.progress !== undefined && isAuthorizedToChangeStatus) updateData.progress = data.progress;
    if (data.bank && isAuthorizedToChangeStatus) updateData.bank = data.bank;
    if (data.remarks) {
        // Remarks can be updated by anyone in the StaffGuard (including admin)
        if (!updateData.remarks) updateData.remarks = data.remarks;
    }

    const { data: updated, error } = await this.db.from('LoanApplication').update(updateData).eq('id', applicationId).select().single();
    if (error) throw error;

    if (data.status || data.stage) {
      await this.createStatusHistory(applicationId, { ...historyData, notes: data.remarks });

      // Emit real-time dashboard activity event
      if (data.status && data.status !== application.status && isAuthorizedToChangeStatus) {
        const actorName = adminName || 'Staff';
        const capitalizedStatus = data.status.charAt(0).toUpperCase() + data.status.slice(1);
        
        let msg = `Staff member ${actorName} moved Application #${application.applicationNumber || application.id.slice(-4)} to ${capitalizedStatus}.`;
        let color = 'bg-blue-50 text-blue-700 border-blue-100';
        let icon = 'sync';

        if (data.status === 'approved') {
          msg = `Staff member ${actorName} moved Application #${application.applicationNumber || application.id.slice(-4)} to Approved.`;
          color = 'bg-emerald-50 text-emerald-700 border-emerald-100';
          icon = 'task_alt';
        } else if (data.status === 'rejected') {
          msg = `Staff member ${actorName} moved Application #${application.applicationNumber || application.id.slice(-4)} to Rejected.`;
          color = 'bg-rose-50 text-rose-700 border-rose-100';
          icon = 'cancel';
        }

        this.eventEmitter.emit('dashboard.activity', {
          type: data.status,
          msg,
          icon,
          color,
          actorName,
          actorEmail: adminId || null,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Send email notifications to the student on status changes
    try {
      const { data: latestApp } = await this.db
        .from('LoanApplication')
        .select('*, user:User!userId(id, email, firstName, lastName)')
        .eq('id', applicationId)
        .single();

      if (latestApp) {
        const email = latestApp.user?.email || latestApp.email;
        if (email) {
          const firstName = latestApp.firstName || latestApp.user?.firstName || '';
          const lastName = latestApp.lastName || latestApp.user?.lastName || '';
          const userName = `${firstName} ${lastName}`.trim() || 'Student';
          const bankName = latestApp.bank || 'our partner bank';

          if (data.status === 'approved' || data.status === 'sanctioned') {
            await this.emailService.sendApplicationAcceptedByBankEmail(email, userName, bankName, latestApp, data);
          } else if (data.status === 'rejected') {
            if (!latestApp.bank || latestApp.bank === 'Pending Partner' || role === 'staff' || role === 'admin' || role === 'super_admin') {
              await this.emailService.sendApplicationRejectedByStaffEmail(email, userName, data.rejectionReason || data.remarks || '');
            } else {
              await this.emailService.sendApplicationRejectedByBankEmail(email, userName, bankName, data.rejectionReason || data.remarks || '');
            }
          } else if (data.status === 'submitted_to_bank') {
            await this.emailService.sendApplicationSentToBankEmail(email, userName, bankName, latestApp);
            try {
              const bankIdStr = (latestApp.bank || bankName).toLowerCase().replace(/[^a-z0-9]/g, '');
              const fallbackEmails: Record<string, string> = {
                avanse: 'avansebank01@gmail.com',
                auxilo: 'auxilobank01@gmail.com',
                idfc: 'idfcbank01@gmail.com',
                poonawalla: 'poonawallabank01@gmail.com',
                credila: 'credilabank01@gmail.com',
              };
              const targetBankEmail = fallbackEmails[bankIdStr] || `${bankIdStr}bank01@gmail.com`;
              await this.emailService.sendNewApplicationNotificationToBank(targetBankEmail, bankName, latestApp, userName);
            } catch (bErr) {
              console.error('[ApplicationService] Failed to send bank notification email:', bErr);
            }
          } else if (data.status === 'disbursed' || data.status === 'disbursement_confirmed') {
            const extraData = data as any;
            await this.emailService.sendLoanDisbursedEmail(email, userName, bankName, latestApp, extraData);
            this.eventEmitter.emit('bank.application.disbursed', {
              applicationId: latestApp.id,
              userId: latestApp.userId,
              amount: Number(extraData.disbursedAmount || latestApp.disbursedAmount || latestApp.amount || 0),
              bankId: bankName,
              utrNumber: extraData.utrNumber || latestApp.utrNumber || 'N/A',
              trancheNumber: extraData.trancheNumber || 1,
              transferMode: extraData.transferMode || 'IMPS/NEFT/RTGS'
            });
          }
        }
      }
    } catch (err) {
      console.error('[ApplicationService.updateApplicationStatus] Failed to send transition email:', err);
    }

    return { success: true, data: updated, message: 'Application updated successfully' };
  }

  async verifyDocument(documentId: string, adminId: string, data: { status: 'verified' | 'rejected'; rejectionReason?: string }) {
    if (documentId.startsWith('vault_')) {
      const realId = documentId.replace('vault_', '');
      const mappedStatus = data.status === 'verified' ? 'verified' : 'rejected';
      const syncPayload: any = {
        status: mappedStatus,
        updatedAt: new Date().toISOString(),
      };

      if (mappedStatus === 'verified') {
        syncPayload.verifiedAt = new Date().toISOString();
        syncPayload.rejectionReason = null;
        syncPayload.verificationMetadata = {
          status: 'verified',
          verifiedAt: new Date().toISOString(),
          message: 'Document manually verified by staff from application',
        };
      } else if (mappedStatus === 'rejected') {
        syncPayload.verifiedAt = null;
        syncPayload.rejectionReason = data.rejectionReason || null;
        syncPayload.verificationMetadata = {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectionReason: data.rejectionReason || null,
          message: data.rejectionReason ? `Document rejected by staff: ${data.rejectionReason}` : 'Document rejected by staff',
        };
      }

      const { data: userDoc, error } = await this.db
        .from('UserDocument')
        .update(syncPayload)
        .eq('id', realId)
        .select()
        .single();
      if (error) throw error;

      if (userDoc) {
        const docName = userDoc.verificationMetadata?.docName || userDoc.docType;
        if (mappedStatus === 'rejected') {
          this.eventEmitter.emit('document.rejected', {
            userId: userDoc.userId,
            documentId: userDoc.id,
            documentType: userDoc.docType,
            documentName: docName,
            rejectionReason: data.rejectionReason,
            rejectedAt: syncPayload.verificationMetadata.rejectedAt,
          });
        } else if (mappedStatus === 'verified') {
          this.eventEmitter.emit('document.verified', {
            userId: userDoc.userId,
            documentId: userDoc.id,
            documentType: userDoc.docType,
            documentName: docName,
            verifiedAt: syncPayload.verifiedAt,
          });
        }
      }
      return { success: true, message: `Vault document ${data.status} successfully` };
    }

    const { data: appDoc } = await this.db.from('ApplicationDocument').select('id, applicationId, docType').eq('id', documentId).single();
    if (!appDoc) {
      const { data: userDoc } = await this.db.from('UserDocument').select('*').eq('id', documentId).single();
      if (userDoc) {
        const mappedStatus = data.status === 'verified' ? 'verified' : 'rejected';
        const syncPayload: any = {
          status: mappedStatus,
          updatedAt: new Date().toISOString(),
        };

        if (mappedStatus === 'verified') {
          syncPayload.verifiedAt = new Date().toISOString();
          syncPayload.rejectionReason = null;
          syncPayload.verificationMetadata = {
            status: 'verified',
            verifiedAt: new Date().toISOString(),
            message: 'Document manually verified by staff from application',
          };
        } else if (mappedStatus === 'rejected') {
          syncPayload.verifiedAt = null;
          syncPayload.rejectionReason = data.rejectionReason || null;
          syncPayload.verificationMetadata = {
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectionReason: data.rejectionReason || null,
            message: data.rejectionReason ? `Document rejected by staff: ${data.rejectionReason}` : 'Document rejected by staff',
          };
        }

        const { data: updatedUserDoc, error } = await this.db
          .from('UserDocument')
          .update(syncPayload)
          .eq('id', documentId)
          .select()
          .single();
        if (error) throw error;

        if (updatedUserDoc) {
          const docName = updatedUserDoc.verificationMetadata?.docName || updatedUserDoc.docType;
          if (mappedStatus === 'rejected') {
            this.eventEmitter.emit('document.rejected', {
              userId: updatedUserDoc.userId,
              documentId: updatedUserDoc.id,
              documentType: updatedUserDoc.docType,
              documentName: docName,
              rejectionReason: data.rejectionReason,
              rejectedAt: syncPayload.verificationMetadata.rejectedAt,
            });
          } else if (mappedStatus === 'verified') {
            this.eventEmitter.emit('document.verified', {
              userId: updatedUserDoc.userId,
              documentId: updatedUserDoc.id,
              documentType: updatedUserDoc.docType,
              documentName: docName,
              verifiedAt: syncPayload.verifiedAt,
            });
          }
        }
        return { success: true, message: `Vault document ${data.status} successfully` };
      }
      throw new NotFoundException('Document not found');
    }

    const { data: updated, error } = await this.db
      .from('ApplicationDocument')
      .update({ status: data.status, verifiedAt: data.status === 'verified' ? new Date().toISOString() : null, verifiedBy: adminId, rejectionReason: data.rejectionReason })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;

    // Back-sync to UserDocument if there's a matching one
    const { data: application } = await this.db
      .from('LoanApplication')
      .select('userId')
      .eq('id', appDoc.applicationId)
      .single();

    if (application?.userId) {
      const mappedStatus = data.status === 'verified' ? 'verified' : 'rejected';
      const syncPayload: any = {
        status: mappedStatus,
        updatedAt: new Date().toISOString(),
      };

      if (mappedStatus === 'verified') {
        syncPayload.verifiedAt = new Date().toISOString();
        syncPayload.rejectionReason = null;
        syncPayload.verificationMetadata = {
          status: 'verified',
          verifiedAt: new Date().toISOString(),
          message: 'Document manually verified by staff from application',
        };
      } else if (mappedStatus === 'rejected') {
        syncPayload.verifiedAt = null;
        syncPayload.rejectionReason = data.rejectionReason || null;
        syncPayload.verificationMetadata = {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectionReason: data.rejectionReason || null,
          message: data.rejectionReason ? `Document rejected by staff: ${data.rejectionReason}` : 'Document rejected by staff',
        };
      }

      const { data: updatedUserDoc } = await this.db
        .from('UserDocument')
        .update(syncPayload)
        .eq('userId', application.userId)
        .eq('docType', appDoc.docType)
        .select()
        .single();

      if (updatedUserDoc) {
        const docName = updatedUserDoc.verificationMetadata?.docName || updatedUserDoc.docType;
        if (mappedStatus === 'rejected') {
          this.eventEmitter.emit('document.rejected', {
            userId: updatedUserDoc.userId,
            documentId: updatedUserDoc.id,
            documentType: updatedUserDoc.docType,
            documentName: docName,
            rejectionReason: data.rejectionReason,
            rejectedAt: syncPayload.verificationMetadata.rejectedAt,
          });
        } else if (mappedStatus === 'verified') {
          this.eventEmitter.emit('document.verified', {
            userId: updatedUserDoc.userId,
            documentId: updatedUserDoc.id,
            documentType: updatedUserDoc.docType,
            documentName: docName,
            verifiedAt: syncPayload.verifiedAt,
          });
        }
      }
    }

    return { success: true, data: updated, message: `Document ${data.status} successfully` };
  }

  async addApplicationNote(applicationId: string, authorId: string, authorName: string, data: { content: string; type?: string; isInternal?: boolean }) {
    const { data: note, error } = await this.db
      .from('ApplicationNote')
      .insert({
        id: crypto.randomUUID(),
        applicationId,
        authorId: authorId || 'system',
        authorName: authorName || 'Staff Officer',
        content: data.content,
        type: data.type || 'admin_note',
        isInternal: data.isInternal !== undefined ? data.isInternal : true
      })
      .select()
      .single();

    if (error) throw error;

    try {
      this.eventEmitter.emit('application.note.added', {
        applicationId,
        note,
      });
    } catch {
      // non-fatal
    }

    return { success: true, data: note, message: 'Note added successfully' };
  }

  async getApplicationNotes(applicationId: string, includeInternal = true) {
    let query = this.db.from('ApplicationNote').select('*').eq('applicationId', applicationId).order('createdAt', { ascending: false });
    if (!includeInternal) query = query.eq('isInternal', false);
    const { data: notes } = await query;
    return { success: true, data: notes || [] };
  }

  async getApplicationStats(user?: any, bankId?: string) {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const isBank = (user?.role === 'bank' || user?.role === 'partner_bank');
      let bankName: string | null = null;
      if (isBank) {
        if (user?.bankName) {
          bankName = user.bankName;
        } else if (user?.bank) {
          const lowerB = user.bank.toLowerCase();
          if (lowerB.includes('credila') || lowerB.includes('hdfc')) bankName = 'HDFC Credila';
          else if (lowerB.includes('poonawalla')) bankName = 'Poonawalla';
          else if (lowerB.includes('idfc')) bankName = 'IDFC';
          else if (lowerB.includes('avanse')) bankName = 'Avanse';
          else if (lowerB.includes('auxilo')) bankName = 'Auxilo';
          else bankName = user.bank;
        }

        // Try email corporate domain next
        if (!bankName && user?.email) {
          const lowerEmail = user.email.toLowerCase().trim();
          if (lowerEmail.includes("auxilo.com")) bankName = 'Auxilo';
          else if (lowerEmail.includes("avanse.com")) bankName = 'Avanse';
          else if (lowerEmail.includes("credila.com") || lowerEmail.includes("hdfccredila.com")) bankName = 'HDFC Credila';
          else if (lowerEmail.includes("idfcfirstbank.com") || lowerEmail.includes("idfcbank.com")) bankName = 'IDFC';
          else if (lowerEmail.includes("poonawallafincorp.com")) bankName = 'Poonawalla';
        }

        if (!bankName) {
          const bId = bankId || user?.firstName;
          if (bId) {
            const lower = bId.toLowerCase();
            if (lower.includes('credila')) bankName = 'HDFC Credila';
            else if (lower.includes('poonawalla')) bankName = 'Poonawalla';
            else if (lower.includes('idfc')) bankName = 'IDFC';
            else if (lower.includes('avanse')) bankName = 'Avanse';
            else if (lower.includes('auxilo')) bankName = 'Auxilo';
            else bankName = bId;
          }
        }
      }

      let allAppsQuery = this.db.from('LoanApplication').select('id, applicationNumber, loanType, amount, status, submittedAt, firstName, lastName, assignedStaffId');

      if (isBank && bankName) {
        const excludeStr = '(submitted,pending,draft,docs_received,staff_verified,application_submitted)';
        allAppsQuery = allAppsQuery.ilike('bank', `%${bankName}%`).not('status', 'in', excludeStr);
      } else if (user && user.role !== 'admin' && user.role !== 'super_admin' && !isBank) {
        const staffId = user.id || user.uid;
        const staffEmail = user.email;
        if (staffId && staffEmail) {
          allAppsQuery = allAppsQuery.or(`assignedStaffId.eq.${staffId},assignedStaffId.eq.${staffEmail}`);
        } else if (staffId) {
          allAppsQuery = allAppsQuery.eq('assignedStaffId', staffId);
        }
      }

      console.log(`[Stats] Executing single query for ${bankName || 'all banks'}...`);
      const { data: allAppsData, error: qErr } = await allAppsQuery;
      if (qErr) console.error('[Stats] Query failed:', qErr);

      const allApps = allAppsData || [];
      const total = allApps.length;

      const recentApps = [...allApps]
        .sort((a: any, b: any) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 5);

      const tm = allApps.filter((a: any) => a.submittedAt && a.submittedAt >= thisMonthStart).length;
      const lm = allApps.filter((a: any) => a.submittedAt && a.submittedAt >= lastMonthStart && a.submittedAt < thisMonthStart).length;

      const statusStats: Record<string, number> = {};
      const loanTypeMap: Record<string, { count: number; totalAmount: number }> = {};
      
      let totalAmount = 0;
      let disbursedAmount = 0;
      for (const app of allApps) {
        const amt = app.amount || 0;
        totalAmount += amt;
        if (app.status === 'disbursed') {
          disbursedAmount += amt;
        }
        statusStats[app.status] = (statusStats[app.status] || 0) + 1;
        if (!loanTypeMap[app.loanType]) loanTypeMap[app.loanType] = { count: 0, totalAmount: 0 };
        loanTypeMap[app.loanType].count++;
        loanTypeMap[app.loanType].totalAmount += amt;
      }
      
      const loanTypeStats = Object.entries(loanTypeMap).map(([type, stats]) => ({ 
        type, 
        count: stats.count, 
        totalAmount: stats.totalAmount 
      }));

      return {
        success: true,
        data: { 
          total, 
          totalAmount,
          disbursedAmount,
          statusStats, 
          loanTypeStats, 
          recentApplications: recentApps, 
          monthlyComparison: { 
            thisMonth: tm, 
            lastMonth: lm, 
            change: lm > 0 ? ((tm - lm) / lm * 100).toFixed(1) : (tm > 0 ? '100.0' : '0.0') 
          } 
        },
      };
    } catch (error) {
      console.error('[ApplicationService] getApplicationStats Error:', error);
      // Return empty stats instead of throwing to prevent 500
      return {
        success: true,
        data: {
          total: 0,
          totalAmount: 0,
          disbursedAmount: 0,
          statusStats: {},
          loanTypeStats: [],
          recentApplications: [],
          monthlyComparison: { thisMonth: 0, lastMonth: 0, change: '0.0' }
        }
      };
    }
  }

  async aiReviewApplication(applicationId: string, adminId: string, adminName: string) {
    try {
      const application = await this.getApplicationById(applicationId);
      const { data: documents } = await this.db.from('ApplicationDocument').select('*').eq('applicationId', applicationId);
      const reviewResult = await this.applicationReviewService.reviewApplication(application, documents || []);

      await this.db.from('ApplicationNote').insert({ applicationId, authorId: adminId, authorName: 'AI Review System', content: JSON.stringify(reviewResult), type: 'ai_review', isInternal: true });
      await this.createStatusHistory(applicationId, { fromStatus: application.status, toStatus: application.status, changedBy: adminId, changedByName: adminName, notes: `AI Review completed. Score: ${reviewResult.overallScore}/100. Recommendation: ${reviewResult.recommendation}`, isAutomatic: true });

      // Emit real-time CIBIL verification activity
      this.eventEmitter.emit('dashboard.activity', {
        type: 'verification',
        msg: `System auto-verified CIBIL score for Student #${application.applicationNumber || application.id.slice(-4)}.`,
        icon: 'verified',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        actorName: 'System',
        actorEmail: 'system@vidyaloan.in',
        createdAt: new Date().toISOString()
      });

      return { success: true, data: reviewResult, message: 'AI review completed successfully' };
    } catch (error) {
      console.error(`[ApplicationService] aiReviewApplication failed for ${applicationId}:`, error);
      throw error;
    }
  }

  private async generateApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `VL-APP-${year}-`;
    
    try {
      const { data, error } = await this.db
        .from('LoanApplication')
        .select('applicationNumber')
        .like('applicationNumber', `${prefix}%`)
        .order('applicationNumber', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[ApplicationService] Error fetching max application number:', error);
      }

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
    } catch (err) {
      console.error('[ApplicationService] Failed to generate sequential application number, falling back to random:', err);
      const seq = String(Math.floor(Math.random() * 100_000)).padStart(5, '0');
      return `${prefix}${seq}`;
    }
  }

  private async createStatusHistory(applicationId: string, data: { fromStatus?: string; toStatus?: string; fromStage?: string; toStage?: string; changedBy?: string; changedByName?: string; changeReason?: string; notes?: string; isAutomatic?: boolean }) {
    await this.db.from('ApplicationStatusHistory').insert({ applicationId, ...data });
  }

  async getAgentApplications(agentId: string) {
    try {
      // 1. Get all referees referred by this agent
      const { data: referrals } = await this.db.from('Referral').select('refereeId').eq('referrerId', agentId);
      if (!referrals || referrals.length === 0) return { success: true, data: [] };

      const refereeIds = referrals.map(r => r.refereeId);

      // 2. Get applications for these students
      const { data: applications } = await this.db
        .from('LoanApplication')
        .select('*, user:User!userId(id, email, firstName, lastName, tests)')
        .in('userId', refereeIds)
        .order('submittedAt', { ascending: false });

      return { success: true, data: applications || [] };
    } catch (error) {
      console.error('[ApplicationService] getAgentApplications Error:', error);
      return { success: false, data: [] };
    }
  }

  async getAgentStats(agentId: string) {
    try {
      // 1. Get all referees referred by this agent
      const { data: referrals } = await this.db.from('Referral').select('refereeId').eq('referrerId', agentId);
      if (!referrals || referrals.length === 0) {
        return { success: true, data: { total: 0, totalAmount: 0, revenue: 0, disbursedAmount: 0, recentApplications: [] } };
      }

      const refereeIds = referrals.map(r => r.refereeId);

      // 2. Get applications for these students
      const { data: applications } = await this.db
        .from('LoanApplication')
        .select('*')
        .in('userId', refereeIds);

      let totalAmount = 0;
      let disbursedAmount = 0;

      for (const app of applications || []) {
        const amt = parseFloat(app.amount) || 0;
        totalAmount += amt;
        if (app.status === 'disbursed' || app.status === 'approved') {
          disbursedAmount += amt;
        }
      }

      // Revenue generation logic (e.g., 0.5% commission on disbursed amount)
      const revenue = disbursedAmount * 0.005;

      return {
        success: true,
        data: {
          total: (applications || []).length,
          totalAmount,
          revenue,
          disbursedAmount,
          recentApplications: (applications || []).slice(0, 5)
        }
      };
    } catch (error) {
      console.error('[ApplicationService] getAgentStats Error:', error);
      return {
        success: true,
        data: { total: 0, totalAmount: 0, revenue: 0, disbursedAmount: 0, recentApplications: [] }
      };
    }
  }

  async shareApplication(applicationId: string, adminId: string, adminName: string) {
    try {
      const application = await this.getApplicationById(applicationId);
      if (!application) throw new Error('Application not found');

      const userEmail = application.email || (application.user as any)?.email;
      if (!userEmail) throw new Error('Recipient email not found');

      const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
      const statusColor = application.status === 'approved' ? '#10b981' : application.status === 'rejected' ? '#ef4444' : '#6366f1';

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155; background-color: #f8fafc;">
          <div style="background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); padding: 40px; border-radius: 24px 24px 0 0; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Vidyaloan</h1>
            <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.8; text-transform: uppercase; letter-spacing: 2px;">Application Details Shared</p>
          </div>
          
          <div style="background: white; padding: 40px; border-radius: 0 0 24px 24px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1e1b4b; font-size: 20px; margin-bottom: 24px;">Hi ${application.firstName || 'Student'},</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 30px;">
              Details for your education loan application <strong>${application.applicationNumber}</strong> are summarized below. You can track your progress anytime on our dashboard.
            </p>

            <div style="background-color: #f1f5f9; padding: 24px; border-radius: 16px; margin-bottom: 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Status</td>
                  <td style="padding-bottom: 12px; text-align: right;">
                    <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                      ${application.status?.toUpperCase() || 'IN REVIEW'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Current Stage</td>
                  <td style="padding-bottom: 12px; text-align: right; font-weight: 700; color: #1e1b4b;">${application.stage?.replace(/_/g, ' ').toUpperCase() || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Loan Amount</td>
                  <td style="padding-bottom: 12px; text-align: right; font-weight: 700; color: #1e1b4b;">₹${Number(application.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Bank Partner</td>
                  <td style="padding-bottom: 12px; text-align: right; font-weight: 700; color: #1e1b4b;">${application.bank || 'Pending Assignment'}</td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Progress</td>
                  <td style="text-align: right; font-weight: 700; color: #1e1b4b;">${application.progress}%</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${frontendUrl}/dashboard" style="display: inline-block; background-color: #4338ca; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(67, 56, 202, 0.4);">
                Track My Application
              </a>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6;">
                This information was shared by ${adminName} from the Vidyaloan Staff Dashboard.<br>
                If you have any questions, please contact our support team.
              </p>
            </div>
          </div>
          
          <div style="padding: 24px; text-align: center; font-size: 11px; color: #94a3b8;">
            © ${new Date().getFullYear()} Vidyaloan. All rights reserved.
          </div>
        </div>
      `;

      await this.emailService.sendMail(
        userEmail,
        `Application Details: ${application.applicationNumber} - Vidyaloan`,
        emailHtml
      );

      // Log the share action as a note
      await this.db.from('ApplicationNote').insert({ applicationId, authorId: adminId, authorName: adminName, content: `Application details shared to registered email: ${userEmail}`, type: 'share', isInternal: true });

      return { success: true, message: 'Application details shared successfully' };
    } catch (error) {
      console.error('[ApplicationService] shareApplication Error:', error);
      throw new Error(`Failed to share application: ${error.message}`);
    }
  }

  getRequiredDocuments(loanType: string) {
    return { success: true, data: REQUIRED_DOCUMENTS[loanType as keyof typeof REQUIRED_DOCUMENTS] || REQUIRED_DOCUMENTS.personal };
  }

  getApplicationStages() {
    return { success: true, data: APPLICATION_STAGES };
  }

  async getDisbursements(applicationId: string) {
    const { data, error } = await this.db
      .from('disbursements')
      .select('*')
      .eq('applicationId', applicationId)
      .order('disbursedAt', { ascending: false });
    return { data: data || [], error };
  }

  async processBankStatementEvv(
    applicationId: string,
    file: Express.Multer.File,
    adminId: string,
    adminName: string
  ) {
    console.log(`[EVV Pipeline] Processing statement for application ${applicationId} by admin ${adminName}`);

    // 1. Fetch application details with flexible ID match
    let application = await this.getApplicationById(applicationId);
    if (!application) {
      const { data: appData } = await this.db
        .from('LoanApplication')
        .select('*')
        .or(`id.eq.${applicationId},applicationId.eq.${applicationId}`)
        .maybeSingle();
      if (appData) application = appData;
    }
    if (!application) throw new NotFoundException(`Loan application ${applicationId} not found`);
    const userId = application.userId || application.id;

    // 2. Upload statement to S3 & save local copy
    const fileExt = path.extname(file.originalname) || '.pdf';
    const s3Key = `vault/${userId}/bank_statement${fileExt}`;

    try {
      const localDir = path.join(process.cwd(), 'uploads', userId, 'bank_statement');
      await fs.promises.mkdir(localDir, { recursive: true });
      await fs.promises.writeFile(path.join(localDir, `file${fileExt}`), file.buffer);
      console.log(`[EVV Pipeline] Saved bank statement locally: ${localDir}`);
    } catch (localWriteError: any) {
      console.error('[EVV Pipeline] Local save failed:', localWriteError.message);
    }
    
    try {
      await this.s3Service.upload(s3Key, file.buffer, file.mimetype || 'application/pdf');
      console.log(`[EVV Pipeline] Uploaded statement to S3: ${s3Key}`);
    } catch (s3Error: any) {
      console.warn(`[EVV Pipeline] AWS S3 Upload notice: ${s3Error.message}`);
    }

    // 3. Upsert document record in ApplicationDocument
    const docData = {
      applicationId,
      docType: 'bank_statement',
      docName: 'Bank Statements (6 months)',
      fileName: file.originalname,
      filePath: s3Key,
      fileSize: file.size,
      mimeType: file.mimetype || 'application/pdf',
      status: 'uploaded',
      uploadedAt: new Date().toISOString()
    };

    try {
      const { data: existingDoc } = await this.db
        .from('ApplicationDocument')
        .select('id')
        .eq('applicationId', applicationId)
        .eq('docType', 'bank_statement')
        .maybeSingle();

      if (existingDoc) {
        await this.db
          .from('ApplicationDocument')
          .update({ ...docData, status: 'uploaded' })
          .eq('id', existingDoc.id);
      } else {
        await this.db
          .from('ApplicationDocument')
          .insert({
            id: 'app-doc-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            ...docData,
            isRequired: true
          });
      }
    } catch (docErr: any) {
      console.warn(`[EVV Pipeline] ApplicationDocument upsert notice: ${docErr.message}`);
    }

    // 4. Mark application as PROCESSING so frontend can poll
    try {
      await this.db
        .from('LoanApplication')
        .update({ evvStatus: 'PROCESSING', evvOverall: null, evvMonthlyBreakdown: [] })
        .eq('id', applicationId);
    } catch (appErr: any) {
      console.warn(`[EVV Pipeline] Application status update notice: ${appErr.message}`);
    }

    // 5. Run EVV computation in the background (fire-and-forget) — do not await
    //    This prevents HTTP request timeouts for large bank statement PDFs
    this.computeEvvInBackground(applicationId, file, adminId, adminName, application, s3Key).catch(err => {
      console.error(`[EVV Pipeline] Background computation error: ${err.message}`);
    });

    // 6. Respond immediately so the HTTP request does not time out
    return {
      success: true,
      status: 'PROCESSING',
      message: 'Bank statement uploaded. EVV calculation is running in the background. Please refresh in a minute.',
    };
  }

  private async computeEvvInBackground(
    applicationId: string,
    file: Express.Multer.File,
    adminId: string,
    adminName: string,
    application: any,
    s3Key: string
  ) {
    // EVV Intelligence Engine — Full output fields
    let evvOverall = 0;
    let evvMonthlyBreakdown: any = [];
    let evvStatus: 'COMPUTED' | 'FAILED' | 'MANUAL_REVIEW' = 'COMPUTED';
    let evvTotalSnapshots = 0;
    let evvTotalTransactions = 0;
    let evvPeriod: { from: string; to: string } | null = null;
    // Extended fields
    let evvScore: number | null = null;
    let evvGrade: string | null = null;
    let evvDecision: string | null = null;
    let evvDecisionReason: string | null = null;
    let evvRiskFlags: any = null;
    let evvBehaviours: any = null;
    let evvMonthlyMetrics: any = null;
    let evvValidation: any = null;
    let evvWeightBreakdown: any = null;
    let evvSnapshots: any = null;
    let errorMessage = '';

    try {
      console.log(`[EVV Background] Starting full EVV analysis for application ${applicationId}`);

      // Run the full EVV intelligence pipeline
      const report = await this.evvEngine.computeFullEvv(
        file.buffer,
        file.mimetype,
        file.originalname,
        applicationId,
      );

      evvStatus = report.status;
      evvOverall = report.overallEvv;
      evvMonthlyBreakdown = report.monthly_evv;
      evvTotalSnapshots = report.totalSnapshots;
      evvTotalTransactions = report.totalTransactions;
      evvPeriod = report.period;

      // New intelligence fields
      evvScore = report.evvScore?.score ?? null;
      evvGrade = report.evvScore?.grade ?? null;
      evvDecision = report.underwritingDecision?.decision ?? null;
      evvDecisionReason = report.underwritingDecision?.reasons?.join(' | ') ?? null;
      evvRiskFlags = report.riskFlags ?? null;
      evvBehaviours = report.behaviours ?? null;
      evvMonthlyMetrics = report.monthlyMetrics ?? null;
      evvWeightBreakdown = {
        breakdown: report.evvScore?.breakdown ?? [],
        sixComponents: report.evvScore?.evv6Components ?? null,
        bankPolicy: report.bankPolicy ?? null,
        disclaimer: report.disclaimer ?? "Internal EVV assessment — not an official bank sanction or automatic loan decision.",
      };
      // Store sampled snapshots (max 200 rows to avoid JSON size limits)
      evvSnapshots = (report.snapshots || []).slice(0, 200);

      console.log(
        `[EVV Background] Analysis complete for ${applicationId}: ` +
        `Score=${evvScore}/100 Grade=${evvGrade} Balance=₹${evvOverall} ` +
        `Decision=${evvDecision} Flags=${evvRiskFlags?.length ?? 0} Status=${evvStatus}`
      );

      // Update docName dynamically
      const numMonths = evvMonthlyBreakdown.length;
      this.db
        .from('ApplicationDocument')
        .update({ docName: `Bank Statements (${numMonths} months)` })
        .eq('applicationId', applicationId)
        .eq('docType', 'bank_statement')
        .then(({ error: docErr }) => {
          if (docErr) console.error(`[EVV Background] docName update failed: ${docErr.message}`);
        });

    } catch (err: any) {
      console.error(`[EVV Background] Full analysis exception: ${err.message}`);
      evvStatus = 'MANUAL_REVIEW';
      errorMessage = err.message?.includes('timeout') || err.message?.includes('aborted')
        ? 'AI processing timed out — try a smaller/clearer PDF.'
        : err.message || 'Error during EVV analysis.';
    }

    // Update database with all EVV intelligence results
    const updateData: any = {
      evvOverall,
      evvMonthlyBreakdown,
      evvStatus,
      evvTotalSnapshots,
      evvTotalTransactions,
      evvPeriod,
      // New intelligence fields
      evvScore,
      evvGrade,
      evvDecision,
      evvDecisionReason,
      evvRiskFlags,
      evvBehaviours,
      evvMonthlyMetrics,
      evvValidation,
      evvWeightBreakdown,
      evvSnapshots,
    };

    if (evvStatus === 'MANUAL_REVIEW' || evvStatus === 'FAILED') {
      updateData.remarks = `EVV Calculation: Manual Review Required — ${errorMessage}`;
    }

    const { error: updateError } = await this.db
      .from('LoanApplication')
      .update(updateData)
      .eq('id', applicationId);

    if (updateError) {
      console.error(`[EVV Background] Failed to update LoanApplication with EVV: ${updateError.message}`);
    }

    // Log notes & status history in parallel for speed
    const auditNotes = evvStatus === 'COMPUTED'
      ? `EVV Calculation completed. Overall balance: ₹${evvOverall.toLocaleString('en-IN')}. Monthly breakdowns saved.`
      : `EVV Calculation: Manual Review Required — ${errorMessage}`;

    await Promise.all([
      this.db.from('ApplicationNote').insert({
        id: 'note-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        applicationId,
        authorId: adminId,
        authorName: 'EVV Engine',
        content: auditNotes,
        type: 'general',
        isInternal: true
      }),
      this.createStatusHistory(applicationId, {
        fromStatus: application.status,
        toStatus: application.status,
        changedBy: adminId,
        changedByName: adminName,
        notes: auditNotes,
        isAutomatic: true
      }),
    ]);

    // Auto-sharing routing rules
    let autoShared = false;
    if (evvStatus === 'COMPUTED' && evvOverall > 5000 && application.bank && application.bank !== 'Pending Partner') {
      try {
        console.log(`[EVV Background] Auto-sharing application ${applicationId} to partner banks (EVV = ₹${evvOverall})`);
        await this.workflowService.submitApplicationToBank(
          applicationId,
          application.bank.toLowerCase().replace(/\s+/g, ''),
          application.bank,
          'System Automation'
        );
        autoShared = true;
        await this.db
          .from('LoanApplication')
          .update({ evvStatus: 'ROUTED_TO_BANK' })
          .eq('id', applicationId);
      } catch (shareError: any) {
        console.error(`[EVV Background] Auto-share failed: ${shareError.message}`);
      }
    }

    // Emit real-time dashboard activity
    this.eventEmitter.emit('dashboard.activity', {
      type: 'verification',
      msg: `EVV analyzed for Student #${application.applicationNumber || application.id.slice(-4)}. Overall: ₹${evvOverall.toLocaleString('en-IN')}. Status: ${evvStatus}.`,
      icon: evvStatus === 'COMPUTED' ? 'payments' : 'warning',
      color: evvStatus === 'COMPUTED' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100',
      actorName: 'EVV Engine',
      actorEmail: 'evv@vidyaloan.in',
      createdAt: new Date().toISOString()
    });

    console.log(`[EVV Background] Completed for application ${applicationId}: status=${evvStatus}, overall=₹${evvOverall}`);
  }

  async updateFollowUp(applicationId: string, staffId: string, data: { date: string; time?: string; notes?: string; status?: string }) {
    try {
      const payload: any = {
        followUpDate: data.date || null,
        followUpTime: data.time || null,
        followUpNotes: data.notes || null,
        followUpStatus: data.status || 'pending',
        followUpSetBy: staffId,
        updatedAt: new Date().toISOString(),
      };

      const { data: updatedApp, error } = await this.db
        .from('LoanApplication')
        .update(payload)
        .eq('id', applicationId)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST204') {
          console.warn(`[ApplicationService.updateFollowUp] followUp columns missing in schema cache — fallback note creation`);
          await this.addApplicationNote(applicationId, staffId, 'Staff Officer', {
            content: `[REMINDER] Date: ${data.date} ${data.time ? `Time: ${data.time}` : ''} Notes: ${data.notes || ''}`,
            type: 'reminder',
            isInternal: true,
          });
          return { success: true, fallback: true };
        }
        console.error(`[ApplicationService.updateFollowUp] Error updating loan application:`, error);
        throw error;
      }

      return { success: true, data: updatedApp };
    } catch (e: any) {
      console.error(`[ApplicationService.updateFollowUp] Error:`, e);
      return { success: false, message: e.message || 'Failed to update follow-up' };
    }
  }
}
