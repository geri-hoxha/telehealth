import { Module } from '@nestjs/common';
import { AcsService } from './acs.service';

@Module({
  providers: [AcsService],
  exports: [AcsService],
})
export class AcsModule {}
