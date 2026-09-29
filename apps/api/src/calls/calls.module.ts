import { Module } from '@nestjs/common';
import { AcsModule } from '../acs/acs.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [AuthModule, AcsModule, PushModule],
  controllers: [CallsController],
  providers: [CallsService],
})
export class CallsModule {}
