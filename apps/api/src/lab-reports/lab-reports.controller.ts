import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestLanguage } from '../common/language';
import type { Language } from '../generated/prisma/enums';
import { LabReportDto } from './lab-report.dto';
import { LabReportsService } from './lab-reports.service';

@ApiTags('lab-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-reports')
export class LabReportsController {
  constructor(private readonly labReports: LabReportsService) {}

  /** Patient: the latest blood test and the latest urine test, newest first. Names come in the request's language. */
  @Get('latest')
  @ApiOkResponse({ type: LabReportDto, isArray: true })
  latest(@CurrentUserId() userId: string, @RequestLanguage() language: Language): Promise<LabReportDto[]> {
    return this.labReports.latest(userId, language);
  }
}
