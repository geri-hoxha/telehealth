import { ApiProperty } from '@nestjs/swagger';

export class CallTokenDto {
  @ApiProperty({ example: 'wss://your-project.livekit.cloud' })
  serverUrl: string;

  @ApiProperty({ description: 'LiveKit access token for joining the room' })
  token: string;
}
