import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../auth/email.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private get db() {
    return this.supabase.getClient();
  }

  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create and store a new notification, then broadcast it via WebSocket events.
   */
  async createNotification(
    userId: string,
    title: string,
    body: string,
    type: string,
    metadata?: any,
  ) {
    this.logger.log(`Creating notification of type ${type} for User ID ${userId}: ${title}`);

    // Deduplication safety check: Prevent inserting duplicate notifications within a 15-second window
    try {
      const appId = metadata?.applicationId || metadata?.loanId;
      const fifteenSecsAgo = new Date(Date.now() - 15000).toISOString();

      let dupQuery = this.db
        .from('Notification')
        .select('*')
        .eq('userId', userId)
        .gte('timestamp', fifteenSecsAgo);

      const { data: recentNotifs } = await dupQuery;
      if (recentNotifs && recentNotifs.length > 0) {
        const duplicate = recentNotifs.find((n: any) => {
          const nAppId = n.metadata?.applicationId || n.metadata?.loanId;
          // Exact match on application ID + user OR exact title match
          if (appId && nAppId && String(appId).toLowerCase() === String(nAppId).toLowerCase()) {
            return true;
          }
          if (n.title && title && n.title.trim().toLowerCase() === title.trim().toLowerCase()) {
            return true;
          }
          return false;
        });

        if (duplicate) {
          this.logger.warn(`[NotificationService] Duplicate notification suppressed for User ID ${userId}: "${title}"`);
          return duplicate;
        }
      }
    } catch (dedupErr: any) {
      this.logger.warn(`[NotificationService] Deduplication check skipped: ${dedupErr?.message}`);
    }

    const newNotif = {
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId,
      title,
      body,
      type,
      isRead: false,
      timestamp: new Date().toISOString(),
      metadata: metadata || null,
    };

    const { data, error } = await this.db
      .from('Notification')
      .insert(newNotif)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to store notification in DB: ${error.message}`);
      // Fallback: still broadcast it even if DB fails so that real-time is alive
    }

    const payload = data || newNotif;

    // Emitting via EventEmitter2 so ChatGateway receives it and broadcasts via Socket.io
    this.eventEmitter.emit('notification.created', {
      ...payload,
      metadata,
    });

    return payload;
  }

  /**
   * Fetch paginated & filterable notifications for the logged-in user.
   */
  async getNotificationsForUser(
    user: any,
    type?: string,
    limit: number = 30,
    offset: number = 0,
  ) {
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isStaff = user.role === 'staff';
    const isBank = user.role === 'bank' || user.role === 'partner_bank';
    const userId = user.id || user.uid || user._id;

    let query = this.db.from('Notification').select('*', { count: 'exact' });

    // Staff see ONLY notifications explicitly assigned to their userId.
    // Admins & Super Admins oversee system-wide and staff notifications.
    // Bank partners see 'bank' / 'incoming_file' notifications.
    // Students see their own personal notifications.
    if (isAdmin) {
      query = query.or(`userId.eq.staff,userId.eq.system,userId.eq.all,userId.eq.${userId}`);
    } else if (isStaff) {
      query = query.or(`userId.eq.${userId},userId.eq.all`);
    } else if (isBank) {
      query = query.or(`userId.eq.bank,userId.eq.system,userId.eq.all,userId.eq.${userId}`);
    } else {
      query = query.or(`userId.eq.${userId},userId.eq.all`);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    query = query.eq('isRead', false);

    const { data, error, count } = await query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to fetch notifications: ${error.message}`);
      return { items: [], total: 0 };
    }

    const rawItems = data || [];
    const uniqueItems: any[] = [];
    const seenKeys = new Set<string>();

    for (const item of rawItems) {
      const appId = item.metadata?.applicationId || item.metadata?.loanId || '';
      const appNum = item.metadata?.applicationNumber || '';
      const titleClean = (item.title || '').replace(/^📋\s*/, '').replace(/^🚀\s*/, '').trim().toLowerCase();
      
      let key = item.id;
      if (appId || appNum) {
        key = `${item.userId}-${appId || appNum}-${titleClean.slice(0, 20)}`;
      } else {
        const timeBucket = item.timestamp ? item.timestamp.slice(0, 16) : '';
        key = `${item.userId}-${titleClean}-${timeBucket}`;
      }

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueItems.push(item);
      }
    }

    return {
      items: uniqueItems,
      total: uniqueItems.length,
    };
  }

  /**
   * Mark a single notification as read (actually delete it).
   */
  async markAsRead(notificationId: string, user: any) {
    try {
      const { data, error } = await this.db
        .from('Notification')
        .delete()
        .eq('id', notificationId)
        .select();

      if (error) {
        this.logger.warn(`Failed to delete notification ${notificationId}: ${error.message}`);
      }

      return data && data.length > 0 ? data[0] : { id: notificationId, isRead: true };
    } catch (err: any) {
      this.logger.warn(`Error marking notification ${notificationId} as read: ${err.message}`);
      return { id: notificationId, isRead: true };
    }
  }

  /**
   * Mark all notifications as read for the user's role or user ID (actually delete them).
   */
  async markAllAsRead(user: any) {
    try {
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      const isStaff = user.role === 'staff';
      const isBank = user.role === 'bank' || user.role === 'partner_bank';
      const userId = user.id || user.uid || user._id;

      let query = this.db.from('Notification').delete();

      if (isAdmin) {
        query = query.or(`userId.eq.staff,userId.eq.system,userId.eq.all,userId.eq.${userId}`);
      } else if (isStaff) {
        query = query.or(`userId.eq.${userId},userId.eq.all`);
      } else if (isBank) {
        query = query.or(`userId.eq.bank,userId.eq.system,userId.eq.all,userId.eq.${userId}`);
      } else {
        query = query.or(`userId.eq.${userId},userId.eq.all`);
      }

      const { data, error } = await query.select();

      if (error) {
        this.logger.warn(`Failed to delete all notifications: ${error.message}`);
      }

      return { success: true, count: data?.length || 0 };
    } catch (err: any) {
      this.logger.warn(`Error deleting all notifications: ${err.message}`);
      return { success: true, count: 0 };
    }
  }

  /**
   * Event listener for candidate registration (Disabled as per staff notification requirements:
   * Staff should only receive notifications for loan applications, not user registration/logins)
   */
  // @OnEvent('candidate.registered')
  async handleCandidateRegistered(payload: any) {
    // Disabled: User signups/logins do not generate staff notifications.
    return;
  }

  private formatAppRef(appNumber?: string, applicationId?: string): string {
    if (appNumber && appNumber !== 'null' && appNumber !== 'undefined' && appNumber.trim() !== '') {
      return `Application #${appNumber}`;
    }
    if (applicationId && applicationId !== 'null' && applicationId !== 'undefined' && applicationId.trim() !== '') {
      return `Application #${applicationId.slice(-6).toUpperCase()}`;
    }
    return 'Application';
  }

  private formatCurrency(amount?: number | string): string | null {
    if (!amount) return null;
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return null;
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(num);
    } catch {
      return `₹${num.toLocaleString('en-IN')}`;
    }
  }

  private isGenericBank(bankName?: string): boolean {
    if (!bankName) return true;
    const lower = bankName.toLowerCase().trim();
    return [
      'any bank',
      'any',
      'anybank',
      'pending partner',
      'pending',
      '—',
      '-',
      'none',
      'n/a',
      'unassigned',
      'not assigned',
      'not specified'
    ].includes(lower);
  }

  private async getApplicationDetails(applicationId?: string) {
    if (!applicationId) return null;
    try {
      const { data } = await this.db
        .from('LoanApplication')
        .select('id, applicationNumber, firstName, lastName, email, amount, loanType, universityName, country, bank, assignedStaffId, userId')
        .eq('id', applicationId)
        .maybeSingle();
      return data;
    } catch {
      return null;
    }
  }

  private async resolveAssignedStaffId(applicationId?: string): Promise<string | null> {
    if (!applicationId) return null;
    try {
      const { data: app } = await this.db
        .from('LoanApplication')
        .select('assignedStaffId')
        .eq('id', applicationId)
        .maybeSingle();
      if (app?.assignedStaffId && app.assignedStaffId !== 'unassigned' && app.assignedStaffId !== 'null') {
        return app.assignedStaffId;
      }
    } catch (err) {
      this.logger.error(`Error resolving assignedStaffId for app ${applicationId}: ${err.message}`);
    }
    return null;
  }

  /**
   * Event listener for loan.assigned — fires immediately after round-robin assignment.
   * Creates an in-app notification ONLY for the specific assigned staff member.
   */
  @OnEvent('loan.assigned')
  async handleLoanAssigned(payload: any) {
    try {
      const appId = payload.loanId || payload.applicationId;
      const app = await this.getApplicationDetails(appId);

      const candidateName = (app?.firstName || app?.lastName)
        ? `${app.firstName || ''} ${app.lastName || ''}`.trim()
        : (payload.candidateName || payload.name || 'Applicant');

      const appNum = app?.applicationNumber || payload.applicationNumber;
      const appRef = this.formatAppRef(appNum, appId);
      const loanType = app?.loanType || payload.loanType || 'education loan';
      const amountVal = app?.amount || payload.loanAmount || payload.amount;
      const amountStr = this.formatCurrency(amountVal);
      const uniName = app?.universityName || payload.universityName;
      const country = app?.country || payload.country;
      const uniStr = uniName ? (country ? `${uniName} (${country})` : uniName) : (country || '');
      const bank = app?.bank || payload.bank;
      const preferredBank = !this.isGenericBank(bank) ? bank : null;

      let body = `${candidateName} has submitted a ${loanType} application`;
      if (amountStr) body += ` for ${amountStr}`;
      if (uniStr) body += ` at ${uniStr}`;
      if (preferredBank) body += ` (Preferred Lender: ${preferredBank})`;
      body += `. Assigned to you for review. (${appRef})`;

      const targetUserId = payload.assignedStaffId || app?.assignedStaffId;
      if (targetUserId) {
        await this.createNotification(
          targetUserId,
          `📋 New Application Assigned: ${candidateName}`,
          body,
          'loan_assigned',
          {
            loanId: appId,
            applicationId: appId,
            applicationNumber: appNum || null,
            candidateName,
            candidateEmail: app?.email || payload.candidateEmail,
            loanAmount: amountVal || null,
            loanType,
            universityName: uniName || null,
            country: country || null,
            bank: preferredBank,
            assignedBy: payload.assignedBy,
          }
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle loan.assigned event: ${error.message}`);
    }
  }

  /**
   * Event listener for application creation.
   * Sends notification ONLY to the staff member assigned to that application.
   */
  @OnEvent('application.created')
  async handleApplicationCreated(payload: any) {
    try {
      const appId = payload.applicationId || payload.loanId;
      const app = await this.getApplicationDetails(appId);

      const candidateName = (app?.firstName || app?.lastName)
        ? `${app.firstName || ''} ${app.lastName || ''}`.trim()
        : (payload.candidateName || 'Candidate');

      const appNum = app?.applicationNumber || payload.applicationNumber;
      const appRef = this.formatAppRef(appNum, appId);
      const loanType = app?.loanType || payload.loanType || 'education loan';
      const amountVal = app?.amount || payload.loanAmount || payload.amount;
      const amountStr = this.formatCurrency(amountVal);
      const uniName = app?.universityName || payload.universityName;
      const country = app?.country || payload.country;
      const uniStr = uniName ? (country ? `${uniName} (${country})` : uniName) : (country || '');
      const bank = app?.bank || payload.bank;
      const preferredBank = !this.isGenericBank(bank) ? bank : null;

      let body = `${candidateName} submitted a new ${loanType} application`;
      if (amountStr) body += ` for ${amountStr}`;
      if (uniStr) body += ` at ${uniStr}`;
      if (preferredBank) body += ` (Preferred Lender: ${preferredBank})`;
      body += `. Assigned to you for review. (${appRef})`;

      const targetUserId = app?.assignedStaffId || payload.assignedStaffId || (await this.resolveAssignedStaffId(appId));
      if (targetUserId) {
        await this.createNotification(
          targetUserId,
          `📋 New Application Assigned: ${candidateName}`,
          body,
          'application_created',
          {
            applicationId: appId,
            applicationNumber: appNum || null,
            userId: payload.userId || app?.userId,
            candidateName,
            candidateEmail: app?.email || payload.candidateEmail,
            loanAmount: amountVal || null,
            loanType,
            universityName: uniName || null,
            country: country || null,
            bank: preferredBank,
            createdAt: payload.createdAt || new Date().toISOString(),
          }
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle application created event: ${error.message}`);
    }
  }

  /**
   * Event listener for bank note/remark added
   * Creates a notification ONLY for the assigned staff member
   */
  @OnEvent('bank.note.added')
  async handleBankNoteAdded(payload: any) {
    try {
      const candidateName = payload.candidateName || 'Candidate';
      let cleanRemarks = payload.remarks || '';
      const matches = cleanRemarks.match(/^\[.*?\]:\s*(.*)$/);
      if (matches) {
        cleanRemarks = matches[1];
      }
      const appRef = this.formatAppRef(payload.applicationNumber, payload.applicationId);

      const targetUserId = await this.resolveAssignedStaffId(payload.applicationId);
      if (targetUserId) {
        await this.createNotification(
          targetUserId,
          `📝 Bank Note Added: ${candidateName}`,
          `A new note was added by ${payload.updatedBy || 'Bank Partner'}: "${cleanRemarks.length > 60 ? cleanRemarks.substring(0, 57) + '...' : cleanRemarks}"${appRef ? ' (' + appRef + ')' : ''}`,
          'bank_note_added',
          {
            applicationId: payload.applicationId,
            applicationNumber: payload.applicationNumber,
            userId: payload.userId,
            candidateName: payload.candidateName,
            remarks: payload.remarks,
            updatedBy: payload.updatedBy,
            userRole: payload.userRole
          }
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle bank note added event: ${error.message}`);
    }
  }

  /**
   * Event listener for application submission.
   * Sends notification ONLY to the staff member assigned to that application.
   */
  @OnEvent('application.submitted')
  async handleApplicationSubmitted(payload: any) {
    try {
      const appId = payload.applicationId || payload.loanId;
      const app = await this.getApplicationDetails(appId);

      const candidateName = (app?.firstName || app?.lastName)
        ? `${app.firstName || ''} ${app.lastName || ''}`.trim()
        : (payload.candidateName || 'Candidate');

      const appNum = app?.applicationNumber || payload.applicationNumber;
      const appRef = this.formatAppRef(appNum, appId);
      const loanType = app?.loanType || payload.loanType || 'education loan';
      const amountVal = app?.amount || payload.loanAmount || payload.amount;
      const amountStr = this.formatCurrency(amountVal);
      const uniName = app?.universityName || payload.universityName;
      const country = app?.country || payload.country;
      const uniStr = uniName ? (country ? `${uniName} (${country})` : uniName) : (country || '');
      const bank = app?.bank || payload.bank;
      const preferredBank = !this.isGenericBank(bank) ? bank : null;

      let body = `${candidateName} submitted a ${loanType} application`;
      if (amountStr) body += ` for ${amountStr}`;
      if (uniStr) body += ` at ${uniStr}`;
      if (preferredBank) body += ` (Preferred Lender: ${preferredBank})`;
      body += `. Ready for document verification. (${appRef})`;

      const targetUserId = app?.assignedStaffId || (await this.resolveAssignedStaffId(appId));
      if (targetUserId) {
        await this.createNotification(
          targetUserId,
          `🚀 Application Submitted: ${candidateName}`,
          body,
          'application_submitted',
          {
            applicationId: appId,
            applicationNumber: appNum || null,
            userId: payload.userId || app?.userId,
            candidateName,
            candidateEmail: app?.email || payload.candidateEmail,
            loanAmount: amountVal || null,
            loanType,
            universityName: uniName || null,
            country: country || null,
            bank: preferredBank,
            submittedAt: payload.submittedAt || new Date().toISOString(),
          }
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle application submitted event: ${error.message}`);
    }
  }

  /**
   * Event listener for document upload
   * Creates a notification ONLY for the assigned staff member
   */
  @OnEvent('document.uploaded')
  async handleDocumentUploaded(payload: any) {
    try {
      const candidateName = payload.candidateName || 'Candidate';
      const docName = payload.documentName || payload.documentType;
      const appRef = this.formatAppRef(payload.applicationNumber, payload.applicationId);

      const targetUserId = await this.resolveAssignedStaffId(payload.applicationId);
      if (targetUserId) {
        await this.createNotification(
          targetUserId,
          `📄 Document Uploaded: ${docName}`,
          `${candidateName} has uploaded ${docName}${appRef ? ' for ' + appRef : ''}. Status: ${payload.status}`,
          'document_uploaded',
          {
            applicationId: payload.applicationId,
            applicationNumber: payload.applicationNumber,
            userId: payload.userId,
            candidateName: payload.candidateName,
            candidateEmail: payload.candidateEmail,
            documentType: payload.documentType,
            documentName: payload.documentName,
            status: payload.status,
            createdAt: payload.createdAt
          }
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle document uploaded event: ${error.message}`);
    }
  }

  /**
   * Event listener for document rejection
   * Creates a notification for the student about document rejection
   */
  @OnEvent('document.rejected')
  async handleDocumentRejected(payload: any) {
    try {
      const docName = payload.documentName || payload.documentType || 'document';
      const reason = payload.rejectionReason || 'Document quality or format does not meet requirements';

      await this.createNotification(
        payload.userId,
        `❌ Document Rejected: ${docName}`,
        `Your uploaded ${docName} has been rejected. Reason: ${reason}`,
        'document_rejected',
        {
          documentId: payload.documentId,
          documentType: payload.documentType,
          documentName: payload.documentName,
          rejectionReason: reason,
          rejectedAt: payload.rejectedAt,
        }
      );

      // Fetch student's email and send document rejection notification email
      if (payload.userId) {
        const { data: student } = await this.db
          .from('User')
          .select('email, firstName, lastName')
          .eq('id', payload.userId)
          .maybeSingle();

        if (student?.email) {
          const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
          await this.emailService.sendDocumentRejectionEmail(
            student.email,
            studentName,
            docName,
            reason,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to handle document rejected event: ${error.message}`);
    }
  }

  /**
   * Event listener for document acceptance/verification
   * Creates a notification for the student about document approval
   */
  @OnEvent('document.verified')
  async handleDocumentVerified(payload: any) {
    try {
      const docName = payload.documentName || payload.documentType;
      await this.createNotification(
        payload.userId,
        `✅ Document Approved: ${docName}`,
        `Your uploaded ${docName} has been successfully verified.`,
        'document_verified',
        {
          documentId: payload.documentId,
          documentType: payload.documentType,
          documentName: payload.documentName,
          verifiedAt: payload.verifiedAt,
        }
      );

      // Fetch student's registered email and dispatch verification email notification
      if (payload.userId) {
        const { data: student } = await this.db
          .from('User')
          .select('email, firstName, lastName')
          .eq('id', payload.userId)
          .maybeSingle();

        if (student?.email) {
          const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
          await this.emailService.sendDocumentVerifiedEmail(
            student.email,
            studentName,
            docName,
            payload.documentType,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to handle document verified event: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BANK-SPECIFIC REAL-TIME NOTIFICATIONS
  // These notifications are sent to userId='bank' so the
  // ChatGateway broadcasts them to the room_bank Socket.io room.
  // ─────────────────────────────────────────────────────────────

  /**
   * Notify bank when a new application file is submitted to them
   */
  @OnEvent('bank.submission.created')
  async handleBankSubmissionCreated(payload: any) {
    try {
      await this.createNotification(
        'bank',
        `📥 New Application Received`,
        `A new loan application has been submitted to ${payload.bankName || 'your bank'}. Application ID: ${payload.applicationId || 'N/A'}`,
        'bank_application_received',
        {
          submissionId: payload.submissionId,
          applicationId: payload.applicationId,
          bankId: payload.bankId,
          bankName: payload.bankName,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank submission event: ${error.message}`);
    }
  }

  /**
   * Notify bank when staff logs a file with LAN
   */
  @OnEvent('bank.file.logged')
  async handleBankFileLogged(payload: any) {
    try {
      await this.createNotification(
        'bank',
        `🗂️ File Logged: LAN ${payload.lanNumber}`,
        `Application has been logged with LAN number ${payload.lanNumber}. Submission ID: ${payload.submissionId}`,
        'bank_file_logged',
        {
          submissionId: payload.submissionId,
          applicationId: payload.applicationId,
          lanNumber: payload.lanNumber,
          bankId: payload.bankId,
          bankName: payload.bankName,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank file logged event: ${error.message}`);
    }
  }

  /**
   * Notify bank when a query is raised on an application
   */
  @OnEvent('bank.query.raised')
  async handleBankQueryRaised(payload: any) {
    try {
      await this.createNotification(
        'bank',
        `❓ Query Raised on Application`,
        `A new query has been raised for submission ${payload.submissionId}. Query ID: ${payload.queryId}. Please respond promptly.`,
        'bank_query_raised',
        {
          submissionId: payload.submissionId,
          applicationId: payload.applicationId,
          queryId: payload.queryId,
          bankId: payload.bankId,
          bankName: payload.bankName,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank query raised event: ${error.message}`);
    }
  }

  /**
   * Notify bank when application is sanctioned (approved)
   */
  @OnEvent('bank.application.sanctioned')
  async handleBankApplicationSanctioned(payload: any) {
    try {
      const amount = payload.sanctionAmount
        ? `₹${Number(payload.sanctionAmount).toLocaleString('en-IN')}`
        : 'the requested amount';
      await this.createNotification(
        'bank',
        `✅ Application Sanctioned`,
        `Application has been successfully sanctioned for ${amount}. Submission ID: ${payload.submissionId}`,
        'bank_sanctioned',
        {
          submissionId: payload.submissionId,
          applicationId: payload.applicationId,
          sanctionAmount: payload.sanctionAmount,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank sanctioned event: ${error.message}`);
    }
  }

  /**
   * Notify bank when application gets a conditional sanction
   */
  @OnEvent('bank.application.conditional_sanctioned')
  async handleBankConditionalSanctioned(payload: any) {
    try {
      await this.createNotification(
        'bank',
        `📋 Conditional Sanction Issued`,
        `Application has been conditionally sanctioned with ${payload.conditionCount || 'some'} condition(s) to be fulfilled. Submission ID: ${payload.submissionId}`,
        'bank_conditional_sanctioned',
        {
          submissionId: payload.submissionId,
          applicationId: payload.applicationId,
          conditionCount: payload.conditionCount,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank conditional sanction event: ${error.message}`);
    }
  }

  /**
   * Notify bank when a counter offer is accepted
   */
  @OnEvent('bank.counter_offer.accepted')
  async handleBankCounterOfferAccepted(payload: any) {
    try {
      await this.createNotification(
        'bank',
        `🤝 Counter Offer Accepted`,
        `The applicant has accepted the counter offer for submission ${payload.submissionId}. Ready to proceed to sanctioned stage.`,
        'bank_counter_offer',
        {
          submissionId: payload.submissionId,
          applicationId: payload.applicationId,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank counter offer accepted event: ${error.message}`);
    }
  }

  /**
   * Notify bank when all conditions on a conditional sanction are met
   */
  @OnEvent('bank.conditions.all_met')
  async handleBankConditionsAllMet(payload: any) {
    try {
      await this.createNotification(
        'bank',
        `🎯 All Conditions Met`,
        `All conditions for conditional sanction have been fulfilled for submission ${payload.submissionId}. Ready for final sanctioning.`,
        'bank_sanctioned',
        {
          submissionId: payload.submissionId,
          applicationId: payload.applicationId,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank conditions all met event: ${error.message}`);
    }
  }

  /**
   * Notify bank when a new support message is received for bank conversations
   */
  @OnEvent('bank.chat.received')
  async handleBankChatReceived(payload: any) {
    try {
      await this.createNotification(
        'bank',
        `💬 New Message from Support`,
        payload.content || 'You have a new message from support.',
        'bank_chat_received',
        {
          conversationId: payload.conversationId,
          senderName: payload.senderName || 'Support',
          bank: payload.metadata?.bank || null,
        }
      );
    } catch (error) {
      this.logger.error(`Failed to handle bank chat received event: ${error.message}`);
    }
  }

  /**
   * Notify staff when a support message is received
   */
  @OnEvent('staff.chat.received')
  async handleStaffChatReceived(payload: any) {
    try {
      const typeLabel = payload.senderType === 'customer' ? 'Student' : 'Bank Partner';
      const assignedStaffId = payload.metadata?.assignedStaffId;
      const targetUserId = (assignedStaffId && !['unassigned', 'null', 'undefined', ''].includes(String(assignedStaffId).trim().toLowerCase()))
        ? assignedStaffId
        : 'staff';

      const appNum = payload.metadata?.applicationNumber ? ` (App #${payload.metadata.applicationNumber})` : '';
      const channelLabel = payload.metadata?.channel === 'whatsapp' ? 'WhatsApp' : 'Chat';

      await this.createNotification(
        targetUserId,
        `💬 ${channelLabel} message from ${payload.senderName || typeLabel}${appNum}`,
        payload.content || 'You have a new support chat message.',
        'staff_chat_received',
        {
          conversationId: payload.conversationId,
          senderName: payload.senderName,
          senderType: payload.senderType,
          applicationId: payload.metadata?.applicationId,
          applicationNumber: payload.metadata?.applicationNumber,
          channel: payload.metadata?.channel || 'chat',
        }
      );
    } catch (error: any) {
      this.logger.error(`Failed to handle staff chat received event: ${error?.message}`);
    }
  }

  /**
   * Send PDF receipt via email when loan disbursement is completed
   */
  @OnEvent('bank.application.disbursed')
  async handleBankApplicationDisbursed(payload: {
    applicationId: string;
    userId: string;
    amount: number;
    bankId?: string;
    utrNumber?: string;
    trancheNumber?: number;
    transferMode?: string;
  }) {
    try {
      this.logger.log(`[NotificationService] Handling disbursement notification for app: ${payload.applicationId}`);

      // 1. Fetch LoanApplication
      const { data: application } = await this.db
        .from('LoanApplication')
        .select('*')
        .eq('id', payload.applicationId)
        .single();

      if (!application) {
        this.logger.warn(`Loan application with ID ${payload.applicationId} not found for disbursement notification.`);
        return;
      }

      // 2. Fetch User to get the email
      let email = application.email;
      let borrowerName = `${application.firstName || ''} ${application.lastName || ''}`.trim();

      if (!email || !borrowerName) {
        const { data: user } = await this.db
          .from('User')
          .select('email, firstName, lastName')
          .eq('id', payload.userId || application.userId)
          .single();

        if (user) {
          if (!email) email = user.email;
          if (!borrowerName) borrowerName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        }
      }

      if (!email) {
        this.logger.warn(`No email found for borrower of loan application ${payload.applicationId}. Cannot send email.`);
        return;
      }

      // 3. Prepare parameters for PDF
      const details = {
        applicationNumber: application.applicationNumber || 'N/A',
        borrowerName: borrowerName || 'Valued Customer',
        bankName: application.bankName || payload.bankId || 'Partner Bank',
        amount: payload.amount || 0,
        utrNumber: payload.utrNumber || 'N/A',
        trancheNumber: payload.trancheNumber || 1,
        transferMode: payload.transferMode || 'IMPS/NEFT/RTGS',
        date: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      };

      // 4. Generate PDF buffer
      const pdfBuffer = await this.generateDisbursementPdf(details);
      const appPdfBuffer = await this.emailService.generateApplicationPdf(application).catch(err => {
        this.logger.error(`Failed to generate application PDF for disbursement email: ${err.message}`);
        return null;
      });

      // 5. Build premium email body
      const subject = `Successful Disbursement of Your Education Loan - ${details.applicationNumber}`;
      const emailHtml = this.buildDisbursementEmailHtml(details);

      const attachments: any[] = [
        {
          filename: `Disbursement_Receipt_${details.applicationNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];

      if (appPdfBuffer) {
        attachments.push({
          filename: `Loan_Application_${details.applicationNumber}.pdf`,
          content: appPdfBuffer,
          contentType: 'application/pdf',
        });
      }

      // 6. Send Email with PDF attachments
      await this.emailService.sendMail(
        email,
        subject,
        emailHtml,
        `Dear ${details.borrowerName}, We are pleased to inform you that your education loan tranche of Rs. ${details.amount.toLocaleString('en-IN')} has been successfully disbursed. Please find the receipt attached.`,
        undefined,
        attachments
      );

      // 7. Create in-app notification as well
      await this.createNotification(
        payload.userId || application.userId,
        `💸 Loan Disbursement Successful`,
        `Tranche ${details.trancheNumber} of ₹${details.amount.toLocaleString('en-IN')} has been disbursed. Receipt has been emailed to you.`,
        'bank_disbursed',
        {
          applicationId: payload.applicationId,
          amount: payload.amount,
          utrNumber: details.utrNumber,
        }
      );

    } catch (error) {
      this.logger.error(`Failed to handle bank application disbursed event: ${error.message}`, error.stack);
    }
  }

  /**
   * Programmatically generate premium disbursement receipt PDF buffer using pdfkit
   */
  public generateDisbursementPdf(details: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // Styling Palette
        const primaryColor = '#6605c7'; // Vidya Loan Deep Purple
        const textColor = '#1f2937';
        const lightGray = '#f3f4f6';
        const darkGray = '#4b5563';

        const drawWatermark = () => {
          doc.save();
          doc.opacity(0.04);
          doc.fillColor(primaryColor);
          doc.fontSize(70);
          doc.translate(doc.page.width / 2, doc.page.height / 2);
          doc.rotate(-30);
          doc.text('VIDYALOAN', -200, -35, { align: 'center', width: 400 });
          doc.restore();
        };

        // Draw on the first page and register for subsequent pages
        drawWatermark();
        doc.on('pageAdded', () => {
          drawWatermark();
        });

        // --- Branded Header ---
        doc.fillColor(primaryColor)
           .fontSize(24)
           .text('Vidya Loan', 50, 50, { characterSpacing: 1 });

        doc.fillColor(darkGray)
           .fontSize(10)
           .text('Education Loan Portal', 50, 80);

        doc.fillColor(textColor)
           .fontSize(16)
           .text('DISBURSEMENT RECEIPT', 350, 55, { align: 'right' });

        doc.strokeColor(primaryColor)
           .lineWidth(2)
           .moveTo(50, 100)
           .lineTo(550, 100)
           .stroke();

        // --- Details Section ---
        doc.y = 130;

        // Draw a light grey background card for the amount
        doc.fillColor(lightGray)
           .rect(50, doc.y, 500, 70)
           .fill();

        doc.fillColor(textColor)
           .fontSize(11)
           .text('DISBURSED AMOUNT', 70, doc.y + 15);

        doc.fillColor(primaryColor)
           .fontSize(22);
        doc.font('Helvetica-Bold')
           .text(`INR ${Number(details.amount).toLocaleString('en-IN')}.00`, 70, doc.y + 35);
        doc.font('Helvetica');

        doc.y += 90;

        // Details grid
        const drawGridItem = (label: string, value: string, x: number, y: number) => {
          doc.fillColor(darkGray)
             .fontSize(10)
             .text(label, x, y);
          doc.fillColor(textColor)
             .fontSize(11)
             .text(value, x, y + 15, { width: 220 });
        };

        const startY = doc.y;
        drawGridItem('Application Number', details.applicationNumber, 50, startY);
        drawGridItem('Borrower Name', details.borrowerName, 300, startY);

        doc.y += 45;
        const secondY = doc.y;
        drawGridItem('Lending Institution (Bank)', details.bankName, 50, secondY);
        drawGridItem('Disbursement Date', details.date, 300, secondY);

        doc.y += 45;
        const thirdY = doc.y;
        drawGridItem('Transaction Reference (UTR)', details.utrNumber, 50, thirdY);
        drawGridItem('Payment Mode', details.transferMode, 300, thirdY);

        doc.y += 45;
        const fourthY = doc.y;
        drawGridItem('Tranche Number', `Tranche ${details.trancheNumber}`, 50, fourthY);

        // Divider
        doc.y += 60;
        doc.strokeColor('#e5e7eb')
           .lineWidth(1)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();

        // --- Note/Disclaimer ---
        doc.y += 20;
        doc.fillColor(darkGray)
           .fontSize(9)
           .text('Please Note:', 50, doc.y, { underline: true });

        doc.text(
          '1. This receipt is digitally generated by Vidya Loan platform upon confirmation of payment from the lending partner.\n' +
          '2. The actual credit time to the beneficiary account might vary depending on bank clearing cycles.\n' +
          '3. For any discrepancies or queries regarding this transfer, please reach out to support@vidyaloans.in or raise a ticket in your student portal.',
          50, doc.y + 15,
          { lineGap: 4, width: 500 }
        );

        // --- Footer ---
        doc.fontSize(8)
           .fillColor('#9ca3af')
           .text('Thank you for choosing Vidya Loan for your education journey.', 50, 700, { align: 'center', width: 500 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Build premium HTML body for disbursement confirmation email
   */
  private buildDisbursementEmailHtml(details: any): string {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loan Disbursement Confirmed</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7f6;
      margin: 0;
      padding: 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #0d47a1;
      color: #ffffff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    .content {
      padding: 24px;
      color: #333333;
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      background-color: #e8f5e9;
      color: #2e7d32;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 16px;
    }
    .amount-box {
      background: #f5f3ff;
      border-left: 4px solid #6605c7;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .amount-label {
      color: #7c3aed;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .amount-value {
      font-size: 28px;
      font-weight: bold;
      color: #6605c7;
      margin-top: 4px;
    }
    .details-card {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
    }
    .details-row td {
      padding: 8px 0;
      border-bottom: 1px dashed #dee2e6;
    }
    .details-table tr:last-child td {
      border-bottom: none;
    }
    .label {
      color: #6c757d;
      font-size: 14px;
      text-align: left;
    }
    .value {
      font-weight: 600;
      color: #212529;
      font-size: 14px;
      text-align: right;
    }
    .btn-container {
      text-align: center;
      margin-top: 28px;
    }
    .btn {
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: 600;
      display: inline-block;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #6c757d;
      border-top: 1px solid #e9ecef;
    }
  </style>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px;">

  <div class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div class="header" style="background-color: #0d47a1; color: #ffffff; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 600;">🎓 VidyaLoan</h1>
    </div>

    <!-- Content Body -->
    <div class="content" style="padding: 24px; color: #333333; line-height: 1.6;">
      <span class="badge" style="display: inline-block; background-color: #e8f5e9; color: #2e7d32; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; margin-bottom: 16px;">💸 Loan Disbursed</span>
      
      <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Great news, ${details.borrowerName || 'Applicant'}!</h2>
      <p>Your education loan disbursement transaction has been completed successfully by <strong>${details.bankName}</strong>.</p>

      <!-- Disbursed Amount Box -->
      <div class="amount-box" style="background: #f5f3ff; border-left: 4px solid #6605c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <div class="amount-label" style="color: #7c3aed; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Disbursed</div>
        <div class="amount-value" style="font-size: 28px; font-weight: bold; color: #6605c7; margin-top: 4px;">₹${Number(details.amount || 0).toLocaleString('en-IN')}.00</div>
      </div>

      <!-- Transaction Details Card -->
      <div class="details-card" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <table class="details-table" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Application ID:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">#${details.applicationNumber}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Transaction Ref (UTR):</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${details.utrNumber}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Partner Bank:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${details.bankName}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Tranche:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">Tranche ${details.trancheNumber}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Payment Mode:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${details.transferMode}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Disbursement Date:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${details.date}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; text-align: left;">Status:</td>
            <td class="value" style="font-weight: 600; color: #2e7d32; font-size: 14px; padding: 8px 0; text-align: right;">Disbursed / Completed</td>
          </tr>
        </table>
      </div>

      <p>We have attached the official <strong>Disbursement Receipt PDF</strong> and application document package to this email for your records.</p>

      <!-- Action Button -->
      <div class="btn-container" style="text-align: center; margin-top: 28px;">
        <a href="${frontendUrl}/dashboard" class="btn" style="background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">View Disbursement Details</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer" style="background-color: #f8f9fa; padding: 16px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e9ecef;">
      <p style="margin: 0 0 8px;">Need help? Contact support at support@vidyaloans.in</p>
      <p style="margin: 0;">&copy; ${year} VidyaLoans Pvt. Ltd. All rights reserved.<br>
      <a href="${frontendUrl}/privacy-policy" style="color: #6c757d; text-decoration: underline;">Privacy Policy</a> &nbsp;·&nbsp;
      <a href="${frontendUrl}/terms-conditions" style="color: #6c757d; text-decoration: underline;">Terms of Service</a></p>
    </div>
  </div>

</body>
</html>
    `;
  }
}

