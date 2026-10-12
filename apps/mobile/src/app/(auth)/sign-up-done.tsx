import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/api/auth';
import { AppText, Button, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

/** After sign-up: the account works once the link in the email is opened. */
export default function SignUpDoneScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => showSnackbar({ message: t('auth.emailResent'), tone: 'success' }),
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.center}>
        <View style={styles.halo}>
          <View style={styles.icon}>
            <Ionicons name="mail-open" size={44} color={colors.white} />
          </View>
        </View>
        <AppText variant="title" align="center">
          {t('signUpDone.title')}
        </AppText>
        <AppText variant="body" color={colors.textSecondary} align="center">
          {t('signUpDone.text', { email })}
        </AppText>
      </View>
      <View style={styles.actions}>
        {/* iOS can open the Mail inbox; Android has no common way to open "the" mail app. */}
        {Platform.OS === 'ios' ? (
          <Button label={t('signUpDone.openMail')} icon="mail" onPress={() => void Linking.openURL('message://').catch(() => {})} />
        ) : null}
        <Button
          label={t('signUpDone.toLogin')}
          variant={Platform.OS === 'ios' ? 'outline' : 'primary'}
          onPress={() => router.dismissTo({ pathname: '/password', params: { email } })}
        />
        <Button label={t('auth.resendEmail')} variant="ghost" onPress={() => resend.mutate()} loading={resend.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  halo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: radius.xl + 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
});
