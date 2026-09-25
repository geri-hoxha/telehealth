import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, type User } from '@/api/auth';
import { ApiError } from '@/api/client';
import { tokenStorage } from './token-storage';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; token: string };

interface AuthContextValue {
  isLoading: boolean;
  user: User | null;
  token: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

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

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading: state.status === 'loading',
      user: state.status === 'signedIn' ? state.user : null,
      token: state.status === 'signedIn' ? state.token : null,
      signIn: async (username, password) => {
        const { accessToken, user } = await authApi.login(username, password);
        await tokenStorage.set(accessToken);
        setState({ status: 'signedIn', user, token: accessToken });
      },
      signOut: async () => {
        await tokenStorage.clear();
        setState({ status: 'signedOut' });
      },
    }),
    [state],
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
