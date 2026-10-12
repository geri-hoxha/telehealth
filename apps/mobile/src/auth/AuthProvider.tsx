import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authApi } from '@/api/auth';
import { ApiError, apiSession } from '@/api/client';
import type { AuthResponse, User } from '@/api/types';
import { tokenStorage } from './token-storage';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; token: string };

interface AuthContextValue {
  isLoading: boolean;
  user: User | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Starts a session from a biometric login the caller already completed. */
  signInWith: (response: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  /** After the profile changed (edit, photo). */
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const signOut = useCallback(async () => {
    apiSession.setToken(null);
    await tokenStorage.clear();
    setState({ status: 'signedOut' });
    queryClient.clear();
  }, [queryClient]);

  // Restore a saved session, keeping it only if the API still accepts the token.
  useEffect(() => {
    async function restoreSession() {
      const token = await tokenStorage.get();
      if (!token) {
        setState({ status: 'signedOut' });
        return;
      }
      try {
        const user = await authApi.me(token);
        apiSession.setToken(token);
        setState({ status: 'signedIn', user, token });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await tokenStorage.clear();
        }
        setState({ status: 'signedOut' });
      }
    }
    void restoreSession();
  }, []);

  // An expired token signs out instead of leaving every screen failing.
  useEffect(() => {
    apiSession.onExpired(() => void signOut());
    return () => apiSession.onExpired(null);
  }, [signOut]);

  const signInWith = useCallback(async ({ accessToken, user }: AuthResponse) => {
    await tokenStorage.set(accessToken);
    apiSession.setToken(accessToken);
    setState({ status: 'signedIn', user, token: accessToken });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: state.status === 'loading',
      user: state.status === 'signedIn' ? state.user : null,
      token: state.status === 'signedIn' ? state.token : null,
      signIn: async (email, password) => signInWith(await authApi.login(email, password)),
      signInWith,
      signOut,
      setUser: (user) => setState((current) => (current.status === 'signedIn' ? { ...current, user } : current)),
      refreshUser: async () => {
        const user = await authApi.me();
        setState((current) => (current.status === 'signedIn' ? { ...current, user } : current));
      },
    }),
    [state, signInWith, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

/**
 * The signed-in user on screens that only exist while signed in. Keeps the last user while
 * signing out, since those screens render once more before they are removed.
 */
export function useUser(): User {
  const { user } = useAuth();
  const lastUser = useRef(user);
  if (user) lastUser.current = user;
  if (!lastUser.current) throw new Error('useUser needs a signed-in user');
  return lastUser.current;
}
