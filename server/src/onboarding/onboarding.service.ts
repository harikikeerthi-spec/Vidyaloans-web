import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../auth/email.service';
import { sanitizeUserPayload, UsersService } from '../users/users.service';

@Injectable()
export class OnboardingService {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(
    private supabase: SupabaseService,
    private emailService: EmailService,
    @Inject(forwardRef(() => UsersService)) private usersService: UsersService,
  ) {}

  async saveOnboardingData(data: any, userId?: string) {
    try {
      let user: any;
      if (userId) {
        const { data: u } = await this.db.from('User').select('*').eq('id', userId).single();
        user = u;
      } else if (data.email) {
        const { data: u } = await this.db.from('User').select('*').eq('email', data.email).single();
        user = u;
      }

      const personal = data.personal || {};
      const academic = data.academic || {};
      const testScores = data.testScores || data.tests || {};

      const goalValue = data.goal?.value || data.goal || data.courseLevel || academic.highestLevel;
      const countryValue = data.country?.value || data.studyDestination || data.study_destination || academic.countryOfEducation || academic.undergrad?.country;
      const courseValue = data.course?.value || data.courseName || data.course_name;
      const targetUniValue = data.target_university?.label || data.targetUniversity || data.target_university;
      const intakeValue = data.start_when?.value || data.intakeSeason || data.intake_season;
      const bachelorsValue = data.bachelors_degree?.label || data.bachelorsDegree || data.currentEducation || academic.highestLevel;
      const gpaValue = data.gpa?.value ? parseFloat(data.gpa.value) : data.gpa ? parseFloat(data.gpa) : undefined;
      const workExpValue = data.work_exp?.value
        ? parseInt(data.work_exp.value)
        : data.workExperience
        ? parseInt(data.workExperience)
        : undefined;
      const entranceTestValue = data.entrance_test?.value || data.entranceTest || (testScores.gre ? 'GRE' : testScores.gmat ? 'GMAT' : testScores.sat ? 'SAT' : testScores.act ? 'ACT' : undefined);
      const entranceScoreValue = data.entrance_score?.value || data.entranceScore || testScores.gre || testScores.gmat || testScores.sat || testScores.act;
      const englishTestValue = data.english_test?.value || data.englishTest || (testScores.ielts ? 'IELTS' : testScores.toefl ? 'TOEFL' : testScores.pte ? 'PTE' : testScores.duolingo ? 'Duolingo' : undefined);
      const englishScoreValue = data.english_score?.value || data.englishScore || testScores.ielts || testScores.toefl || testScores.pte || testScores.duolingo;
      const budgetValue = data.study_budget?.label || data.budget || data.estimatedCost;
      const pincodeValue = data.loan_pincode?.value || data.pincode;
      const loanAmountValue = data.loan_amount?.label || data.loanAmount;
      const admitStatusValue = data.admit_status?.value || data.admitStatus;

      let permAddrStr = user?.permanentAddress || null;
      const permanentAddrObj = data.address?.permanent || personal.permanentAddress || data.permanentAddress;
      if (permanentAddrObj && typeof permanentAddrObj === 'object') {
        const parts = [
          permanentAddrObj.address1,
          permanentAddrObj.address2,
          permanentAddrObj.city,
          permanentAddrObj.state,
          permanentAddrObj.country,
          permanentAddrObj.pincode
        ].filter(Boolean);
        if (parts.length > 0) {
          permAddrStr = parts.join(', ');
        }
      } else if (typeof permanentAddrObj === 'string') {
        permAddrStr = permanentAddrObj;
      }

      const nonEmpty = (v: unknown): string | undefined => {
        if (v == null) return undefined;
        const s = String(v).trim();
        return s === '' ? undefined : s;
      };

      let parsedDob = user?.dateOfBirth || null;
      const dobVal = nonEmpty(personal.dob) || nonEmpty(personal.dateOfBirth) || nonEmpty(data.dob) || nonEmpty(data.dateOfBirth);
      if (dobVal) {
        const parseSimpleDate = (dateStr: string) => {
          if (!dateStr) return null;
          let d = new Date(dateStr);
          if (!isNaN(d.getTime())) return d.toISOString();
          const parts = dateStr.split(/[-/]/);
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
              d = new Date(year, month, day);
              if (!isNaN(d.getTime())) return d.toISOString();
            }
          }
          return null;
        };
        const resDob = parseSimpleDate(dobVal);
        if (resDob) parsedDob = resDob;
      }

