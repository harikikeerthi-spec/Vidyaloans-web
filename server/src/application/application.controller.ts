import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    Res,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ApplicationService } from './application.service';
import { S3Service } from '../document/s3.service';
import { UserGuard } from '../auth/user.guard';
import { AdminGuard } from '../auth/admin.guard';
import { StaffGuard } from '../auth/staff.guard';
import { AgentGuard } from '../auth/agent.guard';
import { NotificationService } from '../notification/notification.service';

// Multer configuration for application documents
const storage = diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = './uploads/applications';
        if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `app-doc-${uniqueSuffix}${ext}`);
    },
});

@Controller('applications')
export class ApplicationController {
    constructor(
        private applicationService: ApplicationService,
        private s3Service: S3Service,
        private notificationService: NotificationService,
        private jwtService: JwtService,
    ) { }

    // ==================== PUBLIC ENDPOINTS ====================

    /**
     * Public document view via signed email token (no auth session needed)
     * GET /applications/documents/public-view?token=...
     */
    @Get('documents/public-view')
    async viewDocumentPublic(
        @Query('token') token: string,
        @Query('download') download: string,
        @Res() res: Response,
    ) {
        if (!token) {
            res.status(401).json({ error: 'Missing document access token' });
            return;
        }
        let payload: any;
        try {
            payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET || 'secretKey',
            });
        } catch {
            res.status(401).json({ error: 'Invalid or expired document token' });
            return;
        }

        const { applicationId, documentId } = payload;
        if (!applicationId || !documentId) {
            res.status(400).json({ error: 'Invalid token payload' });
            return;
        }

        const doc = await this.applicationService.getSingleDocument(applicationId, documentId);
        if (!doc || !doc.filePath) {
            throw new NotFoundException('Document file not found');
        }

        // DigiLocker URI – render info page
        if (doc.filePath.startsWith('in.gov.')) {
            const html = `<!DOCTYPE html><html><head><title>${doc.docName || doc.docType}</title>
<style>body{font-family:system-ui,sans-serif;background:#f0f2f5;display:flex;justify-content:center;padding:40px;}
.card{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.1);max-width:600px;width:100%;border-top:6px solid #82c91e;}
.badge{background:#e6fced;color:#12b842;padding:6px 12px;border-radius:20px;font-weight:600;font-size:14px;}
.label{font-size:13px;color:#666;text-transform:uppercase;font-weight:600;letter-spacing:.5px;}
.value{font-size:18px;color:#333;margin-top:4px;word-break:break-all;}</style></head>
<body><div class="card"><div style="display:flex;align-items:center;gap:15px;margin-bottom:30px;border-bottom:1px solid #eee;padding-bottom:20px;">
<h2 style="margin:0;color:#1a3a6b;">Digital Verification Record</h2><span class="badge">✓ DigiLocker</span></div>
<div class="label">Document</div><div class="value">${doc.docName || doc.docType}</div>
<div style="margin-top:20px;" class="label">DigiLocker URI</div><div class="value">${doc.filePath}</div>
</div></body></html>`;
            res.setHeader('Content-Type', 'text/html');
            return res.send(html);
        }

        const absolutePath = resolve(doc.filePath);
        if (existsSync(absolutePath)) {
            if (download === 'true') {
                const filename = doc.fileName || doc.docName || 'document.pdf';
                return res.download(absolutePath, filename);
            }
            return res.sendFile(absolutePath);
        }

        // Try S3
        try {
            const filename = doc.fileName || doc.docName || 'document.pdf';
            const presignedUrl = await this.s3Service.getPresignedUrl(
                doc.filePath,
                3600,
                download === 'true' ? filename : undefined,
            );
            return res.redirect(302, presignedUrl);
        } catch {
            throw new NotFoundException('Document not found on disk or S3');
        }
    }

    /**
     * Track application by application number (public)
     * GET /applications/track/:applicationNumber
     */
    @Get('track/:applicationNumber')
    async trackApplication(@Param('applicationNumber') applicationNumber: string) {
        return this.applicationService.trackApplication(applicationNumber);
    }

    /**
     * Get required documents list for a loan type
     * GET /applications/required-documents/:loanType
     */
    @Get('required-documents/:loanType')
    async getRequiredDocuments(@Param('loanType') loanType: string) {
        return this.applicationService.getRequiredDocuments(loanType);
    }

    /**
     * Get application stages
     * GET /applications/stages
     */
    @Get('stages')
    async getApplicationStages() {
        return this.applicationService.getApplicationStages();
    }

    // ==================== USER ENDPOINTS ====================

    /**
     * Create a new loan application
     * POST /applications
     * @body Complete application data
     */
    @Post()
    @UseGuards(UserGuard)
    async createApplication(@Request() req, @Body() body: any) {
        const userRole = (req.user?.role || '').toLowerCase();
        const isStaffOrAdmin = ['staff', 'admin', 'super_admin', 'support', 'it', 'agent', 'partner_agent'].includes(userRole) || userRole.startsWith('bank_') || body.isStaff === true;
        const targetUserId = (isStaffOrAdmin && body.userId) ? body.userId : req.user.id;
        return this.applicationService.createApplication(targetUserId, body, isStaffOrAdmin);
    }

    /**
     * Create a new loan application for a student (Staff/Admin)
     * POST /applications/admin/create-for-user
     */
    @Post('admin/create-for-user')
    @UseGuards(StaffGuard)
    async createApplicationForUser(@Request() req, @Body() body: any) {
        if (!body.userId) {
            throw new BadRequestException('Student userId is required');
        }
        return this.applicationService.createApplication(body.userId, body, true);
    }

    /**
     * Get all user's applications
     * GET /applications/my
     * @query status - Filter by status
     * @query loanType - Filter by loan type
     * @query limit - Number of results (default: 20)
     * @query offset - Skip results (default: 0)
     */
    @Get('my')
    @UseGuards(UserGuard)
    async getMyApplications(
        @Request() req,
        @Query('status') status?: string,
        @Query('loanType') loanType?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.applicationService.getUserApplications(req.user.id, {
            status,
            loanType,
            limit: limit ? parseInt(limit, 10) : 20,
            offset: offset ? parseInt(offset, 10) : 0,
        });
    }

    // ==================== ADMIN ENDPOINTS ====================

    /**
     * Get all applications (Admin)
     * GET /applications/admin/all
     * @query status - Filter by status
     * @query stage - Filter by stage
     * @query loanType - Filter by loan type
     * @query bank - Filter by bank
     * @query search - Search term
     * @query fromDate - From date
     * @query toDate - To date
     * @query limit - Number of results
     * @query offset - Skip results
     * @query sortBy - Sort field
     * @query sortOrder - Sort order (asc/desc)
     */
    @Get('admin/all')
    @UseGuards(StaffGuard)
    async getAllApplications(
        @Query('status') status?: string,
        @Query('stage') stage?: string,
        @Query('loanType') loanType?: string,
        @Query('bank') bank?: string,
        @Query('search') search?: string,
        @Query('fromDate') fromDate?: string,
        @Query('toDate') toDate?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: string,
        @Query('userId') userId?: string,
        @Query('excludeStatus') excludeStatus?: string,
        @Query('includeUnassigned') includeUnassigned?: string,
        @Request() req?: any,
    ) {
        let dbBankName: string | undefined = bank;
        if (bank) {
            const mappings: Record<string, string> = {
                credila: 'HDFC Credila',
                poonawalla: 'Poonawalla',
                idfc: 'IDFC',
                avanse: 'Avanse',
                auxilo: 'Auxilo'
            };
            dbBankName = mappings[bank.toLowerCase()] || bank;
        }

        const user = req?.user;
        // Per-staff isolation: staff role users see ONLY applications assigned to them.
        // Admins and super_admins see all applications (no filter applied).
        let assignedStaffId: string | undefined = undefined;
        let staffEmail: string | undefined = undefined;
        if (user && user.role === 'staff') {
            // Pass both the user ID and email — service resolves all matching candidate IDs
            assignedStaffId = user.id || user.uid;
            staffEmail = user.email;
        }

        return this.applicationService.getAllApplications({
            status,
            stage,
            loanType,
            bank: dbBankName,
            search,
            fromDate,
            toDate,
            limit: limit ? parseInt(limit, 10) : 1000,
            offset: offset ? parseInt(offset, 10) : 0,
            sortBy,
            sortOrder: sortOrder as 'asc' | 'desc',
            userId,
            excludeStatus,
            assignedStaffId,
            staffEmail,
            includeUnassigned: includeUnassigned === 'true',
        });
    }

    /**
     * Get application statistics (Admin)
     * GET /applications/admin/stats
     */
    @Get('admin/stats')
    @UseGuards(StaffGuard)
    async getApplicationStats(@Request() req, @Query('bankId') bankId?: string) {
        return this.applicationService.getApplicationStats(req.user, bankId);
    }

    /**
     * Get application documents (Admin)
     * GET /applications/admin/:id/documents
     */
    @Get('admin/:id/documents')
    @UseGuards(StaffGuard)
    async getDocumentsAdmin(@Param('id') id: string) {
        return this.applicationService.getApplicationDocuments(id);
    }

    /**
     * Sync application documents with vault (Admin)
     * POST /applications/admin/:id/sync-vault
     */
    @Post('admin/:id/sync-vault')
    @UseGuards(StaffGuard)
    async syncVaultDocuments(@Param('id') id: string) {
        return this.applicationService.syncApplicationDocuments(id);
    }

    /**
     * Update application details (Admin/Staff/Bank)
     * PUT /applications/admin/:id
     */
    @Put('admin/:id')
    @UseGuards(StaffGuard)
    async updateApplicationDetails(
        @Param('id') id: string,
        @Body() body: any,
        @Request() req: any
    ) {
        return this.applicationService.adminUpdateApplication(id, body, req.user);
    }

    /**
     * Update application status (Admin)
     * PUT /applications/admin/:id/status
     */
    @Put('admin/:id/status')
    @UseGuards(StaffGuard)
    async updateApplicationStatus(
        @Request() req,
        @Param('id') id: string,
        @Body() body: {
            status?: string;
            stage?: string;
            progress?: number;
            remarks?: string;
            rejectionReason?: string;
        }
    ) {
        const adminName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
        return this.applicationService.updateApplicationStatus(id, req.user.id, adminName, body, req.user.role);
    }

    /**
     * AI-powered application review (Admin)
     * POST /applications/admin/:id/ai-review
     */
    @Post('admin/:id/ai-review')
    @UseGuards(StaffGuard)
    async aiReviewApplication(
        @Request() req,
        @Param('id') id: string,
    ) {
        try {
            const adminName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
            console.log(`[AI Review] Starting review for application ${id} by admin ${adminName}`);
            return await this.applicationService.aiReviewApplication(id, req.user.id, adminName);
        } catch (error) {
            console.error(`[AI Review] Controller Error for application ${id}:`, error);
            throw error;
        }
    }

    /**
     * Share application details via email (Admin)
     * POST /applications/admin/:id/share
     */
    @Post('admin/:id/share')
    @UseGuards(StaffGuard)
    async shareApplication(
        @Request() req,
        @Param('id') id: string,
    ) {
        const adminName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
        return this.applicationService.shareApplication(id, req.user.id, adminName);
    }

    /**
     * View/Download application document file (Admin)
     * GET /applications/admin/:id/documents/:documentId/view
     */
    @Get('admin/:id/documents/:documentId/view')
    @UseGuards(StaffGuard)
    async viewDocumentAdmin(
        @Param('id') applicationId: string,
        @Param('documentId') documentId: string,
        @Query('download') download: string,
        @Res() res: Response,
    ) {
        const doc = await this.applicationService.getSingleDocument(applicationId, documentId);

        if (!doc || !doc.filePath) {
            throw new NotFoundException('Document file not found');
        }


        if (doc.filePath && doc.filePath.startsWith('in.gov.')) {
            const html = `
<!DOCTYPE html>
<html>
<head>
    <title>DigiLocker Record - ${doc.docName || doc.docType}</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #f0f2f5; display: flex; justify-content: center; padding: 40px; }
        .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; width: 100%; border-top: 6px solid #82c91e; }
        .header { display: flex; align-items: center; gap: 15px; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .title { margin: 0; color: #1a3a6b; }
        .badge { background: #e6fced; color: #12b842; padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 14px; white-space: nowrap; }
        .field { margin-bottom: 20px; }
        .label { font-size: 13px; color: #666; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
        .value { font-size: 18px; color: #333; margin-top: 4px; word-break: break-all; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h2 class="title">Digital Verification Record</h2>
            <span class="badge">✓ Verified by DigiLocker</span>
        </div>
        <div class="field">
            <div class="label">Document Name</div>
            <div class="value">${doc.docName || doc.docType || 'Document'}</div>
        </div>
        <div class="field">
            <div class="label">DigiLocker Reference URI</div>
            <div class="value">${doc.filePath}</div>
        </div>
        <div class="field">
            <div class="label">Date Synced</div>
            <div class="value">${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'N/A'}</div>
        </div>
        <div class="footer">
            This is a digitally verified record synced directly from DigiLocker. The physical file is held securely by the issuing authority.
        </div>
    </div>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html');
            return res.send(html);
        }
        const absolutePath = resolve(doc.filePath);
        if (existsSync(absolutePath)) {
            if (download === 'true') {
                const filename = doc.fileName || doc.docName || 'document.pdf';
                return res.download(absolutePath, filename);
            }
            return res.sendFile(absolutePath);
        }

        // Try S3 bucket integration
        try {
            console.log(`[viewDocumentAdmin] Document not found locally at ${absolutePath}. Generating presigned URL (download=${download}) for S3 key: ${doc.filePath}`);
            const filename = doc.fileName || doc.docName || 'document.pdf';
            const presignedUrl = await this.s3Service.getPresignedUrl(
                doc.filePath,
                3600,
                download === 'true' ? filename : undefined
            );
            return res.redirect(302, presignedUrl);
        } catch (s3Error) {
            console.error(`[viewDocumentAdmin] S3 presigned URL generation failed for ${doc.filePath}:`, s3Error);
            const fallbackPath = resolve(process.cwd(), 'public/mock/document_missing.pdf');
            if (existsSync(fallbackPath)) {
                return res.sendFile(fallbackPath);
            }
            throw new NotFoundException('Document file not found on disk or S3');
        }
    }

    /**
     * Verify/Reject document (Admin)
     * PUT /applications/admin/documents/:documentId/verify
     */
    @Put('admin/documents/:documentId/verify')
    @UseGuards(StaffGuard)
    async verifyDocument(
        @Request() req,
        @Param('documentId') documentId: string,
        @Body() body: {
            status: 'verified' | 'rejected';
            rejectionReason?: string;
        }
    ) {
        return this.applicationService.verifyDocument(documentId, req.user.id, body);
    }

    /**
     * Get application tracking (Admin)
     * GET /applications/admin/:id/tracking
     */
    @Get('admin/:id/tracking')
    @UseGuards(StaffGuard)
    async getTrackingAdmin(@Param('id') id: string) {
        return this.applicationService.getApplicationTracking(id);
    }

    /**
     * Get application notes (Admin)
     * GET /applications/admin/:id/notes
     */
    @Get('admin/:id/notes')
    @UseGuards(StaffGuard)
    async getApplicationNotes(@Param('id') id: string) {
        return this.applicationService.getApplicationNotes(id, true);
    }

    /**
     * Add note to application (Admin)
     * POST /applications/admin/:id/notes
     */
    @Post('admin/:id/notes')
    @UseGuards(StaffGuard)
    async addApplicationNote(
        @Request() req,
        @Param('id') id: string,
        @Body() body: {
            content: string;
            type?: string;
            isInternal?: boolean;
        }
    ) {
        const authorName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
        return this.applicationService.addApplicationNote(id, req.user.id, authorName, body);
    }

    /**
     * Update follow-up / reminder for application (Staff)
     * PUT /applications/:id/follow-up
     */
    @Put(':id/follow-up')
    @UseGuards(StaffGuard)
    async updateFollowUp(
        @Request() req,
        @Param('id') id: string,
        @Body() body: { date: string; time?: string; notes?: string; status?: string }
    ) {
        return this.applicationService.updateFollowUp(id, req.user.id, body);
    }

    // ==================== AGENT ENDPOINTS ====================

    /**
     * Get agent's referral stats
     * GET /applications/agent/stats
     */
    @Get('agent/stats')
    @UseGuards(AgentGuard)
    async getAgentStats(@Request() req) {
        return this.applicationService.getAgentStats(req.user.id);
    }

    /**
     * Get applications referred by this agent
     * GET /applications/agent/list
     */
    @Get('agent/list')
    @UseGuards(AgentGuard)
    async getAgentApplications(@Request() req) {
        return this.applicationService.getAgentApplications(req.user.id);
    }

    // ==================== USER :id ENDPOINTS (must be AFTER all named routes) ====================

    /**
     * Download loan disbursement receipt PDF
     * GET /applications/:id/disbursement-receipt
     */
    @Get(':id/disbursement-receipt')
    @UseGuards(UserGuard)
    async downloadDisbursementReceipt(
        @Request() req,
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        const application = await this.applicationService.getApplicationById(id);
        if (!application) {
            throw new NotFoundException('Application not found');
        }

        // Verify ownership (unless admin/staff/bank/support)
        const allowedRoles = ['admin', 'super_admin', 'staff', 'support', 'bank', 'partner_bank'];
        if (!allowedRoles.includes(req.user.role) && application.userId !== req.user.id) {
            throw new BadRequestException('Unauthorized to view this application');
        }

        // Fetch disbursements
        const { data: disbursements } = await this.applicationService.getDisbursements(id);
        const latestDisbursement = disbursements && disbursements.length > 0 ? disbursements[0] : null;

        // Extract borrower name and email
        const user = application.user;
        let borrowerName = `${application.firstName || ''} ${application.lastName || ''}`.trim();
        if (!borrowerName && user) {
            borrowerName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        }

        const details = {
            applicationNumber: application.applicationNumber || 'N/A',
            borrowerName: borrowerName || 'Valued Customer',
            bankName: application.bankName || application.bank || 'Partner Bank',
            amount: latestDisbursement ? latestDisbursement.disbursementAmount : application.amount,
            utrNumber: latestDisbursement ? latestDisbursement.utrNumber : 'N/A',
            trancheNumber: latestDisbursement ? latestDisbursement.trancheNumber : 1,
            transferMode: latestDisbursement ? latestDisbursement.transferMode : 'NEFT/RTGS',
            date: latestDisbursement && latestDisbursement.disbursedAt
                ? new Date(latestDisbursement.disbursedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                })
                : new Date().toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                }),
        };

        const pdfBuffer = await this.notificationService.generateDisbursementPdf(details);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Disbursement_Receipt_${details.applicationNumber}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });

        res.end(pdfBuffer);
    }

    /**
     * Get application by ID
     * GET /applications/:id
     */
    @Get(':id')
    @UseGuards(UserGuard)
    async getApplicationById(@Request() req, @Param('id') id: string) {
        let application = await this.applicationService.getApplicationById(id);

        // Verify ownership (unless admin/staff/bank/support)
        const allowedRoles = ['admin', 'super_admin', 'staff', 'support', 'bank', 'partner_bank'];
        if (!allowedRoles.includes(req.user.role) && application.userId !== req.user.id) {
            throw new BadRequestException('Unauthorized to view this application');
        }

        // Trigger staff review start email if viewed by staff/admin for the first time while status is 'submitted'
        const isStaff = ['admin', 'super_admin', 'staff', 'support'].includes(req.user.role);
        if (isStaff && application.status === 'submitted' && !application.reviewStartedAt) {
            try {
                const updated = await this.applicationService.startApplicationReview(id);
                application = { ...application, ...updated };
            } catch (err) {
                console.error('Failed to trigger staff review start flow:', err);
            }
        }

        return {
            success: true,
            data: application
        };
    }

    /**
     * Get application tracking/timeline
     * GET /applications/:id/tracking
     */
    @Get(':id/tracking')
    @UseGuards(UserGuard)
    async getApplicationTracking(@Request() req, @Param('id') id: string) {
        return this.applicationService.getApplicationTracking(id, req.user.id);
    }

    /**
     * Update application
     * PUT /applications/:id
     */
    @Put(':id')
    @UseGuards(UserGuard)
    async updateApplication(
        @Request() req,
        @Param('id') id: string,
        @Body() body: any
    ) {
        return this.applicationService.updateApplication(id, req.user.id, body);
    }

    /**
     * Submit a draft application
     * POST /applications/:id/submit
     */
    @Post(':id/submit')
    @UseGuards(UserGuard)
    async submitApplication(@Request() req, @Param('id') id: string) {
        return this.applicationService.submitApplication(id, req.user.id);
    }

    /**
     * Cancel application
     * POST /applications/:id/cancel
     * @body reason - Cancellation reason (optional)
     */
    @Post(':id/cancel')
    @UseGuards(UserGuard)
    async cancelApplication(
        @Request() req,
        @Param('id') id: string,
        @Body() body: { reason?: string }
    ) {
        return this.applicationService.cancelApplication(id, req.user.id, body?.reason);
    }

    /**
     * Get documents for an application
     * GET /applications/:id/documents
     */
    @Get(':id/documents')
    @UseGuards(UserGuard)
    async getApplicationDocuments(@Request() req, @Param('id') id: string) {
        return this.applicationService.getApplicationDocuments(id, req.user.id);
    }

    /**
     * Upload document to application
     * POST /applications/:id/documents
     */
    @Post(':id/documents')
    @UseGuards(UserGuard)
    @UseInterceptors(FileInterceptor('file', {
        storage: storage,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
        fileFilter: (req, file, cb) => {
            if (file.mimetype.match(/\/(jpg|jpeg|png|pdf|doc|docx)$/)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Unsupported file type. Allowed: jpg, jpeg, png, pdf, doc, docx'), false);
            }
        }
    }))
    async uploadDocument(
        @Request() req,
        @Param('id') applicationId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body('docType') docType: string,
        @Body('docName') docName: string,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }

        if (!docType) {
            if (file?.path) {
                try { unlinkSync(file.path); } catch (e) { }
            }
            throw new BadRequestException('docType is required');
        }

        return this.applicationService.uploadDocument(applicationId, req.user.id, {
            docType,
            docName: docName || file.originalname,
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
        });
    }

    /**
     * Delete document from application
     * DELETE /applications/:id/documents/:documentId
     */
    @Delete(':id/documents/:documentId')
    @UseGuards(UserGuard)
    async deleteDocument(
        @Request() req,
        @Param('id') applicationId: string,
        @Param('documentId') documentId: string,
    ) {
        return this.applicationService.deleteDocument(documentId, req.user.id);
    }

    /**
     * Upload bank statement for EVV calculation
     * POST /applications/:id/upload-statement
     */
    @Post(':id/upload-statement')
    @UseGuards(StaffGuard)
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
        fileFilter: (req, file, cb) => {
            const mimeMatch = !file.mimetype || file.mimetype.match(/\/(jpg|jpeg|png|pdf|octet-stream|x-pdf|document|csv|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/i);
            const extMatch = !file.originalname || file.originalname.match(/\.(jpg|jpeg|png|pdf|csv|xlsx|xls)$/i);
            if (mimeMatch || extMatch) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Unsupported file type. Allowed: PDF, JPG, PNG, CSV, XLSX'), false);
            }
        }
    }))
    async uploadBankStatement(
        @Request() req,
        @Param('id') applicationId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        const adminId = req.user?.id || 'staff';
        const adminName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || req.user?.email || 'Staff User';
        return this.applicationService.processBankStatementEvv(applicationId, file, adminId, adminName);
    }

}
