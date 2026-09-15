import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizePayload, computeFingerprint } from '../common/utils/sanitize-payload.util';

export class CaptureErrorDto {
  name!: string;
  message!: string;
  statusCode?: number;
  endpoint?: string;
  method?: string;
  stack?: string;
  level?: 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO';
  source?: 'backend' | 'frontend' | 'webhook' | 'worker';
  context?: string;
  metadata?: any;
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

export class ErrorLogQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  level?: string;
  statusCode?: number;
  isResolved?: boolean | string;
  source?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'lastSeenAt' | 'occurrences' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Captures and deduplicates an error.
   * If an unresolved error with the same fingerprint exists, increments occurrences and updates lastSeenAt.
   */
  async captureError(dto: CaptureErrorDto): Promise<void> {
    try {
      const name = (dto.name || 'Error').slice(0, 250);
      const message = dto.message || 'Unknown error occurred';
      const statusCode = dto.statusCode || 500;
      const endpoint = dto.endpoint ? dto.endpoint.slice(0, 950) : null;
      const method = dto.method ? dto.method.toUpperCase().slice(0, 20) : null;
      const stack = dto.stack || null;
      const source = dto.source || 'backend';
      const context = dto.context || null;
      const sanitizedMeta = dto.metadata ? sanitizePayload(dto.metadata) : null;

      let level = dto.level;
      if (!level) {
        if (statusCode >= 500 || name.toLowerCase().includes('fatal') || name.toLowerCase().includes('panic')) {
          level = 'CRITICAL';
        } else if (statusCode >= 400 && statusCode < 500) {
          level = 'WARN';
        } else {
          level = 'ERROR';
        }
      }

      const fingerprint = computeFingerprint({
        name,
        message,
        endpoint: endpoint || undefined,
        stack: stack || undefined,
      });

      // Look for active unresolved error with identical fingerprint within the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const existing = await (this.prisma as any).errorLog.findFirst({
        where: {
          fingerprint,
          isResolved: false,
          lastSeenAt: { gte: sevenDaysAgo },
        },
      });

