import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CallMedia, CallState } from '../generated/prisma/enums';

export class CreateCallDto {
  @ApiProperty({ enum: CallMedia, example: CallMedia.VIDEO })
  @IsEnum(CallMedia)
  media: CallMedia;
}

export class CallPartyDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Geri Demo' })
  name: string;
}

export class CallDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: CallState })
  state: CallState;

  @ApiProperty({ enum: CallMedia })
  media: CallMedia;

  @ApiProperty({ type: CallPartyDto })
  patient: CallPartyDto;

  @ApiProperty({ type: CallPartyDto })
  doctor: CallPartyDto;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  answeredAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  endedAt: Date | null;
}

/** What the app needs to join the call's ACS room. */
export class CallJoinDto {
  @ApiProperty({ description: 'ACS room id' })
  roomId: string;

  @ApiProperty({ description: 'The caller’s ACS identity' })
  acsUserId: string;

  @ApiProperty({ description: 'ACS access token with the voip.join scope' })
  token: string;

  @ApiProperty()
  expiresOn: Date;
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
}
