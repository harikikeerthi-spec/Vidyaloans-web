import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    // Configure SMTP transporter
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'email-smtp.ap-south-1.amazonaws.com';
    const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587');
    const isSecure = port === 465;

    this.transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: isSecure, // true for 465, false for 587 STARTTLS
      requireTLS: !isSecure,
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  private hasCredentials(): boolean {
    return !!((process.env.SMTP_USER || process.env.EMAIL_USER) && (process.env.SMTP_PASS || process.env.EMAIL_PASS));
  }

  private getFromAddress(): string {
    const emailFrom = (process.env.MAIL_FROM || process.env.EMAIL_FROM || '').trim();
    if (emailFrom && emailFrom.includes('@')) {
      if (emailFrom.includes('<')) return emailFrom;
      return `"VidyaLoans Support" <${emailFrom}>`;
    }

    const emailUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    if (emailUser && emailUser.includes('@')) {
      return `"VidyaLoans Support" <${emailUser}>`;
    }

    return '"VidyaLoans Support" <support@vidyaloans.in>';
  }

  private getReplyToAddress(): string {
    const replyTo = (process.env.EMAIL_REPLY_TO || '').trim();
    if (replyTo && replyTo.includes('@')) return replyTo;
    const emailFrom = (process.env.MAIL_FROM || process.env.EMAIL_FROM || '').trim();
    if (emailFrom && emailFrom.includes('@')) {
      const match = emailFrom.match(/<([^>]+)>/);
      return match ? match[1] : emailFrom;
    }
    return 'support@vidyaloans.in';
  }

  private getStandardHeaders() {
    return {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
    };
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async sendOtp(email: string, otp: string) {
    const timestamp = new Date().toLocaleTimeString();
    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      subject: `Your VidyaLoan OTP Verification Code`,
      text: `Your OTP is: ${otp}. This code expires in 1 minutes.`,
      headers: {
        'X-Mailer': 'VidyaLoan Platform',
        'X-Priority': '3',
      },
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6605c7 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; margin: 0;">VidyaLoan</h1>
          </div>
          <div style="background: #f7f5f8; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Your Verification Code</h2>
            <p style="color: #666; font-size: 16px;">Use the following OTP to complete your authentication:</p>
            <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #6605c7;">${otp}</span>
            </div>
            <p style="color: #999; font-size: 14px;">This code expires in 1 minutes. Do not share this code with anyone.</p>
          </div>
        </div>
      `,
    };

    try {
      // Always log to console for debugging
      console.log(`[EmailService] PREPARING TO SEND OTP`);
      console.log(`[EmailService] Target Email: ${email}`);
      console.log(`[EmailService] OTP Value: ${otp}`);
      console.log(`--------------------------------`);

      // Send actual email if credentials are configured
      if (this.hasCredentials()) {
        await this.transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${email}`);
      } else {
        console.log(`Email credentials not configured - OTP only logged to console`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      // Don't throw - still allow OTP flow to work even if email fails
      console.log(`Email failed but OTP is: ${otp}`);
    }
  }

  async sendDigilockerConsentRequest(email: string, consentLink: string, documentTypes: string[]) {
    const timestamp = new Date().toLocaleTimeString();
    const docListHtml = documentTypes.map(doc => `<li>${doc.replace(/_/g, ' ').toUpperCase()}</li>`).join('');

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Vidya Loan</h1>
          </div>
          
          <div style="padding: 0 10px;">
            <h2 style="color: #111827; margin-bottom: 16px;">Document Verification Request</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">You have requested to sync the following documents from your DigiLocker account to Vidya Loan:</p>
            
            <ul style="color: #4b5563; font-size: 14px; background: #f9fafb; padding: 20px 40px; border-radius: 8px; margin: 20px 0;">
              ${docListHtml}
            </ul>

            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">To proceed with the verification, please click the button below to grant permission and log in to your DigiLocker account.</p>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${consentLink}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                Give Permission & Login
              </a>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                If you did not initiate this request, please ignore this email.<br>
                For your security, do not share this link with anyone.
              </p>
            </div>
          </div>
        </div>
      `;

    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      subject: `Action Required: DigiLocker Document Consent Request`,
      html: htmlContent,
      text: this.stripHtml(htmlContent),
      headers: {
        'X-Mailer': 'VidyaLoan Platform',
      },
    };

    try {
      console.log(`[EmailService] SENDING DIGILOCKER CONSENT TO: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`Consent email sent successfully to ${email}`);
      } else {
        console.log(`Email credentials not configured - Link: ${consentLink}`);
      }
    } catch (error) {
      console.error('Error sending consent email:', error);
    }
  }

  async sendMail(to: string, subject: string, html: string, text?: string, replyTo?: string, attachments?: any[]) {
    const mailOptions: any = {
      from: this.getFromAddress(),
      to: to,
      replyTo: replyTo,
      subject: subject,
      html: html,
      text: text || this.stripHtml(html),
      headers: {
        'X-Mailer': 'VidyaLoan Platform',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'X-Auto-Response-Suppress': 'OOF',
      },
    };

    if (attachments) {
      mailOptions.attachments = attachments;
    }

    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
      } else {
        console.log(`Email credentials not configured - Subject: ${subject}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  /**
   * Send a welcome / thank-you email to a brand-new user after their first login.
   * Introduces Vidyaloan and guides them toward applying for a loan.
   */
  async sendWelcomeEmail(email: string, firstName?: string, lastName?: string) {
    // Delegate to the full dashboard welcome email (supports both cases)
    return this.sendDashboardWelcomeEmail(email, firstName, lastName);
  }

  /**
   * Send a rich, professional welcome email AFTER the user completes their profile
   * and enters the VidyaLoan dashboard for the first time.
   * Includes personalised greeting, loan offerings, platform features, and a CTA.
   */
  async sendDashboardWelcomeEmail(email: string, firstName?: string, lastName?: string) {
    const fullName = firstName ? (lastName ? `${firstName} ${lastName}` : firstName) : '';
    const name = firstName ? firstName : 'there';
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();

    const mailOptions = {
      from: this.getFromAddress(),
      to: fullName ? `"${fullName}" <${email}>` : email,
      replyTo: this.getReplyToAddress(),
      headers: this.getStandardHeaders(),
      subject: `Welcome to VidyaLoans, ${name}! Your Education Loan Journey Begins`,
      text: `Dear ${name},\n\nWelcome to VidyaLoan – India's smartest education loan platform!\n\nYour profile is set up and your dashboard is ready. Here's what you can do now:\n\n🏦 LOAN OFFERINGS\n• Education loans up to ₹1.5 Crore\n• Competitive interest rates from 8.5% p.a.\n• Moratorium period during studies\n• No collateral for loans up to ₹7.5 Lakh\n• Covers tuition, living, travel, and equipment costs\n\n🚀 HOW TO GET YOUR LOAN IN 4 STEPS\n1. Complete Your Profile – Personal & academic details (done!)\n2. Upload Documents via DigiLocker – 100% digital & secure\n3. Choose Your Bank – Compare offers from 20+ lenders\n4. Track in Real Time – Get updates at every step\n\n✨ PLATFORM FEATURES\n• AI-powered bank matching\n• DigiLocker integration for instant document sync\n• Real-time application tracking\n• Dedicated loan counsellors\n• Community forum & expert blogs\n\nGo to your dashboard: ${frontendUrl}\n\nWarm regards,\nThe VidyaLoan Team\nsupport@vidyaloans.in`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to VidyaLoan – ${name}</title>
    <style>
        /* Responsive styles for email clients that support media queries */
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; border-radius: 0 !important; }
            .col { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; margin-bottom: 20px; }
            .footer-col { display: block !important; width: 100% !important; text-align: center !important; margin-bottom: 15px; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 0;">
        <tr>
            <td align="center">
                <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
                    
                    <tr>
                        <td style="background-color: #1e3a8a; padding: 32px 40px; text-align: left;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">VidyaLoan</h1>
                                        <p style="color: #93c5fd; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Education Loan Platform</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 22px; font-weight: 700;">Welcome, ${name}!</h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">
                                Your profile is now complete and your VidyaLoan account is fully activated. Let's turn your education dream into a reality with the smartest loan platform in India. Explore customized loan options, upload documents digitally, and seamlessly compare leading bank offers all in one dashboard.
                            </p>
                            
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                                <tr>
                                    <td align="left">
                                        <a href="${frontendUrl}/dashboard" target="_blank" style="background-color: #2563eb; color: #ffffff; display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">Go to My Dashboard →</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <fieldset style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
                                <legend style="color: #1e3a8a; font-size: 14px; font-weight: 700; padding: 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">What VidyaLoan Offers You</legend>
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td class="col" width="50%" valign="top" style="padding-right: 12px;">
                                            <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1f2937;">💰 Loans up to ₹1.5 Crore</p>
                                            <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280; line-height: 18px;">Covers tuition, living, travel, laptop & exam fees.</p>
                                            
                                            <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1f2937;">⏳ Study-Period Moratorium</p>
                                            <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 18px;">No EMI during studies + 6 months after graduation.</p>
                                        </td>
                                        <td class="col" width="50%" valign="top" style="padding-left: 12px;">
                                            <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1f2937;">📉 From 8.5% p.a. Interest</p>
                                            <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280; line-height: 18px;">Competitive rates compared across 20+ banks & NBFCs.</p>
                                            
                                            <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1f2937;">🔓 No Collateral up to ₹7.5L</p>
                                            <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 18px;">Unsecured loan options built for eligible students.</p>
                                        </td>
                                    </tr>
                                </table>
                            </fieldset>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px 40px 40px;">
                            <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px; font-weight: 700;">Your 4-Step Loan Journey</h3>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td valign="top" width="40" style="padding-bottom: 16px;">
                                        <div style="background-color: #dcfce7; color: #15803d; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 14px;">✓</div>
                                    </td>
                                    <td valign="top" style="padding-bottom: 16px;">
                                        <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: #111827;">Complete Your Profile</p>
                                        <p style="margin: 0; font-size: 13px; color: #6b7280;">You've already done this — your details are saved securely.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="top" width="40" style="padding-bottom: 16px;">
                                        <div style="background-color: #eff6ff; color: #2563eb; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 14px;">2</div>
                                    </td>
                                    <td valign="top" style="padding-bottom: 16px;">
                                        <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: #111827;">Upload Documents via DigiLocker</p>
                                        <p style="margin: 0; font-size: 13px; color: #6b7280;">Sync Aadhaar, academic transcripts, and your admission letter instantly.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="top" width="40" style="padding-bottom: 16px;">
                                        <div style="background-color: #eff6ff; color: #2563eb; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 14px;">3</div>
                                    </td>
                                    <td valign="top" style="padding-bottom: 16px;">
                                        <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: #111827;">Choose Your Bank & Plan</p>
                                        <p style="margin: 0; font-size: 13px; color: #6b7280;">Our engine evaluates plans across SBI, HDFC, Axis, and 15+ lenders.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td valign="top" width="40;">
                                        <div style="background-color: #eff6ff; color: #2563eb; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 14px;">4</div>
                                    </td>
                                    <td valign="top">
                                        <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 600; color: #111827;">Track Metrics in Real Time</p>
                                        <p style="margin: 0; font-size: 13px; color: #6b7280;">Access milestones, download sanctions, or connect with your personal counsellor.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 20px 40px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="font-size: 13px; color: #4b5563; font-weight: 600;">🏦 20+ Partner Lenders</td>
                                    <td align="center" style="font-size: 13px; color: #4b5563; font-weight: 600;">⚡ 48-Hour Avg Approval</td>
                                    <td align="center" style="font-size: 13px; color: #4b5563; font-weight: 600;">🌍 50+ Global Destinations</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 32px 40px; background-color: #ffffff; font-size: 14px; color: #4b5563;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td class="footer-col" width="70%" style="line-height: 20px;">
                                        <strong>Need guidance getting started?</strong><br>
                                        Our expert financial advisors are available Mon–Sat, 9 AM – 6 PM IST to assist you with applications.
                                    </td>
                                    <td class="footer-col" width="30%" align="right" valign="middle">
                                        <a href="mailto:support@vidyaloans.in" style="color: #2563eb; text-decoration: none; font-weight: 600; border: 1px solid #2563eb; padding: 8px 16px; border-radius: 4px; display: inline-block;">Contact Support</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #f1f5f9; padding: 24px 40px; text-align: center; font-size: 12px; color: #64748b; line-height: 18px;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">© ${year} VIDYALOANS PVT. LTD.</p>
                            <p style="margin: 0 0 16px 0;">Empowering Indian students to achieve global education goals.<br>Registered in India</p>
                            <p style="margin: 0;"> You received this automated notification because your email was registered on VidyaLoan. <br> <a href="${frontendUrl}/privacy-policy" style="color: #64748b; text-decoration: underline;">Privacy Policy</a> &middot; <a href="${frontendUrl}/terms-conditions" style="color: #64748b; text-decoration: underline;">Terms of Service</a></p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>`,
    };

    try {
      console.log(`[EmailService] Sending welcome email to new user: ${email}`);
      if (this.hasCredentials()) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Welcome email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – welcome email skipped for ${email}`);
      }
    } catch (error) {
      // Non-fatal: never block the login flow because of a welcome email failure
      console.error(`[EmailService] Failed to send welcome email to ${email}:`, error);
    }
  }

  async sendStaffReviewStartedEmail(email: string, userName: string, application: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();
    const appNum = application.applicationNumber || 'N/A';
    const loanType = (application.loanType || 'Education').toUpperCase();
    const amount = application.amount ? `₹${Number(application.amount).toLocaleString('en-IN')}` : 'N/A';
    const bankName = application.bank || 'our partner bank';

    const mailOptions = {
      from: this.getFromAddress(),
      to: userName ? `"${userName}" <${email}>` : email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `VidyaLoans: Processing Your Loan Application #${appNum}`,
      text: `Dear ${userName},\n\nGood news! The VidyaLoan review team has officially received and started processing your loan application (No. #${appNum}) for ${bankName}.\n\nApplication Details:\n- Number: #${appNum}\n- Type: ${loanType}\n- Amount: ${amount}\n\nOur loan specialists are checking your documents to fast-track your approval.\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Application Received & Processing - VidyaLoan</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0f0f1a;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f1a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #1a0533 0%, #2d0a5e 40%, #1e1b6e 100%);
              border-radius: 20px 20px 0 0;
              padding: 36px 40px 28px;
              border-bottom: 1px solid rgba(139,92,246,0.3);
            ">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Left side Logo -->
                  <td width="60" align="left" style="vertical-align: middle;">
                    <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:20px;font-weight:bold;">VL</div>
                  </td>
                  <!-- Middle Text -->
                  <td align="center" style="vertical-align: middle; padding-right: 60px;">
                    <h1 style="color:#ffffff;margin:0 0 4px;font-size:28px;font-weight:800;letter-spacing:-0.5px;font-family:'Inter','Segoe UI',Arial,sans-serif;">VidyaLoan</h1>
                    <p style="color:#a78bfa;margin:0;font-size:12px;letter-spacing:2px;font-weight:600;font-family:'Inter','Segoe UI',Arial,sans-serif;text-transform:uppercase;">EDUCATION LOAN PLATFORM</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="
              background: linear-gradient(160deg, #6605c7 0%, #8b5cf6 100%);
              padding: 40px 40px 36px;
              text-align: center;
            ">
              <p style="margin:0 0 8px;font-size:42px;">⚡</p>
              <h2 style="color:#ffffff;margin:0 0 10px;font-size:26px;font-weight:800;line-height:1.2;">
                Application Received & Under Review
              </h2>
              <p style="color:#ddd6fe;margin:0;font-size:15px;line-height:1.65;max-width:420px;display:inline-block;">
                Great news, ${userName}! The VidyaLoan review team has officially started processing your file.
              </p>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px 20px;">
              <p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 24px;">
                Dear <strong>${userName}</strong>, <br><br>
                Your education loan application (No. <strong>#${appNum}</strong>) has been picked up by our review team. 
                Our finance and documentation specialists are currently verifying your details to match you with the best loan structures for <strong>${bankName}</strong>.
              </p>

              <!-- Details Summary -->
              <h3 style="color:#1e1b4b;font-size:16px;font-weight:700;margin:28px 0 14px;border-bottom:2px solid #f3f4f6;padding-bottom:8px;">
                📋 Application Summary
              </h3>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;width:40%;">Application Number</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:700;font-size:14px;">#${appNum}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Lender Partner</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-weight:600;font-size:14px;">${bankName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Loan Category</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;">${loanType}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;">Requested Principal</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6605c7;font-weight:700;font-size:14px;">${amount}</td>
                </tr>
              </table>

              <!-- Progress bar container -->
              <div style="background:#f3f4f6; border-radius:10px; height:8px; width:100%; margin:28px 0 12px; overflow:hidden;">
                <div style="background:linear-gradient(to right, #6605c7, #8b5cf6); height:100%; width:30%; border-radius:10px;"></div>
              </div>
              <p style="color:#4b5563; font-size:12px; font-weight:600; margin:0 0 28px; text-align:right;">
                Overall Progress: 30% completed
              </p>

              <!-- Timeline -->
              <h3 style="color:#1e1b4b;font-size:16px;font-weight:700;margin:28px 0 20px;border-bottom:2px solid #f3f4f6;padding-bottom:8px;">
                📍 Tracking Pipeline
              </h3>
              
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                <!-- Step 1 -->
                <tr>
                  <td valign="top" style="width: 32px; text-align: center;">
                    <div style="background-color: #059669; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px; display: inline-block;">✓</div>
                    <div style="width: 2px; height: 35px; background-color: #059669; margin: 4px auto;"></div>
                  </td>
                  <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                    <span style="color: #111827; font-weight: 700; font-size: 14px; display: block;">Application Submitted</span>
                    <span style="color: #059669; font-size: 11px; font-weight: 600; text-transform: uppercase;">Completed</span>
                    <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0; line-height: 1.4;">Your application has been received and registered under number #${appNum}.</p>
                  </td>
                </tr>
                <!-- Step 2 -->
                <tr>
                  <td valign="top" style="width: 32px; text-align: center;">
                    <div style="background-color: #8b5cf6; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px; display: inline-block;">2</div>
                    <div style="width: 2px; height: 35px; background-color: #e5e7eb; margin: 4px auto;"></div>
                  </td>
                  <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                    <span style="color: #111827; font-weight: 700; font-size: 14px; display: block;">VidyaLoan Review</span>
                    <span style="color: #8b5cf6; font-size: 11px; font-weight: 600; text-transform: uppercase;">Active Review</span>
                    <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0; line-height: 1.4;">Our team is actively reviewing your qualifications and matching your profile with loan structures.</p>
                  </td>
                </tr>
                <!-- Step 3 -->
                <tr>
                  <td valign="top" style="width: 32px; text-align: center;">
                    <div style="background-color: #f3f4f6; color: #9ca3af; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px; display: inline-block;">3</div>
                    <div style="width: 2px; height: 35px; background-color: #e5e7eb; margin: 4px auto;"></div>
                  </td>
                  <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                    <span style="color: #9ca3af; font-weight: 600; font-size: 14px; display: block;">Credit Check</span>
                    <span style="color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase;">Pending</span>
                    <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0; line-height: 1.4;">System performs background financial and credit score checks.</p>
                  </td>
                </tr>
                <!-- Step 4 -->
                <tr>
                  <td valign="top" style="width: 32px; text-align: center;">
                    <div style="background-color: #f3f4f6; color: #9ca3af; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px; display: inline-block;">4</div>
                    <div style="width: 2px; height: 35px; background-color: #e5e7eb; margin: 4px auto;"></div>
                  </td>
                  <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                    <span style="color: #9ca3af; font-weight: 600; font-size: 14px; display: block;">Bank Review</span>
                    <span style="color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase;">Pending</span>
                    <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0; line-height: 1.4;">Our partner bank will review the details for eligibility.</p>
                  </td>
                </tr>
                <!-- Step 5 -->
                <tr>
                  <td valign="top" style="width: 32px; text-align: center;">
                    <div style="background-color: #f3f4f6; color: #9ca3af; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px; display: inline-block;">5</div>
                    <div style="width: 2px; height: 35px; background-color: #e5e7eb; margin: 4px auto;"></div>
                  </td>
                  <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                    <span style="color: #9ca3af; font-weight: 600; font-size: 14px; display: block;">Sanction Offer</span>
                    <span style="color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase;">Pending</span>
                    <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0; line-height: 1.4;">Official sanction letter is issued with specific loan interest rate & terms.</p>
                  </td>
                </tr>
                <!-- Step 6 -->
                <tr>
                  <td valign="top" style="width: 32px; text-align: center;">
                    <div style="background-color: #f3f4f6; color: #9ca3af; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px; display: inline-block;">6</div>
                  </td>
                  <td valign="top" style="padding-left: 12px;">
                    <span style="color: #9ca3af; font-weight: 600; font-size: 14px; display: block;">Disbursement</span>
                    <span style="color: #9ca3af; font-size: 11px; font-weight: 600; text-transform: uppercase;">Pending</span>
                    <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0; line-height: 1.4;">Funds are transferred directly to the educational institution.</p>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <h3 style="color:#1e1b4b;font-size:16px;font-weight:700;margin:28px 0 14px;border-bottom:2px solid #f3f4f6;padding-bottom:8px;">
                ⚙️ What our team is doing:
              </h3>
              
              <ul style="color:#4b5563; font-size:13px; line-height:1.6; padding-left:20px; margin-bottom:28px;">
                <li style="margin-bottom:8px;">Verifying your academic qualifications and university details.</li>
                <li style="margin-bottom:8px;">Performing a preliminary credit eligibility check.</li>
                <li style="margin-bottom:8px;">Reviewing co-applicant financial profiles and required documentation.</li>
              </ul>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#ffffff;padding:0 40px 40px;text-align:center;">
              <a href="${frontendUrl}/dashboard" style="
                display:inline-block;
                background:linear-gradient(135deg,#6605c7,#8b5cf6);
                color:#ffffff;
                text-decoration:none;
                padding:16px 44px;
                border-radius:50px;
                font-size:16px;
                font-weight:700;
                letter-spacing:0.3px;
                box-shadow:0 6px 20px rgba(102,5,199,0.3);
              ">🚀 Track Live Processing Status</a>
            </td>
          </tr>

          <!-- SUPPORT -->
          <tr>
            <td style="background:#fafafa;border-top:1px solid #f3f4f6;padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-weight:700;color:#374151;font-size:13px;">Registered Email Address</p>
                    <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">This update was sent to ${email} registered with your account.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              background:linear-gradient(135deg,#1a0533,#1e1b6e);
              border-radius:0 0 20px 20px;
              padding:28px 40px;
              text-align:center;
            ">
              <p style="color:#a78bfa;font-size:12px;margin:0 0 8px;font-weight:600;letter-spacing:1px;">VIDYALOAN</p>
              <p style="color:#6b7280;font-size:11px;margin:0 0 12px;line-height:1.6;">
                Empowering Indian students to achieve global education goals.<br/>
                Registered in India
              </p>
              <p style="color:#4b5563;font-size:10px;margin:0;line-height:1.6;">
                © ${year} VidyaLoana Pvt. Ltd. All rights reserved.<br/>
                <a href="${frontendUrl}/privacy-policy" style="color:#6366f1;text-decoration:none;">Privacy Policy</a> &nbsp;·&nbsp;
                <a href="${frontendUrl}/terms-conditions" style="color:#6366f1;text-decoration:none;">Terms of Service</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending staff review started email to: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Staff review started email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – staff review email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send staff review started email to ${email}:`, error);
    }
  }

  async sendLoanSubmissionEmail(email: string, userName: string, bankName: string, application: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();
    const appNum = application.applicationNumber || 'N/A';
    const loanType = (application.loanType || 'Education').toUpperCase();
    const amount = application.amount ? `₹${Number(application.amount).toLocaleString('en-IN')}` : 'N/A';
    const university = application.universityName || application.targetUniversity || 'N/A';
    const targetCountry = application.country || application.targetCountry || application.countryName || 'N/A';

    const mailOptions = {
      from: this.getFromAddress(),
      to: userName ? `"${userName}" <${email}>` : email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Confirmation: Loan Application Submitted (#${appNum})`,
      text: `Dear ${userName},\n\nYour loan application for ${targetCountry} has been submitted successfully.\n\nApplication Number: ${appNum}\nLoan Type: ${loanType}\nAmount: ${amount}\nTarget Country: ${targetCountry}\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loan Application Submitted Successfully</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .col-3 { display: block !important; width: 100% !important; text-align: center !important; margin-bottom: 20px; }
      .footer-col { display: block !important; width: 100% !important; text-align: center !important; margin-bottom: 15px; }
      .meta-table td { display: block !important; width: 100% !important; text-align: left !important; padding: 8px 0 !important; }
      .meta-table tr { border-bottom: 1px solid #f1f5f9; display: block; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 45px 0;">
    <tr>
      <td align="center">
        <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="background-color: #0f172a; padding: 28px 40px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="color: #38bdf8; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 4px;">VidyaLoan</span>
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Application Received</h1>
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.3);">#${appNum}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: left;">
              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 15px; color: #166534; font-weight: 600; line-height: 22px;">
                  🎉 Great job! Your financing request has been successfully logged and is currently under review by our credit specialists.
                </p>
              </div>
              <p style="color: #475569; font-size: 15px; line-height: 24px; margin: 0 0 24px 0;">
                Hello ${userName || 'Applicant'}, Thank you for choosing VidyaLoan to fund your career aspirations. We have safely compiled your credentials for study in <strong>${targetCountry}</strong>. Expect a definitive profile eligibility status update within the next <strong>24–48 hours</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table class="meta-table" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                <tr>
                  <td colspan="2" style="padding-bottom: 14px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">📋 Application Summary</h3>
                  </td>
                </tr>
                <tr>
                  <td width="40%" style="padding: 12px 0 6px 0; font-size: 14px; color: #64748b;">Target Country</td>
                  <td width="60%" style="padding: 12px 0 6px 0; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${targetCountry}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Loan Type</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${loanType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Requested Amount</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #10b981; font-weight: 700; text-align: right;">${amount}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0 4px 0; font-size: 14px; color: #64748b;">Institution</td>
                  <td style="padding: 6px 0 4px 0; font-size: 14px; color: #0f172a; font-weight: 600; text-align: right;">${university}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 35px 40px;">
              <h4 style="margin: 0 0 20px 0; font-size: 16px; color: #0f172a; font-weight: 700;">⚡ Next Operational Steps</h4>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td valign="top" width="36" style="padding-bottom: 20px;">
                    <div style="background-color: #e0f2fe; color: #0284c7; width: 24px; height: 24px; border-radius: 6px; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px;">1</div>
                  </td>
                  <td valign="top" style="padding-bottom: 20px;">
                    <h5 style="margin: 0 0 4px 0; font-size: 14px; color: #0f172a; font-weight: 600;">Document Syncing</h5>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 18px;">Accelerate your file review. Link your DigiLocker profile to seamlessly pull verified identity details and certificates directly into the verification system.</p>
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="36" style="padding-bottom: 20px;">
                    <div style="background-color: #f1f5f9; color: #475569; width: 24px; height: 24px; border-radius: 6px; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px;">2</div>
                  </td>
                  <td valign="top" style="padding-bottom: 20px;">
                    <h5 style="margin: 0 0 4px 0; font-size: 14px; color: #0f172a; font-weight: 600;">Credit Check & Evaluation</h5>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 18px;">Our assigned financial auditors and bank underwriters evaluate academic eligibility parameters along with financial co-applicant portfolios.</p>
                  </td>
                </tr>
                <tr>
                  <td valign="top" width="36;">
                    <div style="background-color: #f1f5f9; color: #475569; width: 24px; height: 24px; border-radius: 6px; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px;">3</div>
                  </td>
                  <td valign="top">
                    <h5 style="margin: 0 0 4px 0; font-size: 14px; color: #0f172a; font-weight: 600;">Sanction Letter Delivery</h5>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 18px;">Upon successful validation clearance, your digitally signed bank sanction document outlines the exact interest structures and remittance methods.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 0 40px 40px 40px; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/dashboard" target="_blank" style="background-color: #0284c7; color: #ffffff; display: block; padding: 14px 0; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; text-align: center; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.25);">🚀 Track Real-Time Application Status</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 40px; background-color: #fafafa;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td class="footer-col" width="65%">
                    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #0f172a;">Need any processing assistance?</p>
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 18px;">Our assigned loan counsellors are configured to walk you through documentation guidelines.</p>
                  </td>
                  <td class="footer-col" width="35%" align="right" valign="middle">
                    <a href="mailto:support@vidyaloans.in" style="color: #0284c7; text-decoration: none; font-size: 13px; font-weight: 600; border: 1px solid #e2e8f0; background-color: #ffffff; padding: 10px 16px; border-radius: 6px; display: inline-block;">📧 Contact Support</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: #0f172a; padding: 30px 40px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 20px;">
              <strong style="color: #ffffff; letter-spacing: 0.5px;">VIDYALOANS</strong><br>
              Empowering Indian students to achieve global education goals seamlessly.<br>
              <span style="color: #64748b; font-size: 11px;">Registered in India</span>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; border-top: 1px solid #1e293b; padding-top: 16px;">
                <tr>
                  <td align="center" style="font-size: 11px; color: #64748b;">
                    You received this mail response because you registered at VidyaLoans. <br>
                    <a href="${frontendUrl}/privacy-policy" style="color: #94a3b8; text-decoration: underline;">Privacy Policy</a> · <a href="${frontendUrl}/terms-conditions" style="color: #94a3b8; text-decoration: underline;">Terms of Service</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending loan submission email to: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Loan submission email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – loan submission email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send loan submission email to ${email}:`, error);
    }
  }

  private calculateProgress(application: any, defaultFallback: number = 25): number {
    if (!application) return defaultFallback;
    const s = String(application.status || '').toLowerCase();
    const stage = String(application.stage || '').toLowerCase();

    if (['disbursed', 'closed'].includes(s) || ['disbursed', 'disbursement'].includes(stage)) return 100;
    if (['sanctioned', 'approved', 'sanction'].includes(s) || ['sanction'].includes(stage)) return 95;
    if (['under_bank_review', 'query_raised', 'conditional_sanction', 'processing'].includes(s) || ['bank_review', 'review'].includes(stage)) return 90;
    if (['submitted_to_bank', 'file_logged'].includes(s) || ['submit_to_bank'].includes(stage)) return 75;
    if (['staff_verified', 'verification', 'documents_verified'].includes(s) || ['credit_check'].includes(stage)) return 50;
    if (['docs_received', 'docs_uploaded', 'under_review'].includes(s) || ['document_verification'].includes(stage)) return Math.max(typeof application.progress === 'number' && application.progress > 0 ? application.progress : 0, 40);
    if (['submitted', 'application_submitted'].includes(s) || ['application_submitted'].includes(stage)) return Math.max(typeof application.progress === 'number' && application.progress > 0 ? application.progress : 0, 25);

    if (typeof application.progress === 'number' && application.progress > 0) {
      return application.progress;
    }
    return defaultFallback;
  }

  async sendAllDocumentsVerifiedEmail(email: string, userName: string, application?: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();
    const appNum = application?.applicationNumber || (application?.id ? `#${application.id.slice(-6)}` : '');
    const name = userName || 'Student';

    const mailOptions = {
      from: this.getFromAddress(),
      to: name ? `"${name}" <${email}>` : email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Documents Verified: All Your Submitted Documents Have Been Approved by Staff`,
      text: `Dear ${name},\n\nGreat news! All documents submitted for your loan application ${appNum ? `(${appNum}) ` : ''}have been reviewed and successfully verified by our staff team.\n\nYour application has been updated to "Documents Verified" status and is now ready for bank review.\n\nTrack your application progress: ${frontendUrl}\n\nWarm regards,\nThe VidyaLoans Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>All Documents Verified</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 45px 0;">
    <tr>
      <td align="center">
        <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="background-color: #0f172a; padding: 28px 40px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="color: #38bdf8; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 4px;">VidyaLoans</span>
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Documents Verified</h1>
                  </td>
                  ${appNum ? `<td align="right" valign="middle"><span style="background-color: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.3);">${appNum}</span></td>` : ''}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 20px;">
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 24px; margin-bottom: 24px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="36" valign="middle">
                      <div style="background-color: #22c55e; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; font-size: 16px;">✓</div>
                    </td>
                    <td valign="middle" style="padding-left: 12px;">
                      <strong style="color: #15803d; font-size: 15px; display: block;">Verification Complete!</strong>
                      <span style="color: #166534; font-size: 13px;">All submitted documents have been reviewed and approved by VidyaLoans staff.</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                Dear <strong>${name}</strong>,
              </p>
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Great news! Our verification staff has successfully reviewed and verified all the required academic, identity, and financial documents submitted for your loan application.
              </p>

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #f1f5f9;">
                <tr>
                  <td>
                    <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Current Status</div>
                    <div style="font-size: 18px; color: #0f172a; font-weight: 700;">Documents Verified & Approved (50%)</div>
                    <div style="font-size: 13px; color: #475569; margin-top: 4px;">Your complete dossier is now ready and proceeding to bank submission.</div>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin: 32px 0 16px;">
                <a href="${frontendUrl}" style="background-color: #0284c7; color: #ffffff; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">Track Application Status</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
              <p style="margin: 0 0 8px;">VidyaLoans Support Team &bull; support@vidyaloans.in</p>
              <p style="margin: 0;">&copy; ${year} VidyaLoans. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending All Documents Verified Email to ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] All Documents Verified Email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] SMTP credentials not set. Simulated sending email to ${email}`);
      }
    } catch (error: any) {
      console.error(`[EmailService] Failed to send All Documents Verified Email to ${email}:`, error?.message || error);
    }
  }

  async sendLoanTrackingEmail(email: string, userName: string, bankName: string, application: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();
    const appNum = application.applicationNumber || 'N/A';
    const loanType = (application.loanType || 'Education').toUpperCase();
    const targetCountry = application.country || application.targetCountry || application.countryName || 'N/A';
    const progress = this.calculateProgress(application, 25);

    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Application Progress Tracker (#${appNum})`,
      text: `Dear ${userName},\n\nYour loan application progress tracker is active.\n\nApplication Number: #${appNum}\nTarget Country: ${targetCountry}\nLoan Type: ${loanType}\nCurrent Stage: Application Submitted\nProgress: ${progress}%\n\nYou can track the progress of your application on the VidyaLoan dashboard: ${frontendUrl}/dashboard\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Progress Tracker</title>
    <style>
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; border-radius: 0 !important; }
            .footer-col { display: block !important; width: 100% !important; text-align: center !important; margin-bottom: 15px; }
            .progress-bar-container { width: 100% !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 45px 0;">
        <tr>
            <td align="center">
                <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); overflow: hidden; border: 1px solid #e2e8f0;">
                    
                    <tr>
                        <td style="background-color: #4f46e5; padding: 32px 40px; text-align: left; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <span style="color: #c7d2fe; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">VidyaLoan Engine</span>
                                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Application Progress Active</h1>
                                    </td>
                                    <td align="right" valign="middle">
                                        <div style="background-color: rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 6px; backdrop-filter: blur(4px);">
                                            ID: #${appNum}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px 40px 24px 40px;">
                            <p style="color: #475569; font-size: 15px; line-height: 24px; margin: 0;">
                                Your loan application for study in <strong>${targetCountry}</strong> has been safely registered on the VidyaLoan system. You can closely monitor the real-time pipeline status of your journey from submission through to final fund disbursement.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;">
                                <tr>
                                    <td style="font-size: 14px; color: #1e293b; font-weight: 600;">Overall Progress</td>
                                    <td align="right" style="font-size: 14px; color: #4f46e5; font-weight: 700;">${progress}% Completed</td>
                                </tr>
                                <tr>
                                    <td colspan="2" style="padding-top: 12px;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #e2e8f0; border-radius: 4px; height: 8px;">
                                            <tr>
                                                <td width="${progress}%" style="background-color: #10b981; border-radius: 4px; height: 8px;"></td>
                                                <td width="${100 - progress}%"></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px 35px 40px;">
                            <h3 style="margin: 0 0 24px 0; font-size: 16px; color: #0f172a; font-weight: 700; letter-spacing: -0.3px;">📍 Live Tracking Pipeline</h3>
                            
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td valign="top" width="32" style="padding-bottom: 24px; text-align: center;">
                                        <div style="background-color: #dcfce7; color: #15803d; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px;">✓</div>
                                        <div style="width: 2px; height: 36px; background-color: #10b981; margin: 4px auto 0 auto;"></div>
                                    </td>
                                    <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                                        <span style="background-color: #dcfce7; color: #166534; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">Completed</span>
                                        <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 600;">Application Submitted</h4>
                                        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 18px;">Your application parameters have been logged and registered securely under ticket ID #${appNum}.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <td valign="top" width="32" style="padding-bottom: 24px; text-align: center;">
                                        <div style="background-color: #e0f2fe; color: #0369a1; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 700; font-size: 12px; border: 2px solid #0284c7; box-sizing: border-box;">2</div>
                                        <div style="width: 2px; height: 36px; background-color: #e2e8f0; margin: 4px auto 0 auto;"></div>
                                    </td>
                                    <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                                        <span style="background-color: #e0f2fe; color: #0369a1; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">Next Action Step</span>
                                        <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #0f172a; font-weight: 600;">Document Verification</h4>
                                        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 18px;">Verify your identity metrics and secure profile credentials. Link your DigiLocker module to process instant auto-approvals.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <td valign="top" width="32" style="padding-bottom: 24px; text-align: center;">
                                        <div style="background-color: #f1f5f9; color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 600; font-size: 12px;">3</div>
                                        <div style="width: 2px; height: 36px; background-color: #e2e8f0; margin: 4px auto 0 auto;"></div>
                                    </td>
                                    <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                                        <span style="background-color: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">Pending</span>
                                        <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #475569; font-weight: 600;">Credit Check Evaluation</h4>
                                        <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 18px;">Automated processes calculate financial risk profiles and verify credit scores internally.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <td valign="top" width="32" style="padding-bottom: 24px; text-align: center;">
                                        <div style="background-color: #f1f5f9; color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 600; font-size: 12px;">4</div>
                                        <div style="width: 2px; height: 36px; background-color: #e2e8f0; margin: 4px auto 0 auto;"></div>
                                    </td>
                                    <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                                        <span style="background-color: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">Pending</span>
                                        <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #475569; font-weight: 600;">Partner Bank Review</h4>
                                        <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 18px;">Underwriters from our partner bank evaluate files for formal eligibility compliance parameters.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <td valign="top" width="32" style="padding-bottom: 24px; text-align: center;">
                                        <div style="background-color: #f1f5f9; color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 600; font-size: 12px;">5</div>
                                        <div style="width: 2px; height: 36px; background-color: #e2e8f0; margin: 4px auto 0 auto;"></div>
                                    </td>
                                    <td valign="top" style="padding-left: 12px; padding-bottom: 24px;">
                                        <span style="background-color: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">Pending</span>
                                        <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #475569; font-weight: 600;">Sanction Release</h4>
                                        <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 18px;">Official digital generation of loan sanction letter detailing specific rate frameworks.</p>
                                    </td>
                                </tr>

                                <tr>
                                    <td valign="top" width="32" style="text-align: center;">
                                        <div style="background-color: #f1f5f9; color: #94a3b8; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: 600; font-size: 12px;">6</div>
                                    </td>
                                    <td valign="top" style="padding-left: 12px;">
                                        <span style="background-color: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">Pending</span>
                                        <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #475569; font-weight: 600;">Loan Disbursement</h4>
                                        <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 18px;">Capital structures are dispatched directly to your designated global academic institution.</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 0 40px 40px 40px; border-bottom: 1px solid #f1f5f9;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="${frontendUrl}/dashboard" target="_blank" style="background-color: #4f46e5; color: #ffffff; display: block; padding: 14px 0; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; text-align: center; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">🚀 Launch Real-Time Tracking Dashboard</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #fafafa; padding: 24px 40px; border-bottom: 1px solid #e2e8f0;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td style="font-size: 12px; color: #64748b; line-height: 18px;">
                                        <strong>Registered Inbox Address:</strong><br>
                                        This verification notice was auto-dispatched to the registered user profile matching your credentials. Keep track safely via your centralized dashboard.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #0f172a; padding: 32px 40px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 20px;">
                            <strong style="color: #ffffff; letter-spacing: 0.5px;">VIDYALOANS PLATFORMS</strong><br>
                            Empowering academic financing with transparent operational transparency global frameworks.<br>
                            <span style="color: #64748b; font-size: 11px;">Registered</span>
                            
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; border-top: 1px solid #1e293b; padding-top: 16px;">
                                <tr>
                                    <td align="center" style="font-size: 11px; color: #475569;">
                                        © ${year} VidyaLoans Pvt. Ltd. All rights reserved.<br>
                                        <a href="${frontendUrl}/privacy-policy" style="color: #94a3b8; text-decoration: underline;">Privacy Policy</a> &nbsp;·&nbsp; <a href="${frontendUrl}/terms-conditions" style="color: #94a3b8; text-decoration: underline;">Terms of Service</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending loan tracking email to: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Loan tracking email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – loan tracking email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send loan tracking email to ${email}:`, error);
    }
  }

  async sendApplicationSentToBankEmail(email: string, userName: string, bankName: string, application: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();
    const appNum = application.applicationNumber || 'N/A';
    const loanType = (application.loanType || 'Education').toUpperCase();
    const amount = application.amount ? `₹${Number(application.amount).toLocaleString('en-IN')}` : 'N/A';
    const university = application.universityName || application.targetUniversity || 'N/A';
    const targetCountry = application.country || application.targetCountry || application.countryName || 'N/A';
    const progress = this.calculateProgress(application, 75);

    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Application Status: Submitted to ${bankName} (#${appNum})`,
      text: `Dear ${userName},\n\nYour loan application has been reviewed and processed by the VidyaLoan staff and has been successfully sent to ${bankName} for review.\n\nApplication Number: #${appNum}\nBank Partner: ${bankName}\nLoan Type: ${loanType}\nRequested Amount: ${amount}\nTarget Country: ${targetCountry}\nInstitution: ${university}\nCurrent Stage: Bank Review\nProgress: ${progress}%\n\nYou can track the progress of your application on the VidyaLoan dashboard: ${frontendUrl}/dashboard\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Shared with Bank</title>
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
      background-color: #e3f2fd;
      color: #1565c0;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 16px;
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
      <span class="badge" style="display: inline-block; background-color: #e3f2fd; color: #1565c0; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; margin-bottom: 16px;">📤 Application Forwarded</span>
      
      <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Great news, ${userName || 'Applicant'}!</h2>
      <p>Your education loan application has been successfully verified and shared with our banking partner for official evaluation.</p>

      <!-- Details Card -->
      <div class="details-card" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <table class="details-table" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Application ID:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">#${appNum}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Partner Bank:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${bankName}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Loan Type:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${loanType}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Requested Amount:</td>
            <td class="value" style="font-weight: 600; color: #10b981; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${amount}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Target Country:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${targetCountry}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Institution:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${university}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; text-align: left;">Status:</td>
            <td class="value" style="font-weight: 600; color: #2e7d32; font-size: 14px; padding: 8px 0; text-align: right;">Under Bank Review</td>
          </tr>
        </table>
      </div>

      <p>The bank's credit team will review your application and financial documents. You will receive updates directly as soon as there is progress.</p>

      <!-- Action Button -->
      <div class="btn-container" style="text-align: center; margin-top: 28px;">
        <a href="${frontendUrl}/dashboard" class="btn" style="background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">Track Application Progress</a>
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
      `,
    };

    try {
      console.log(`[EmailService] Sending application sent to bank email to: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Application sent to bank email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – tracking email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send application sent to bank email to ${email}:`, error);
    }
  }

  async sendNewApplicationNotificationToBank(
    bankEmail: string,
    bankName: string,
    application: any,
    studentName: string,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const appNum = application.applicationNumber || 'N/A';
    const loanType = application.loanType || 'Education Loan';
    const amount = application.amount ? `₹${Number(application.amount).toLocaleString('en-IN')}` : 'N/A';
    const university = application.universityName || application.targetUniversity || 'N/A';

    const mailOptions = {
      from: this.getFromAddress(),
      to: bankEmail,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `📥 Loan Application #${appNum} Submitted to ${bankName} for Credit Review`,
      text: `Dear Partner at ${bankName},\n\nA new verified student education loan application (#${appNum}) has been submitted to ${bankName} through the VidyaLoan Staff Portal for credit evaluation and underwriting.\n\nApplication Reference: #${appNum}\nStudent Name: ${studentName}\nRequested Amount: ${amount}\nTarget University: ${university}\nLoan Type: ${loanType}\n\nPlease log in to the VidyaLoans Bank Partner Portal to review the credit file and documents.\n\nPortal Login: ${frontendUrl}/bank/login\n\nBest regards,\nThe VidyaLoans Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loan Application Submitted to Bank - VidyaLoan</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#334155;">
  <div style="max-width:600px;margin:30px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg,#0d47a1,#1565c0);padding:30px;text-align:center;color:#ffffff;">
      <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">VidyaLoan</h1>
      <p style="margin:5px 0 0;font-size:12px;opacity:0.9;text-transform:uppercase;letter-spacing:1px;">Bank Partner Underwriting Portal</p>
    </div>
    <div style="padding:30px;line-height:1.6;">
      <div style="background-color:#e3f2fd;border-left:4px solid #1565c0;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#0d47a1;font-weight:700;">
          📥 New Application Submitted to ${bankName}
        </p>
      </div>
      <h2 style="margin:0 0 15px;font-size:18px;color:#1e293b;font-weight:700;">Loan Application Submitted for Underwriting</h2>
      <p style="margin:0 0 20px;">Dear Partner at <strong>${bankName}</strong>,</p>
      <p style="margin:0 0 25px;">A new verified student education loan application has been submitted to your bank through the VidyaLoan Staff Portal for credit evaluation. Below are the primary file details:</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 25px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;width:150px;border-bottom:1px dashed #cbd5e1;">Application No.</td>
            <td style="padding:8px 0;color:#0f172a;font-weight:700;border-bottom:1px dashed #cbd5e1;">#${appNum}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;border-bottom:1px dashed #cbd5e1;">Student Name</td>
            <td style="padding:8px 0;color:#0f172a;font-weight:600;border-bottom:1px dashed #cbd5e1;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;border-bottom:1px dashed #cbd5e1;">Loan Amount</td>
            <td style="padding:8px 0;color:#10b981;font-weight:700;border-bottom:1px dashed #cbd5e1;">${amount}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;border-bottom:1px dashed #cbd5e1;">Target University</td>
            <td style="padding:8px 0;color:#0f172a;font-weight:600;border-bottom:1px dashed #cbd5e1;">${university}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-weight:600;">Loan Type</td>
            <td style="padding:8px 0;color:#0f172a;font-weight:600;">${loanType}</td>
          </tr>
        </table>
      </div>
      
      <p style="margin:0 0 30px;">All applicant documents, co-applicant financial profiles, and staff verification logs have been uploaded and are ready for credit evaluation on your portal.</p>
      
      <div style="text-align:center;margin-bottom:30px;">
        <a href="${frontendUrl}/bank/login" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:8px;font-weight:700;font-size:14px;box-shadow:0 4px 10px rgba(37,99,235,0.25);">
          🚀 Access Bank Underwriting Portal
        </a>
      </div>
      
      <p style="margin:0;font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:20px;">
        Need help or have questions regarding this file? Contact support at support@vidyaloans.in.
      </p>
    </div>
  </div>
</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending application alert to bank email: ${bankEmail}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] New application email sent successfully to bank: ${bankEmail}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – logged bank notification to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send bank application notification to ${bankEmail}:`, error);
    }
  }

  /**
   * Send a full, detailed application package email to the bank.
   * Triggered manually by staff from the "Send Mail" action in the incoming queue.
   * Includes all application fields, document list, and a portal login CTA.
   */
  async sendApplicationPackageToBank(
    bankEmail: string,
    bankName: string,
    application: any,
    studentName: string,
    attachments?: any[],
  ) {
    const frontendUrl = process.env.FRONTEND_URL;
    const appNum = application.applicationNumber || 'N/A';
    const loanType = application.loanType || 'Education Loan';
    const amount = application.amount ? `₹${Number(application.amount).toLocaleString('en-IN')}` : 'N/A';
    const university = application.universityName || 'N/A';
    const course = application.courseName || application.courseType || 'N/A';
    const duration = application.courseDuration ? `${application.courseDuration} months` : 'N/A';
    const admission = application.admissionStatus || 'N/A';
    const gender = application.gender || 'N/A';
    const dob = application.dateOfBirth || 'N/A';

    const documents: any[] = application.documents || [];
    const docRows = documents.length > 0
      ? documents.map((doc: any) => {
        const viewUrl = (doc.id && application.id)
          ? `${frontendUrl}/api/applications/admin/${application.id}/documents/${doc.id}/view`
          : null;
        return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">
            <strong>${(doc.name || doc.type || 'Document').replace(/_/g, ' ')}</strong>
            ${viewUrl ? `<br/><a href="${viewUrl}" style="font-size:11px;color:#4f46e5;text-decoration:none;font-weight:600;" target="_blank">View / Download Document ↗</a>` : ''}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${doc.status === 'verified' ? '#dcfce7' : doc.status === 'rejected' ? '#fee2e2' : '#fef3c7'};color:${doc.status === 'verified' ? '#166534' : doc.status === 'rejected' ? '#991b1b' : '#92400e'};">${(doc.status || 'pending').toUpperCase()}</span>
          </td>
        </tr>`;
      }).join('')
      : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">No documents attached</td></tr>`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Application Package – VidyaLoan</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#334155;">
  <div style="max-width:660px;margin:36px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 36px;color:#fff;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div>
          <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">VidyaLoan</h1>
          <p style="margin:4px 0 0;font-size:11px;opacity:0.85;text-transform:uppercase;letter-spacing:1.2px;">Bank Partner Portal · Application Package</p>
        </div>
      </div>
    </div>

    <!-- Notice Banner -->
    <div style="background:#eff6ff;border-bottom:1px solid #dbeafe;padding:14px 36px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">📥</span>
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">
        Full application package for <strong>${studentName}</strong> has been sent to <strong>${bankName}</strong> for credit review.
      </p>
    </div>

    <div style="padding:32px 36px;line-height:1.6;">

      <!-- Application Summary -->
      <h2 style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a;">Application Reference</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#64748b;">Below is the complete file summary forwarded for your credit underwriting team.</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;">
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;width:170px;">Application No.</td>
            <td style="padding:5px 0;color:#0f172a;font-weight:700;font-family:monospace;">#${appNum}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;">Loan Type</td>
            <td style="padding:5px 0;color:#0f172a;">${loanType}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;">Requested Amount</td>
            <td style="padding:5px 0;color:#0f172a;font-weight:700;">${amount}</td>
          </tr>
        </table>
      </div>

      <!-- Student Profile -->
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px;">👤 Student Profile</h3>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;">
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;width:170px;">Full Name</td>
            <td style="padding:5px 0;color:#0f172a;font-weight:600;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;">Gender</td>
            <td style="padding:5px 0;color:#0f172a;">${gender}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;">Date of Birth</td>
            <td style="padding:5px 0;color:#0f172a;">${dob}</td>
          </tr>
        </table>
      </div>

      <!-- Academic Program -->
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px;">🎓 Academic Program</h3>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;">
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;width:170px;">University</td>
            <td style="padding:5px 0;color:#0f172a;">${university}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;">Course</td>
            <td style="padding:5px 0;color:#0f172a;">${course}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;">Duration</td>
            <td style="padding:5px 0;color:#0f172a;">${duration}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-weight:600;">Admission Status</td>
            <td style="padding:5px 0;color:#0f172a;font-weight:600;text-transform:capitalize;">${admission}</td>
          </tr>
        </table>
      </div>

      <!-- Documents -->
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:0.5px;">📎 Attached Documents</h3>
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Document Name</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${docRows}
          </tbody>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${frontendUrl}/bank/login" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(79,70,229,0.25);">
          Open Partner Portal →
        </a>
      </div>

      <p style="margin:0;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:20px;text-align:center;">
        This is a system-generated application package from VidyaLoan.<br>
        For support, contact <a href="mailto:support@vidyaloans.in" style="color:#4f46e5;">support@vidyaloans.in</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    try {
      console.log(`[EmailService] Sending full application package to bank: ${bankEmail}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail({
          from: this.getFromAddress(),
          to: bankEmail,
          replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
          headers: this.getStandardHeaders(),
          subject: `📋 Application Package – ${studentName} | ${appNum} | ${bankName}`,
          html,
          text: `Dear Partner at ${bankName},\n\nPlease find the full application package for ${studentName} (Ref: #${appNum}).\n\nAmount: ${amount}\nUniversity: ${university}\nCourse: ${course}\n\nLogin to the Partner Portal: ${frontendUrl}/bank/login\n\nRegards,\nVidyaLoan Team`,
          attachments: attachments && attachments.length > 0 ? attachments : undefined
        });
        console.log(`[EmailService] Application package sent to ${bankEmail}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – package logged for ${bankEmail}`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send application package to ${bankEmail}:`, error);
    }
  }

  async sendApplicationAcceptedByBankEmail(email: string, userName: string, bankName: string, application: any, details?: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();
    const appNum = application.applicationNumber || 'N/A';
    const progress = this.calculateProgress(application, 95);

    // Parse sanction amounts and rates
    const rawAmt = details?.sanctionAmount || application.sanctionAmount || application.amount;
    const amount = rawAmt ? `₹${Number(rawAmt).toLocaleString('en-IN')}` : 'N/A';
    const rate = details?.interestRate || application.interestRate || '9.5';
    const tenure = details?.tenure || application.tenure || 120;

    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Application Approved: Loan Sanctioned by ${bankName} (#${appNum})`,
      text: `Dear ${userName},\n\nWe have fantastic news! Your loan application for ${bankName} has been accepted and approved by the bank.\n\nApplication Number: #${appNum}\nSanction Amount: ${amount}\nInterest Rate: ${rate}% p.a.\nTenure: ${tenure} months\n\nYou can view and accept the formal sanction letter on your VidyaLoan dashboard: ${frontendUrl}/dashboard\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loan Application Accepted - VidyaLoan</title>
    <style>
        /* Reset styles for consistency across email clients */
        body, table, td, a { text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }

        /* Premium Hover Effects (Supported by modern clients) */
        .cta-button:hover { background-color: #5b21b6 !important; transform: translateY(-1px); }
    </style>
</head>
<body>
  <div style="
    background-image: url('${frontendUrl}/images/vidyaloans-logo-transparent.png'); 
    background-repeat: no-repeat; 
    background-position: center center; 
    background-size: 50% auto;
    width: 100%; 
    margin: 0; 
    padding: 0;
  ">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(248, 250, 252, 0.9); padding: 40px 10px;">
        <tr>
            <td align="center" valign="top">
                
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                    
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <span style="font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #6605c7; text-transform: uppercase;">VIDYALOAN</span>
                        </td>
                    </tr>

                    <tr>
                        <td align="left" style="padding: 20px 40px 40px 40px; position: relative; background-image: repeating-linear-gradient(-45deg, rgba(102, 5, 199, 0.03) 0px, rgba(102, 5, 199, 0.03) 2px, transparent 2px, transparent 40px);">
                            
                            <h1 style="margin: 0 0 20px 0; font-size: 26px; font-weight: 700; line-height: 1.3; color: #0F172A; text-align: center;">
                                Loan Application Approved!
                            </h1>

                            <div style="height: 1px; width: 60px; background-color: #E2E8F0; margin: 0 auto 30px auto;"></div>

                            <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                                Hello ${userName},
                            </p>
                            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                                We have fantastic news! Your loan application for <strong>${bankName}</strong> has been accepted and approved by the bank. Below are the details of your sanction proposal:
                            </p>

                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 16px; font-size: 14px; color: #64748B; font-weight: 500; border-bottom: 1px solid #E2E8F0;">Application Number:</td>
                                    <td style="padding: 16px; font-size: 14px; color: #0F172A; font-weight: 600; text-align: right; border-bottom: 1px solid #E2E8F0;">#${appNum}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 16px; font-size: 14px; color: #64748B; font-weight: 500; border-bottom: 1px solid #E2E8F0;">Sanctioned Amount:</td>
                                    <td style="padding: 16px; font-size: 14px; color: #0F172A; font-weight: 600; text-align: right; border-bottom: 1px solid #E2E8F0;">${amount}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 16px; font-size: 14px; color: #64748B; font-weight: 500; border-bottom: 1px solid #E2E8F0;">Interest Rate:</td>
                                    <td style="padding: 16px; font-size: 14px; color: #0F172A; font-weight: 600; text-align: right; border-bottom: 1px solid #E2E8F0;">${rate}% p.a.</td>
                                </tr>
                                <tr>
                                    <td style="padding: 16px; font-size: 14px; color: #64748B; font-weight: 500;">Repayment Tenure:</td>
                                    <td style="padding: 16px; font-size: 14px; color: #0F172A; font-weight: 600; text-align: right;">${tenure} months</td>
                                </tr>
                            </table>

                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-top: 10px;">
                                        <a href="${frontendUrl}/dashboard" target="_blank" class="cta-button" style="display: inline-block; background-color: #6605c7; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(102, 5, 199, 0.2); transition: all 0.2s ease;">
                                            Review & Accept Sanction Letter
                                        </a>
                                    </td>
                                </tr>
                            </table>

                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="background-color: #F1F5F9; padding: 24px 40px; border-top: 1px solid #E2E8F0;">
                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #94A3B8; line-height: 1.4;">
                                Empowering Indian students to achieve global education goals.<br/>
                                Registered in India 
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                                &copy; ${year} VidyaLoans Pvt. Ltd. All rights reserved.
                            </p>
                        </td>
                    </tr>

                </table>
                </td>
        </tr>
    </table>
  </div>
</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending application accepted email to: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Generate the entire application PDF
        const appPdfBuffer = await this.generateApplicationPdf(application).catch(err => {
          console.error('[EmailService] Failed to generate application PDF for sanction email:', err);
          return null;
        });

        if (appPdfBuffer) {
          (mailOptions as any).attachments = [
            {
              filename: `Loan_Application_${appNum}.pdf`,
              content: appPdfBuffer,
              contentType: 'application/pdf',
            }
          ];
        }

        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Application accepted email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – tracking email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send application accepted email to ${email}:`, error);
    }
  }

  async sendLoanDisbursedEmail(email: string, userName: string, bankName: string, application: any, transactionDetails?: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();
    const appNum = application?.applicationNumber || 'N/A';
    const amount = transactionDetails?.amount ? `₹${Number(transactionDetails.amount).toLocaleString('en-IN')}` : (application?.disbursedAmount || application?.amount ? `₹${Number(application.disbursedAmount || application.amount).toLocaleString('en-IN')}` : 'N/A');
    const utrNumber = transactionDetails?.utrNumber || application?.utrNumber || 'N/A';
    const trancheNumber = transactionDetails?.trancheNumber || application?.trancheNumber || 1;
    const transferMode = transactionDetails?.transferMode || 'IMPS / NEFT / RTGS';
    const dateStr = transactionDetails?.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Notification: Loan Disbursed Successfully (#${appNum})`,
      text: `Dear ${userName},\n\nGreat news! Your education loan amount of ${amount} has been successfully disbursed by ${bankName}.\n\nApplication Number: #${appNum}\nTransaction Ref (UTR): ${utrNumber}\nDisbursed Amount: ${amount}\nBank Partner: ${bankName}\nTranche: Tranche ${trancheNumber}\nDisbursement Date: ${dateStr}\n\nYou can view full transaction details on your VidyaLoan dashboard: ${frontendUrl}/dashboard\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
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
      
      <h2 style="margin-top: 0; color: #111827; font-size: 20px;">Great news, ${userName || 'Applicant'}!</h2>
      <p>Your education loan disbursement transaction has been completed successfully by <strong>${bankName}</strong>.</p>

      <!-- Disbursed Amount Box -->
      <div class="amount-box" style="background: #f5f3ff; border-left: 4px solid #6605c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <div class="amount-label" style="color: #7c3aed; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Disbursed Amount</div>
        <div class="amount-value" style="font-size: 28px; font-weight: bold; color: #6605c7; margin-top: 4px;">${amount}</div>
      </div>

      <!-- Transaction Details Card -->
      <div class="details-card" style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <table class="details-table" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Application ID:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">#${appNum}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Transaction Ref (UTR):</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${utrNumber}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Partner Bank:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${bankName}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Tranche:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">Tranche ${trancheNumber}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Payment Mode:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${transferMode}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: left;">Disbursement Date:</td>
            <td class="value" style="font-weight: 600; color: #212529; font-size: 14px; padding: 8px 0; border-bottom: 1px dashed #dee2e6; text-align: right;">${dateStr}</td>
          </tr>
          <tr class="details-row">
            <td class="label" style="color: #6c757d; font-size: 14px; padding: 8px 0; text-align: left;">Status:</td>
            <td class="value" style="font-weight: 600; color: #2e7d32; font-size: 14px; padding: 8px 0; text-align: right;">Disbursed / Completed</td>
          </tr>
        </table>
      </div>

      <p>The disbursed funds have been credited according to your sanction terms. You can review full transaction details on your student dashboard.</p>

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
      `,
    };

    try {
      console.log(`[EmailService] Sending loan disbursement email to: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Loan disbursement email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – disbursement email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send loan disbursement email to ${email}:`, error);
    }
  }

  async sendApplicationRejectedByStaffEmail(email: string, userName: string, reason: string) {
    const year = new Date().getFullYear();

    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Application Status Update: VidyaLoans Staff Review`,
      text: `Dear ${userName},\n\nWe regret to inform you that your loan application has been rejected by VidyaLoan staff.\n\nRejection Reason: ${reason || 'Not specified'}\n\nIf you have any questions or believe this was a mistake, please contact our support desk immediately.\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Application Rejected by VidyaLoan Staff</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0f0f1a;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f1a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #1a0533 0%, #2d0a5e 40%, #1e1b6e 100%);
              border-radius: 20px 20px 0 0;
              padding: 36px 40px 28px;
              border-bottom: 1px solid rgba(225,29,72,0.3);
              text-align: center;
            ">
              <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 2px;">VIDYALOAN</span>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background-color:#151526;border-radius:0 0 20px 20px;padding:40px;border:1px solid #272742;border-top:none;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom:24px;">
                    <h2 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:-0.5px;">Application Rejected by VidyaLoan Staff</h2>
                  </td>
                </tr>
                <tr>
                  <td style="color:#a5a5c7;font-size:15px;line-height:24px;padding-bottom:20px;">
                    Dear <strong>${userName}</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="color:#a5a5c7;font-size:15px;line-height:24px;padding-bottom:24px;">
                    We regret to inform you that after careful review of your documents and profile details, your loan application has been rejected by our <strong>VidyaLoan Verification Staff</strong>.
                  </td>
                </tr>
                
                <!-- REJECTION BOX -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <div style="background-color:rgba(225,29,72,0.06);border:1px solid rgba(225,29,72,0.3);border-left:4px solid #e11d48;border-radius:8px;padding:20px;">
                      <h4 style="color:#e11d48;font-size:11px;font-weight:800;text-transform:uppercase;margin:0 0 8px 0;letter-spacing:1px;">Reason for Rejection</h4>
                      <p style="color:#ffffff;font-size:14px;line-height:20px;font-weight:600;margin:0;font-style:italic;">
                        "${reason || 'Verification shortfall or incomplete criteria'}"
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="color:#a5a5c7;font-size:14px;line-height:22px;padding-bottom:24px;">
                    If you believe this was a mistake, or if you can provide additional/updated documents to resolve the issue, please contact our support desk or reach out to your assigned agent. We will be happy to assist you.
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="border-top:1px solid #272742;padding-top:24px;text-align:center;color:#6b7280;font-size:12px;line-height:18px;">
                    This is an automated notification. Please do not reply directly to this email.<br/>
                    &copy; ${year} VidyaLoan. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending application rejected by staff email to ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Staff rejection email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – rejection email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send staff rejection email to ${email}:`, error);
    }
  }

  async sendApplicationRejectedByBankEmail(email: string, userName: string, bankName: string, reason: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.vidyaloans.in';
    const year = new Date().getFullYear();

    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      replyTo: process.env.EMAIL_USER || 'support@vidyaloans.in',
      headers: this.getStandardHeaders(),
      subject: `Application Status Update: ${bankName} Review`,
      text: `Dear ${userName},\n\nWe regret to inform you that your loan application has been rejected by ${bankName}.\n\nRejection Reason: ${reason || 'Credit score or verification shortfall'}\n\nDon't worry! VidyaLoan is partnered with 20+ other lenders. Our team will automatically match your profile with other suitable bank partners to explore alternate options. Contact our loan counsellors immediately for help.\n\nWarm regards,\nThe VidyaLoan Team`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Application Rejected - VidyaLoan</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0f0f1a;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f1a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="
              background: linear-gradient(135deg, #1a0533 0%, #2d0a5e 40%, #1e1b6e 100%);
              border-radius: 20px 20px 0 0;
              padding: 36px 40px 28px;
              border-bottom: 1px solid rgba(139,92,246,0.3);
            ">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Left side Logo -->
                  <td width="60" align="left" style="vertical-align: middle;">
                    <img src="${frontendUrl}/images/vidyaloans-logo-transparent.png" alt="VidyaLoan" width="52" height="52" style="display:block;border:none;border-radius:10px;" />
                  </td>
                  <!-- Middle Text -->
                  <td align="center" style="vertical-align: middle; padding-right: 60px;">
                    <h1 style="color:#ffffff;margin:0 0 4px;font-size:28px;font-weight:800;letter-spacing:-0.5px;font-family:'Inter','Segoe UI',Arial,sans-serif;">VidyaLoan</h1>
                    <p style="color:#a78bfa;margin:0;font-size:12px;letter-spacing:2px;font-weight:600;font-family:'Inter','Segoe UI',Arial,sans-serif;text-transform:uppercase;">EDUCATION LOAN PLATFORM</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="
              background: linear-gradient(160deg, #dc2626 0%, #f43f5e 100%);
              padding: 40px 40px 36px;
              text-align: center;
            ">
              <p style="margin:0 0 8px;font-size:42px;">⚠️</p>
              <h2 style="color:#ffffff;margin:0 0 10px;font-size:26px;font-weight:800;line-height:1.2;">
                Application Rejected by Bank
              </h2>
              <p style="color:#ffe4e6;margin:0;font-size:15px;line-height:1.65;max-width:420px;display:inline-block;">
                We regret to inform you that <strong>${bankName}</strong> was unable to approve this application.
              </p>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px 24px;">
              <p style="color:#374151;font-size:15px;line-height:1.75;margin:0 0 24px;">
                Dear <strong>${userName}</strong>, <br><br>
                Thank you for applying through VidyaLoan. We received the decision review from <strong>${bankName}</strong> regarding your loan application.
              </p>

              <!-- Rejection Reason Box -->
              <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:12px; padding:20px; margin-bottom:28px;">
                <h4 style="color:#9f1239; font-size:14px; font-weight:700; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.05em;">Reason for Decision</h4>
                <p style="color:#881337; font-size:14px; margin:0; line-height:1.5;">
                  ${reason || 'Credit profile parameters or documentation criteria were not met for this specific bank scheme.'}
                </p>
              </div>

              <h3 style="color:#1e1b4b;font-size:16px;font-weight:700;margin:28px 0 12px;border-bottom:2px solid #f3f4f6;padding-bottom:8px;">
                💡 Don't lose heart! What's next?
              </h3>
              <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0 0 20px;">
                A single rejection from one lender does not mean you cannot secure your education loan. 
                VidyaLoan is partnered with <strong>20+ other leading banks and NBFCs</strong>. 
                Our platform will automatically evaluate and match your dossier with other suitable lending partners that fit your profile.
              </p>
              <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0;">
                Your dedicated loan counsellor is already reviewing alternative options for you and will reach out shortly.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#ffffff;padding:0 40px 40px;text-align:center;">
              <a href="${frontendUrl}/dashboard" style="
                display:inline-block;
                background:linear-gradient(135deg,#e11d48,#be123c);
                color:#ffffff;
                text-decoration:none;
                padding:16px 44px;
                border-radius:50px;
                font-size:16px;
                font-weight:700;
                letter-spacing:0.3px;
                box-shadow:0 6px 20px rgba(225,29,72,0.4);
              ">💬 Chat with Loan Counsellor</a>
            </td>
          </tr>

          <!-- SUPPORT -->
          <tr>
            <td style="background:#fafafa;border-top:1px solid #f3f4f6;padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-weight:700;color:#374151;font-size:13px;">Registered Email Address</p>
                    <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">This message was sent to ${email} registered with your account.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              background:linear-gradient(135deg,#1a0533,#1e1b6e);
              border-radius:0 0 20px 20px;
              padding:28px 40px;
              text-align:center;
            ">
              <p style="color:#a78bfa;font-size:12px;margin:0 0 8px;font-weight:600;letter-spacing:1px;">VIDYALOAN</p>
              <p style="color:#6b7280;font-size:11px;margin:0 0 12px;line-height:1.6;">
                Empowering Indian students to achieve global education goals.<br/>
                Registered in India
              </p>
              <p style="color:#4b5563;font-size:10px;margin:0;line-height:1.6;">
                You received this email because you registered at VidyaLoan.<br/>
                © ${year} VidyaLoans Pvt. Ltd. All rights reserved.<br/>
                <a href="${frontendUrl}/privacy-policy" style="color:#6366f1;text-decoration:none;">Privacy Policy</a> &nbsp;·&nbsp;
                <a href="${frontendUrl}/terms-conditions" style="color:#6366f1;text-decoration:none;">Terms of Service</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    try {
      console.log(`[EmailService] Sending application rejected email to: ${email}`);
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Application rejected email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – tracking email logged to console`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send application rejected email to ${email}:`, error);
    }
  }

  public generateApplicationPdf(application: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // Colors
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
          .text('Education Loan Application Summary', 50, 80);

        doc.moveTo(50, 95).lineTo(550, 95).strokeColor('#e5e7eb').lineWidth(1).stroke();

        // Application Meta Details
        doc.fillColor(textColor).fontSize(10).text(`Application Number: ${application.applicationNumber || 'N/A'}`, 50, 110);
        doc.text(`Applied Bank: ${application.bank || application.bankName || 'N/A'}`, 50, 125);
        doc.text(`Loan Amount: Rs. ${(application.amount || 0).toLocaleString('en-IN')}`, 50, 140);
        doc.text(`Status: ${(application.status || 'pending').toUpperCase()}`, 320, 110);
        doc.text(`Submitted On: ${application.submittedAt ? new Date(application.submittedAt).toLocaleDateString('en-IN') : 'N/A'}`, 320, 125);

        doc.moveTo(50, 160).lineTo(550, 160).strokeColor('#e5e7eb').lineWidth(1).stroke();

        let y = 175;

        // Helper to draw sections
        const drawSectionHeader = (title) => {
          if (y > 620) { doc.addPage(); y = 50; }
          doc.fillColor(primaryColor).fontSize(12).text(title, 50, y);
          y += 18;
          doc.moveTo(50, y).lineTo(550, y).strokeColor('#ede9fe').lineWidth(0.5).stroke();
          y += 10;
        };

        const drawField = (label, value, halfWidth = false, rightSide = false) => {
          if (y > 700) { doc.addPage(); y = 50; }
          doc.fillColor(darkGray).fontSize(9).text(label, rightSide ? 300 : 50, y);
          doc.fillColor(textColor).fontSize(10).text(String(value ?? 'N/A'), rightSide ? 380 : 150, y);
          if (!halfWidth || rightSide) {
            y += 16;
          }
        };

        // 1. Personal Details
        drawSectionHeader('1. Personal Details');
        drawField('First Name', application.firstName, true, false);
        drawField('Last Name', application.lastName, true, true);
        drawField('Email ID', application.email, true, false);
        drawField('Phone Number', application.phone, true, true);
        drawField('Date of Birth', application.dateOfBirth ? new Date(application.dateOfBirth).toLocaleDateString('en-IN') : 'N/A', true, false);
        drawField('Gender', application.gender, true, true);
        drawField('Nationality', application.nationality, false, false);
        y += 10;

        // 2. Address
        drawSectionHeader('2. Contact Address');
        drawField('Address', application.address, false, false);
        drawField('City', application.city, true, false);
        drawField('State', application.state, true, true);
        drawField('Pincode', application.pincode, true, false);
        drawField('Country', application.country, true, true);
        y += 10;

        // 3. Academic details
        drawSectionHeader('3. Academic Details');
        drawField('University Name', application.universityName, false, false);
        drawField('Course Name', application.courseName, false, false);
        drawField('Course Duration', application.courseDuration ? `${application.courseDuration} Months` : 'N/A', true, false);
        drawField('Admission Status', application.admissionStatus, true, true);
        y += 10;

        // 4. Employment details
        drawSectionHeader('4. Employment Details');
        drawField('Employment Type', application.employmentType, true, false);
        drawField('Employer Name', application.employerName, true, true);
        drawField('Job Title', application.jobTitle, true, false);
        drawField('Annual Income', application.annualIncome ? `Rs. ${Number(application.annualIncome).toLocaleString('en-IN')}` : 'N/A', true, true);
        y += 10;

        // 5. Co-Applicant
        drawSectionHeader('5. Co-Applicant & Parent Details');
        drawField('Has Co-Applicant', application.hasCoApplicant ? 'Yes' : 'No', true, false);
        if (application.hasCoApplicant) {
          drawField('Name', application.coApplicantName, true, true);
          drawField('Relation', application.coApplicantRelation, true, false);
          drawField('Phone', application.coApplicantPhone, true, true);
          drawField('Income', application.coApplicantIncome ? `Rs. ${Number(application.coApplicantIncome).toLocaleString('en-IN')}` : 'N/A', false, false);
        }
        drawField("Father's Name", application.fatherName, true, false);
        drawField("Mother's Name", application.motherName, true, true);
        y += 10;

        // 6. Collateral
        drawSectionHeader('6. Collateral Details');
        drawField('Has Collateral', application.hasCollateral ? 'Yes' : 'No', true, false);
        if (application.hasCollateral) {
          drawField('Collateral Type', application.collateralType, true, true);
          drawField('Collateral Value', application.collateralValue ? `Rs. ${Number(application.collateralValue).toLocaleString('en-IN')}` : 'N/A', false, false);
          drawField('Collateral Details', application.collateralDetails, false, false);
        }

        // Footer
        doc.fillColor(darkGray)
          .fontSize(8)
          .text('This is a computer-generated summary of your VidyaLoan application.', 50, 740, { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send an email notification to student when a document is rejected by staff
   */
  async sendDocumentRejectionEmail(
    email: string,
    studentName: string,
    documentName: string,
    rejectionReason: string,
  ) {
    const formattedDocName = (documentName || 'Document').replace(/_/g, ' ').toUpperCase();
    const mailOptions = {
      from: this.getFromAddress(),
      to: email,
      subject: `Action Required: Your ${formattedDocName} Document was Rejected - VidyaLoan`,
      text: `Hello ${studentName},\n\nYour uploaded document "${formattedDocName}" has been rejected by our verification team.\n\nReason for Rejection:\n${rejectionReason || 'Document quality or format does not meet requirements.'}\n\nPlease log in to your dashboard to re-upload a clear and valid copy.\n\nBest regards,\nVidyaLoan Verification Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="background: linear-gradient(135deg, #6605c7 0%, #4338ca 100%); padding: 25px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">VidyaLoan Document Verification</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="display: inline-block; background: #ffe4e6; color: #e11d48; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 15px;">
              ❌ Action Required: Document Rejected
            </div>
            <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Verification Update for ${formattedDocName}</h2>
            <p style="font-size: 15px; color: #475569; line-height: 1.5;">Hello <strong>${studentName || 'Student'}</strong>,</p>
            <p style="font-size: 15px; color: #475569; line-height: 1.5;">Your uploaded document <strong>"${formattedDocName}"</strong> was reviewed by our verification staff and has been marked as <strong>Rejected</strong>.</p>
            
            <div style="background: #fff1f2; border-left: 4px solid #f43f5e; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #9f1239; letter-spacing: 0.5px;">Rejection Reason</p>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #881337; font-weight: 600; line-height: 1.4;">${rejectionReason || 'Document does not meet standard legibility or formatting requirements.'}</p>
            </div>

            <p style="font-size: 14px; color: #475569; line-height: 1.5;">Please log in to your student dashboard to re-upload a clear and valid copy of this document so we can continue processing your loan application.</p>
            
            <div style="text-align: center; margin: 30px 0 20px 0;">
              <a href="https://www.vidyaloans.in/login" style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">Log In & Re-upload Document</a>
            </div>

            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">VidyaLoan Student Verification Desk • This is an automated notification.</p>
          </div>
        </div>
      `,
    };

    try {
      console.log(`[EmailService] PREPARING TO SEND DOCUMENT REJECTION EMAIL`);
      console.log(`[EmailService] Target Email: ${email}`);
      console.log(`[EmailService] Document Name: ${formattedDocName}`);
      console.log(`[EmailService] Rejection Reason: ${rejectionReason}`);
      console.log(`--------------------------------`);

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Document rejection email sent successfully to ${email}`);
      } else {
        console.log(`[EmailService] Email credentials not configured – document rejection email logged to console`);
      }
    } catch (error: any) {
      console.error(`[EmailService] Failed to send document rejection email to ${email}:`, error?.message || error);
    }
  }

  /**
   * Send official welcome & activation email to newly onboarded Agent Partner
   */
  async sendAgentWelcomeEmail(
    email: string,
    agentName: string,
    partnerId: string,
    partnershipType: string = 'Channel Partner',
    percentage: string | number = '1.5'
  ) {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const loginLink = `${frontendUrl}/agent/login`;

    const mailOptions = {
      from: `"VidyaLoans Partner Network" <${process.env.EMAIL_USER || 'noreply@vidyaloans.in'}>`,
      to: email,
      subject: `🎉 Congratulations ${agentName}! Your VidyaLoans Agent Partner Account is Active`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to VidyaLoans Partner Network</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 30px 10px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
            
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #4338ca 100%); padding: 35px 30px; text-align: center;">
              <span style="display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                Verified Partner Network
              </span>
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                Congratulations, ${agentName}!
              </h1>
              <p style="color: #cbd5e1; margin: 0; font-size: 14px; font-weight: 500;">
                You are officially activated as an Education Loan Channel Partner with VidyaLoans.
              </p>
            </div>

            <!-- Content Area -->
            <div style="padding: 32px 30px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Dear <strong>${agentName}</strong>,<br><br>
                Welcome to the VidyaLoans partner ecosystem! Your agent partner profile has been reviewed, approved, and activated. You can now refer study abroad students, track loan applications in real time, and earn commission payouts.
              </p>

              <!-- Partner Credentials Card -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 14px 0; font-size: 13px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.8px;">
                  Partner Account Overview
                </h3>
                <table cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 160px; border-bottom: 1px dashed #e2e8f0;">Partner ID:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 700; border-bottom: 1px dashed #e2e8f0;">
                      <code style="background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 6px; font-family: monospace;">${partnerId}</code>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; border-bottom: 1px dashed #e2e8f0;">Registered Email:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600; border-bottom: 1px dashed #e2e8f0;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; border-bottom: 1px dashed #e2e8f0;">Partnership Tier:</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600; border-bottom: 1px dashed #e2e8f0;">${partnershipType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Referral Commission:</td>
                    <td style="padding: 8px 0; color: #059669; font-weight: 800; font-size: 15px;">${percentage}% on Disbursements</td>
                  </tr>
                </table>
              </div>

              <!-- How to Log In -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 600; line-height: 1.5;">
                  🔑 <strong>How to Access:</strong> Simply click the button below and enter your registered email address <strong>(${email})</strong>. You will receive a secure One-Time Password (OTP) to log in instantly.
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0 24px 0;">
                <a href="${loginLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(67, 56, 202, 0.35);">
                  🚀 Access Agent Partner Portal →
                </a>
              </div>

              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                Direct link: <a href="${loginLink}" style="color: #4338ca; text-decoration: underline;">${loginLink}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 30px 0 20px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.4;">
                VidyaLoans Partner Operations Desk • Support: <a href="mailto:partners@vidyaloans.in" style="color: #6366f1;">partners@vidyaloans.in</a><br>
                This is an official automated onboarding notification.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Congratulations ${agentName}!\n\nYou are officially activated as an Education Loan Channel Partner with VidyaLoans.\n\nPartner ID: ${partnerId}\nRegistered Email: ${email}\nPartnership Tier: ${partnershipType}\nCommission Rate: ${percentage}%\n\nAccess your Agent Portal here: ${loginLink}\n\nLogin using your email address and OTP.`,
    };

    try {
      console.log(`[EmailService] Sending agent welcome email to: ${email} (Partner ID: ${partnerId})`);
      if (this.hasCredentials()) {
        await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] Agent welcome email sent successfully to ${email}`);
        return true;
      } else {
        console.log(`[EmailService] EMAIL CREDENTIALS NOT CONFIGURED – Agent Welcome Email logged to console:`);
        console.log(`Target: ${email} | Login Link: ${loginLink}`);
        return true;
      }
    } catch (err: any) {
      console.error(`[EmailService] Failed to send agent welcome email to ${email}:`, err?.message || err);
      return false;
    }
  }
}
