import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TranslationKey } from '@/i18n';

/**
 * Biometric login: the API hands out a long-lived key that this phone keeps in the Keychain /
 * Keystore behind Face ID or a fingerprint (`requireAuthentication`), so reading it is the
 * biometric check. The email is stored separately, unprotected, to know whether to offer it.
 */
const EMAIL_KEY = 'biometric.email';
const SECRET_KEY = 'biometric.key';

export type BiometricKind = 'faceId' | 'touchId' | 'fingerprint' | 'face' | 'generic';

export async function biometricKind(): Promise<BiometricKind | null> {
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !enrolled || !SecureStore.canUseBiometricAuthentication()) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    if (Platform.OS === 'ios') return face ? 'faceId' : finger ? 'touchId' : 'generic';
    return finger ? 'fingerprint' : face ? 'face' : 'generic';
  } catch {
    return null;
  }
}

export const BIOMETRIC_LABEL: Record<BiometricKind, TranslationKey> = {
  faceId: 'biometric.faceId',
  touchId: 'biometric.touchId',
  fingerprint: 'biometric.fingerprint',
  face: 'biometric.face',
  generic: 'biometric.generic',
};

export const biometricStore = {
  /** The account biometric login is set up for on this phone, if any. */
  email: () => SecureStore.getItemAsync(EMAIL_KEY).catch(() => null),

  /** Saves the key behind biometrics. Android asks for the fingerprint here already. */
  save: async (email: string, key: string, prompt: string) => {
    await SecureStore.deleteItemAsync(SECRET_KEY).catch(() => {});
    await SecureStore.setItemAsync(SECRET_KEY, key, {
      requireAuthentication: true,
      authenticationPrompt: prompt,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  },

  /** Asks for Face ID / fingerprint. Null when cancelled or when the key is gone (biometrics changed). */
  read: async (prompt: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(SECRET_KEY, {
        requireAuthentication: true,
        authenticationPrompt: prompt,
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      return null;
    }
  },

  clear: async () => {
    await SecureStore.deleteItemAsync(SECRET_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(EMAIL_KEY).catch(() => {});
  },
};

/** A plain biometric check, e.g. before turning the feature on (iOS doesn't ask when saving). */
export async function confirmWithBiometrics(prompt: string, cancelLabel: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel, disableDeviceFallback: true });
  return result.success;
}
