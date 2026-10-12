import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { biometricStore } from '@/auth/biometrics';
import { AuthLayout, FormError } from '@/components/AuthLayout';
import { PasswordField } from '@/components/PasswordField';
import { Button, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';

/** The last "forgot password" step: a new password, then back to the password step. */
export default function ResetPasswordScreen() {
  const { email = '', code = '' } = useLocalSearchParams<{ email: string; code: string }>();
  const { t } = useI18n();
  const showSnackbar = useSnackbar();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const tooShort = password.length < 8;
  const mismatch = password !== confirm;

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword(email, code, password),
    onSuccess: async () => {
      // The API revoked biometric keys with the reset; forget ours too.
      if ((await biometricStore.email())?.toLowerCase() === email.toLowerCase()) await biometricStore.clear();
      showSnackbar({ message: t('forgot.done'), tone: 'success' });
      router.dismissTo({ pathname: '/password', params: { email } });
    },
  });

  const submit = () => {
    setSubmitted(true);
    if (!tooShort && !mismatch) reset.mutate();
  };

  return (
    <AuthLayout
      title={t('forgot.newPasswordTitle')}
      subtitle={t('forgot.newPasswordIntro')}
      footer={<Button label={t('forgot.savePassword')} onPress={submit} loading={reset.isPending} />}
    >
      <PasswordField
        label={t('forgot.newPassword')}
        value={password}
        onChangeText={setPassword}
        error={submitted && tooShort ? t('password.tooShort') : undefined}
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
      />
      <PasswordField
        label={t('forgot.confirmPassword')}
        value={confirm}
        onChangeText={setConfirm}
        error={submitted && mismatch ? t('password.mismatch') : undefined}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      {reset.isError ? <FormError message={errorMessage(reset.error, t)} /> : null}
    </AuthLayout>
  );
}
