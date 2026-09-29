import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DevicePlatform, PushKind } from '../generated/prisma/enums';

export class RegisterDeviceDto {
  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ enum: PushKind, description: 'VOIP for an iOS PushKit token, FCM for an Android token' })
  @IsEnum(PushKind)
  kind: PushKind;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
