import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';
import { z } from 'zod';
import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import type { Sex } from '@/api/types';
import { AuthLayout, FormError } from '@/components/AuthLayout';
import { PasswordField } from '@/components/PasswordField';
import { AppText, Button, ChipGroup, TextField } from '@/components/ui';
import { useI18n, type TranslationKey } from '@/i18n';
import { colors, spacing } from '@/theme';

// Messages are translation keys, translated when shown.
const schema = z
  .object({
    firstName: z.string().trim().min(1, 'common.required'),
    lastName: z.string().trim().min(1, 'common.required'),
    phone: z.string().trim().regex(/^\+?[0-9 ]{6,20}$/, 'signUp.phoneInvalid'),
    personalId: z
      .string()
      .transform((value) => value.replace(/\s+/g, '').toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{6,20}$/, 'signUp.personalIdInvalid')),
    sex: z.enum(['MALE', 'FEMALE'], { message: 'common.required' }),
    password: z.string().min(8, 'password.tooShort'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password.mismatch',
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Patients sign themselves up; then they confirm their email before logging in. */
export default function SignUpScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { t } = useI18n();
  const lastName = useRef<TextInput>(null);
  const phone = useRef<TextInput>(null);
  const personalId = useRef<TextInput>(null);
  const confirm = useRef<TextInput>(null);

  const { control, handleSubmit } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '+355 ', personalId: '', sex: undefined, password: '', confirmPassword: '' },
  });

  const register = useMutation({
    mutationFn: ({ confirmPassword: _, ...values }: FormOutput) => authApi.register({ ...values, email }),
    onSuccess: () => router.replace({ pathname: '/sign-up-done', params: { email } }),
  });

  const message = (key?: string) => (key ? t(key as TranslationKey) : undefined);
  const submit = handleSubmit((values) => register.mutate(values));

  return (
    <AuthLayout
      title={t('signUp.title')}
      subtitle={t('signUp.intro', { email })}
      footer={
        <>
          <Button label={t('signUp.submit')} onPress={submit} loading={register.isPending} />
          <AppText variant="small" color={colors.textMuted} align="center">
            {t('signUp.terms')}
          </AppText>
        </>
      }
    >
      <AppText variant="overline" color={colors.textMuted}>
        {t('signUp.sectionPersonal')}
      </AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <TextField
                label={t('signUp.firstName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={message(fieldState.error?.message)}
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
                onSubmitEditing={() => lastName.current?.focus()}
              />
            )}
          />
        </View>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <TextField
                ref={lastName}
                label={t('signUp.lastName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={message(fieldState.error?.message)}
                autoComplete="family-name"
                textContentType="familyName"
                returnKeyType="next"
                onSubmitEditing={() => phone.current?.focus()}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <TextField
            ref={phone}
            label={t('signUp.phone')}
            icon="call-outline"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={message(fieldState.error?.message)}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="next"
            onSubmitEditing={() => personalId.current?.focus()}
          />
        )}
      />
      <Controller
        control={control}
        name="personalId"
        render={({ field, fieldState }) => (
          <TextField
            ref={personalId}
            label={t('signUp.personalId')}
            icon="card-outline"
            placeholder="J90101001A"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={message(fieldState.error?.message)}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        )}
      />
      <Controller
        control={control}
        name="sex"
        render={({ field, fieldState }) => (
          <View style={styles.field}>
            <AppText variant="caption" weight="600" color={colors.textSecondary}>
              {t('signUp.sex')}
            </AppText>
            <ChipGroup<Sex>
              options={[
                { value: 'FEMALE', label: t('sex.FEMALE'), icon: 'female' },
                { value: 'MALE', label: t('sex.MALE'), icon: 'male' },
              ]}
              value={field.value ?? null}
              onChange={field.onChange}
            />
            {fieldState.error ? (
              <AppText variant="small" color={colors.danger}>
                {message(fieldState.error.message)}
              </AppText>
            ) : null}
          </View>
        )}
      />

      <AppText variant="overline" color={colors.textMuted} style={styles.section}>
        {t('signUp.sectionSecurity')}
      </AppText>
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            label={t('signUp.password')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={message(fieldState.error?.message)}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirm.current?.focus()}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <PasswordField
            ref={confirm}
            label={t('signUp.confirmPassword')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={message(fieldState.error?.message)}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        )}
      />
      {register.isError ? <FormError message={errorMessage(register.error, t)} /> : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md - 4,
  },
  field: {
    gap: spacing.sm,
  },
  section: {
    marginTop: spacing.sm,
  },
});
