import { Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../auth/email.service';
import { CreateCohortApplicationDto } from './dto/create-cohort-application.dto';

function escapeHtml(str?: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class ConnectedService {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateCohortApplicationDto) {
    const { data: existing } = await this.db
      .from('CohortApplication')
      .select('id')
      .eq('email', dto.email)
      .eq('targetIntake', dto.targetIntake)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(
        'An application with this email already exists for the selected intake.',
      );
    }

    const nowIso = new Date().toISOString();
    const { data: application, error } = await this.db
      .from('CohortApplication')
      .insert({
        id: randomUUID(),
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        targetIntake: dto.targetIntake,
        destination: dto.destination,
        university: dto.university,
        course: dto.course,
        gapYear: dto.gapYear ?? false,
        message: dto.message,
        source: dto.source ?? 'connectED',
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .select()
      .single();

    if (error) throw error;

    // Mirror into UniversityInquiry so ConnectED submissions appear in Admin › Registration Leads
    try {
      const descriptorParts = [
        dto.destination?.trim() || 'Study Abroad',
        `[Intake: ${dto.targetIntake}]`,
        dto.university?.trim() ? `[University: ${dto.university.trim()}]` : '',
        dto.course?.trim() ? `[Course: ${dto.course.trim()}]` : '',
        dto.gapYear ? '[Gap Year: Yes]' : '',
        dto.message?.trim() ? `[Note: ${dto.message.trim()}]` : '',
        '(Source: ConnectED Cohort)',
      ]
        .filter(Boolean)
        .join(' ');

      const { error: inqError } = await this.db.from('UniversityInquiry').insert({
        id: randomUUID(),
        name: dto.fullName.trim(),
        email: dto.email.trim(),
        mobile: dto.phone.trim(),
        universityName: descriptorParts.substring(0, 255),
        type: 'connected_cohort',
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (inqError) {
        console.warn('[ConnectedService] UniversityInquiry mirror insert warning:', inqError.message);
      }
    } catch (mirrorErr: any) {
      console.warn('[ConnectedService] Failed to mirror ConnectED lead into UniversityInquiry:', mirrorErr?.message);
    }

    // Send confirmation email to the applicant's provided email address
    const targetEmail = dto.email?.trim();
    if (targetEmail) {
      const safeName = escapeHtml(dto.fullName?.trim() || 'Student');
      const safeIntake = escapeHtml(dto.targetIntake?.trim() || 'Upcoming Intake');
      const safeDest = escapeHtml(dto.destination?.trim() || 'Study Abroad');
      const safeCourse = escapeHtml(dto.course?.trim() || 'Not specified');
      const safeUni = escapeHtml(dto.university?.trim() || 'Not specified');

      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="margin: 0 0 12px; color: #6605c7;">Application Received — VidyaLoans ConnectED</h2>
          <p style="margin: 0 0 16px; line-height: 1.6;">Hi ${safeName},</p>
          <p style="margin: 0 0 16px; line-height: 1.6;">
            Thank you for applying to the <strong>VidyaLoans ConnectED Cohort</strong>. We have received your details and our advisor team will reach out to you shortly.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; font-size: 14px;">
            <p style="margin: 4px 0;"><strong>Target Intake:</strong> ${safeIntake}</p>
            <p style="margin: 4px 0;"><strong>Destination:</strong> ${safeDest}</p>
            <p style="margin: 4px 0;"><strong>University:</strong> ${safeUni}</p>
            <p style="margin: 4px 0;"><strong>Target Course:</strong> ${safeCourse}</p>
          </div>
          <p style="margin: 0; font-size: 13px; color: #64748b;">
            If you have any questions, reply to this email or reach us at support@vidyaloans.in.
          </p>
        </div>
      `;

      this.emailService
        .sendMail(targetEmail, 'We received your VidyaLoans ConnectED application', html)
        .catch((mailErr: any) => {
          console.warn('[ConnectedService] Failed to send confirmation email:', mailErr?.message);
        });
    }

    return { success: true, id: application.id };
  }

  async findAll(status?: string) {
    let query = this.db
      .from('CohortApplication')
      .select('*')
      .order('createdAt', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data } = await query;
    return data || [];
  }

  async updateStatus(id: string, status: string, reviewedBy?: string, reviewNotes?: string) {
    const { data, error } = await this.db
      .from('CohortApplication')
      .update({ status, reviewedBy, reviewNotes, reviewedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
