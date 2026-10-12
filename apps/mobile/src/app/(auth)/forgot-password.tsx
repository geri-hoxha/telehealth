import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { AuthLayout, FormError } from '@/components/AuthLayout';
import { CodeInput } from '@/components/CodeInput';
import { AppText, Button, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors } from '@/theme';

/** "Forgot password": email a 6-digit code, then check it before choosing a new password. */
export default function ForgotPasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { t } = useI18n();
  const showSnackbar = useSnackbar();
  const [step, setStep] = useState<'request' | 'code'>('request');
  const [code, setCode] = useState('');

  const send = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => {
      if (step === 'code') showSnackbar({ message: t('forgot.codeSent'), tone: 'success' });
      setStep('code');
      setCode('');
    },
  });

  const verify = useMutation({
    mutationFn: (value: string) => authApi.verifyResetCode(email, value),
    onSuccess: (_, value) => router.push({ pathname: '/reset-password', params: { email, code: value } }),
  });

  if (step === 'request') {
    return (
      <AuthLayout
        title={t('forgot.title')}
        subtitle={t('forgot.intro', { email })}
        footer={<Button label={t('forgot.sendCode')} icon="mail" onPress={() => send.mutate()} loading={send.isPending} />}
      >
        {send.isError ? <FormError message={errorMessage(send.error, t)} /> : null}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('forgot.codeTitle')}
      subtitle={t('forgot.codeIntro', { email })}
      footer={
        <Button
          label={t('common.continue')}
          onPress={() => verify.mutate(code)}
          loading={verify.isPending}
          disabled={code.length < 6}
        />
      }
    >
      <CodeInput
        value={code}
        onChange={(value) => {
          setCode(value);
          if (verify.isError) verify.reset();
          if (value.length === 6) verify.mutate(value);
        }}
        error={verify.isError}
        accessibilityLabel={t('forgot.codeTitle')}
      />
      {verify.isError ? <FormError message={errorMessage(verify.error, t)} /> : null}
      <Pressable onPress={() => send.mutate()} disabled={send.isPending} accessibilityRole="button" style={styles.resend} hitSlop={8}>
        <AppText variant="caption" weight="700" color={colors.primary}>
          {t('forgot.resendCode')}
        </AppText>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  resend: {
    alignSelf: 'center',
  },
});
