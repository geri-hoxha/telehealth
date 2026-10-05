import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CallMedia } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApnsClient } from './apns.client';
import { FcmClient, type FcmServiceAccount } from './fcm.client';

export interface IncomingCallPush {
  callId: string;
  /** The patient's user id. */
  callerId: string;
  media: CallMedia;
}

/**
 * What the ringing screen shows as the caller. Pushes carry only ids, so no patient names pass
 * through Apple or Google; the app shows the real name once the doctor opens the call.
 */
const CALLER_DISPLAY_NAME = 'Pacient';

/**
 * Wakes doctors' phones: a PushKit VoIP push on iOS (shown by CallKit) and a high-priority FCM
 * data message on Android (shown as a full-screen incoming-call notification). The app's
 * expo-callkit-telecom module reads both natively, so a closed app rings too.
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
      try {
        this.apns = new ApnsClient({
          keyId,
          teamId,
          bundleId,
          privateKey: readFileSync(keyPath, 'utf8'),
          production: config.get<string>('APNS_PRODUCTION') === 'true',
        });
      } catch (error) {
        this.logger.warn(`APNs key could not be read (${String(error)}): iPhones will only ring while the app is open`);
      }
    } else {
      this.logger.warn('APNs is not configured: iPhones will only ring while the app is open');
    }

    const serviceAccountPath = config.get<string>('FCM_SERVICE_ACCOUNT_PATH');
    if (serviceAccountPath) {
      try {
        this.fcm = new FcmClient(JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as FcmServiceAccount);
      } catch (error) {
        this.logger.warn(`FCM service account could not be read (${String(error)}): Android phones will only ring while the app is open`);
      }
    } else {
      this.logger.warn('FCM is not configured: Android phones will only ring while the app is open');
    }
  }

  /** Rings every registered device of the user. Never throws. */
  async sendIncomingCall(userId: string, push: IncomingCallPush, ringSeconds: number): Promise<void> {
    // The payload format expo-callkit-telecom parses (its IncomingCallEvent).
    const incomingCall = {
      eventId: push.callId, // One ring per call; Android drops a repeated push with the same id.
      serverCallId: push.callId,
      hasVideo: push.media === 'VIDEO',
      startedAt: new Date().toISOString(),
      caller: { id: push.callerId, displayName: CALLER_DISPLAY_NAME },
    };
    const devices = await this.prisma.device.findMany({ where: { userId } });

    await Promise.all(
      devices.map(async (device) => {
        try {
          if (device.kind === 'VOIP') {
            if (!this.apns) return;
            const result = await this.apns.sendVoip(device.token, { incomingCall }, ringSeconds);
            if (!result.ok) {
              this.logger.warn(`APNs rejected a push (${result.status} ${result.reason})`);
              if (result.status === 410 || result.reason === 'BadDeviceToken') {
                await this.removeDevice(device.id);
              }
            }
          } else {
            if (!this.fcm) return;
            // FCM data values must be strings.
            const data = { messageType: 'incomingCall', incomingCall: JSON.stringify(incomingCall) };
            const result = await this.fcm.sendData(device.token, data, ringSeconds);
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