      // Helper: merge incoming family data with existing family JSON so we don't overwrite unrelated fields
      const buildFamilyJson = () => {
        let familyObj: any = {};
        const rawFamily = user?.family;
        if (rawFamily) {
          try { familyObj = typeof rawFamily === 'string' ? JSON.parse(rawFamily) : rawFamily; } catch {}
        }
        // Merge incoming family object
        const incomingFamily = data.family || data.familyDetails;
        if (incomingFamily) {
          const parsed = typeof incomingFamily === 'string' ? (JSON.parse(incomingFamily) || {}) : incomingFamily;
          familyObj = { ...familyObj, ...parsed };
        }
        // Merge fatherName/motherName from parents array or personal data
        const fatherFromParents = data.parents?.find((p: any) => p.relation === 'father')?.name;
        const motherFromParents = data.parents?.find((p: any) => p.relation === 'mother')?.name;
        const fatherAadharFromParents = data.parents?.find((p: any) => p.relation === 'father')?.aadharNumber;
        const fatherPanFromParents = data.parents?.find((p: any) => p.relation === 'father')?.panNumber;
        const motherAadharFromParents = data.parents?.find((p: any) => p.relation === 'mother')?.aadharNumber;
        const motherPanFromParents = data.parents?.find((p: any) => p.relation === 'mother')?.panNumber;

        return JSON.stringify({
          ...familyObj,
          fatherName: (fatherFromParents || personal.fatherName || data.fatherName || familyObj.fatherName || null),
          motherName: (motherFromParents || personal.motherName || data.motherName || familyObj.motherName || null),
          fatherAadhar: (fatherAadharFromParents || familyObj.fatherAadhar || null),
          fatherPan: (fatherPanFromParents || familyObj.fatherPan || null),
          motherAadhar: (motherAadharFromParents || familyObj.motherAadhar || null),
          motherPan: (motherPanFromParents || familyObj.motherPan || null),
        });
      };

      const rawUpdateData: any = {
        firstName: nonEmpty(personal.firstName) ?? nonEmpty(data.firstName) ?? user?.firstName,
        lastName: nonEmpty(personal.lastName) ?? nonEmpty(data.lastName) ?? user?.lastName,
        phoneNumber: data.phoneNumber || data.phone || data.mobile || personal.phoneNumber || personal.mobile || personal.phone || user?.phoneNumber,
        mobile: data.phoneNumber || data.phone || data.mobile || personal.phoneNumber || personal.mobile || personal.phone || user?.mobile,
        goal: goalValue,
        studyDestination: countryValue,
        courseName: courseValue,
        targetUniversity: targetUniValue,
        intakeSeason: intakeValue,
        bachelorsDegree: bachelorsValue,
        workExp: workExpValue,
        gpa: gpaValue,
        entranceTest: entranceTestValue,
        entranceScore: entranceScoreValue,
        englishTest: englishTestValue,
        englishScore: englishScoreValue,
        budget: budgetValue,
        pincode: pincodeValue,
        loanAmount: loanAmountValue,
        admitStatus: admitStatusValue,
        dateOfBirth: parsedDob,
        permanentAddress: permAddrStr,
        gender: nonEmpty(personal.gender) ?? nonEmpty(data.gender) ?? user?.gender ?? null,
        passport: data.passport ? (typeof data.passport === 'string' ? data.passport : JSON.stringify(data.passport)) : (user?.passport || null),
        nationality: data.nationality ? (typeof data.nationality === 'string' ? data.nationality : JSON.stringify(data.nationality)) : (user?.nationality || null),
        mailingAddress: (data.address?.mailing || data.mailingAddress) ? (typeof (data.address?.mailing || data.mailingAddress) === 'string' ? (data.address?.mailing || data.mailingAddress) : JSON.stringify(data.address?.mailing || data.mailingAddress)) : (user?.mailingAddress || null),
        emergencyContact: data.emergencyContact ? (typeof data.emergencyContact === 'string' ? data.emergencyContact : JSON.stringify(data.emergencyContact)) : (user?.emergencyContact || null),
        academic: data.academic ? (typeof data.academic === 'string' ? data.academic : JSON.stringify(data.academic)) : (user?.academic || null),
        workExperience: data.workExperience ? (typeof data.workExperience === 'string' ? data.workExperience : JSON.stringify(data.workExperience)) : (user?.workExperience || null),
        tests: (data.testScores || data.tests) ? (typeof (data.testScores || data.tests) === 'string' ? (data.testScores || data.tests) : JSON.stringify(data.testScores || data.tests)) : (user?.tests || null),
        family: buildFamilyJson(),
        coApplicant: data.coApplicant ? (typeof data.coApplicant === 'string' ? data.coApplicant : JSON.stringify(data.coApplicant)) : (user?.coApplicant || null),
      };

