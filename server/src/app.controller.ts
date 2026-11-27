import { Controller, Get, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { CsrfService } from './auth/csrf.service';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly csrfService: CsrfService,
    private readonly supabase: SupabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async health() {
    let databaseOk = false;
    try {
      const { error } = await this.supabase.getClient().from('User').select('id').limit(1);
      databaseOk = !error;
    } catch {
      databaseOk = false;
    }

    const authOk = Boolean(process.env.JWT_SECRET && this.csrfService);
    const apiOk = true;
    const allOk = apiOk && databaseOk && authOk;

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        api: apiOk,
        database: databaseOk,
        auth: authOk,
        publicApi: apiOk && databaseOk,
      },
    };
  }

  @Get('csrf-token')
  getCsrfToken(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const token = this.csrfService.generateCsrfToken(req, res);
    return {
      success: true,
      csrfToken: token,
    };
  }
}
