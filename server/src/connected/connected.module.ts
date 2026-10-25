import { Module, forwardRef } from '@nestjs/common';
import { ConnectedController } from './connected.controller';
import { ConnectedService } from './connected.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [forwardRef(() => AuthModule)],
    controllers: [ConnectedController],
    providers: [ConnectedService],
})
export class ConnectedModule { }
