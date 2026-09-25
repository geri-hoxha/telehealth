import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { UsersService } from '../users/users.service';
import { CallTokenDto } from './call-token.dto';

// Until call routing exists, everyone joins the same test room.
const TEST_ROOM = 'test-call';

@Injectable()
export class CallsService {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async createToken(userId: string): Promise<CallTokenDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const accessToken = new AccessToken(
      this.config.getOrThrow<string>('LIVEKIT_API_KEY'),
      this.config.getOrThrow<string>('LIVEKIT_API_SECRET'),
      { identity: user.id, name: `${user.firstName} ${user.lastName}` },
    );
    accessToken.addGrant({ room: TEST_ROOM, roomJoin: true, canPublish: true, canSubscribe: true });

    return {
      serverUrl: this.config.getOrThrow<string>('LIVEKIT_URL'),
      token: await accessToken.toJwt(),
    };
  }
}
