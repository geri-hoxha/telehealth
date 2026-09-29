import { apiRequest } from './client';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Patients call doctors; doctors receive the calls. */
  role: 'PATIENT' | 'DOCTOR';
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { username, password } }),

  me: (token: string) => apiRequest<User>('/auth/me', { token }),
};
