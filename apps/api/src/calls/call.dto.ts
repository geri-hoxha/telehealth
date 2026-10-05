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
}
