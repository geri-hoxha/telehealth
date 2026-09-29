import type { CallMedia, PushToken } from '@modules/acs-calling';
import { apiRequest } from './client';

export type CallState = 'RINGING' | 'ACCEPTED' | 'ENDED' | 'DECLINED' | 'CANCELED' | 'UNANSWERED' | 'FAILED';

export interface Call {
  id: string;
  state: CallState;
  media: CallMedia;
  patient: { id: string; name: string };
  doctor: { id: string; name: string };
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}

/** What the app needs to join the call's ACS room. */
export interface CallJoin {
  roomId: string;
  acsUserId: string;
  token: string;
  expiresOn: string;
}

export interface CallWithJoin {
  call: Call;
  join: CallJoin;
}

export const callsApi = {
  /** Patient: call a doctor. */
  create: (token: string, media: CallMedia) =>
    apiRequest<CallWithJoin>('/calls', { method: 'POST', body: { media }, token }),

  get: (token: string, callId: string) => apiRequest<Call>(`/calls/${callId}`, { token }),

  /** Doctor: the call ringing for me right now, if any. */
  incoming: (token: string) => apiRequest<{ call: Call | null }>('/calls/incoming', { token }),

  accept: (token: string, callId: string) =>
    apiRequest<CallWithJoin>(`/calls/${callId}/accept`, { method: 'POST', token }),

  /** Either side: hang up (also cancels or declines a call that is still ringing). */
  end: (token: string, callId: string) => apiRequest<Call>(`/calls/${callId}/end`, { method: 'POST', token }),
};

export const devicesApi = {
  register: (token: string, device: PushToken) =>
    apiRequest<void>('/devices', { method: 'POST', body: device, token }),

  unregister: (token: string, device: PushToken) =>
    apiRequest<void>('/devices', { method: 'DELETE', body: device, token }),
};
