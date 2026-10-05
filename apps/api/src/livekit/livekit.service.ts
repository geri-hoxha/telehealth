import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, ServerError } from 'livekit-server-sdk';

/**
 * A token only has to be valid when joining; LiveKit refreshes it for connected participants.
 * Kept short because LiveKit recreates a deleted room for anyone who still holds a valid token.
 */
const TOKEN_TTL = '10m';

export interface LiveKitJoin {
  serverUrl: string;
  roomName: string;
  token: string;
}

interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Thin wrapper around LiveKit: join tokens for a room, and closing a room.
 * Works the same with LiveKit Cloud and a self-hosted server; only the env variables change.
 */
@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly config?: LiveKitConfig;
  private roomServiceClient?: RoomServiceClient;

  constructor(config: ConfigService) {
    const url = config.get<string>('LIVEKIT_URL');
    const apiKey = config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = config.get<string>('LIVEKIT_API_SECRET');
    if (url && apiKey && apiSecret) {
      this.config = { url, apiKey, apiSecret };
    }
  }

  /** Throws 503 when LiveKit isn't set up, so callers can check before doing anything else. */
  requireConfigured(): void {
    this.requireConfig();
  }

  /** Lets one user join one room with audio and video. Only holders of a token can join a room. */
  async createJoin(roomName: string, identity: string): Promise<LiveKitJoin> {
    const { url, apiKey, apiSecret } = this.requireConfig();
    const token = new AccessToken(apiKey, apiSecret, { identity, ttl: TOKEN_TTL });
    token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
    return { serverUrl: url, roomName, token: await token.toJwt() };
  }

  /** Deleting the room disconnects everyone in it. Failures are only logged. */
  async deleteRoom(roomName: string): Promise<void> {
    if (!this.config) return;
    try {
      await this.roomService(this.config).deleteRoom(roomName);
    } catch (error) {
      // Nobody ever joined, or LiveKit already closed the empty room.
      if (error instanceof ServerError && error.status === 404) return;
      this.logger.warn(`Could not delete LiveKit room ${roomName}: ${String(error)}`);
    }
  }

  private roomService({ url, apiKey, apiSecret }: LiveKitConfig): RoomServiceClient {
    this.roomServiceClient ??= new RoomServiceClient(url, apiKey, apiSecret);
    return this.roomServiceClient;
  }

  private requireConfig(): LiveKitConfig {
    if (!this.config) {
      throw new ServiceUnavailableException(
        'Calls are not configured (LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required)',
      );
    }
    return this.config;
  }
}
