import { apiRequest, fileField } from './client';
import type {
  AppConfig,
  AppNotification,
  Article,
  Benefit,
  Claim,
  Doctor,
  FolderComment,
  FolderDocument,
  HealthEvent,
  MedicalFolder,
  NewFolder,
  Patient,
  PolicyType,
  Story,
  Subscription,
  SubscriptionOverview,
  UnreadNotifications,
} from './types';

// Everything besides auth and calls: what the patient and doctor screens show and change.

export const subscriptionApi = {
  overview: () => apiRequest<SubscriptionOverview>('/subscription'),
  activateInsurance: (policyType: PolicyType, cardNumber: string) =>
    apiRequest<Subscription>('/subscription/insurance', { method: 'POST', body: { policyType, cardNumber } }),
  redeemPrepaid: (code: string) => apiRequest<Subscription>('/subscription/prepaid', { method: 'POST', body: { code } }),
  requestDemo: () => apiRequest<Subscription>('/subscription/demo', { method: 'POST' }),
  claims: () => apiRequest<Claim[]>('/claims'),
};

export const contentApi = {
  stories: () => apiRequest<Story[]>('/stories'),
  benefits: () => apiRequest<Benefit[]>('/benefits'),
  benefit: (id: string) => apiRequest<Benefit>(`/benefits/${id}`),
  articles: () => apiRequest<Article[]>('/articles'),
  article: (id: string) => apiRequest<Article>(`/articles/${id}`),
};

export const eventsApi = {
  list: (when: 'upcoming' | 'past') => apiRequest<HealthEvent[]>(`/events?when=${when}`),
  get: (id: string) => apiRequest<HealthEvent>(`/events/${id}`),
  join: (id: string) => apiRequest<HealthEvent>(`/events/${id}/participation`, { method: 'POST' }),
  leave: (id: string) => apiRequest<HealthEvent>(`/events/${id}/participation`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: () => apiRequest<AppNotification[]>('/notifications'),
  unread: () => apiRequest<UnreadNotifications>('/notifications/unread'),
  markAllRead: () => apiRequest<void>('/notifications/read-all', { method: 'POST' }),
  markRead: (id: string) => apiRequest<void>(`/notifications/${id}/read`, { method: 'POST' }),
};

export const foldersApi = {
  /** Patients: their own. Doctors: pass the patient. */
  list: (patientId?: string) =>
    apiRequest<MedicalFolder[]>(`/folders${patientId ? `?patientId=${patientId}` : ''}`),
  get: (id: string) => apiRequest<MedicalFolder>(`/folders/${id}`),
  create: (folder: NewFolder) => apiRequest<MedicalFolder>('/folders', { method: 'POST', body: folder }),
  comments: (id: string) => apiRequest<FolderComment[]>(`/folders/${id}/comments`),
  addComment: (id: string, body: string) =>
    apiRequest<FolderComment>(`/folders/${id}/comments`, { method: 'POST', body: { body } }),
  documents: (id: string) => apiRequest<FolderDocument[]>(`/folders/${id}/documents`),
  uploadDocument: (id: string, file: { uri: string; name: string; mimeType: string }) => {
    const form = new FormData();
    form.append('file', fileField(file.uri, file.name, file.mimeType));
    return apiRequest<FolderDocument>(`/folders/${id}/documents`, { method: 'POST', body: form });
  },
};

export const patientsApi = {
  list: (query: string) => apiRequest<Patient[]>(`/patients?q=${encodeURIComponent(query)}`),
  get: (id: string) => apiRequest<Patient>(`/patients/${id}`),
  block: (id: string, durationHours: number, reason: string) =>
    apiRequest<Patient>(`/patients/${id}/block`, { method: 'POST', body: { durationHours, reason } }),
  unblock: (id: string) => apiRequest<Patient>(`/patients/${id}/block`, { method: 'DELETE' }),
};

export const doctorsApi = {
  get: (id: string) => apiRequest<Doctor>(`/doctors/${id}`),
};

export const configApi = {
  get: () => apiRequest<AppConfig>('/config', { token: null }),
};
