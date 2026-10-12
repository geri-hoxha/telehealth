import { Module } from '@nestjs/common';
import { LiveKitModule } from '../livekit/livekit.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [LiveKitModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
