import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, UsersModule, AuthModule, PrismaModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
