import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import { colors, radius, spacing } from '@/theme';
import { BrandHero } from './BrandHero';
import { AppText } from './ui';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned at the bottom: the main button. */
  footer?: ReactNode;
  /** The first step shows the big logo and tagline; later steps a compact one with a back button. */
  variant?: 'hero' | 'step';
}

/** Onboarding screens: the brand gradient on top and a white sheet with the form. */
export function AuthLayout({ title, subtitle, children, footer, variant = 'step' }: AuthLayoutProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <BrandHero compact={variant === 'step'} tagline={variant === 'hero' ? t('auth.tagline') : undefined}>
          {variant === 'step' && router.canGoBack() ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              style={[styles.back, { top: insets.top + spacing.sm }]}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={colors.white} />
            </Pressable>
          ) : null}
        </BrandHero>
        <View style={styles.sheet}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" color={colors.textMuted}>
              {subtitle}
            </AppText>
          ) : null}
          <View style={styles.body}>{children}</View>
        </View>
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

/** A red box with an error message, and an optional action under it. */
export function FormError({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle" size={18} color={colors.danger} />
        <AppText variant="caption" color={colors.danger} style={styles.flex}>
          {message}
        </AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
  },
  back: {
    position: 'absolute',
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  sheet: {
    flex: 1,
    marginTop: -spacing.lg,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + 4,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  body: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  error: {
    gap: spacing.sm,
    padding: spacing.md - 4,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
