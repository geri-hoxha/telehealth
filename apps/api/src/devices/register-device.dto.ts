import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DevicePlatform, PushKind } from '../generated/prisma/enums';

export class RegisterDeviceDto {
  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ enum: PushKind, description: 'VOIP: an iOS PushKit token (calls). APNS: an iOS notification token. FCM: an Android token (both)' })
  @IsEnum(PushKind)
  kind: PushKind;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
