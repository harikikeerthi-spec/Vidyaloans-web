import { Controller, Post, Get, Put, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AdminApplicationService } from './admin-application.service';
import { AssignmentService } from '../assignment/assignment.service';
import { StaffGuard } from '../auth/staff.guard';

@Controller('admin/applications')
@UseGuards(StaffGuard)
export class AdminApplicationController {
    constructor(
        private adminApplicationService: AdminApplicationService,
        private assignmentService: AssignmentService,
    ) {}

    private assertAdminRole(req: any) {
        const role = (req?.user?.role || '').toLowerCase();
        if (!['admin', 'super_admin', 'staff_admin'].includes(role)) {
            throw new ForbiddenException('Access denied: Admin privileges required');
        }
    }

    private async assertAdminOrAssignedStaff(appId: string, req: any) {
        const role = (req?.user?.role || '').toLowerCase();
        if (['admin', 'super_admin', 'staff_admin'].includes(role)) {
            return;
        }
        if (role === 'staff' || role === 'support') {
            await this.assignmentService.verifyStaffAccess(appId, req.user?.id || req.user?.uid);
            return;
        }
        throw new ForbiddenException('Access denied: Insufficient role permissions');
    }

    @Post('assign-all-unassigned')
    async assignAllUnassigned(@Request() req: any) {
        this.assertAdminRole(req);
        const triggeredBy = req.user?.id || req.user?.uid || 'admin';
        const result = await this.assignmentService.assignAllUnassigned(triggeredBy);
        return { success: true, message: `Auto-assignment completed. Assigned: ${result.assigned}, Skipped: ${result.skipped}, Failed: ${result.failed}`, data: result };
    }

    @Post('auto-assign-all-unassigned')
    async autoAssignAllUnassigned(@Request() req: any) {
        this.assertAdminRole(req);
        const triggeredBy = req.user?.id || req.user?.uid || 'admin';
        const result = await this.assignmentService.assignAllUnassigned(triggeredBy);
        return { success: true, message: `Auto-assignment completed. Assigned: ${result.assigned}, Skipped: ${result.skipped}, Failed: ${result.failed}`, data: result };
    }

    @Post('auto-assign')
    async autoAssign(@Request() req: any) {
        this.assertAdminRole(req);
        const triggeredBy = req.user?.id || req.user?.uid || 'admin';
        const result = await this.assignmentService.assignAllUnassigned(triggeredBy);
        return { success: true, message: `Auto-assignment completed. Assigned: ${result.assigned}, Skipped: ${result.skipped}, Failed: ${result.failed}`, data: result };
    }

    @Post('reassign/:loanId')
    async reassignLoanByPrefix(
        @Param('loanId') loanId: string,
        @Body() body: { toStaffId: string; reason?: string },
        @Request() req: any,
    ) {
        this.assertAdminRole(req);
        const assignedBy = req.user?.id || req.user?.uid || 'admin';
        return await this.assignmentService.reassignLoan(
            loanId,
            body.toStaffId,
            body.reason || 'manual',
            assignedBy
        );
    }

    @Post(':loanId/reassign')
    async reassignLoanBySuffix(
        @Param('loanId') loanId: string,
        @Body() body: { toStaffId: string; reason?: string },
        @Request() req: any,
    ) {
        this.assertAdminRole(req);
        const assignedBy = req.user?.id || req.user?.uid || 'admin';
        return await this.assignmentService.reassignLoan(
            loanId,
            body.toStaffId,
            body.reason || 'manual',
            assignedBy
        );
    }

    @Post('bulk-reassign')
    async bulkReassignLoans(
        @Body() body: { loanIds: string[]; toStaffId: string; reason?: string },
        @Request() req: any,
    ) {
        this.assertAdminRole(req);
        const assignedBy = req.user?.id || req.user?.uid || 'admin';
        return await this.assignmentService.bulkReassignLoans(
            body.loanIds,
            body.toStaffId,
            body.reason || 'bulk_reassign_admin',
            assignedBy
        );
    }

