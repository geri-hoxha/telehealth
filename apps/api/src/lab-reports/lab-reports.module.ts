import { Module } from '@nestjs/common';
import { LabReportsController } from './lab-reports.controller';
import { LabReportsService } from './lab-reports.service';

@Module({
  controllers: [LabReportsController],
  providers: [LabReportsService],
})
export class LabReportsModule {}
