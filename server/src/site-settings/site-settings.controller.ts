import { Controller, Get, Put, Post, Body, Query, UseGuards } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  @Get('public')
  async getPublicSettings() {
    const settings = await this.siteSettingsService.getPublicSettings();
    return {
      success: true,
      data: settings,
    };
  }

  @Get()
  async getSettings() {
    const settings = await this.siteSettingsService.getSettings();
    return {
      success: true,
      data: settings,
    };
  }

  @Put()
  @UseGuards(AdminGuard)
  async updateSettings(@Body() dto: UpdateSiteSettingsDto) {
    const updated = await this.siteSettingsService.updateSettings(dto);
    return {
      success: true,
      message: 'Site settings updated successfully',
      data: updated,
    };
  }

  @Post('reset-defaults')
  @UseGuards(AdminGuard)
  async resetDefaults() {
    const reset = await this.siteSettingsService.resetDefaults();
    return {
      success: true,
      message: 'Site settings reset to default values',
      data: reset,
    };
  }

  @Post('check-email')
  async checkDisposableEmail(@Body('email') email: string, @Query('email') emailQuery?: string) {
    const targetEmail = email || emailQuery || '';
    const result = await this.siteSettingsService.checkDisposableEmail(targetEmail);
    return {
      success: true,
      data: result,
    };
  }
}