      const updateData = rawUpdateData;

      // Sanitize payload so ONLY valid User table columns are updated (prevents PGRST204)
      const userUpdateData = sanitizeUserPayload(rawUpdateData);

      if (!user) {
        if (!data.email) return { success: false, message: 'Email required for new user' };
        const { data: created, error } = await this.db
          .from('User')
          .insert({ email: data.email, firstName: userUpdateData.firstName || 'User', mobile: userUpdateData.mobile || '', password: '', role: 'user', ...userUpdateData })
          .select()
          .single();
        if (error) {
          console.warn(`[OnboardingService] Insert warning (${error.message}). Retrying with basic payload...`);
          const basicInsert = { ...userUpdateData };
          delete basicInsert.academic;
          const { data: retryCreated, error: retryErr } = await this.db
            .from('User')
            .insert({ email: data.email, firstName: basicInsert.firstName || 'User', mobile: basicInsert.mobile || '', password: '', role: 'user', ...basicInsert })
            .select()
            .single();
          if (retryErr) throw retryErr;
          user = retryCreated;
        } else {
          user = created;
        }
      } else {
        const { data: updated, error } = await this.db
          .from('User')
          .update(userUpdateData)
          .eq('id', user.id)
          .select()
          .single();
        if (error) {
          console.warn(`[OnboardingService] Update warning (${error.message}). Retrying with stringified or basic payload...`);
          const retryPayload = { ...userUpdateData };
          delete retryPayload.academic;
          if (retryPayload.family && typeof retryPayload.family === 'object') {
            retryPayload.family = JSON.stringify(retryPayload.family);
          }
          if (retryPayload.coApplicant && typeof retryPayload.coApplicant === 'object') {
            retryPayload.coApplicant = JSON.stringify(retryPayload.coApplicant);
          }
          const { data: retryUpdated, error: retryErr } = await this.db
            .from('User')
            .update(retryPayload)
            .eq('id', user.id)
            .select()
            .single();
          if (retryErr) {
            console.warn(`[OnboardingService] Retrying with basic columns...`);
            const basicPayload = { ...retryPayload };
            delete basicPayload.family;
            delete basicPayload.coApplicant;
            delete basicPayload.tests;
            const { data: bData, error: bErr } = await this.db.from('User').update(basicPayload).eq('id', user.id).select().single();
            if (bErr) throw bErr;
            user = bData;
          } else {
            user = retryUpdated;
          }
        } else {
          user = updated;
        }
      }

      // Upsert parents details into parents table
      if (data.parents && Array.isArray(data.parents)) {
        for (const p of data.parents) {
          if (p.relation) {
            const parentPayload = {
              userId: user.id,
              relation: p.relation,
              name: p.name || null,
              aadharNumber: p.aadharNumber || null,
              panNumber: p.panNumber || null,
              updatedAt: new Date().toISOString()
            };

            const { data: existingParent } = await this.db
              .from('parents')
              .select('id')
              .eq('userId', user.id)
              .eq('relation', p.relation)
              .maybeSingle();

            if (existingParent) {
              await this.db.from('parents').update(parentPayload).eq('id', existingParent.id);
            } else {
              const newParentPayload = {
                id: `${user.id}_${p.relation}_${Date.now()}`,
                ...parentPayload
              };
              await this.db.from('parents').insert(newParentPayload);
            }
          }
        }
      }

