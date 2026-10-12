import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { authApi } from '@/api/auth';
import { errorCode, errorMessage } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { useBiometricLogin } from '@/auth/useBiometricLogin';
import { AuthLayout, FormError } from '@/components/AuthLayout';
import { AppText, Avatar, Button, TextField, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

/** Onboarding step 2 for existing accounts: the password, or Face ID / fingerprint. */
export default function PasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { t } = useI18n();
  const { signIn } = useAuth();
  const showSnackbar = useSnackbar();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [missing, setMissing] = useState(false);
  const biometric = useBiometricLogin(email);
  const prompted = useRef(false);

  const login = useMutation({ mutationFn: () => signIn(email, password) });
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => showSnackbar({ message: t('auth.emailResent'), tone: 'success' }),
  });

  // Offer Face ID / fingerprint right away when it is set up for this account.
  const { available: biometricAvailable, login: biometricLogin } = biometric;
  useEffect(() => {
    if (biometricAvailable && !prompted.current) {
      prompted.current = true;
      void biometricLogin();
    }
  }, [biometricAvailable, biometricLogin]);

  const submit = () => {
    if (!password) {
      setMissing(true);
      return;
    }
    setMissing(false);
    login.mutate();
  };

  return (
    <AuthLayout
      title={t('auth.passwordTitle')}
      footer={
        <>
          <Button label={t('auth.login')} onPress={submit} loading={login.isPending} />
          {biometric.available ? (
            <Button
              label={t('auth.loginWith', { method: biometric.method })}
              icon={biometric.kind === 'faceId' || biometric.kind === 'face' ? 'scan' : 'finger-print'}
              variant="outline"
              onPress={() => void biometric.login()}
              loading={biometric.pending}
            />
          ) : null}
        </>
      }
    >
      <View style={styles.account}>
        <Avatar name={email} size={36} />
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {email}
        </AppText>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <AppText variant="caption" weight="700" color={colors.primary}>
            {t('auth.change')}
          </AppText>
        </Pressable>
      </View>

      <TextField
        label={t('auth.password')}
        icon="lock-closed-outline"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        error={missing ? t('auth.passwordRequired') : undefined}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        autoFocus={!biometric.available}
        accessory={
          <Pressable
            onPress={() => setVisible((value) => !value)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        }
      />

      {login.isError ? (
        <FormError message={errorMessage(login.error, t)}>
          {errorCode(login.error) === 'EMAIL_NOT_VERIFIED' ? (
            <Button
              label={t('auth.resendEmail')}
              variant="outline"
              size="sm"
              icon="mail"
              onPress={() => resend.mutate()}
              loading={resend.isPending}
              style={styles.inlineButton}
            />
          ) : null}
        </FormError>
      ) : null}
      {biometric.error ? <FormError message={errorMessage(biometric.error, t)} /> : null}

      <Pressable
        onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
        accessibilityRole="button"
        style={styles.forgot}
        hitSlop={8}
      >
        <AppText variant="caption" weight="700" color={colors.primary}>
          {t('auth.forgotPassword')}
        </AppText>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    padding: spacing.sm + 2,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  forgot: {
    alignSelf: 'flex-end',
  },
  inlineButton: {
    alignSelf: 'flex-start',
  },
});
