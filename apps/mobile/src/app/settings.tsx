import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import { authApi, profileApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { useAuth, useUser } from '@/auth/AuthProvider';
import { BIOMETRIC_LABEL, biometricKind, biometricStore, confirmWithBiometrics, type BiometricKind } from '@/auth/biometrics';
import { AppText, Header, ListGroup, ListRow, Screen, useSnackbar } from '@/components/ui';
import { LANGUAGES, useI18n, type Language } from '@/i18n';
import { colors } from '@/theme';

const API_LANGUAGE: Record<Language, 'SQ' | 'EN' | 'MK'> = { sq: 'SQ', en: 'EN', mk: 'MK' };

/** Language and biometric login. */
export default function SettingsScreen() {
  const user = useUser();
  const { setUser } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const showSnackbar = useSnackbar();
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [detected, email] = await Promise.all([biometricKind(), biometricStore.email()]);
      setKind(detected);
      setBiometricOn(!!email && email.toLowerCase() === user.email.toLowerCase());
    })();
  }, [user.email]);

  const changeLanguage = async (next: Language) => {
    if (next === language) return;
    await setLanguage(next);
    // Pushes and emails follow the account's language.
    profileApi
      .update({ language: API_LANGUAGE[next] })
      .then(setUser)
      .catch(() => {});
  };

  const method = kind ? t(BIOMETRIC_LABEL[kind]) : t('biometric.generic');

  const toggleBiometric = async (enable: boolean) => {
    setBusy(true);
    try {
      if (enable) {
        if (!(await confirmWithBiometrics(t('auth.biometricPrompt'), t('common.cancel')))) return;
        const { key } = await authApi.createBiometricKey();
        await biometricStore.save(user.email, key, t('auth.biometricPrompt'));
        setBiometricOn(true);
      } else {
        const key = await biometricStore.read(t('auth.biometricPrompt'));
        if (key) await authApi.revokeBiometricKey(key).catch(() => {});
        await biometricStore.clear();
        setBiometricOn(false);
      }
    } catch (error) {
      showSnackbar({ message: errorMessage(error, t), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<Header title={t('settings.title')} />}>
      <ListGroup title={t('settings.language')}>
        {LANGUAGES.map((option) => (
          <ListRow
            key={option.code}
            left={<AppText style={styles.flag}>{option.flag}</AppText>}
            title={option.name}
            onPress={() => void changeLanguage(option.code)}
            chevron={false}
            right={
              option.code === language ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : <View style={styles.empty} />
            }
          />
        ))}
      </ListGroup>

      <ListGroup title={t('settings.security')}>
        <ListRow
          icon={kind === 'faceId' || kind === 'face' ? 'scan' : 'finger-print'}
          title={t('settings.biometric', { method })}
          subtitle={kind ? t('settings.biometricHint') : t('settings.biometricUnavailable')}
          right={
            <Switch
              value={biometricOn}
              onValueChange={(value) => void toggleBiometric(value)}
              disabled={!kind || busy}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t('settings.biometric', { method })}
            />
          }
        />
      </ListGroup>

      <ListGroup title={t('settings.notifications')}>
        <ListRow
          icon="notifications-outline"
          title={t('settings.openSystemSettings')}
          subtitle={t('settings.notificationsHint')}
          onPress={() => void Linking.openSettings()}
        />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flag: {
    fontSize: 26,
    lineHeight: 32,
  },
  empty: {
    width: 24,
  },
});
