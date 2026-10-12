import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { useBiometricLogin } from '@/auth/useBiometricLogin';
import { AuthLayout, FormError } from '@/components/AuthLayout';
import { AppText, Button, TextField } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Onboarding step 1: the email decides between logging in and signing up. */
export default function WelcomeScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const biometric = useBiometricLogin();

  const check = useMutation({
    mutationFn: (value: string) => authApi.checkEmail(value),
    onSuccess: ({ exists }, value) => {
      router.push({ pathname: exists ? '/password' : '/sign-up', params: { email: value } });
    },
  });

  const submit = () => {
    const value = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    check.mutate(value);
  };

  return (
    <AuthLayout
      variant="hero"
      title={t('auth.welcome')}
      subtitle={t('auth.emailIntro')}
      footer={
        <>
          <Button label={t('common.continue')} icon="arrow-forward" onPress={submit} loading={check.isPending} />
          {biometric.available ? (
            <>
              <View style={styles.or}>
                <View style={styles.line} />
                <AppText variant="small" color={colors.textMuted}>
                  {t('auth.or')}
                </AppText>
                <View style={styles.line} />
              </View>
              <Button
                label={t('auth.loginWith', { method: biometric.method })}
                icon={biometric.kind === 'faceId' || biometric.kind === 'face' ? 'scan' : 'finger-print'}
                variant="outline"
                onPress={() => void biometric.login()}
                loading={biometric.pending}
              />
            </>
          ) : null}
        </>
      }
    >
      <TextField
        label={t('auth.email')}
        icon="mail-outline"
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (invalid) setInvalid(false);
        }}
        error={invalid ? t('auth.emailInvalid') : undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={submit}
      />
      {check.isError ? <FormError message={errorMessage(check.error, t)} /> : null}
      {biometric.error ? <FormError message={errorMessage(biometric.error, t)} /> : null}
      {biometric.available && biometric.savedEmail ? (
        <View style={styles.saved}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <AppText variant="caption" color={colors.textSecondary}>
            {biometric.savedEmail}
          </AppText>
        </View>
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  or: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    alignSelf: 'center',
  },
});
