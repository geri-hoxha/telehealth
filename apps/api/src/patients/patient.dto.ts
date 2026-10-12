import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { PersonDto } from '../common/people';
import { Sex } from '../generated/prisma/enums';

export class BlockPatientDto {
  @ApiProperty({ minimum: 1, maximum: 2160, example: 24, description: 'How long, in hours (at most 90 days)' })
  @IsInt()
  @Min(1)
  @Max(2160)
  durationHours: number;

  @ApiProperty({ maxLength: 500 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class PatientBlockDto {
  @ApiProperty()
  endsAt: Date;

  @ApiProperty()
  reason: string;
}

export class PatientPlanDto {
  @ApiProperty()
  planName: string;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;
}

export class PatientDto extends PersonDto {
  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  personalId: string | null;

  @ApiPropertyOptional({ enum: Sex, nullable: true })
  sex: Sex | null;

  @ApiProperty()
  folderCount: number;

  @ApiPropertyOptional({ type: PatientBlockDto, nullable: true, description: 'Set while the patient may not call' })
  block: PatientBlockDto | null;

  @ApiPropertyOptional({ type: PatientPlanDto, nullable: true, description: 'The active subscription' })
  plan: PatientPlanDto | null;
}
