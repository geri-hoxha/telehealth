import { Global, Module } from '@nestjs/common';
import { CareService } from './care.service';

@Global()
@Module({
  providers: [CareService],
  exports: [CareService],
})
export class CareModule {}
