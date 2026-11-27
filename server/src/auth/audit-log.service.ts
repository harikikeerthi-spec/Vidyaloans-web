import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

export type AppUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  [key: string]: any;
};

@Injectable()
export class AuditLogService {
  private get db() {
    return this.supabase.getClient();
  }

  constructor(private supabase: SupabaseService) {}

  private async resolveInitiatorId(user?: Partial<AppUser>): Promise<string | null> {
    const rawId = typeof user?.id === 'string' ? user.id.trim() : '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

    if (isUuid) {
      const { data } = await this.db.from('User').select('id').eq('id', rawId).maybeSingle();
      if (data?.id) return data.id;
    }

    if (user?.email) {
      const { data } = await this.db.from('User').select('id').eq('email', user.email).maybeSingle();
      if (data?.id) return data.id;
    }

    const { data: fallback } = await this.db
      .from('User')
      .select('id')
      .in('role', ['admin', 'super_admin'])
      .limit(1)
      .maybeSingle();
    return fallback?.id || null;
  }

  async logAction(
    action: string,
    entityType: string,
    entityId: string,
    user: AppUser,
    changes: any,
    request?: any,
  ) {
    try {
      const initiatedBy = await this.resolveInitiatorId(user);
      if (!initiatedBy) {
        console.warn('[AuditLogService] Skipping audit log insert: no valid User.id for initiatedBy');
        return;
      }

      const { error } = await this.db.from('AuditLog').insert({
        id: randomUUID(),
        action,
        entityType,
        entityId,
        initiatedBy,
        changes: changes || {},
        ipAddress: request?.ip || null,
        userAgent: request?.get?.('user-agent') || null,
        createdAt: new Date().toISOString(),
      });
      if (error) {
        console.error('Failed to create audit log:', error);
      }
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  async getEntityLogs(entityType: string, entityId: string, limit: number = 50) {
    const { data } = await this.db
      .from('AuditLog')
      .select('id, action, initiatedBy, changes, createdAt, initiator:User!initiatedBy(firstName, lastName, email)')
      .eq('entityType', entityType)
      .eq('entityId', entityId)
      .order('createdAt', { ascending: false })
      .limit(limit);
    return data || [];
  }

  async getAllLogs(
    entityType?: string,
    initiatedBy?: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    let query = this.db
      .from('AuditLog')
      .select('id, action, entityType, entityId, createdAt, initiator:User!initiatedBy(firstName, lastName, email)')
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (entityType) query = query.eq('entityType', entityType);
    if (initiatedBy) query = query.eq('initiatedBy', initiatedBy);

    const { data } = await query;
    return data || [];
  }
}
