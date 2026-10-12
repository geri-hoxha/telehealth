import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonDto, personInclude, toPersonDto } from '../common/people';
import { Sex } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

export class DoctorDto extends PersonDto {
  @ApiPropertyOptional({ enum: Sex, nullable: true })
  sex: Sex | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  bio: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  city: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  country: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  healthCentre: string | null;

  @ApiProperty({ description: 'Calls this doctor answered' })
  callCount: number;
}

@ApiTags('doctors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly prisma: PrismaService) {}

  /** A doctor's public profile, opened from a call's details. */
  @Get(':id')
  @ApiOkResponse({ type: DoctorDto })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<DoctorDto> {
    const doctor = await this.prisma.user.findFirst({
      where: { id, role: 'DOCTOR' },
      include: { ...personInclude, _count: { select: { doctorCalls: { where: { answeredAt: { not: null } } } } } },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    const profile = doctor.doctorProfile;
    return {
      ...toPersonDto(doctor),
      sex: doctor.sex,
      bio: profile?.bio ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      healthCentre: profile?.healthCentre ?? null,
      callCount: doctor._count.doctorCalls,
    };
  }
}
