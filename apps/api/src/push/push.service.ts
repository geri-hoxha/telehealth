import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CallMedia } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApnsClient } from './apns.client';
import { FcmClient, type FcmServiceAccount } from './fcm.client';

/** Pushes contain only IDs: the phone fetches names from the API itself. */
export interface IncomingCallPush {
  callId: string;
  media: CallMedia;
}

/**
 * Wakes doctors' phones: a PushKit VoIP push on iOS (shown by CallKit) and a high-priority FCM
 * data message on Android (shown as a full-screen incoming-call notification).
 * Either channel is skipped with a warning when its credentials are not configured.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly apns?: ApnsClient;
  private readonly fcm?: FcmClient;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const keyPath = config.get<string>('APNS_KEY_PATH');
    const keyId = config.get<string>('APNS_KEY_ID');
    const teamId = config.get<string>('APNS_TEAM_ID');
    const bundleId = config.get<string>('APNS_BUNDLE_ID');
    if (keyPath && keyId && teamId && bundleId) {
      this.apns = new ApnsClient({
        keyId,
        teamId,
        bundleId,
        privateKey: readFileSync(keyPath, 'utf8'),
        production: config.get<string>('APNS_PRODUCTION') === 'true',
      });
    } else {
      this.logger.warn('APNs is not configured: iPhones will only ring while the app is open');
    }

    const serviceAccountPath = config.get<string>('FCM_SERVICE_ACCOUNT_PATH');
    if (serviceAccountPath) {
      this.fcm = new FcmClient(JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as FcmServiceAccount);
    } else {
      this.logger.warn('FCM is not configured: Android phones will only ring while the app is open');
    }
  }

  /** Rings every registered device of the user. Never throws. */
  async sendIncomingCall(userId: string, push: IncomingCallPush, ringSeconds: number): Promise<void> {
    await this.sendToUser(userId, { type: 'incoming_call', ...push }, ringSeconds, true);
  }

  /**
   * Stops the ringing on Android. iOS is not sent a VoIP push for this, because every VoIP push
   * must show a CallKit call; the phone checks the call's state itself while it rings.
   */
  async sendCallCancelled(userId: string, callId: string): Promise<void> {
    await this.sendToUser(userId, { type: 'call_cancelled', callId }, 60, false);
  }

  private async sendToUser(
    userId: string,
    data: Record<string, string>,
    ttlSeconds: number,
    includeVoip: boolean,
  ): Promise<void> {
    const devices = await this.prisma.device.findMany({ where: { userId } });

    await Promise.all(
      devices.map(async (device) => {
        try {
          if (device.kind === 'VOIP') {
            if (!includeVoip || !this.apns) return;
            const result = await this.apns.sendVoip(device.token, data, ttlSeconds);
            if (!result.ok) {
              this.logger.warn(`APNs rejected a push (${result.status} ${result.reason})`);
              if (result.status === 410 || result.reason === 'BadDeviceToken') {
                await this.removeDevice(device.id);
              }
            }
          } else {
            if (!this.fcm) return;
            const result = await this.fcm.sendData(device.token, data, ttlSeconds);
            if (!result.ok) {
              this.logger.warn(`FCM rejected a push (${result.status} ${result.reason})`);
              if (result.reason === 'UNREGISTERED' || result.status === 404) {
                await this.removeDevice(device.id);
              }
            }
          }
        } catch (error) {
          this.logger.error(`Push to device ${device.id} failed: ${String(error)}`);
        }
      }),
    );
  }

  private async removeDevice(id: string): Promise<void> {
    await this.prisma.device.deleteMany({ where: { id } });
  }
}
