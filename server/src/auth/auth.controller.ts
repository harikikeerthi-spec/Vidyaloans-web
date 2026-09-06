import { Controller, Post, Body, Get, Param, Delete, Req, Res, Inject, forwardRef, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../referral/referral.service';
import { AssignmentService } from '../assignment/assignment.service';
import { CsrfService } from './csrf.service';
import { EmailService } from './email.service';
import { UserGuard } from './user.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private referralService: ReferralService,
    private csrfService: CsrfService,
    private emailService: EmailService,
    @Inject(forwardRef(() => AssignmentService)) private assignmentService: AssignmentService,
  ) { }

  /**
   * Endpoint to initialize/retrieve Double CSRF Token and set cookie
   * GET /api/auth/csrf-token
   */
  @Get('csrf-token')
  getCsrfToken(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const token = this.csrfService.generateCsrfToken(req, res);
    return {
      success: true,
      csrfToken: token,
    };
  }

  /**
   * Check if a user exists in the system
   * GET /auth/check-user/:email
   * @param email - User's email address
   * @returns { exists: boolean, message: string }
   */
  @Get('check-user/:email')
  async checkUserExists(@Param('email') email: string) {
    return this.authService.checkUserExists(email);
  }

  // ==================== UNIFIED OTP FLOW ====================

  /**
   * Step 1: Send OTP to email (Works for both new and existing users)
   * POST /auth/send-otp
   * @body email: string (required)
   * @returns { success: boolean, message: string, userExists: boolean }
   */
  @Post('send-otp')
  async sendOtp(@Body() body: { email: string; portal?: string; role?: string; requiredRole?: string }) {
    if (!body || !body.email) {
      return {
        success: false,
        message: 'Email address is required',
      };
    }
    const portal = body.portal || body.role || body.requiredRole;
    return this.authService.sendOtpUnified(body.email, portal);
  }

  @Post('request-otp')
  async requestOtp(@Body() body: { email: string; portal?: string }) {
    if (!body || !body.email) {
      return {
        success: false,
        message: 'Email address is required',
      };
    }
    const user = await this.usersService.findOne(body.email);
    if (!user || !['agent', 'partner_agent', 'admin', 'super_admin'].includes(user.role)) {
      return {
        success: false,
        message: 'Access Denied: No agent partner account found with this email address.',
      };
    }

    const result = await this.authService.sendOtpUnified(body.email, 'agent');
    if (!result.success) {
      return result;
    }

    let businessName = `${user.firstName || 'Partner'} Agency`;
    try {
      const fs = require('fs');
      const path = require('path');
      const profilePath = path.join(process.cwd(), 'scratch', 'agent_profiles.json');
      if (fs.existsSync(profilePath)) {
        const data = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        if (data[user.id] && data[user.id].businessName) {
          businessName = data[user.id].businessName;
        }
      }
    } catch (e) { }

    return {
      ...result,
      businessName
    };
  }

  /**
   * Step 2: Verify OTP and determine user flow
   * POST /auth/verify-otp
   * @body email: string (required), otp: string (required, 6 digits)
   * @returns { 
   *   success: boolean, 
   *   access_token: string, 
   *   userExists: boolean,
   *   hasUserDetails: boolean,
   *   message: string
   * }
   * 
   * Flow:
   * - If userExists: true && hasUserDetails: true → Navigate to homepage
   * - If userExists: true && hasUserDetails: false → Navigate to user-details.html
   * - If userExists: false → Navigate to user-details.html (new user)
   */
  @Post('verify-otp')
  async verifyOtp(
    @Req() req: any,
    @Body() body: { email: string; otp: string; referralCode?: string }
  ) {
    if (!body || !body.email || !body.otp) {
      return {
        success: false,
        message: 'Email and OTP are both required',
      };
    }
    const result = await this.authService.verifyOtpUnified(body.email, body.otp);

    // Read referral code from body OR request cookie
    let referralCode = body.referralCode;
    if (!referralCode && req.headers?.cookie) {
      const cookies = req.headers.cookie;
      const match = cookies.match(/(?:^|; )referral_code=([^;]*)/);
      if (match) {
        referralCode = decodeURIComponent(match[1]);
      }
    }

    // If signup is successful and a referral code is resolved, record it
    if (result.success && !result.userExists && referralCode) {
      try {
        await this.referralService.recordReferral(referralCode, body.email, result.userId);
      } catch (error) {
        console.error('Failed to record referral during signup:', error);
      }
    }

    return result;
  }

  /**
   * Submit loan application directly from landing page with OTP verification
   * POST /auth/landing-page-submit
   */
  @Post('landing-page-submit')
  async landingPageSubmit(@Body() body: any) {
    if (!body || !body.email || !body.otp) {
      return {
        success: false,
        message: 'Email and OTP verification code are required',
      };
    }
    return this.authService.submitLandingPageApplication(body);
  }


  /**
   * Firebase Authentication
   * POST /auth/firebase
   * @body idToken: string (required)
   * @returns Internal JWT tokens and user profile
   */
  @Post('firebase')
  async firebaseLogin(@Body() body: { idToken: string }) {
    if (!body || !body.idToken) {
      return {
        success: false,
        message: 'Firebase ID Token is required',
      };
    }
    return this.authService.authenticateFirebaseUser(body.idToken);
  }

  /**
   * Refresh access token using refresh token
   * POST /auth/refresh
   * @body refresh_token: string (required)
   * @returns { success: boolean, access_token: string, refresh_token: string, message: string }
   */
  @Post('refresh')
  async refreshToken(@Body() body: { refresh_token: string }) {
    if (!body || !body.refresh_token) {
      return {
        success: false,
        message: 'Refresh token is required',
      };
    }
    return this.authService.refreshTokens(body.refresh_token);
  }

  /**
   * Logout user by invalidating refresh token
   * POST /auth/logout
   * @body email: string (required)
   * @returns { success: boolean, message: string }
   */
  @Post('logout')
  async logout(@Body() body: { email: string }) {
    if (!body || !body.email) {
      return {
        success: false,
        message: 'Email is required',
      };
    }
    return this.authService.logout(body.email);
  }

  // ==================== USER DASHBOARD ====================

  /**
   * Get user dashboard data and profile information
   * POST /auth/dashboard
   * @body email: string (required)
   * @returns { success: boolean, user: { id, email, firstName, lastName, phoneNumber, dateOfBirth, createdAt } }
   */
  @Post('dashboard')
  async getUserDashboard(@Body() body: { email: string }) {
    if (!body || !body.email) {
      return {
        success: false,
        message: 'Email is required to fetch dashboard',
      };
    }
    try {
      return await this.authService.getUserDashboard(body.email);
    } catch (error) {
      console.error('[AuthController.getUserDashboard] Fatal Error:', error);
      return {
        success: false,
        message: 'Internal server error occurred while fetching dashboard',
        error: error.message
      };
    }
  }

  /**
   * Get complete dashboard data including applications and documents
   * POST /auth/dashboard-data
   * @body userId: string (required)
   * @returns { success: boolean, data: { applications: [], documents: [] } }
   */
  @Post('dashboard-data')
  async getDashboardData(@Body() body: { userId: string }) {
    if (!body || !body.userId) {
      return {
        success: false,
        message: 'User ID is required',
      };
    }
    try {
      const data = await this.usersService.getUserDashboardData(body.userId);
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('getDashboardData error:', error);
      return {
        success: false,
        message: `Failed to fetch dashboard data: ${error.message}`,
      };
    }
  }

  @Get('dashboard-data/:userId')
  async getDashboardDataByParam(@Param('userId') userId: string) {
    if (!userId) {
      return {
        success: false,
        message: 'User ID is required',
      };
    }
    try {
      const data = await this.usersService.getUserDashboardData(userId);
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('getDashboardData error:', error);
      return {
        success: false,
        message: `Failed to fetch dashboard data: ${error.message}`,
      };
    }
  }

  /**
   * Update user details (first name, last name, email, phone/mobile, DOB, passport, academic, etc.)
   * POST /auth/update-details
   */
  @Post('update-details')
  async updateUserDetails(@Body() body: {
    email?: string;
    newEmail?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    mobile?: string;
    dateOfBirth?: string;
    dob?: string;
    profileImage?: string;
    pincode?: string;
    targetUniversity?: string;
    studyDestination?: string;
    fatherName?: string;
    motherName?: string;
    family?: any;
    coApplicant?: any;
    coApplicantName?: string;
    coApplicantPhone?: string;
    coApplicantEmail?: string;
    coApplicantRelation?: string;
    academic?: any;
    userId?: string;
    passport?: any;
  }) {
    if (!body || (!body.email && !body.userId && !body.newEmail)) {
      return {
        success: false,
        message: 'Email or userId is required',
      };
    }

    // Merge separate coApplicant fields (sent from apply-loan page) into the coApplicant JSON blob
    let coApplicantPayload = body.coApplicant || {};
    if (typeof coApplicantPayload === 'string') {
      try { coApplicantPayload = JSON.parse(coApplicantPayload); } catch { coApplicantPayload = {}; }
    }
    if (body.coApplicantName) coApplicantPayload.name = coApplicantPayload.name || body.coApplicantName;
    if (body.coApplicantPhone) coApplicantPayload.mobile = coApplicantPayload.mobile || body.coApplicantPhone;
    if (body.coApplicantPhone) coApplicantPayload.phone = coApplicantPayload.phone || body.coApplicantPhone;
    if (body.coApplicantEmail) coApplicantPayload.email = coApplicantPayload.email || body.coApplicantEmail;
    if (body.coApplicantRelation) coApplicantPayload.relation = coApplicantPayload.relation || body.coApplicantRelation;

    const phone = body.phoneNumber || body.mobile;
    const dob = body.dateOfBirth || body.dob;
    const targetEmail = (body.newEmail || body.email || '').trim();

    const result = await this.usersService.updateUserDetails(
      targetEmail,
      body.firstName,
      body.lastName,
      phone,
      dob,
      undefined,
      body.profileImage,
      body.pincode,
      body.targetUniversity,
      body.studyDestination,
      body.fatherName,
      body.motherName,
      body.family,
      Object.keys(coApplicantPayload).length > 0 ? coApplicantPayload : body.coApplicant,
      body.academic,
      body.userId,
      body.passport
    );

    return result;
  }

  // ==================== LOAN APPLICATIONS ====================

  /**
   * Create a new loan application
   * POST /auth/create-application
   * @body userId: string, amount: number, country: string, university: string, etc.
   * @returns { success: boolean, application?: LoanApplication }
   */
  @Post('create-application')
  @UseGuards(UserGuard)
  async createApplication(
    @Req() req: any,
    @Body() body: {
      userId: string;
      bank?: string;
      loanType?: string;
      amount: number;
      courseType?: string;
      courseName?: string;
      fieldOfStudy?: string;
      program?: string;
      programFocus?: string;
      country?: string;
      otherCountry?: string;
      university?: string;
      universityName?: string;
      targetUniversity?: string;
      annualFee?: string | number;
      livingCost?: string | number;
      hasCoApplicant?: boolean;
      coApplicant?: string;
      coApplicantName?: string;
      coApplicantPhone?: string;
      coApplicantEmail?: string;
      coApplicantRelation?: string;
      otherRelation?: string;
      coApplicantIncome?: string | number;
      income?: string | number;
      hasCollateral?: boolean;
      collateral?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      dateOfBirth?: string;
      address?: string;
      notes?: string;
      pincode?: string;
      admissionStatus?: string;
      isStaff?: boolean;
      creatorRole?: string;
    }
  ) {
    if (!body || !body.userId) {
      return {
        success: false,
        message: 'User ID is required',
      };
    }

    const userRole = (req?.user?.role || body?.creatorRole || '').toLowerCase();
    const isStaffOrAdmin =
      ['staff', 'admin', 'super_admin', 'support', 'it', 'agent', 'partner_agent'].includes(userRole) ||
      userRole.startsWith('bank_') ||
      body.isStaff === true ||
      body.creatorRole === 'staff';

    // Safely parse amount to a number
    const amountVal = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;

    if (isNaN(amountVal)) {
      return {
        success: false,
        message: 'Valid loan amount is required',
      };
    }

    if (body.email) {
      const emailCheck = await this.authService.checkDisposableEmail(body.email);
      if (emailCheck.blocked) {
        return {
          success: false,
          message: emailCheck.reason || 'Temporary or disposable email addresses are not allowed. Please use your official personal email.',
        };
      }
    }

    if (body.coApplicantEmail) {
      const coAppCheck = await this.authService.checkDisposableEmail(body.coApplicantEmail);
      if (coAppCheck.blocked) {
        return {
          success: false,
          message: coAppCheck.reason || 'Co-applicant email is a temporary or blocked domain. Please provide an official personal email.',
        };
      }
    }

    try {
      const selectedBank = body.bank || 'Any Bank';
      const selectedCountry = body.country === 'Other' ? (body.otherCountry || 'Other') : (body.country || 'Global');
      const selectedLoanType = body.loanType || body.courseType || body.fieldOfStudy || 'Postgraduate Abroad';
      const selectedCourse = body.courseName || body.fieldOfStudy || body.courseType || body.programFocus || body.program;

      const application = await this.usersService.createLoanApplication(body.userId, {
        bank: selectedBank,
        loanType: selectedLoanType,
        amount: amountVal,
        courseType: body.courseType || body.fieldOfStudy,
        courseName: selectedCourse,
        program: body.program,
        programFocus: body.programFocus,
        country: selectedCountry,
        university: body.university,
        universityName: body.universityName || body.university || body.targetUniversity,
        targetUniversity: body.targetUniversity || body.university,
        annualFee: String(body.annualFee || ''),
        livingCost: String(body.livingCost || ''),
        hasCoApplicant: body.hasCoApplicant,
        coApplicant: body.coApplicant || body.coApplicantRelation,
        coApplicantName: body.coApplicantName,
        coApplicantPhone: body.coApplicantPhone,
        coApplicantEmail: body.coApplicantEmail,
        income: String(body.coApplicantIncome || body.income || ''),
        hasCollateral: body.hasCollateral,
        collateral: body.collateral,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        address: body.address,
        notes: body.notes,
        pincode: body.pincode,
        admissionStatus: body.admissionStatus,
      }, isStaffOrAdmin);
      return {
        success: true,
        application,
      };
    } catch (error) {
      console.error('Create application error:', error);
      throw error;
    }
  }

  /**
   * Get all entries from the separate ApplyLoan table (leads)
   * GET /auth/apply-loan-applications
   */
  @Get('apply-loan-applications')
  async getApplyLoanApplications() {
    try {
      const { data, error } = await this.usersService.getApplyLoanApplications();
      if (error) throw error;
      return {
        success: true,
        applications: data,
      };
    } catch (error) {
      console.error('Fetch apply loan applications error:', error);
      return {
        success: false,
        message: 'Could not fetch apply loan applications',
        error: error.message,
      };
    }
  }

  @Post('assign-all-unassigned')
  async assignAllUnassigned() {
    await this.usersService.backfillAndAutoAssignApplications();
    return { success: true, message: 'Triggered auto-assignment for unassigned applications.' };
  }

  @Post('reassign/:loanId')
  async reassignLoanFallback(
    @Param('loanId') loanId: string,
    @Body() body: { toStaffId: string; reason?: string },
    @Req() req: any,
  ) {
    const assignedBy = req.user?.id || req.user?.uid || 'admin';
    return await this.assignmentService.reassignLoan(
      loanId,
      body?.toStaffId,
      body?.reason || 'manual_fallback',
      assignedBy,
    );
  }

  /**
   * Get user's loan applications
   * POST /auth/applications
   * @body userId: string (required)
   * @returns { success: boolean, applications: [] }
   */
  @Post('applications')
  async getApplications(@Body() body: { userId: string }) {
    if (!body || !body.userId) {
      return {
        success: false,
        message: 'User ID is required',
      };
    }
    try {
      const applications = await this.usersService.getUserApplications(body.userId);
      return {
        success: true,
        applications,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch applications',
      };
    }
  }

  /**
   * Update loan application status
   * POST /auth/update-application/:id
   * @body status: string (required) - pending, processing, approved, rejected
   * @returns { success: boolean, application?: LoanApplication }
   */
  @Post('update-application/:id')
  async updateApplication(
    @Param('id') id: string,
    @Body() body: { status: string }
  ) {
    if (!body || !body.status) {
      return {
        success: false,
        message: 'Status is required',
      };
    }
    try {
      const application = await this.usersService.updateLoanApplicationStatus(id, body.status);
      return {
        success: true,
        application,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update application',
      };
    }
  }

  /**
   * Delete a loan application
   * DELETE /auth/application/:id
   * @returns { success: boolean, message: string }
   */
  @Delete('application/:id')
  async deleteApplication(@Param('id') id: string) {
    try {
      await this.usersService.deleteLoanApplication(id);
      return {
        success: true,
        message: 'Application deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete application',
      };
    }
  }

  // ==================== DOCUMENTS ====================

  /**
   * Upload or update document status
   * POST /auth/upload-document
   * @body userId: string, docType: string, uploaded: boolean, filePath?: string
   * @returns { success: boolean, document?: UserDocument }
   */
  @Post('upload-document')
  async uploadDocument(@Body() body: {
    userId: string;
    docType: string;
    uploaded: boolean;
    filePath?: string;
  }) {
    if (!body || !body.userId || !body.docType) {
      return {
        success: false,
        message: 'User ID and Document Type are required',
      };
    }
    try {
      const document = await this.usersService.upsertUserDocument(body.userId, body.docType, {
        uploaded: body.uploaded,
        filePath: body.filePath,
        status: body.uploaded ? 'uploaded' : 'pending',
      });
      return {
        success: true,
        document,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to upload document',
      };
    }
  }

  /**
   * Get user's documents
   * POST /auth/documents
   * @body userId: string (required)
   * @returns { success: boolean, documents: [] }
   */
  @Post('documents')
  async getDocuments(@Body() body: { userId: string }) {
    if (!body || !body.userId) {
      return {
        success: false,
        message: 'User ID is required',
      };
    }
    try {
      const documents = await this.usersService.getUserDocuments(body.userId);
      return {
        success: true,
        documents,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch documents',
      };
    }
  }

  /**
   * Delete a document
   * DELETE /auth/document/:userId/:docType
   * @returns { success: boolean, message: string }
   */
  @Delete('document/:userId/:docType')
  async deleteDocument(
    @Param('userId') userId: string,
    @Param('docType') docType: string
  ) {
    try {
      await this.usersService.deleteUserDocument(userId, docType);
      return {
        success: true,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete document',
      };
    }
  }
}


