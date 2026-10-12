import Constants from 'expo-constants';
import { getLanguage } from '@/i18n';

const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * In development the API runs on the same computer as the Expo dev server, so we reuse
 * the dev server's host (e.g. "10.1.1.103:8081") to reach it from a phone on the same Wi-Fi.
 * Set EXPO_PUBLIC_API_URL to point somewhere else.
 */
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:3000`;
}

export const API_URL = resolveApiUrl();

/** The API returns paths like "/api/files/avatars/…"; images and web views need full URLs. */
export function apiUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}

export class ApiError extends Error {
  /** HTTP status code, or 0 when the server could not be reached. */
  readonly status: number;
  /** Stable error code from the API, e.g. NO_DOCTOR_AVAILABLE. */
  readonly code?: string;
  /** The whole error body, for extra fields such as the end of a block (`until`). */
  readonly details: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The signed-in session's token, set by AuthProvider, so screens don't pass it around. */
let sessionToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export const apiSession = {
  setToken: (token: string | null) => {
    sessionToken = token;
  },
  getToken: () => sessionToken,
  /** Called when the API rejects the session's token, e.g. after it expired. */
  onExpired: (handler: (() => void) | null) => {
    onSessionExpired = handler;
  },
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** JSON, or FormData for uploads. */
  body?: unknown;
  /** Overrides the session token (e.g. while signing in). */
  token?: string | null;
}

export async function apiRequest<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const isUpload = typeof FormData !== 'undefined' && body instanceof FormData;
  const authToken = token === undefined ? sessionToken : token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), isUpload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Accept-Language': getLanguage(),
        ...(isUpload ? {} : { 'Content-Type': 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : isUpload ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  } finally {
    clearTimeout(timeout);
  }

  // 204 responses have no body.
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const message = 'message' in details ? String(details.message) : response.statusText;
    const code = 'code' in details ? String(details.code) : undefined;
    if (response.status === 401 && authToken && authToken === sessionToken) {
      onSessionExpired?.();
    }
    throw new ApiError(response.status, message, code, details);
  }
  return data as T;
}

/** A file for a multipart upload: React Native's FormData takes {uri, name, type}. */
export function fileField(uri: string, name: string, type: string): Blob {
  return { uri, name, type } as unknown as Blob;
}