      if (existing) {
        await (this.prisma as any).errorLog.update({
          where: { id: existing.id },
          data: {
            occurrences: { increment: 1 },
            lastSeenAt: new Date(),
            stack: stack || existing.stack,
            metadata: sanitizedMeta || existing.metadata,
            userId: dto.userId || existing.userId,
            userEmail: dto.userEmail || existing.userEmail,
            userRole: dto.userRole || existing.userRole,
          },
        });
      } else {
        await (this.prisma as any).errorLog.create({
          data: {
            fingerprint,
            level,
            name,
            message,
            statusCode,
            endpoint,
            method,
            stack,
            source,
            context,
            metadata: sanitizedMeta,
            userId: dto.userId || null,
            userEmail: dto.userEmail || null,
            userRole: dto.userRole || null,
            isResolved: false,
            occurrences: 1,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          },
        });
      }
    } catch (err) {
      // Must never crash caller or block application
      this.logger.error(`Failed to capture error log in database: ${err.message}`);
    }
  }

  /**
   * Retrieves paginated error logs with flexible filtering and sorting.
   */
  async findAll(query: ErrorLogQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by resolution status
    if (query.isResolved !== undefined && query.isResolved !== '') {
      where.isResolved = query.isResolved === true || query.isResolved === 'true';
    }

    // Filter by severity level
    if (query.level && query.level !== 'all') {
      where.level = query.level.toUpperCase();
    }

    // Filter by HTTP status code
    if (query.statusCode) {
      const code = Number(query.statusCode);
      if (code === 500) {
        where.statusCode = { gte: 500 };
      } else if (code === 400) {
        where.statusCode = { gte: 400, lt: 500 };
      } else {
        where.statusCode = code;
      }
    }

    // Filter by source
    if (query.source && query.source !== 'all') {
      where.source = query.source.toLowerCase();
    }

    // Date range filters
    if (query.startDate || query.endDate) {
      where.lastSeenAt = {};
      if (query.startDate) where.lastSeenAt.gte = new Date(query.startDate);
      if (query.endDate) where.lastSeenAt.lte = new Date(query.endDate);
    }

    // Keyword search across message, name, endpoint, and userEmail
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { message: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { endpoint: { contains: s, mode: 'insensitive' } },
        { userEmail: { contains: s, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy || 'lastSeenAt';
    const sortOrder = query.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      (this.prisma as any).errorLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      (this.prisma as any).errorLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Computes metrics and statistics for the error logs dashboard.
   */
  async getStats() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUnresolved,
      criticalCount,
      todayCount,
      weekCount,
      allLevels,
      allSources,
      recentErrors,
    ] = await Promise.all([
      (this.prisma as any).errorLog.count({
        where: { isResolved: false },
      }),
      (this.prisma as any).errorLog.count({
        where: {
          isResolved: false,
          OR: [{ level: 'CRITICAL' }, { statusCode: { gte: 500 } }],
        },
      }),
      (this.prisma as any).errorLog.count({
        where: { lastSeenAt: { gte: twentyFourHoursAgo } },
      }),
      (this.prisma as any).errorLog.count({
        where: { lastSeenAt: { gte: sevenDaysAgo } },
      }),
      (this.prisma as any).errorLog.groupBy({
        by: ['level'],
        _count: { id: true },
        where: { isResolved: false },
      }),
      (this.prisma as any).errorLog.groupBy({
        by: ['source'],
        _count: { id: true },
        where: { isResolved: false },
      }),
      (this.prisma as any).errorLog.findMany({
        where: { lastSeenAt: { gte: sevenDaysAgo } },
        select: { lastSeenAt: true, occurrences: true },
        take: 1000,
      }),
    ]);

    // Build 7-day daily histogram
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = 0;
    }

    for (const err of recentErrors) {
      if (err.lastSeenAt) {
        const key = new Date(err.lastSeenAt).toISOString().split('T')[0];
        if (dailyMap[key] !== undefined) {
          dailyMap[key] += err.occurrences || 1;
        }
      }
    }

    const dailyTrend = Object.entries(dailyMap).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      totalUnresolved,
      criticalCount,
      todayCount,
      weekCount,
      breakdownByLevel: allLevels.reduce((acc: any, curr: any) => {
        acc[curr.level] = curr._count.id;
        return acc;
      }, {}),
      breakdownBySource: allSources.reduce((acc: any, curr: any) => {
        acc[curr.source] = curr._count.id;
        return acc;
      }, {}),
      dailyTrend,
    };
  }

  /**
   * Retrieves single error log detail by ID.
   */
  async findById(id: string) {
    return (this.prisma as any).errorLog.findUnique({
      where: { id },
    });
  }

  /**
   * Marks an error log as resolved with optional admin user and note.
   */
  async resolveLog(id: string, resolvedBy?: string, note?: string) {
    return (this.prisma as any).errorLog.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || 'Admin',
        resolutionNote: note || null,
      },
    });
  }

  /**
   * Reopens an error log.
   */
  async unresolveLog(id: string) {
    return (this.prisma as any).errorLog.update({
      where: { id },
      data: {
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
      },
    });
  }

  /**
   * Bulk resolves multiple error logs.
   */
  async bulkResolve(ids: string[], resolvedBy?: string, note?: string) {
    if (!ids || ids.length === 0) return { count: 0 };
    return (this.prisma as any).errorLog.updateMany({
      where: { id: { in: ids } },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || 'Admin',
        resolutionNote: note || null,
      },
    });
  }

  /**
   * Deletes a single error log.
   */
  async deleteLog(id: string) {
    return (this.prisma as any).errorLog.delete({
      where: { id },
    });
  }

  /**
   * Purges old resolved error logs older than specified days.
   */
  async purgeResolved(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return (this.prisma as any).errorLog.deleteMany({
      where: {
        isResolved: true,
        resolvedAt: { lte: cutoff },
      },
    });
  }
}
