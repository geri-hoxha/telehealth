import { useCallback, useEffect, useState } from 'react';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { useI18n } from '@/i18n';
import { useAuth } from './AuthProvider';
import { BIOMETRIC_LABEL, biometricKind, biometricStore, type BiometricKind } from './biometrics';

/**
 * Biometric login on onboarding screens: whether it is set up on this phone (for `email`, or for
 * any account when omitted) and a function that runs it.
 */
export function useBiometricLogin(email?: string) {
  const { t } = useI18n();
  const { signInWith } = useAuth();
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const [detected, stored] = await Promise.all([biometricKind(), biometricStore.email()]);
      setKind(detected);
      setSavedEmail(stored);
    })();
  }, []);

  const available = !!kind && !!savedEmail && (!email || savedEmail.toLowerCase() === email.toLowerCase());
  const method = kind ? t(BIOMETRIC_LABEL[kind]) : '';

  const login = useCallback(async () => {
    setError(null);
    const key = await biometricStore.read(t('auth.biometricPrompt'));
    if (!key) return; // Cancelled, or the key is gone because biometrics changed.
    setPending(true);
    try {
      await signInWith(await authApi.biometricLogin(key));
    } catch (loginError) {
      // A revoked key (e.g. after a password reset) won't work again.
      if (loginError instanceof ApiError && loginError.code === 'BIOMETRIC_KEY_INVALID') {
        await biometricStore.clear();
        setSavedEmail(null);
      }
      setError(loginError);
    } finally {
      setPending(false);
    }
  }, [signInWith, t]);

  return { available, method, kind, savedEmail, login, error, pending };
}