    /**
     * POST /admin/applications/:id/remarks
     * Add remark/suggestion to application
     */
    @Post(':id/remarks')
    async addRemark(
        @Param('id') appId: string,
        @Body()
        body: {
            type: 'suggestion' | 'remark' | 'warning' | 'approval_note';
            content: string;
        },
        @Request() req,
    ) {
        await this.assertAdminOrAssignedStaff(appId, req);
        return await this.adminApplicationService.addRemark(appId, {
            applicationId: appId,
            type: body.type,
            content: body.content,
            authorId: req.user.id,
            authorName: req.user.firstName,
            isInternal: true,
        });
    }

    /**
     * GET /admin/applications/:id/remarks
     * Get all remarks for an application
     */
    @Get(':id/remarks')
    async getRemarks(@Request() req, @Param('id') appId: string) {
        await this.assertAdminOrAssignedStaff(appId, req);
        const remarks = await this.adminApplicationService.getApplicationRemarks(appId);
        return { success: true, data: remarks };
    }

    /**
     * PUT /admin/applications/:id/assign-mentor
     * Assign mentor and counselor to application
     */
    @Put(':id/assign-mentor')
    async assignMentorCounselor(
        @Param('id') appId: string,
        @Body()
        body: {
            mentorId: string;
            mentorName: string;
            counselorId: string;
            counselorName: string;
        },
        @Request() req,
    ) {
        this.assertAdminRole(req);
        return await this.adminApplicationService.assignMentorCounselor({
            applicationId: appId,
            mentorId: body.mentorId,
            mentorName: body.mentorName,
            counselorId: body.counselorId,
            counselorName: body.counselorName,
        });
    }

    /**
     * PUT /admin/applications/:id/risk-assessment
     * Assess risk level for an application
     */
    @Put(':id/risk-assessment')
    async assessRisk(
        @Request() req,
        @Param('id') appId: string,
        @Body()
        body: {
            riskLevel: 'low' | 'medium' | 'high';
            creditScore?: number;
            notes?: string;
        },
    ) {
        await this.assertAdminOrAssignedStaff(appId, req);
        return await this.adminApplicationService.assessRisk({
            applicationId: appId,
            riskLevel: body.riskLevel,
            creditScore: body.creditScore,
            notes: body.notes,
        });
    }

    /**
     * POST /admin/applications/batch-process
     * Batch process multiple applications
     */
    @Post('batch-process')
    async batchProcessApplications(
        @Body()
        body: {
            applicationIds: string[];
            action: 'approve' | 'reject' | 'flag' | 'send_request';
            remarks: string;
        },
        @Request() req,
    ) {
        this.assertAdminRole(req);
        return await this.adminApplicationService.batchProcessApplications(
            body.applicationIds,
            body.action,
            body.remarks,
            req.user.id,
            req.user.firstName,
        );
    }

    /**
     * GET /admin/applications/:id/eligibility
     * Check application eligibility
     */
    @Get(':id/eligibility')
    async checkEligibility(@Request() req, @Param('id') appId: string) {
        await this.assertAdminOrAssignedStaff(appId, req);
        const assessment = await this.adminApplicationService.checkEligibility(appId);
        return { success: true, data: assessment };
    }

    /**
     * GET /admin/applications/portfolio/analysis
     * Get portfolio analysis
     */
    @Get('portfolio/analysis')
    async getPortfolioAnalysis(@Request() req) {
        const bankId = req.query.bankId as string | undefined;
        const analysis = await this.adminApplicationService.getPortfolioAnalysis(req.user, bankId);
        return { success: true, data: analysis };
    }

    /**
     * GET /admin/applications/compliance/report
     * Get compliance report
     */
    @Get('compliance/report')
    async getComplianceReport(@Request() req) {
        const bankId = req.query.bankId as string | undefined;
        const report = await this.adminApplicationService.getComplianceReport(req.user, bankId);
        return { success: true, data: report };
    }
}
