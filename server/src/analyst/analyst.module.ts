import { Module, forwardRef } from '@nestjs/common';
import { AnalystController } from './analyst.controller';
import { AnalystService } from './analyst.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [AnalystController],
  providers: [AnalystService],
  exports: [AnalystService],
})
export class AnalystModule {}
