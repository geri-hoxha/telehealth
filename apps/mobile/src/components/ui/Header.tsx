import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '@/i18n';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface HeaderProps {
  title?: string;
  /** Tab roots: a large title on the left and no back button. */
  large?: boolean;
  /** Shown under a large title. */
  subtitle?: string;
  right?: ReactNode;
  /** 'close' for modals. */
  back?: 'back' | 'close' | false;
  onBack?: () => void;
  tone?: 'default' | 'light';
}

export function Header({ title, large = false, subtitle, right, back = large ? false : 'back', onBack, tone = 'default' }: HeaderProps) {
  const { t } = useI18n();
  const textColor = tone === 'light' ? colors.white : colors.text;
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  if (large) {
    return (
      <View style={styles.large}>
        <View style={styles.largeText}>
          {title ? (
            <AppText variant="title" color={textColor} accessibilityRole="header" numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText variant="caption" color={tone === 'light' ? 'rgba(255,255,255,0.8)' : colors.textMuted}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ? <View style={styles.actions}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {back ? (
          <IconButton
            icon={back === 'close' ? 'close' : 'chevron-back'}
            label={back === 'close' ? t('common.close') : t('common.back')}
            onPress={goBack}
            variant={tone === 'light' ? 'glass' : 'surface'}
            size={40}
          />
        ) : null}
      </View>
      <AppText variant="headline" color={textColor} numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title ?? ''}
      </AppText>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  side: {
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  largeText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
