import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { EmailService } from './email.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { StaffGuard } from './staff.guard';
import { AuthorizationService } from './authorization.service';
import { AuditLogService } from './audit-log.service';

import { UserGuard } from './user.guard';
import { OwnershipOrStaffGuard } from './ownership.guard';
import { ReferralModule } from '../referral/referral.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FirebaseAuthService } from './firebase-auth.service';
import { CsrfService } from './csrf.service';

import { SiteSettingsModule } from '../site-settings/site-settings.module';

@Module({
  imports: [
    EventEmitterModule,
    forwardRef(() => ReferralModule),
    forwardRef(() => AssignmentModule),
    UsersModule,
    ConfigModule,
    SiteSettingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || configService.get<string>('JWT_EXPIRATION') || '24h') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    AdminGuard,
    SuperAdminGuard,
    StaffGuard,
    AuthorizationService,
    AuditLogService,

    UserGuard,
    OwnershipOrStaffGuard,
    FirebaseAuthService,
    CsrfService,
  ],
  exports: [
    AuthService,
    JwtModule,
    UsersModule,
    AdminGuard,
    SuperAdminGuard,
    StaffGuard,
    AuthorizationService,
    AuditLogService,
    UserGuard,
    OwnershipOrStaffGuard,
    EmailService,
    FirebaseAuthService,
    CsrfService,
  ],
})
export class AuthModule { }
