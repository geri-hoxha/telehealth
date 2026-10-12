import { createPrivateKey, sign, type KeyObject } from 'node:crypto';
import { connect } from 'node:http2';

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  /** Contents of the .p8 key file. */
  privateKey: string;
  production: boolean;
}

export type ApnsResult = { ok: true } | { ok: false; status: number; reason: string };

/** Apple accepts a provider token for up to an hour; refresh a bit earlier. */
const TOKEN_LIFETIME_MS = 50 * 60 * 1000;

/** Sends pushes over APNs' HTTP/2 API with token-based (.p8) authentication. */
export class ApnsClient {
  private readonly key: KeyObject;
  private providerToken?: { value: string; createdAt: number };

  constructor(private readonly config: ApnsConfig) {
    this.key = createPrivateKey(config.privateKey);
  }

  /** A VoIP push for CallKit (the ".voip" topic). */
  sendVoip(deviceToken: string, payload: object, expiresInSeconds: number): Promise<ApnsResult> {
    return this.send(deviceToken, payload, {
      pushType: 'voip',
      topic: `${this.config.bundleId}.voip`,
      expiresInSeconds,
    });
  }

  /** A regular notification with an `aps.alert`. */
  sendAlert(deviceToken: string, payload: object): Promise<ApnsResult> {
    return this.send(deviceToken, payload, {
      pushType: 'alert',
      topic: this.config.bundleId,
      expiresInSeconds: 24 * 60 * 60,
    });
  }

  private send(
    deviceToken: string,
    payload: object,
    { pushType, topic, expiresInSeconds }: { pushType: 'voip' | 'alert'; topic: string; expiresInSeconds: number },
  ): Promise<ApnsResult> {
    const host = this.config.production
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';

    return new Promise((resolve, reject) => {
      const session = connect(host);
      session.on('error', reject);

      const request = session.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        authorization: `bearer ${this.getProviderToken()}`,
        'apns-push-type': pushType,
        'apns-topic': topic,
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + expiresInSeconds),
        'content-type': 'application/json',
      });

      let status = 0;
      let body = '';
      request.setEncoding('utf8');
      request.on('response', (headers) => {
        status = Number(headers[':status']);
      });
      request.on('data', (chunk: string) => {
        body += chunk;
      });
      request.on('end', () => {
        session.close();
        if (status === 200) {
          resolve({ ok: true });
          return;
        }
        let reason = body;
        try {
          reason = (JSON.parse(body) as { reason?: string }).reason ?? body;
        } catch {
          // Keep the raw body.
        }
        resolve({ ok: false, status, reason });
      });
      request.on('error', (error) => {
        session.close();
        reject(error);
      });

      request.end(JSON.stringify(payload));
    });
  }

  private getProviderToken(): string {
    const now = Date.now();
    if (this.providerToken && now - this.providerToken.createdAt < TOKEN_LIFETIME_MS) {
      return this.providerToken.value;
    }

    const header = base64url(JSON.stringify({ alg: 'ES256', kid: this.config.keyId }));
    const claims = base64url(JSON.stringify({ iss: this.config.teamId, iat: Math.floor(now / 1000) }));
    const signature = sign('sha256', Buffer.from(`${header}.${claims}`), {
      key: this.key,
      dsaEncoding: 'ieee-p1363',
    });
    const value = `${header}.${claims}.${base64url(signature)}`;
    this.providerToken = { value, createdAt: now };
    return value;
  }
}

export function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}
