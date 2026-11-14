import { Controller, Post, Body, Get, Query, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UniversityInquiryService } from './university-inquiry.service';
import { StaffGuard } from '../auth/staff.guard';

@Controller('university-inquiry')
export class UniversityInquiryController {
    constructor(private readonly inquiryService: UniversityInquiryService) { }

    @Post()
    async create(@Body() body: {
        userId?: string;
        name: string;
        email?: string;
        mobile?: string;
        phone?: string;
        universityName?: string;
        intake?: string;
        type?: string;
        subject?: string;
        message?: string;
    }) {
        return this.inquiryService.createInquiry(body);
    }

    @Get('check')
    @UseGuards(StaffGuard)
    async check(
        @Query('email') email: string,
        @Query('universityName') universityName: string,
        @Query('type') type: string,
    ) {
        return this.inquiryService.checkInquiry(email, universityName, type);
    }

    @Get()
    @UseGuards(StaffGuard)
    async getAll(
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('assignedStaffId') assignedStaffId?: string,
    ) {
        return this.inquiryService.getAllInquiries({ type, status, search, assignedStaffId });
    }

    @Get(':id')
    @UseGuards(StaffGuard)
    async getById(@Param('id') id: string) {
        return this.inquiryService.getInquiryById(id);
    }

    @Post('bulk-assign')
    @UseGuards(StaffGuard)
    async bulkAssign(
        @Body() body: { leadIds: string[]; staffId?: string | null; staffName?: string | null; staffEmail?: string | null },
    ) {
        return this.inquiryService.bulkAssignInquiries(body?.leadIds || [], body || {});
    }

    @Patch(':id/assign')
    @UseGuards(StaffGuard)
    async assignPatch(
        @Param('id') id: string,
        @Body() body: { staffId?: string | null; staffName?: string | null; staffEmail?: string | null },
    ) {
        return this.inquiryService.assignInquiry(id, body || {});
    }

    @Post(':id/assign')
    @UseGuards(StaffGuard)
    async assignPost(
        @Param('id') id: string,
        @Body() body: { staffId?: string | null; staffName?: string | null; staffEmail?: string | null },
    ) {
        return this.inquiryService.assignInquiry(id, body || {});
    }

    @Patch(':id/status')
    @UseGuards(StaffGuard)
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
    ) {
        return this.inquiryService.updateInquiryStatus(id, body?.status || 'contacted');
    }

    @Delete(':id')
    @UseGuards(StaffGuard)
    async delete(@Param('id') id: string) {
        return this.inquiryService.deleteInquiry(id);
    }
}
