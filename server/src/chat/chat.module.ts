import { Module, forwardRef } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AwsWhatsAppService } from './aws-whatsapp.service';
import { AwsSnsService } from './aws-sns.service';
import { ChatGateway } from './chat.gateway';
import { WhatsappController } from './whatsapp.controller';
import { ChatController } from './chat.controller';
import { MultiPartyChatService } from './multiparty-chat.service';
import { MultiPartyChatController } from './multiparty-chat.controller';
import { StudentNotificationService } from './student-notification.service';
import { EmailService } from './email.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DocumentModule } from '../document/document.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
      EventEmitterModule,
      UsersModule,
      forwardRef(() => DocumentModule),
      forwardRef(() => AiModule),
      ConfigModule,
      JwtModule.registerAsync({
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          secret: configService.get<string>('JWT_SECRET'),
        }),
        inject: [ConfigService],
      })
  ],
  controllers: [WhatsappController, ChatController, MultiPartyChatController],
  providers: [
    ChatService,
    AwsWhatsAppService,
    AwsSnsService,
    ChatGateway,
    MultiPartyChatService,
    EmailService,
    StudentNotificationService,
  ],
  exports: [
    ChatService,
    AwsWhatsAppService,
    AwsSnsService,
    MultiPartyChatService,
    EmailService,
    StudentNotificationService,
  ],
})
export class ChatModule {}
