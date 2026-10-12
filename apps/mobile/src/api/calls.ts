import { apiRequest } from './client';
import type { Call, CallMedia, CallWithJoin, Person, PushDevice } from './types';

export interface CallOptions {
  /** Ring this doctor first when free ("Call now" after a free line). */
  preferredDoctorId?: string;
  /** A live event the patient joined: its specialist is rung first. */
  eventId?: string;
}

export const callsApi = {
  /** Patient: call a doctor. The call waits in the queue until a doctor answers. */
  create: (media: CallMedia, options: CallOptions = {}, token?: string) =>
    apiRequest<CallWithJoin>('/calls', { method: 'POST', body: { media, ...options }, token }),

  /** Newest first; `before` pages back. */
  history: (before?: string) =>
    apiRequest<Call[]>(`/calls${before ? `?before=${encodeURIComponent(before)}` : ''}`),

  get: (callId: string, token?: string) => apiRequest<Call>(`/calls/${callId}`, { token }),

  /** Doctor: the call ringing for me right now, if any, and this ring's id (the incoming call's eventId). */
  incoming: (token?: string) =>
    apiRequest<{ call: Call | null; ringId: string | null }>('/calls/incoming', { token }),

  /** Doctor: answer a call or an "Add doctor" invite. 409 once it no longer rings for me. */
  accept: (callId: string, token?: string) =>
    apiRequest<CallWithJoin>(`/calls/${callId}/accept`, { method: 'POST', token }),

  /** Doctor: reject while ringing; the call moves on to another doctor. */
  decline: (callId: string, token?: string) =>
    apiRequest<Call>(`/calls/${callId}/decline`, { method: 'POST', token }),

  /** Anyone: hang up (also cancels a waiting call). */
  end: (callId: string, token?: string) => apiRequest<Call>(`/calls/${callId}/end`, { method: 'POST', token }),

  availableDoctors: (query: string) =>
    apiRequest<Person[]>(`/calls/available-doctors?q=${encodeURIComponent(query)}`),

  invite: (callId: string, doctorId: string) =>
    apiRequest<Call>(`/calls/${callId}/invites`, { method: 'POST', body: { doctorId } }),

  feedback: (callId: string, rating: number, comment: string | null) =>
    apiRequest<Call>(`/calls/${callId}/feedback`, { method: 'POST', body: { rating, comment } }),

  freeLine: (callId: string) => apiRequest<void>(`/calls/${callId}/free-line`, { method: 'POST' }),
};

export const devicesApi = {
  register: (device: PushDevice, token?: string) =>
    apiRequest<void>('/devices', { method: 'POST', body: device, token }),

  unregister: (device: PushDevice, token?: string) =>
    apiRequest<void>('/devices', { method: 'DELETE', body: device, token }),
};
