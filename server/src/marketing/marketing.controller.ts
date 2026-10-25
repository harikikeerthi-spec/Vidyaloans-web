import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { StaffGuard } from '../auth/staff.guard';

@Controller('marketing')
@UseGuards(StaffGuard)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.marketingService.getDashboardMetrics();
  }

  @Get('leads')
  async getLeads(
    @Query('country') country?: string,
    @Query('intake') intake?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.marketingService.getLeads({ country, intake, search, status });
  }

  @Get('referrals')
  async getReferrals() {
    return this.marketingService.getReferrals();
  }

  @Get('blogs')
  async getBlogs() {
    return this.marketingService.getBlogs();
  }
}
