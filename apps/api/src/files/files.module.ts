import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { UploadsService } from './uploads.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class FilesModule {}
