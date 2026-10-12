import { apiRequest, fileField } from './client';
import type { AuthResponse, Sex, User } from './types';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  personalId: string;
  sex: Sex;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  sex?: Sex;
  language?: User['language'];
  bio?: string | null;
  licenceNumber?: string | null;
  country?: string | null;
  city?: string | null;
  healthCentre?: string | null;
}

export const authApi = {
  checkEmail: (email: string) =>
    apiRequest<{ exists: boolean }>('/auth/check-email', { method: 'POST', body: { email }, token: null }),

  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, token: null }),

  /** Patients only. No session until the email is confirmed. */
  register: (input: RegisterInput) =>
    apiRequest<{ email: string }>('/auth/register', { method: 'POST', body: input, token: null }),

  resendVerification: (email: string) =>
    apiRequest<void>('/auth/resend-verification', { method: 'POST', body: { email }, token: null }),

  forgotPassword: (email: string) =>
    apiRequest<void>('/auth/forgot-password', { method: 'POST', body: { email }, token: null }),

  verifyResetCode: (email: string, code: string) =>
    apiRequest<void>('/auth/verify-reset-code', { method: 'POST', body: { email, code }, token: null }),

  resetPassword: (email: string, code: string, newPassword: string) =>
    apiRequest<void>('/auth/reset-password', { method: 'POST', body: { email, code, newPassword }, token: null }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<void>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),

  /** A key this phone keeps behind Face ID / fingerprint. */
  createBiometricKey: () => apiRequest<{ key: string }>('/auth/biometric', { method: 'POST' }),

  revokeBiometricKey: (key: string) => apiRequest<void>('/auth/biometric', { method: 'DELETE', body: { key } }),

  biometricLogin: (key: string) =>
    apiRequest<AuthResponse>('/auth/biometric/login', { method: 'POST', body: { key }, token: null }),

  me: (token?: string) => apiRequest<User>('/auth/me', { token }),
};

export const profileApi = {
  update: (changes: ProfileUpdate) => apiRequest<User>('/me', { method: 'PATCH', body: changes }),

  uploadAvatar: (uri: string, mimeType = 'image/jpeg') => {
    const form = new FormData();
    const extension = mimeType.split('/')[1] ?? 'jpg';
    form.append('photo', fileField(uri, `photo.${extension}`, mimeType));
    return apiRequest<User>('/me/avatar', { method: 'POST', body: form });
  },

  removeAvatar: () => apiRequest<User>('/me/avatar', { method: 'DELETE' }),
};
