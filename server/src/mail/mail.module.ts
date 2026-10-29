import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { ExecutiveWebmailController } from './executive-webmail.controller';
import { ExecutiveWebmailService } from './executive-webmail.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    AuthModule,
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [MailController, ExecutiveWebmailController],
  providers: [MailService, ExecutiveWebmailService],
  exports: [MailService, ExecutiveWebmailService],
})
export class MailModule {}
