import { apiRequest } from './client';

export interface CallToken {
  serverUrl: string;
  token: string;
}

export const callsApi = {
  createToken: (token: string) => apiRequest<CallToken>('/calls/token', { method: 'POST', token }),
};
