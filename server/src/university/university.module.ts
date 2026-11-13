import { Module, forwardRef } from '@nestjs/common';
import { UniversityInquiryController } from './university-inquiry.controller';
import { UniversityInquiryService } from './university-inquiry.service';
import { EmailService } from '../auth/email.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [forwardRef(() => AuthModule)],
    controllers: [UniversityInquiryController],
    providers: [UniversityInquiryService, EmailService],
})
export class UniversityModule { }
