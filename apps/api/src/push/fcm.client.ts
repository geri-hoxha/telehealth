import { createPrivateKey, sign, type KeyObject } from 'node:crypto';
import { base64url } from './apns.client';

/** The fields we use from a Firebase service account JSON file. */
export interface FcmServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export type FcmResult = { ok: true } | { ok: false; status: number; reason: string };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** Sends messages through the FCM HTTP v1 API. */
export class FcmClient {
  private readonly key: KeyObject;
  private accessToken?: { value: string; expiresAt: number };

  constructor(private readonly account: FcmServiceAccount) {
    this.key = createPrivateKey(account.private_key);
  }

  /** A data-only message, e.g. an incoming call that expo-callkit-telecom shows itself. */
  sendData(deviceToken: string, data: Record<string, string>, ttlSeconds: number): Promise<FcmResult> {
    return this.send({ token: deviceToken, data, android: { priority: 'high', ttl: `${ttlSeconds}s` } });
  }

  /** A notification the system shows when the app is in the background. */
  sendNotification(
    deviceToken: string,
    notification: { title: string; body: string },
    data: Record<string, string>,
    channelId: string,
  ): Promise<FcmResult> {
    return this.send({
      token: deviceToken,
      notification,
      data,
      android: { priority: 'high', notification: { channel_id: channelId } },
    });
  }

  private async send(message: object): Promise<FcmResult> {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${await this.getAccessToken()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ message }),
      },
    );
    if (response.ok) {
      return { ok: true };
    }
    const body = (await response.json().catch(() => null)) as {
      error?: { status?: string; details?: { errorCode?: string }[] };
    } | null;
    const reason =
      body?.error?.details?.find((detail) => detail.errorCode)?.errorCode ??
      body?.error?.status ??
      response.statusText;
    return { ok: false, status: response.status, reason };
  }

  /** Exchanges a signed service-account JWT for a short-lived OAuth access token. */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > now) {
      return this.accessToken.value;
    }

    const iat = Math.floor(now / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({ iss: this.account.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }),
    );
    const signature = sign('sha256', Buffer.from(`${header}.${claims}`), this.key);
    const assertion = `${header}.${claims}.${base64url(signature)}`;

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!response.ok) {
      throw new Error(`FCM auth failed: ${response.status} ${await response.text()}`);
    }
    const { access_token, expires_in } = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = { value: access_token, expiresAt: now + expires_in * 1000 };
    return access_token;
  }
}
