import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlockPatientDto, PatientDto } from './patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  /** Doctor: patients they talked to or wrote a folder for. */
  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Name, email, phone or personal ID' })
  @ApiOkResponse({ type: PatientDto, isArray: true })
  list(@CurrentUserId() userId: string, @Query('q') query?: string): Promise<PatientDto[]> {
    return this.patients.list(userId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: PatientDto })
  get(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<PatientDto> {
    return this.patients.get(userId, id);
  }

  /** "Temporary block": the patient can't call until it ends (403 PATIENT_BLOCKED). */
  @Post(':id/block')
  @ApiOkResponse({ type: PatientDto })
  block(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockPatientDto,
  ): Promise<PatientDto> {
    return this.patients.block(userId, id, dto);
  }

  @Delete(':id/block')
  @ApiOkResponse({ type: PatientDto })
  unblock(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<PatientDto> {
    return this.patients.unblock(userId, id);
  }
}
