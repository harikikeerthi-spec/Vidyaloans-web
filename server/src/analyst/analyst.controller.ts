import { Controller, Get, Query } from '@nestjs/common';
import { AnalystService } from './analyst.service';

@Controller('analyst')
export class AnalystController {
  constructor(private readonly analystService: AnalystService) {}

  @Get('dashboard')
  async getDashboard(@Query('timeframe') timeframe?: string) {
    return this.analystService.getDashboardMetrics(timeframe);
  }

  @Get('funnel')
  async getFunnel(
    @Query('country') country?: string,
    @Query('intake') intake?: string,
  ) {
    return this.analystService.getFunnelMetrics(country, intake);
  }

  @Get('banks')
  async getBanks() {
    return this.analystService.getBanksSla();
  }

  @Get('cohorts')
  async getCohorts() {
    return this.analystService.getCohorts();
  }
}
