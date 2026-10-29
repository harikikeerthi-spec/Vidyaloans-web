import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsersModule } from '../users/users.module';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { BankDashboardController } from './bank-dashboard.controller';
import { BankDashboardService } from './bank-dashboard.service';
import { BankWorkflowController } from './bank-workflow.controller';
import { BankWorkflowService } from './bank-workflow.service';
import { SlackService } from './slack.service';
import { SalesforceService } from './salesforce.service';
import { BankCronService } from './bank-cron.service';
import { BankRbacInterceptor } from './bank-rbac.middleware';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';
import { AssignmentModule } from '../assignment/assignment.module';

@Module({
  imports: [
    SupabaseModule,
    UsersModule,
    ChatModule,
    AuthModule,
    AssignmentModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [BankController, BankDashboardController, BankWorkflowController],
  providers: [
    BankService,
    BankDashboardService,
    BankWorkflowService,
    SlackService,
    SalesforceService,
    BankCronService,
    BankRbacInterceptor
  ],
  exports: [BankService, BankDashboardService, BankWorkflowService, BankCronService]
})
export class BankModule { }
