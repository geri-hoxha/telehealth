import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import { accent, colors, radius, spacing } from '@/theme';
import { AppText, IconButton, type IconName } from './ui';

/** A promotion or article: a coloured header with its icon, then the text. */
export function ContentPage({
  icon,
  color,
  eyebrow,
  title,
  subtitle,
  body,
  footer,
}: {
  icon: string;
  color: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  body: string;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={accent(color)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.xxl + spacing.md }]}
        >
          <View style={[styles.bubble, styles.bubbleOne]} />
          <View style={[styles.bubble, styles.bubbleTwo]} />
          <View style={styles.icon}>
            <Ionicons name={icon as IconName} size={40} color={colors.white} />
          </View>
          {eyebrow ? (
            <AppText variant="overline" color="rgba(255,255,255,0.85)">
              {eyebrow}
            </AppText>
          ) : null}
          <AppText variant="display" color={colors.white}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="subhead" color="rgba(255,255,255,0.92)">
              {subtitle}
            </AppText>
          ) : null}
        </LinearGradient>
        <View style={styles.body}>
          {body.split('\n').map((paragraph, index) =>
            paragraph.trim() ? (
              <AppText key={index} variant="body" style={styles.paragraph} selectable>
                {paragraph}
              </AppText>
            ) : null,
          )}
          {footer}
        </View>
      </ScrollView>
      <IconButton
        icon="chevron-back"
        label={t('common.back')}
        variant="glass"
        size={40}
        onPress={() => router.back()}
        style={[styles.back, { top: insets.top + spacing.sm }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bubbleOne: {
    width: 260,
    height: 260,
    right: -80,
    top: -70,
  },
  bubbleTwo: {
    width: 160,
    height: 160,
    left: -60,
    bottom: -80,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  paragraph: {
    fontSize: 17,
    lineHeight: 27,
  },
  back: {
    position: 'absolute',
    left: spacing.md,
  },
});
