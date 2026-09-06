import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { FirebaseAuthService } from './firebase-auth.service';
import { EmailService } from './email.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PhoneNumberUtil } from 'google-libphonenumber';
import { SiteSettingsService } from '../site-settings/site-settings.service';

const phoneUtil = PhoneNumberUtil.getInstance();

@Injectable()
export class AuthService {
  private otps = new Map<string, { otp: string; expiresAt: number }>();

  private validatePhoneNumberStructurally(phoneNumber: string): { isValid: boolean; message?: string } {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return { isValid: false, message: 'Please enter your phone number' };
    }
    const allowedCharsRegex = /^[0-9+\s\-()]+$/;
    if (!allowedCharsRegex.test(phoneNumber)) {
      return { isValid: false, message: 'Please enter a valid phone number (only digits, spaces, +, -, and parentheses are allowed)' };
    }
    try {
      const parsed = phoneUtil.parseAndKeepRawInput(phoneNumber, 'IN');
      const isValid = phoneUtil.isValidNumber(parsed);
      if (!isValid) {
        return { isValid: false, message: 'The phone number is structurally invalid for the parsed region/country code.' };
      }
      return { isValid: true };
    } catch (error: any) {
      return { isValid: false, message: `Invalid phone number format: ${error.message || 'Parsing failed'}` };
    }
  }
  private signupData = new Map<string, {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
  }>();

  private isTempEmailDomain(domain: string): boolean {
    const tempEmailDomains = [
      'mailinator.com',
      '10minutemail.com',
      'tempmail.com',
      'temp-mail.org',
      'guerrillamail.com',
      'sharklasers.com',
      'yopmail.com',
      'dispostable.com',
      'getairmail.com',
      'throwawaymail.com',
      'tempmailaddress.com',
      'maildrop.cc',
      'mintemail.com',
      'generator.email',
      'fakeinbox.com',
      'burnermail.io',
      'trashmail.com',
      'receivesms.cc',
      'tempmail.dev',
      'emailfake.com',
      'disposable.com',
      'afterdo.com',
      'binkmail.com',
      'safetymail.info',
      'guerrillamailblock.com',
      'guerrillamail.net',
      'guerrillamail.org',
      'guerrillamail.biz',
      'grr.la',
      'pokemail.net',
      'acoxs.com'
    ];

    const domainLower = domain.toLowerCase();
    return tempEmailDomains.some(d => domainLower === d || domainLower.endsWith('.' + d)) ||
      domainLower.includes('tempmail') ||
      domainLower.includes('temp-mail') ||
      domainLower.includes('disposable') ||
      domainLower.includes('throwaway') ||
      domainLower.includes('10minutemail') ||
      domainLower.includes('fakeinbox') ||
      domainLower.includes('yopmail');
  }

  constructor(
    private usersService: UsersService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private firebaseAuthService: FirebaseAuthService,
    private siteSettingsService: SiteSettingsService,
  ) { }

  public async checkDisposableEmail(email: string) {
    return this.siteSettingsService.checkDisposableEmail(email);
  }

  /**
   * Generate both access and refresh tokens for a user
   */
  /**
   * Derive the canonical bank key (e.g. "idfc") and display name from a bank user's email.
   * This is the same mapping used by BankController.resolveBankName().
   */
  private resolveBankIdFromEmail(email: string): { bankId: string | null; bankName: string | null } {
    if (!email) return { bankId: null, bankName: null };
    const lower = email.toLowerCase().trim();
    if (lower.includes('auxilo') || lower === 'luharika28@gmail.com') return { bankId: 'auxilo', bankName: 'Auxilo Finserve' };
    if (lower.includes('avanse') || lower === 'ropayi2211@aspensif.com') return { bankId: 'avanse', bankName: 'Avanse Financial' };
    if (lower.includes('credila') || lower.includes('hdfc') || lower === 'keerthichinnu0728@gmail.com') return { bankId: 'credila', bankName: 'HDFC Credila' };
    if (lower.includes('idfc') || lower === 'abhimadasu4@gmail.com') return { bankId: 'idfc', bankName: 'IDFC FIRST Bank' };
    if (lower.includes('poonawalla') || lower === 'farmatech@gmail.com') return { bankId: 'poonawalla', bankName: 'Poonawalla Fincorp' };
    return { bankId: null, bankName: null };
  }

  private async generateTokens(user: any, originalLoginAt?: number) {
    const isBank = user.role === 'bank' || user.role === 'partner_bank';
    const { bankId, bankName } = isBank ? this.resolveBankIdFromEmail(user.email) : { bankId: null, bankName: null };

    const loginAt = originalLoginAt || Date.now();

    const payload: Record<string, any> = {
      email: user.email,
      sub: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      loginAt,
    };

    // Embed bank identity in JWT so the socket gateway can auto-join the per-bank room
    if (isBank && bankId) {
      payload.bankId = bankId;
      payload.bankName = bankName;
    }

    const isStaff = user.role === 'staff' || user.role === 'staff_admin';
    const standardAccessExpStr = isStaff
      ? '2h'
      : (this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '24h');
    const standardRefreshExpStr = isStaff
      ? '2h'
      : (this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') || '24h');

    let accessExpiresIn: string | number = standardAccessExpStr;
    let refreshExpiresIn: string | number = standardRefreshExpStr;

    if (originalLoginAt) {
      const maxAgeMs = isStaff ? (2 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000);
      const elapsedMs = Date.now() - originalLoginAt;
      const remainingMs = maxAgeMs - elapsedMs;

      if (remainingMs <= 0) {
        throw new UnauthorizedException('Session has expired. Please login again.');
      }

      const remainingSec = Math.floor(remainingMs / 1000);

      // Parse standard access expiration to seconds
      let standardAccessSec = isStaff ? 7200 : 1800; // default 2h for staff, 30m for users
      if (standardAccessExpStr.endsWith('m')) {
        standardAccessSec = parseInt(standardAccessExpStr) * 60;
      } else if (standardAccessExpStr.endsWith('h')) {
        standardAccessSec = parseInt(standardAccessExpStr) * 3600;
      } else if (standardAccessExpStr.endsWith('s')) {
        standardAccessSec = parseInt(standardAccessExpStr);
      }

      accessExpiresIn = Math.min(standardAccessSec, remainingSec);
      refreshExpiresIn = remainingSec;
    }

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiresIn as any,
    });

    // Generate refresh token (long-lived)
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn as any,
    });

    // Store refresh token in database
    // await this.usersService.updateRefreshToken(user.email, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async sendOtp(
    email: string,
    isSignup: boolean = false,
    signupInfo?: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      dateOfBirth?: string;
    }
  ) {
    // Validate required fields for signup (only if provided)
    if (isSignup && signupInfo) {
      // Validate firstName if provided
      if (signupInfo.firstName !== undefined) {
        if (signupInfo.firstName.trim() === '') {
          return { success: false, message: 'Please enter your first name' };
        }

        if (signupInfo.firstName.length > 30) {
          return { success: false, message: 'First name must not exceed 30 characters' };
        }
      }

      // Validate lastName if provided
      if (signupInfo.lastName !== undefined) {
        if (signupInfo.lastName.trim() === '') {
          return { success: false, message: 'Please enter your last name' };
        }

        if (signupInfo.lastName.length > 30) {
          return { success: false, message: 'Last name must not exceed 30 characters' };
        }
      }

      // Validate phoneNumber if provided
      if (signupInfo.phoneNumber !== undefined) {
        const phoneValidation = this.validatePhoneNumberStructurally(signupInfo.phoneNumber);
        if (!phoneValidation.isValid) {
          return { success: false, message: phoneValidation.message };
        }
      }

      // Validate dateOfBirth if provided
      if (signupInfo.dateOfBirth !== undefined) {
        if (signupInfo.dateOfBirth.trim() === '') {
          return { success: false, message: 'Please enter your date of birth' };
        }

        // Validate date of birth format (DD-MM-YYYY)
        const dobPattern = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
        if (!dobPattern.test(signupInfo.dateOfBirth)) {
          return { success: false, message: 'Date of birth must be in DD-MM-YYYY format (e.g., 15-01-1990)' };
        }

        // Parse and validate the date
        const dobParts = signupInfo.dateOfBirth.split('-');
        const day = parseInt(dobParts[0], 10);
        const month = parseInt(dobParts[1], 10);
        const year = parseInt(dobParts[2], 10);

        const dobDate = new Date(year, month - 1, day);

        // Check if it's a valid date
        if (dobDate.getFullYear() !== year || dobDate.getMonth() !== month - 1 || dobDate.getDate() !== day) {
          return { success: false, message: 'Please enter a valid date of birth' };
        }

        // Check if date is not in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dobDate > today) {
          return { success: false, message: 'Date of birth cannot be in the future' };
        }

        // Check if person is at least 18 years old
        const age = Math.floor((today.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age < 18) {
          return { success: false, message: 'You must be at least 18 years old to register' };
        }

        // Check if date is reasonable (not more than 120 years ago)
        if (age > 120) {
          return { success: false, message: 'Please enter a valid date of birth' };
        }
      }
    }

    // Validate email format (for both signup and login)
    if (!email || email.trim() === '') {
      return { success: false, message: 'Please enter your email address' };
    }

    // Check for @ symbol first
    if (!email.includes('@')) {
      return { success: false, message: 'Email must contain @ symbol' };
    }

    // Split email into username and domain
    const emailParts = email.split('@');
    if (emailParts.length !== 2 || !emailParts[1].includes('.')) {
      return { success: false, message: 'Email must have a valid domain (e.g., .com, .org)' };
    }

    const username = emailParts[0];
    const domain = emailParts[1];

    const disposableCheck = await this.siteSettingsService.checkDisposableEmail(email);
    if (disposableCheck.blocked) {
      return {
        success: false,
        message: disposableCheck.reason || 'Temporary or disposable email addresses are not allowed. Please use your official personal email (e.g. Gmail, Yahoo, Outlook).'
      };
    }

    // Validate username: minimum 8 characters
    if (username.length < 8) {
      return { success: false, message: 'Email username (before @) must be at least 8 characters long' };
    }

    // Validate username: must include at least one alphabetical character (a-z)
    if (!/[a-z]/.test(username)) {
      return { success: false, message: 'Email username must include at least one alphabetical character (a-z)' };
    }

    // Validate username: no capital letters allowed
    if (/[A-Z]/.test(username)) {
      return { success: false, message: 'Email username must not contain capital letters' };
    }

    // Email validation: must contain lowercase letters, @, and a valid domain
    const emailRegex = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!emailRegex.test(email.toLowerCase())) {
      return { success: false, message: 'Please enter a valid email address (e.g., username@example.com)' };
    }

    // Check if user exists
    const existingUser = await this.usersService.findOne(email);

    if (isSignup && existingUser) {
      // User trying to signup but already exists
      return { success: false, message: 'User already exists. Please login instead.', redirect: 'login' };
    }

    if (!isSignup && !existingUser) {
      // User trying to login but doesn't exist
      return { success: false, message: 'User not found. Please signup first.', redirect: 'signup' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otps.set(email, { otp, expiresAt: Date.now() + 60000 }); // Expires in 1 minute
    console.log(`[AuthService] New OTP generated for ${email}: ${otp}`);

    // Store signup data for registration - ONLY update if fields are provided
    // This prevents overwriting existing data with 'undefined' during resend
    if (isSignup && signupInfo) {
      const existingData = this.signupData.get(email) || {};

      this.signupData.set(email, {
        firstName: signupInfo.firstName ?? existingData.firstName,
        lastName: signupInfo.lastName ?? existingData.lastName,
        phoneNumber: signupInfo.phoneNumber ?? existingData.phoneNumber,
        dateOfBirth: signupInfo.dateOfBirth ?? existingData.dateOfBirth,
      });
      console.log(`[AuthService] Signup data updated/preserved for ${email}`);
    }

    try {
      await this.emailService.sendOtp(email, otp);
    } catch (emailError) {
      console.warn(`[AuthService] SMTP failed to send email but OTP is generated: ${otp}`, emailError);
    }
    return {
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' ? { otp } : {})
    };
  }

  async checkUserExists(email: string) {
    const disposableCheck = await this.siteSettingsService.checkDisposableEmail(email);
    if (disposableCheck.blocked) {
      return {
        exists: false,
        message: disposableCheck.reason || 'Temporary or disposable email addresses are not allowed.'
      };
    }
    const user = await this.usersService.findOne(email);
    if (user) {
      return { exists: true, message: 'User found' };
    } else {
      return { exists: false, message: 'User not found. Please sign up first.' };
    }
  }

  // ==================== UNIFIED OTP FLOW ====================

  /**
   * Send OTP to email - works for both new and existing users
   * Step 1 of unified flow
   */
  async sendOtpUnified(email: string, portal?: string) {
    // Validate email format
    if (!email || email.trim() === '') {
      return { success: false, message: 'Please enter your email address' };
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes('@')) {
      return { success: false, message: 'Email must contain @ symbol' };
    }

    const emailParts = cleanEmail.split('@');
    if (emailParts.length !== 2 || !emailParts[1].includes('.')) {
      return { success: false, message: 'Email must have a valid domain (e.g., .com, .org)' };
    }

    const username = emailParts[0];
    const domain = emailParts[1];

    const disposableCheck = await this.siteSettingsService.checkDisposableEmail(cleanEmail);
    if (disposableCheck.blocked) {
      return {
        success: false,
        message: disposableCheck.reason || 'Temporary or disposable email addresses are not allowed. Please use your official personal email (e.g. Gmail, Yahoo, Outlook).'
      };
    }

    // Check if user exists first
    let existingUser: any = null;
    try {
      existingUser = await this.usersService.findOne(cleanEmail);
    } catch (err) {
      console.warn(`[AuthService] Error checking user existence:`, err);
    }

    // ── Pre-OTP Portal Access Authorization Check ────────────────────────
    const targetPortal = (portal || '').toLowerCase().trim();
    if (targetPortal && targetPortal !== 'user' && targetPortal !== 'student') {
      if (!existingUser) {
        if (targetPortal === 'admin') {
          return {
            success: false,
            message: 'Access Denied: No administrator account found with this email address.',
            userExists: false
          };
        }
        if (targetPortal === 'staff') {
          return {
            success: false,
            message: 'Access Denied: No staff account found with this email. Staff portal is restricted to authorized personnel.',
            userExists: false
          };
        }
        if (targetPortal === 'bank') {
          return {
            success: false,
            message: 'Access Denied: No bank officer account found with this email address.',
            userExists: false
          };
        }
        if (targetPortal === 'agent') {
          return {
            success: false,
            message: 'Access Denied: No agent partner account found with this email address.',
            userExists: false
          };
        }
      } else {
        const userRole = (existingUser.role || '').toLowerCase();
        if (targetPortal === 'admin') {
          if (userRole !== 'admin' && userRole !== 'super_admin') {
            return {
              success: false,
              message: 'Access Denied: This account does not have administrator privileges.',
              userExists: true
            };
          }
        } else if (targetPortal === 'staff') {
          if (existingUser.isResigned || existingUser.status === 'resigned') {
            return {
              success: false,
              message: 'Access Denied: This staff account has been marked as resigned or inactive.',
              userExists: true
            };
          }
          if (!['staff', 'staff_admin', 'it'].includes(userRole)) {
            return {
              success: false,
              message: 'Access Denied: Staff portal is strictly for authorized staff members.',
              userExists: true
            };
          }
        } else if (targetPortal === 'bank') {
          if (userRole === 'admin' || userRole === 'super_admin') {
            return {
              success: false,
              message: 'Access Denied: Administrator accounts must log in via the Admin Login Page.',
              userExists: true
            };
          }
          if (!['bank', 'partner_bank'].includes(userRole)) {
            return {
              success: false,
              message: 'Access Denied: This account does not have bank officer privileges.',
              userExists: true
            };
          }
        } else if (targetPortal === 'agent') {
          if (!['agent', 'partner_agent', 'admin', 'super_admin'].includes(userRole)) {
            return {
              success: false,
              message: 'Access Denied: You do not have agent partner privileges to access this portal.',
              userExists: true
            };
          }
        }
      }
    }

    if (!existingUser) {
      if (username.length < 8) {
        return { success: false, message: 'Email username (before @) must be at least 8 characters long' };
      }

      if (!/[a-z]/.test(username)) {
        return { success: false, message: 'Email username must include at least one alphabetical character (a-z)' };
      }

      if (/[A-Z]/.test(username)) {
        return { success: false, message: 'Email username must not contain capital letters' };
      }

      const emailRegex = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
      if (!emailRegex.test(email.toLowerCase())) {
        return { success: false, message: 'Please enter a valid email address (e.g., username@example.com)' };
      }
    }

    try {

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      this.otps.set(email, { otp, expiresAt: Date.now() + 60000 }); // Expires in 1 minute
      console.log(`[AuthService] OTP generated for ${email}: ${otp}`);

      // Send OTP via email
      try {
        await this.emailService.sendOtp(email, otp);
      } catch (emailError) {
        console.warn(`[AuthService] SMTP failed to send email but OTP is generated: ${otp}`, emailError);
      }

      return {
        success: true,
        message: 'OTP sent successfully',
        userExists: !!existingUser, // Return whether user exists or not
        ...(process.env.NODE_ENV === 'development' ? { otp } : {})
      };
    } catch (error) {
      console.error('[AuthService] Database or Email error in sendOtpUnified:', error);
      return {
        success: false,
        message: 'Internal error: Could not connect to the database or email service. Please check your Railway environment variables and ensure the database is migrated.',
        error: error.message
      };
    }
  }

  /**
   * Verify OTP and handle both new and existing users
   * Step 2 of unified flow
   * 
   * For existing users with complete details: return token + userExists=true, hasUserDetails=true
   * For existing users without details: return token + userExists=true, hasUserDetails=false
   * For new users: create user + return token + userExists=false, hasUserDetails=false
   */
  async verifyOtpUnified(email: string, otp: string) {
    // Verify OTP (with '123456' E2E master bypass for automated staff validation)
    const stored = this.otps.get(email);

    if (otp !== '123456') {
      if (!stored || stored.otp !== otp) {
        throw new BadRequestException('Invalid OTP. Please enter the right one to login.');
      }

      if (Date.now() > stored.expiresAt) {
        this.otps.delete(email);
        throw new BadRequestException('OTP has expired. Please request a new OTP.');
      }
    }

    // Invalidate OTP after verification
    this.otps.delete(email);

    // Verify email is not blocked/disposable
    const disposableCheck = await this.siteSettingsService.checkDisposableEmail(email);
    if (disposableCheck.blocked) {
      throw new BadRequestException(
        disposableCheck.reason || 'Temporary or disposable email addresses are not allowed. Please use your official personal email.'
      );
    }

    try {
      // Find or create user
      let user = await this.usersService.findOne(email);
      const isNewUser = !user;

      if (!user) {
        // Create new user with only email; optional fields omitted
        user = await this.usersService.create({ email });
        console.log(`[AuthService] New user created: ${email}`);

        // NOTE: Welcome email is sent AFTER the user fills /user-details (updateUserDetails),
        // so it contains their real first name. No email sent here.

        // Emit candidate registered event for staff notifications
        this.eventEmitter.emit('candidate.registered', {
          userId: user.id,
          email: user.email,
          firstName: user.firstName || 'New Candidate',
          lastName: user.lastName || '',
          phoneNumber: user.phoneNumber,
          dateOfBirth: user.dateOfBirth,
          createdAt: new Date().toISOString()
        });
      }

      // Check if user has complete details
      const hasUserDetails = !!(user.firstName && user.lastName && user.phoneNumber && user.dateOfBirth);

      // Generate JWT tokens (access + refresh)
      const tokens = await this.generateTokens(user);

      // Notify other modules (like Chat) about user activity
      this.eventEmitter.emit('user.login', {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isNewUser
      });

      // Format date of birth if it exists
      let formattedDob: string | null = null;
      if (user.dateOfBirth) {
        try {
          const date = new Date(user.dateOfBirth);
          if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            formattedDob = `${day}-${month}-${year}`;
          }
        } catch (e) {
          console.error('[AuthService.verifyOtpUnified] DOB parsing failed:', e);
        }
      }

      return {
        success: true,
        message: isNewUser ? 'Signup successful. Please complete your profile.' : 'Login successful.',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        userId: user.id,
        userExists: !isNewUser,
        hasUserDetails,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: formattedDob || '',
        role: user.role,
      };
    } catch (error) {
      console.error('[AuthService] Error in verifyOtpUnified:', error);
      return {
        success: false,
        message: 'An error occurred during verification. Please try again.'
      };
    }
  }

  /**
   * Handle Firebase Authentication
   * Verifies Firebase token, syncs user with DB, and returns internal JWT
   */
  async authenticateFirebaseUser(idToken: string) {
    try {
      let decodedToken;
      if (!this.firebaseAuthService.isEnabled()) {
        console.warn('[AuthService] Firebase is disabled. Decoding ID Token without signature verification.');
        try {
          const parts = idToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            decodedToken = {
              email: payload.email,
              name: payload.name || payload.email?.split('@')[0] || 'User',
              picture: payload.picture || null,
            };
          } else {
            decodedToken = {
              email: 'student@example.com',
              name: 'Demo Student',
              picture: null,
            };
          }
        } catch {
          decodedToken = {
            email: 'student@example.com',
            name: 'Demo Student',
            picture: null,
          };
        }
      } else {
        decodedToken = await this.firebaseAuthService.verifyToken(idToken);
      }

      const { email, name, picture } = decodedToken;

      if (!email) {
        throw new UnauthorizedException('Firebase token does not contain an email');
      }

      const disposableCheck = await this.siteSettingsService.checkDisposableEmail(email);
      if (disposableCheck.blocked) {
        throw new UnauthorizedException(
          disposableCheck.reason || 'Temporary or disposable email addresses are not allowed. Please use your official personal email.'
        );
      }

      // Find or create user
      let user = await this.usersService.findOne(email);
      const isNewUser = !user;

      if (!user) {
        // Extract names from Firebase 'name' field if possible
        const nameParts = name ? name.split(' ') : [];
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts.slice(1).join(' ') || '';

        user = await this.usersService.create({
          email,
          firstName,
          lastName,
        });
        console.log(`[AuthService] New Firebase user created: ${email}`);

        // NOTE: Welcome email fires from updateUserDetails (after /user-details form),
        // so it contains their real name. Skip it here for Firebase users too.
      }

      const hasUserDetails = !!(user.firstName && user.lastName && user.phoneNumber && user.dateOfBirth);
      const tokens = await this.generateTokens(user);

      this.eventEmitter.emit('user.login', {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isNewUser
      });

      // Format date of birth if it exists
      let formattedDob: string | null = null;
      if (user.dateOfBirth) {
        try {
          const date = new Date(user.dateOfBirth);
          if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            formattedDob = `${day}-${month}-${year}`;
          }
        } catch (e) {
          console.error('[AuthService.authenticateFirebaseUser] DOB parsing failed:', e);
        }
      }

      return {
        success: true,
        message: isNewUser ? 'Signup successful.' : 'Login successful.',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        userId: user.id,
        userExists: !isNewUser,
        hasUserDetails,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: formattedDob || '',
        role: user.role,
        picture: picture // Return Firebase profile picture if available
      };
    } catch (error) {
      console.error('[AuthService] Firebase authentication error:', error);
      throw new UnauthorizedException(error.message || 'Firebase authentication failed');
    }
  }

  async refreshTokens(refreshToken: string) {
    try {
      // Verify the refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken);

      // Get user from database
      const user = await this.usersService.findOne(payload.email);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify that the refresh token matches the one stored in database
      // if (user.refreshToken !== refreshToken) {
      //   throw new UnauthorizedException('Invalid refresh token');
      // }

      // Extract original login timestamp, with backward compatibility fallback to iat * 1000
      const originalLoginAt = payload.loginAt || (payload.iat ? payload.iat * 1000 : undefined);

      // Generate new tokens
      const tokens = await this.generateTokens(user, originalLoginAt);

      return {
        success: true,
        message: 'Tokens refreshed successfully',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Refresh token has expired. Please login again.');
      }

      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(email: string) {
    // Feature disabled
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async getUserDashboard(email: string) {
    console.log(`[AuthService.getUserDashboard] Fetching dashboard for: ${email}`);
    try {
      const user = await this.usersService.findOne(email);

      if (!user) {
        console.warn(`[AuthService.getUserDashboard] User not found: ${email}`);
        throw new UnauthorizedException('User not found');
      }

      console.log(`[AuthService.getUserDashboard] User found: ${user.id}, DOB: ${user.dateOfBirth}`);

      // Format date of birth if it exists
      let formattedDob: string | null = null;
      if (user.dateOfBirth) {
        try {
          const date = new Date(user.dateOfBirth);
          if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            formattedDob = `${day}-${month}-${year}`;
            console.log(`[AuthService.getUserDashboard] Formatted DOB: ${formattedDob}`);
          } else {
            console.warn(`[AuthService.getUserDashboard] Invalid DOB in DB: ${user.dateOfBirth}`);
          }
        } catch (e) {
          console.error('[AuthService.getUserDashboard] DOB parsing failed:', e);
        }
      }

      let targetUniversity = user.targetUniversity || '';
      let studyDestination = user.studyDestination || '';

      if (!targetUniversity || !studyDestination) {
        try {
          const apps = await this.usersService.getUserApplications(user.id);
          if (apps && apps.length > 0) {
            const latest = apps[0];
            if (!targetUniversity) targetUniversity = latest.universityName || latest.targetUniversity || latest.university || '';
            if (!studyDestination) studyDestination = latest.country || latest.destinationCountry || '';
          }
        } catch (err) {
          console.error('[AuthService.getUserDashboard] Error resolving application fallback:', err);
        }
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          phoneNumber: user.phoneNumber || '',
          dateOfBirth: formattedDob || '',
          role: user.role || 'user',
          createdAt: user.createdAt,
          studyDestination,
          targetUniversity,
        }
      };
    } catch (error) {
      console.error('[AuthService.getUserDashboard] Error:', error);
      return {
        success: false,
        message: 'Failed to fetch user dashboard profile',
        error: error.message
      };
    }
  }

  async updateUserDetails(
    email: string,
    firstName: string,
    lastName: string,
    phoneNumber: string,
    dateOfBirth: string,
    intakeSeason?: string,
    profileImage?: string,
    pincode?: string
  ) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Email address is required' };
    }

    // Check if user exists with the provided email
    let existingUser = await this.usersService.findOne(cleanEmail);
    const isFirstProfileCompletion = !existingUser || !existingUser.firstName || !existingUser.phoneNumber || !existingUser.dateOfBirth;

    // Validate firstName
    if (!firstName || firstName.trim() === '') {
      return { success: false, message: 'Please enter your first name' };
    }
    if (firstName.length > 30) {
      return { success: false, message: 'First name must not exceed 30 characters' };
    }

    // Validate lastName
    if (!lastName || lastName.trim() === '') {
      return { success: false, message: 'Please enter your last name' };
    }
    if (lastName.length > 30) {
      return { success: false, message: 'Last name must not exceed 30 characters' };
    }

    // Validate phoneNumber
    const phoneValidation = this.validatePhoneNumberStructurally(phoneNumber);
    if (!phoneValidation.isValid) {
      return { success: false, message: phoneValidation.message };
    }

    // Validate dateOfBirth
    if (!dateOfBirth || dateOfBirth.trim() === '') {
      return { success: false, message: 'Please enter your date of birth' };
    }
    const dobPattern = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
    if (!dobPattern.test(dateOfBirth.trim())) {
      return { success: false, message: 'Date of birth must be in DD-MM-YYYY format (e.g., 15-01-1990)' };
    }

    // Parse and validate the date
    const dobParts = dateOfBirth.trim().split('-');
    const day = parseInt(dobParts[0], 10);
    const month = parseInt(dobParts[1], 10);
    const year = parseInt(dobParts[2], 10);
    const dobDate = new Date(year, month - 1, day);

    if (dobDate.getFullYear() !== year || dobDate.getMonth() !== month - 1 || dobDate.getDate() !== day) {
      return { success: false, message: 'Please enter a valid date of birth' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dobDate > today) {
      return { success: false, message: 'Date of birth cannot be in the future' };
    }

    const age = Math.floor((today.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) {
      return { success: false, message: 'You must be at least 18 years old to register' };
    }
    if (age > 120) {
      return { success: false, message: 'Please enter a valid date of birth' };
    }

    // Update user details
    try {
      const user = await this.usersService.updateUserDetails(
        cleanEmail,
        firstName,
        lastName,
        phoneNumber,
        dateOfBirth,
        intakeSeason,
        profileImage,
        pincode
      );

      if (!user || (user as any).success === false) {
        return { success: false, message: (user as any)?.message || 'User not found' };
      }

      // Fire-and-forget: send personalised dashboard welcome email on first profile completion
      if (isFirstProfileCompletion) {
        void this.emailService.sendDashboardWelcomeEmail(email, firstName, lastName);
        console.log(`[AuthService] Dashboard welcome email queued for ${email} (${firstName} ${lastName})`);
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          dateOfBirth: user.dateOfBirth,
          intakeSeason: user.intakeSeason || '',
        }
      };
    } catch (error) {
      console.error('Error updating user details:', error);
      return {
        success: false,
        message: 'Failed to update profile. Please try again or contact support.'
      };
    }
  }

  /**
   * Submit loan application directly from landing page with OTP verification
   */
  async submitLandingPageApplication(body: {
    email: string;
    otp: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    dateOfBirth?: string;
    // Academic details
    universityName: string;
    courseName: string;
    country: string;
    courseDuration?: number | string;
    loanAmount: number | string;
    admissionStatus?: string;
    // Co-applicant details
    hasCoApplicant?: boolean;
    coApplicantName?: string;
    coApplicantRelation?: string;
    coApplicantPhone?: string;
    coApplicantEmail?: string;
    coApplicantIncome?: number | string;
  }) {
    const { email, otp, firstName, lastName, phoneNumber, dateOfBirth } = body;

    if (!email || !otp) {
      throw new BadRequestException('Email address and OTP code are required');
    }

    if (!firstName || !lastName || !phoneNumber) {
      throw new BadRequestException('First name, last name, and phone number are required');
    }

    const cleanEmail = email.toLowerCase().trim();

    const disposableCheck = await this.siteSettingsService.checkDisposableEmail(cleanEmail);
    if (disposableCheck.blocked) {
      throw new BadRequestException(
        disposableCheck.reason || 'Temporary or disposable email addresses are not allowed. Please use your official personal email (e.g. Gmail, Yahoo, Outlook).'
      );
    }

    // Verify OTP (with '123456' E2E master bypass)
    const stored = this.otps.get(cleanEmail);
    if (otp !== '123456') {
      if (!stored || stored.otp !== otp) {
        throw new BadRequestException('Invalid OTP. Please enter the right verification code.');
      }
      if (Date.now() > stored.expiresAt) {
        this.otps.delete(cleanEmail);
        throw new BadRequestException('OTP has expired. Please request a new verification code.');
      }
    }
    this.otps.delete(cleanEmail);

    // Parse loan amount
    const parsedAmount = typeof body.loanAmount === 'string' ? parseFloat(body.loanAmount) : body.loanAmount;
    const amountVal = isNaN(parsedAmount) || !parsedAmount ? 1000000 : parsedAmount;

    // Find or create user
    let user = await this.usersService.findOne(cleanEmail);
    const isNewUser = !user;

    if (!user) {
      user = await this.usersService.create({
        email: cleanEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        dateOfBirth: dateOfBirth ? dateOfBirth.trim() : undefined,
      });
      console.log(`[AuthService] Landing page: New user created: ${cleanEmail}`);
    } else {
      // Update existing user's details if provided
      await this.usersService.updateUserDetails(
        cleanEmail,
        firstName.trim(),
        lastName.trim(),
        phoneNumber.trim(),
        dateOfBirth ? dateOfBirth.trim() : undefined,
        undefined,
        undefined,
        undefined,
        body.universityName,
        body.country
      );
      user = await this.usersService.findOne(cleanEmail);
    }

    // Emit candidate registered event for staff tracking
    this.eventEmitter.emit('candidate.registered', {
      userId: user.id,
      email: user.email,
      firstName: user.firstName || firstName,
      lastName: user.lastName || lastName,
      phoneNumber: user.phoneNumber || phoneNumber,
      dateOfBirth: user.dateOfBirth || dateOfBirth,
      createdAt: new Date().toISOString(),
    });

    // Create loan application in DB
    const selectedBank = 'Any Bank';
    const selectedCountry = body.country || 'Global';
    const selectedUniversity = body.universityName || 'Target University';
    const selectedCourse = body.courseName || 'Higher Education';

    const application = await this.usersService.createLoanApplication(user.id, {
      bank: selectedBank,
      loanType: 'Education Loan',
      amount: amountVal,
      courseName: selectedCourse,
      country: selectedCountry,
      universityName: selectedUniversity,
      targetUniversity: selectedUniversity,
      hasCoApplicant: !!body.hasCoApplicant,
      coApplicant: body.coApplicantRelation,
      coApplicantName: body.coApplicantName,
      coApplicantPhone: body.coApplicantPhone,
      coApplicantEmail: body.coApplicantEmail,
      income: String(body.coApplicantIncome || ''),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      phone: phoneNumber.trim(),
      dateOfBirth: dateOfBirth ? dateOfBirth.trim() : undefined,
      admissionStatus: body.admissionStatus || 'Applied',
    }, false);

    // Generate JWT tokens for user session
    const tokens = await this.generateTokens(user);

    this.eventEmitter.emit('user.login', {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      isNewUser,
    });

    return {
      success: true,
      message: 'Loan application submitted successfully!',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
      applicationNumber: application?.applicationNumber || application?.id,
      applicationId: application?.id,
      application,
    };
  }
}

