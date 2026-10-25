import { Injectable, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { randomUUID } from 'crypto';

@Injectable()
export class UniversityInquiryService implements OnModuleInit {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(
    private supabase: SupabaseService,
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async onModuleInit() {
    try {
      await (this.prisma as any).$executeRawUnsafe(`
        ALTER TABLE "UniversityInquiry" 
        ADD COLUMN IF NOT EXISTS "assignedStaffId" TEXT,
        ADD COLUMN IF NOT EXISTS "assignedStaffName" TEXT,
        ADD COLUMN IF NOT EXISTS "assignedStaffEmail" TEXT,
        ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);

        CREATE INDEX IF NOT EXISTS "UniversityInquiry_assignedStaffId_idx" ON "UniversityInquiry"("assignedStaffId");
      `);
    } catch (_) {}
  }

  async createInquiry(data: {
    userId?: string;
    name: string;
    email: string;
    mobile: string;
    universityName: string;
    type: string;
  }) {
    const finalType = data.type === 'callback' ? 'callback' : 'fasttrack';
    const validUserId = (data.userId && data.userId.trim() !== '') ? data.userId.trim() : null;
    const recordId = randomUUID();

    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + istOffsetMs);

    const baseData = {
      id: recordId,
      userId: validUserId,
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      universityName: data.universityName,
      status: 'pending',
      createdAt: istNow,
      updatedAt: istNow,
    };

    let inquiryResult: any = null;

    // 1. Save to UniversityInquiry using Prisma for guaranteed PostgreSQL write
    try {
      inquiryResult = await this.prisma.universityInquiry.create({
        data: {
          ...baseData,
          type: finalType,
        },
      });
    } catch (err) {
      console.error('Error inserting into UniversityInquiry via Prisma, trying Supabase fallback:', err);
      try {
        const { data: inq } = await this.db.from('UniversityInquiry').insert({
          ...baseData,
          type: finalType,
          createdAt: istNow.toISOString(),
          updatedAt: istNow.toISOString(),
        }).select().maybeSingle();
        inquiryResult = inq || { ...baseData, type: finalType };
      } catch (sbErr) {
        inquiryResult = { ...baseData, type: finalType };
      }
    }

    // 2. Save into separate specialized table (FastTrackApplication vs CallbackRequest)
    if (finalType === 'fasttrack') {
      try {
        await this.prisma.fastTrackApplication.create({
          data: baseData,
        });
      } catch (ftErr) {
        console.error('Error inserting into FastTrackApplication via Prisma, trying Supabase fallback:', ftErr);
        try {
          await this.db.from('FastTrackApplication').insert({
            ...baseData,
            createdAt: istNow.toISOString(),
            updatedAt: istNow.toISOString(),
          });
        } catch (e) {}
      }
    } else if (finalType === 'callback') {
      try {
        await this.prisma.callbackRequest.create({
          data: baseData,
        });
      } catch (cbErr) {
        console.error('Error inserting into CallbackRequest via Prisma, trying Supabase fallback:', cbErr);
        try {
          await this.db.from('CallbackRequest').insert({
            ...baseData,
            createdAt: istNow.toISOString(),
            updatedAt: istNow.toISOString(),
          });
        } catch (e) {}
      }
    }

    // 3. Send email notifications asynchronously (non-blocking)
    this.sendInquiryEmails({
      ...data,
      type: finalType,
    }).catch((mailError) => {
      console.error('Failed to send inquiry emails:', mailError);
    });

    return {
      success: true,
      data: inquiryResult,
      message: 'Inquiry submitted successfully',
    };
  }

  async getInquiriesByUser(userId: string) {
    try {
      return await this.prisma.universityInquiry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      try {
        const { data } = await this.db
          .from('UniversityInquiry')
          .select('*')
          .eq('userId', userId)
          .order('createdAt', { ascending: false });
        return data || [];
      } catch (err) {
        return [];
      }
    }
  }

  async checkInquiry(email: string, universityName: string, type: string) {
    try {
      const existing = await this.prisma.universityInquiry.findFirst({
        where: { email, universityName, type },
        select: { id: true },
      });
      return { exists: !!existing };
    } catch (e) {
      try {
        const { data: existing } = await this.db
          .from('UniversityInquiry')
          .select('id')
          .eq('email', email)
          .eq('universityName', universityName)
          .eq('type', type)
          .maybeSingle();
        return { exists: !!existing };
      } catch (err) {
        return { exists: false };
      }
    }
  }

  async getAllInquiries(params?: { type?: string; status?: string; search?: string; assignedStaffId?: string }) {
    try {
      const where: any = {};
      if (params?.type && params.type !== 'all') {
        where.type = params.type;
      }
      if (params?.status && params.status !== 'all') {
        where.status = params.status;
      }
      if (params?.assignedStaffId) {
        if (params.assignedStaffId === 'unassigned') {
          where.assignedStaffId = null;
        } else if (params.assignedStaffId !== 'all') {
          where.assignedStaffId = params.assignedStaffId;
        }
      }
      if (params?.search && params.search.trim() !== '') {
        const s = params.search.trim();
        where.OR = [
          { name: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
          { mobile: { contains: s, mode: 'insensitive' } },
          { universityName: { contains: s, mode: 'insensitive' } },
        ];
      }

      const inquiries = await (this.prisma as any).universityInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      const total = inquiries.length;
      const pending = inquiries.filter((i: any) => i.status === 'pending').length;
      const contacted = inquiries.filter((i: any) => i.status === 'contacted').length;
      const converted = inquiries.filter((i: any) => i.status === 'converted' || i.status === 'approved').length;

      return {
        success: true,
        data: inquiries,
        stats: { total, pending, contacted, converted },
      };
    } catch (err: any) {
      console.error('Error fetching university inquiries via Prisma, falling back to Supabase:', err);
      try {
        let q = this.db.from('UniversityInquiry').select('*').order('createdAt', { ascending: false });
        if (params?.type && params.type !== 'all') q = q.eq('type', params.type);
        if (params?.status && params.status !== 'all') q = q.eq('status', params.status);
        if (params?.assignedStaffId) {
          if (params.assignedStaffId === 'unassigned') {
            q = q.is('assignedStaffId', null);
          } else if (params.assignedStaffId !== 'all') {
            q = q.eq('assignedStaffId', params.assignedStaffId);
          }
        }
        const { data } = await q;
        const list = data || [];
        return {
          success: true,
          data: list,
          stats: {
            total: list.length,
            pending: list.filter((i: any) => i.status === 'pending').length,
            contacted: list.filter((i: any) => i.status === 'contacted').length,
            converted: list.filter((i: any) => i.status === 'converted').length,
          },
        };
      } catch (e: any) {
        return { success: false, data: [], error: e.message };
      }
    }
  }

  async updateInquiryStatus(id: string, status: string) {
    try {
      const updated = await (this.prisma as any).universityInquiry.update({
        where: { id },
        data: { status },
      });
      return { success: true, data: updated };
    } catch (err: any) {
      try {
        const { data } = await this.db
          .from('UniversityInquiry')
          .update({ status, updatedAt: new Date().toISOString() })
          .eq('id', id)
          .select()
          .maybeSingle();
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  }

  async assignInquiry(
    id: string,
    assignment: { staffId?: string | null; staffName?: string | null; staffEmail?: string | null }
  ) {
    let staffId = assignment.staffId?.trim() || null;
    let staffName = assignment.staffName?.trim() || null;
    let staffEmail = assignment.staffEmail?.trim() || null;

    if (staffId && staffId !== 'unassigned') {
      if (!staffName || !staffEmail) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: staffId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
          if (user) {
            staffName = staffName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
            staffEmail = staffEmail || user.email;
          }
        } catch (_) {}
      }
    } else {
      staffId = null;
      staffName = null;
      staffEmail = null;
    }

    const assignedAt = staffId ? new Date() : null;

    try {
      const updated = await (this.prisma as any).universityInquiry.update({
        where: { id },
        data: {
          assignedStaffId: staffId,
          assignedStaffName: staffName,
          assignedStaffEmail: staffEmail,
          assignedAt: assignedAt,
        },
      });
      return { success: true, data: updated };
    } catch (err: any) {
      try {
        const { data } = await this.db
          .from('UniversityInquiry')
          .update({
            assignedStaffId: staffId,
            assignedStaffName: staffName,
            assignedStaffEmail: staffEmail,
            assignedAt: assignedAt ? assignedAt.toISOString() : null,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .maybeSingle();
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  }

  async bulkAssignInquiries(
    leadIds: string[],
    assignment: { staffId?: string | null; staffName?: string | null; staffEmail?: string | null }
  ) {
    if (!leadIds || leadIds.length === 0) {
      return { success: true, count: 0 };
    }

    let staffId = assignment.staffId?.trim() || null;
    let staffName = assignment.staffName?.trim() || null;
    let staffEmail = assignment.staffEmail?.trim() || null;

    if (staffId && staffId !== 'unassigned') {
      if (!staffName || !staffEmail) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: staffId },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
          if (user) {
            staffName = staffName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
            staffEmail = staffEmail || user.email;
          }
        } catch (_) {}
      }
    } else {
      staffId = null;
      staffName = null;
      staffEmail = null;
    }

    const assignedAt = staffId ? new Date() : null;

    try {
      await (this.prisma as any).universityInquiry.updateMany({
        where: { id: { in: leadIds } },
        data: {
          assignedStaffId: staffId,
          assignedStaffName: staffName,
          assignedStaffEmail: staffEmail,
          assignedAt: assignedAt,
        },
      });
      return { success: true, count: leadIds.length };
    } catch (err: any) {
      try {
        await this.db
          .from('UniversityInquiry')
          .update({
            assignedStaffId: staffId,
            assignedStaffName: staffName,
            assignedStaffEmail: staffEmail,
            assignedAt: assignedAt ? assignedAt.toISOString() : null,
            updatedAt: new Date().toISOString(),
          })
          .in('id', leadIds);
        return { success: true, count: leadIds.length };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  }

  async deleteInquiry(id: string) {
    try {
      await this.prisma.universityInquiry.delete({ where: { id } });
      return { success: true };
    } catch (err: any) {
      try {
        await this.db.from('UniversityInquiry').delete().eq('id', id);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  }

  private async sendInquiryEmails(data: any) {
    const typeLabel = data.type === 'callback' ? 'Request a Callback' : 'Fasttrack Application';

    const userHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="background: linear-gradient(135deg, #6605c7 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Vidya Loan</h1>
        </div>
        <div style="padding: 0 10px;">
          <h2 style="color: #111827; margin-bottom: 16px;">We've received your request!</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Hi ${data.name},</p>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">We have received your ${typeLabel.toLowerCase()} inquiry for <strong>${data.universityName}</strong>.</p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Name:</strong> ${data.name}</p>
            <p style="margin: 5px 0;"><strong>Mobile:</strong> ${data.mobile}</p>
            <p style="margin: 5px 0;"><strong>University:</strong> ${data.universityName}</p>
            <p style="margin: 5px 0;"><strong>Request:</strong> ${typeLabel}</p>
          </div>
          <p style="color: #4b5563; font-size: 16px;">Our education consultants will call you shortly.</p>
        </div>
      </div>
    `;

    const adminHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>New Lead Generated</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Mobile:</strong> ${data.mobile}</p>
        <p><strong>University:</strong> ${data.universityName}</p>
        <p><strong>Lead Type:</strong> ${typeLabel}</p>
      </div>
    `;

    try {
      await this.emailService.sendMail(data.email, `Inquiry Received: ${data.universityName}`, userHtml);
      await this.emailService.sendMail(process.env.ADMIN_EMAIL || 'admin@vidyaloan.com', `NEW LEAD: ${data.name} - ${typeLabel}`, adminHtml);
    } catch (e) {
      console.error('Error sending lead emails', e);
    }
  }
}