      const leadData = {
        userId: user.id,
        email: user.email,
        fullName: updateData.firstName && updateData.lastName
          ? `${updateData.firstName} ${updateData.lastName}`
          : (user.firstName + ' ' + (user.lastName || '')).trim(),
        phone: updateData.mobile,
        goal: goalValue,
        studyDestination: countryValue,
        courseName: courseValue,
        targetUniversity: targetUniValue,
        intakeSeason: intakeValue,
        bachelorsDegree: bachelorsValue,
        gpa: gpaValue,
        workExp: workExpValue,
        entranceTest: entranceTestValue,
        entranceScore: entranceScoreValue,
        englishTest: englishTestValue,
        englishScore: englishScoreValue,
        budget: budgetValue,
        pincode: pincodeValue,
        loanAmount: loanAmountValue,
        admitStatus: admitStatusValue,
        source: 'onboarding_bot',
        status: user.admitStatus ? 'processing' : 'pending',
      };

      // Upsert OnboardingApplication
      const { data: existingLead } = await this.db.from('OnboardingApplication').select('id').eq('userId', user.id).single();
      if (existingLead) {
        await this.db.from('OnboardingApplication').update(leadData).eq('userId', user.id);
      } else {
        await this.db.from('OnboardingApplication').insert(leadData);
      }

      // Upsert study, academic, financial preferences
      await Promise.all([
        (async () => {
          const { data: existing } = await this.db.from('UserStudyPreference').select('id').eq('userId', user.id).single();
          const pref = { userId: user.id, goal: goalValue, studyDestination: countryValue, courseName: courseValue, targetUniversity: targetUniValue, intakeSeason: intakeValue, admitStatus: admitStatusValue };
          if (existing) { await this.db.from('UserStudyPreference').update(pref).eq('userId', user.id); }
          else { await this.db.from('UserStudyPreference').insert(pref); }
        })(),
        (async () => {
          const { data: existing } = await this.db.from('UserAcademicProfile').select('id').eq('userId', user.id).single();
          const prof = { userId: user.id, bachelorsDegree: bachelorsValue, gpa: gpaValue, workExp: workExpValue, entranceTest: entranceTestValue, entranceScore: entranceScoreValue, englishTest: englishTestValue, englishScore: englishScoreValue };
          if (existing) { await this.db.from('UserAcademicProfile').update(prof).eq('userId', user.id); }
          else { await this.db.from('UserAcademicProfile').insert(prof); }
        })(),
        (async () => {
          const { data: existing } = await this.db.from('UserFinancialProfile').select('id').eq('userId', user.id).single();
          const fin = { userId: user.id, budget: budgetValue, pincode: pincodeValue, loanAmount: loanAmountValue };
          if (existing) { await this.db.from('UserFinancialProfile').update(fin).eq('userId', user.id); }
          else { await this.db.from('UserFinancialProfile').insert(fin); }
        })(),
      ]);

      // Also sync LoanApplication records for this user if any exist
      try {
        const appUpdates: any = {};
        if (updateData.firstName) appUpdates.firstName = updateData.firstName;
        if (updateData.lastName) appUpdates.lastName = updateData.lastName;
        if (updateData.phoneNumber || updateData.mobile) {
          appUpdates.phone = updateData.phoneNumber || updateData.mobile;
          appUpdates.mobile = updateData.phoneNumber || updateData.mobile;
        }
        if (updateData.gender) appUpdates.gender = updateData.gender;
        if (permAddrStr) appUpdates.address = permAddrStr;
        if (pincodeValue) appUpdates.pincode = pincodeValue;
        if (targetUniValue) appUpdates.universityName = targetUniValue;
        if (countryValue) appUpdates.countryOfEducation = countryValue;
        if (updateData.fatherName) appUpdates.fatherName = updateData.fatherName;
        if (updateData.motherName) appUpdates.motherName = updateData.motherName;
        if (data.family?.fatherPhone || data.family?.fatherMobile) appUpdates.fatherPhone = data.family.fatherPhone || data.family.fatherMobile;
        if (data.family?.fatherEmail) appUpdates.fatherEmail = data.family.fatherEmail;
        if (data.family?.motherPhone || data.family?.motherMobile) appUpdates.motherPhone = data.family.motherPhone || data.family.motherMobile;
        if (data.family?.motherEmail) appUpdates.motherEmail = data.family.motherEmail;
        if (data.coApplicant?.name) appUpdates.coApplicantName = data.coApplicant.name;
        if (data.coApplicant?.relation) appUpdates.coApplicantRelation = data.coApplicant.relation;
        if (data.coApplicant?.mobile || data.coApplicant?.phone) appUpdates.coApplicantPhone = data.coApplicant.mobile || data.coApplicant.phone;
        if (data.coApplicant?.email) appUpdates.coApplicantEmail = data.coApplicant.email;
        if (data.coApplicant?.income || data.coApplicant?.annualIncome) appUpdates.coApplicantIncome = parseFloat(data.coApplicant.income || data.coApplicant.annualIncome);
        if (data.coApplicant?.name || data.coApplicant?.email || data.coApplicant?.phone || data.coApplicant?.mobile) appUpdates.hasCoApplicant = true;

        if (Object.keys(appUpdates).length > 0) {
          await this.db.from('LoanApplication').update(appUpdates).eq('userId', user.id);
        }
      } catch (appErr) {
        console.error('Failed to sync LoanApplication records during onboarding save:', appErr);
      }

