import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { FormError } from '@/components/AuthLayout';
import { PasswordField } from '@/components/PasswordField';
import { Button, Header, Screen, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function ChangePasswordScreen() {
  const { t } = useI18n();
  const showSnackbar = useSnackbar();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: () => {
      showSnackbar({ message: t('changePassword.saved'), tone: 'success' });
      router.back();
    },
  });

  const submit = () => {
    setSubmitted(true);
    if (current && next.length >= 8 && next === confirm) change.mutate();
  };

  return (
    <Screen
      keyboard
      header={<Header title={t('changePassword.title')} />}
      footer={<Button label={t('common.save')} onPress={submit} loading={change.isPending} />}
    >
      <PasswordField
        label={t('changePassword.current')}
        value={current}
        onChangeText={setCurrent}
        autoComplete="current-password"
        textContentType="password"
        error={submitted && !current ? t('auth.passwordRequired') : undefined}
      />
      <PasswordField
        label={t('changePassword.new')}
        value={next}
        onChangeText={setNext}
        autoComplete="new-password"
        textContentType="newPassword"
        error={submitted && next.length < 8 ? t('password.tooShort') : undefined}
      />
      <PasswordField
        label={t('changePassword.confirm')}
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        textContentType="newPassword"
        error={submitted && next !== confirm ? t('password.mismatch') : undefined}
        onSubmitEditing={submit}
      />
      {change.isError ? <FormError message={errorMessage(change.error, t)} /> : null}
    </Screen>
  );
}
