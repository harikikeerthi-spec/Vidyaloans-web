import { Controller, Post, Body, Get, Query, Patch, Param, Delete } from '@nestjs/common';
import { UniversityInquiryService } from './university-inquiry.service';

@Controller('university-inquiry')
export class UniversityInquiryController {
    constructor(private readonly inquiryService: UniversityInquiryService) { }

    @Post()
    async create(@Body() body: {
        userId?: string;
        name: string;
        email: string;
        mobile: string;
        universityName: string;
        type: string;
    }) {
        return this.inquiryService.createInquiry(body);
    }

    @Get('check')
    async check(
        @Query('email') email: string,
        @Query('universityName') universityName: string,
        @Query('type') type: string,
    ) {
        return this.inquiryService.checkInquiry(email, universityName, type);
    }

    @Get()
    async getAll(
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('assignedStaffId') assignedStaffId?: string,
    ) {
        return this.inquiryService.getAllInquiries({ type, status, search, assignedStaffId });
    }

    @Post('bulk-assign')
    async bulkAssign(
        @Body() body: { leadIds: string[]; staffId?: string | null; staffName?: string | null; staffEmail?: string | null },
    ) {
        return this.inquiryService.bulkAssignInquiries(body?.leadIds || [], body || {});
    }

    @Patch(':id/assign')
    async assignPatch(
        @Param('id') id: string,
        @Body() body: { staffId?: string | null; staffName?: string | null; staffEmail?: string | null },
    ) {
        return this.inquiryService.assignInquiry(id, body || {});
    }

    @Post(':id/assign')
    async assignPost(
        @Param('id') id: string,
        @Body() body: { staffId?: string | null; staffName?: string | null; staffEmail?: string | null },
    ) {
        return this.inquiryService.assignInquiry(id, body || {});
    }

    @Patch(':id/status')
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
    ) {
        return this.inquiryService.updateInquiryStatus(id, body?.status || 'contacted');
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.inquiryService.deleteInquiry(id);
    }
}
