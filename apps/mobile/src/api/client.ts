import Constants from 'expo-constants';

const REQUEST_TIMEOUT_MS = 10_000;

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

export class ApiError extends Error {
  /** HTTP status code, or 0 when the server could not be reached. */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  } finally {
    clearTimeout(timeout);
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data ? String(data.message) : response.statusText;
    throw new ApiError(response.status, message);
  }
  return data as T;
}
