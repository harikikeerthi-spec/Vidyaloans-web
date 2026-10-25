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
    ) {
        return this.inquiryService.getAllInquiries({ type, status, search });
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
