import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationIdentityClient } from '@azure/communication-identity';
import { RoomsClient } from '@azure/communication-rooms';

/** Tokens only allow joining rooms the user was added to. */
const TOKEN_SCOPES = ['voip.join'] as const;
const TOKEN_LIFETIME_MINUTES = 60;
/** How long a call's room stays usable. Calls are deleted from ACS when they end. */
const ROOM_LIFETIME_MS = 3 * 60 * 60 * 1000;

export interface AcsJoinToken {
  acsUserId: string;
  token: string;
  expiresOn: Date;
}

/** Thin wrapper around the ACS identity and Rooms APIs. */
@Injectable()
export class AcsService {
  private readonly logger = new Logger(AcsService.name);
  private readonly connectionString: string | undefined;
  private identityClient?: CommunicationIdentityClient;
  private roomsClient?: RoomsClient;

  constructor(config: ConfigService) {
    this.connectionString = config.get<string>('ACS_CONNECTION_STRING') || undefined;
  }

  async createIdentity(): Promise<string> {
    const user = await this.identity().createUser();
    return user.communicationUserId;
  }

  async issueToken(acsUserId: string): Promise<AcsJoinToken> {
    const { token, expiresOn } = await this.identity().getToken(
      { communicationUserId: acsUserId },
      [...TOKEN_SCOPES],
      { tokenExpiresInMinutes: TOKEN_LIFETIME_MINUTES },
    );
    return { acsUserId, token, expiresOn };
  }

  /** Creates a room with only the given user in it. */
  async createRoom(acsUserId: string): Promise<string> {
    const now = Date.now();
    const room = await this.rooms().createRoom({
      validFrom: new Date(now),
      validUntil: new Date(now + ROOM_LIFETIME_MS),
      participants: [{ id: { communicationUserId: acsUserId }, role: 'Attendee' }],
    });
    return room.id;
  }

  async addToRoom(roomId: string, acsUserId: string): Promise<void> {
    await this.rooms().addOrUpdateParticipants(roomId, [
      { id: { communicationUserId: acsUserId }, role: 'Attendee' },
    ]);
  }

  /** Deleting the room removes everyone from it. Failures are only logged. */
  async deleteRoom(roomId: string): Promise<void> {
    try {
      await this.rooms().deleteRoom(roomId);
    } catch (error) {
      this.logger.warn(`Could not delete ACS room ${roomId}: ${String(error)}`);
    }
  }

  private identity(): CommunicationIdentityClient {
    this.identityClient ??= new CommunicationIdentityClient(this.requireConnectionString());
    return this.identityClient;
  }

  private rooms(): RoomsClient {
    this.roomsClient ??= new RoomsClient(this.requireConnectionString());
    return this.roomsClient;
  }

  private requireConnectionString(): string {
    if (!this.connectionString) {
      throw new ServiceUnavailableException('Calls are not configured (ACS_CONNECTION_STRING is missing)');
    }
    return this.connectionString;
  }
}
