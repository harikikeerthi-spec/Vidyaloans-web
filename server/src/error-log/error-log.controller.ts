import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ErrorLogService, ErrorLogQueryDto } from './error-log.service';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin/error-logs')
export class ErrorLogController {
  constructor(private readonly errorLogService: ErrorLogService) {}

  /**
   * Summary KPI stats for Error Logs dashboard
   * GET /api/admin/error-logs/stats
   */
  @Get('stats')
  @UseGuards(AdminGuard)
  async getStats() {
    const stats = await this.errorLogService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Paginated listing of error logs with filtering
   * GET /api/admin/error-logs
   */
  @Get()
  @UseGuards(AdminGuard)
  async findAll(@Query() query: ErrorLogQueryDto) {
    const result = await this.errorLogService.findAll(query);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Ingest client-side errors reported from React
   * POST /api/admin/error-logs/client
   */
  @Post('client')
  @HttpCode(HttpStatus.OK)
  async captureClientError(@Body() body: any, @Req() req: any) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.errorLogService.captureError({
      name: body.name || 'ClientRuntimeError',
      message: body.message || 'Unknown client exception',
      statusCode: body.statusCode || 400,
      endpoint: body.url || body.path || req.originalUrl,
      method: body.method || 'CLIENT',
      stack: body.stack,
      level: body.level || 'ERROR',
      source: 'frontend',
      context: body.componentStack ? 'ReactErrorBoundary' : 'WindowOnError',
      metadata: {
        componentStack: body.componentStack,
        url: body.url,
        userAgent,
        clientIp,
        extra: body.extra,
      },
      userId: body.userId,
      userEmail: body.userEmail,
      userRole: body.userRole,
    });

    return { success: true };
  }

  /**
   * Get single error log detail
   * GET /api/admin/error-logs/:id
   */
  @Get(':id')
  @UseGuards(AdminGuard)
  async findOne(@Param('id') id: string) {
    const log = await this.errorLogService.findById(id);
    if (!log) {
      return { success: false, message: 'Error log not found' };
    }
    return {
      success: true,
      data: log,
    };
  }

  /**
   * Mark error as resolved
   * PATCH /api/admin/error-logs/:id/resolve
   */
  @Patch(':id/resolve')
  @UseGuards(AdminGuard)
  async resolve(
    @Param('id') id: string,
    @Body('note') note: string,
    @Req() req: any,
  ) {
    const adminIdentifier = req.user?.email || req.user?.firstName || 'Admin';
    const updated = await this.errorLogService.resolveLog(id, adminIdentifier, note);
    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Reopen / unresolve error log
   * PATCH /api/admin/error-logs/:id/unresolve
   */
  @Patch(':id/unresolve')
  @UseGuards(AdminGuard)
  async unresolve(@Param('id') id: string) {
    const updated = await this.errorLogService.unresolveLog(id);
    return {
      success: true,
      data: updated,
    };
  }

  /**
   * Bulk resolve multiple error logs
   * POST /api/admin/error-logs/bulk-resolve
   */
  @Post('bulk-resolve')
  @UseGuards(AdminGuard)
  async bulkResolve(
    @Body('ids') ids: string[],
    @Body('note') note: string,
    @Req() req: any,
  ) {
    const adminIdentifier = req.user?.email || req.user?.firstName || 'Admin';
    const result = await this.errorLogService.bulkResolve(ids, adminIdentifier, note);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Delete single error log
   * DELETE /api/admin/error-logs/:id
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteLog(@Param('id') id: string) {
    await this.errorLogService.deleteLog(id);
    return {
      success: true,
      message: 'Error log deleted',
    };
  }

  /**
   * Purge resolved error logs older than specified days (default 30)
   * POST /api/admin/error-logs/purge
   */
  @Post('purge')
  @UseGuards(AdminGuard)
  async purgeResolved(@Body('days') days?: number) {
    const result = await this.errorLogService.purgeResolved(days || 30);
    return {
      success: true,
      data: result,
      message: `Purged ${result.count} resolved error logs`,
    };
  }
}
