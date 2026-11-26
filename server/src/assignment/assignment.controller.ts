import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { StaffGuard } from '../auth/staff.guard';
import { ReassignLoanDto, BulkReassignDto, LockApplicationDto, UpdateStaffAvailabilityDto } from './dto/assign.dto';

@Controller('assignment')
@UseGuards(StaffGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  private getRole(req: any): string {
    return (req?.user?.role || '').toLowerCase();
  }

  private assertAdminRole(req: any) {
    if (!['admin', 'super_admin', 'staff_admin'].includes(this.getRole(req))) {
      throw new ForbiddenException('Access denied: Admin privileges required');
    }
  }

  private assertAdminOrStaffRole(req: any) {
    const role = this.getRole(req);
    if (!['admin', 'super_admin', 'staff_admin', 'staff', 'support'].includes(role)) {
      throw new ForbiddenException('Access denied: Insufficient role permissions for case assignment');
    }
  }

  /**
   * Trigger round-robin assignment for a single loan application.
   * POST /assignment/assign/:loanId
   */
  @Post('assign/:loanId')
  async assignLoan(
    @Param('loanId') loanId: string,
    @Req() req: any,
  ) {
    this.assertAdminOrStaffRole(req);
    const triggeredBy = req.user?.id || req.user?.uid || 'staff';
    const result = await this.assignmentService.assignLoan(loanId, triggeredBy);
    return { success: result.success, data: result };
  }

  /**
   * Assign ALL currently unassigned loan applications via round-robin.
   * POST /assignment/assign-all-unassigned
   * Useful for backfill on startup or after adding new staff members.
   */
  @Post('assign-all-unassigned')
  async assignAllUnassigned(@Req() req: any) {
    this.assertAdminRole(req);
    const triggeredBy = req.user?.id || req.user?.uid || 'system';
    const result = await this.assignmentService.assignAllUnassigned(triggeredBy);
    return { success: true, message: `Auto-assignment completed. Assigned: ${result.assigned}, Skipped: ${result.skipped}, Failed: ${result.failed}`, data: result };
  }

  @Post('auto-assign-all-unassigned')
  async autoAssignAllUnassigned(@Req() req: any) {
    this.assertAdminRole(req);
    const triggeredBy = req.user?.id || req.user?.uid || 'system';
    const result = await this.assignmentService.assignAllUnassigned(triggeredBy);
    return { success: true, message: `Auto-assignment completed. Assigned: ${result.assigned}, Skipped: ${result.skipped}, Failed: ${result.failed}`, data: result };
  }

  @Post('auto-assign')
  async autoAssign(@Req() req: any) {
    this.assertAdminRole(req);
    const triggeredBy = req.user?.id || req.user?.uid || 'system';
    const result = await this.assignmentService.assignAllUnassigned(triggeredBy);
    return { success: true, message: `Auto-assignment completed. Assigned: ${result.assigned}, Skipped: ${result.skipped}, Failed: ${result.failed}`, data: result };
  }

  @Post('reassign/:loanId')
  async reassignLoanByPrefix(
    @Param('loanId') loanId: string,
    @Body() dto: ReassignLoanDto,
    @Req() req: any,
  ) {
    this.assertAdminRole(req);
    const assignedBy = req.user?.id || req.user?.uid || 'manager';
    return await this.assignmentService.reassignLoan(
      loanId,
      dto.toStaffId,
      dto.reason || 'manual',
      assignedBy
    );
  }

  @Post(':loanId/reassign')
  async reassignLoanBySuffix(
    @Param('loanId') loanId: string,
    @Body() dto: ReassignLoanDto,
    @Req() req: any,
  ) {
    this.assertAdminRole(req);
    const assignedBy = req.user?.id || req.user?.uid || 'manager';
    return await this.assignmentService.reassignLoan(
      loanId,
      dto.toStaffId,
      dto.reason || 'manual',
      assignedBy
    );
  }

  @Post('bulk-reassign')
  async bulkReassignLoans(
    @Body() dto: BulkReassignDto,
    @Req() req: any,
  ) {
    this.assertAdminRole(req);
    const assignedBy = req.user?.id || req.user?.uid || 'admin';
    return await this.assignmentService.bulkReassignLoans(
      dto.loanIds,
      dto.toStaffId,
      dto.reason || 'bulk_reassign_admin',
      assignedBy
    );
  }

  @Post('lock/:loanId')
  async lockApplication(
    @Param('loanId') loanId: string,
    @Body() dto: LockApplicationDto,
    @Req() req: any,
  ) {
    this.assertAdminOrStaffRole(req);
    const isAdmin = ['admin', 'super_admin', 'staff_admin'].includes(this.getRole(req));
    const staffId = isAdmin ? (dto.staffId || req.user?.id || 'staff') : (req.user?.id || req.user?.uid);
    return await this.assignmentService.lockApplication(loanId, staffId);
  }

  @Get('my-applications')
  async getMyApplications(
    @Req() req: any,
    @Query('staffId') staffIdQuery?: string,
    @Query('status') status?: string,
    @Query('includeUnassigned') includeUnassignedQuery?: string,
  ) {
    this.assertAdminOrStaffRole(req);
    const isAdmin = ['admin', 'super_admin', 'staff_admin'].includes(this.getRole(req));
    const staffId = isAdmin ? (staffIdQuery || req.user?.id || req.user?.uid) : (req.user?.id || req.user?.uid);
    const includeUnassigned = isAdmin && (includeUnassignedQuery === 'true' || includeUnassignedQuery === '1');
    const applications = await this.assignmentService.getMyApplications(staffId, status, includeUnassigned);
    return { success: true, data: applications, count: applications.length };
  }

  @Get('team-dashboard')
  async getTeamWorkloadSummary(@Req() req: any) {
    this.assertAdminRole(req);
    const summary = await this.assignmentService.getTeamWorkloadSummary();
    return { success: true, data: summary };
  }

  @Get('unassigned-queue')
  async getUnassignedQueue(@Req() req: any) {
    this.assertAdminRole(req);
    const queue = await this.assignmentService.getUnassignedQueue();
    return { success: true, data: queue, count: queue.length };
  }

  @Get('history')
  async getAssignmentHistory(@Req() req: any, @Query('loanId') loanId?: string) {
    this.assertAdminOrStaffRole(req);
    const history = await this.assignmentService.getAssignmentHistory(loanId);
    return { success: true, data: history };
  }

  @Get('history/:loanId')
  async getLoanAssignmentHistory(@Param('loanId') loanId: string) {
    const history = await this.assignmentService.getAssignmentHistory(loanId);
    return { success: true, data: history };
  }

  @Patch('staff/:staffId/availability')
  async updateStaffAvailability(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffAvailabilityDto,
  ) {
    const result = await this.assignmentService.updateStaffAvailability(staffId, dto);
    return { success: true, data: result };
  }
}
