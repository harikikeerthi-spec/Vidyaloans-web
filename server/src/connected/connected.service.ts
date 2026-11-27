import { Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCohortApplicationDto } from './dto/create-cohort-application.dto';

@Injectable()
export class ConnectedService {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(private readonly supabase: SupabaseService) {}

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