      if (user?.email) {
        this.usersService.clearCache(user.email);
      }
      this.usersService.clearCache();

      return { success: true, message: 'Onboarding data saved successfully', user };
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      return { success: false, message: 'Failed to save onboarding data', error: error.message };
    }
  }

  async shareOnboardingLink(studentId: string, studentEmail: string, studentName: string, shareUrl: string, staffUser: any) {
    try {
      const staffName = staffUser.firstName && staffUser.lastName ? `${staffUser.firstName} ${staffUser.lastName}` : (staffUser.firstName || staffUser.email || 'Your Coordinator');
      const staffEmail = staffUser.email;
      
      const subject = `📋 Complete your VidyaLoan Onboarding Profile – Shared by ${staffName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 800;">VidyaLoan</h1>
            <p style="color: #e0e7ff; margin: 5px 0 0; font-size: 14px; letter-spacing: 0.5px;">SECURE ONBOARDING PORTAL</p>
          </div>
          
          <div style="padding: 0 10px;">
            <h2 style="color: #111827; margin-bottom: 16px; font-size: 20px; font-weight: 700;">Hello ${studentName},</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Your dedicated academic loan coordinator, <strong>${staffName}</strong> (<a href="mailto:${staffEmail}" style="color: #4f46e5; text-decoration: none;">${staffEmail}</a>), has initiated your VidyaLoan profile onboarding!
            </p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              To proceed with your education loan application, please click the secure link below to access your dynamic onboarding form, fill in your details, and sync your KYC documents directly.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${shareUrl}" style="background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
                📋 Complete Onboarding Profile
              </a>
            </div>

            <div style="background-color: #f9fafb; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 16px 20px; margin: 24px 0;">
              <h4 style="color: #1f2937; margin: 0 0 8px; font-size: 14px; font-weight: 700;">💡 What you need to prepare:</h4>
              <ul style="color: #4b5563; font-size: 13px; line-height: 1.5; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 4px;">Applicant's Aadhaar & PAN details</li>
                <li style="margin-bottom: 4px;">Academic transcripts / Marksheets</li>
                <li style="margin-bottom: 4px;">Co-Applicant/Parent income details & PAN</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-top: 24px;">
              If you have any questions or need guidance during the application, you can reach out directly to <strong>${staffName}</strong> by replying to this email.
            </p>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.5;">
                This is a secure communication from VidyaLoan.<br>
                For security reasons, please do not share your unique onboarding link with anyone else.
              </p>
            </div>
          </div>
        </div>
      `;
      
      const text = `Hello ${studentName},\n\nYour academic loan coordinator, ${staffName} (${staffEmail}), has initiated your VidyaLoan onboarding!\n\nTo complete your profile and proceed with your education loan application, please click the secure link below:\n\n${shareUrl}\n\nIf you have any questions, you can contact ${staffName} directly at ${staffEmail}.\n\nWarm regards,\nThe Vidyaloan Team`;
      
      await this.emailService.sendMail(studentEmail, subject, html, text, staffEmail);
      return { success: true, message: 'Onboarding link shared successfully via email.' };
    } catch (err) {
      console.error('[OnboardingService] Failed to share onboarding link:', err);
      return { success: false, message: 'Failed to send onboarding email.', error: err.message };
    }
  }
}
