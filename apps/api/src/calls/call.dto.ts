import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PersonDto } from '../common/people';
import { CallMedia, CallState } from '../generated/prisma/enums';
import { PatientPlanDto } from '../patients/patient.dto';

export class CreateCallDto {
  @ApiProperty({ enum: CallMedia, example: CallMedia.VIDEO })
  @IsEnum(CallMedia)
  media: CallMedia;

  @ApiPropertyOptional({ format: 'uuid', description: 'Ring this doctor first when free ("Call now" after a free line)' })
  @IsOptional()
  @IsUUID()
  preferredDoctorId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "A live event the patient joined: rings its specialist first" })
  @IsOptional()
  @IsUUID()
  eventId?: string;
}

export class InviteDoctorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  doctorId: string;
}

export class CallFeedbackDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}

export class CallParticipantDto extends PersonDto {
  @ApiProperty({ enum: ['PATIENT', 'DOCTOR', 'ADDED_DOCTOR'] })
  role: 'PATIENT' | 'DOCTOR' | 'ADDED_DOCTOR';
}

export class CallDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: CallState })
  state: CallState;

  @ApiProperty({ enum: CallMedia })
  media: CallMedia;

  @ApiProperty({ type: PersonDto })
  patient: PersonDto;

  @ApiPropertyOptional({ type: PersonDto, nullable: true, description: 'The doctor ringing now or who answered' })
  doctor: PersonDto | null;

  @ApiProperty({ description: 'When the patient called' })
  createdAt: Date;

  @ApiPropertyOptional({ type: Date, nullable: true, description: "When the current doctor's phone started ringing" })
  ringingAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true, description: 'When a doctor answered' })
  answeredAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  endedAt: Date | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Seconds talked' })
  durationSeconds: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'QUEUED: patients waiting ahead' })
  queuePosition: number | null;

  @ApiProperty({ description: 'Doctors rung so far; more than one shows "Trying another line…"' })
  attemptCount: number;

  @ApiProperty({ description: "Whether the signed-in doctor's phone should be ringing for this call" })
  ringingForMe: boolean;

  @ApiProperty({ type: CallParticipantDto, isArray: true, description: 'Who took part (LiveKit identities are their ids)' })
  participants: CallParticipantDto[];

  @ApiPropertyOptional({ type: CallFeedbackDto, nullable: true })
  feedback: CallFeedbackDto | null;

  @ApiPropertyOptional({ type: PatientPlanDto, nullable: true, description: "Doctors only: the patient's plan" })
  patientPlan: PatientPlanDto | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  eventId: string | null;
}

/** What the app needs to join the call's LiveKit room. */
export class CallJoinDto {
  @ApiProperty({ example: 'wss://your-project.livekit.cloud' })
  serverUrl: string;

  @ApiProperty({ example: 'call-0199a1b2-…' })
  roomName: string;

  @ApiProperty({ description: 'LiveKit access token for this room only' })
  token: string;
}

export class CallWithJoinDto {
  @ApiProperty({ type: CallDto })
  call: CallDto;

  @ApiProperty({ type: CallJoinDto })
  join: CallJoinDto;
}

export class IncomingCallDto {
  @ApiPropertyOptional({ type: CallDto, nullable: true })
  call: CallDto | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "This ring's id (an attempt or an added-doctor invite): the incoming call's eventId",
  })
  ringId: string | null;
}
