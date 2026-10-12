import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, spacing } from '@/theme';
import { AppText } from './ui';

/** The gradient top of onboarding screens: logo, app name and a line under it. */
export function BrandHero({ tagline, compact = false, children }: { tagline?: string; compact?: boolean; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + (compact ? spacing.md : spacing.xl) }, compact && styles.compact]}
    >
      <View style={[styles.bubble, styles.bubbleOne]} />
      <View style={[styles.bubble, styles.bubbleTwo]} />
      {children}
      <View style={[styles.logo, compact && styles.logoCompact]}>
        <Ionicons name="medical" size={compact ? 26 : 36} color={colors.primary} />
      </View>
      <AppText variant={compact ? 'headline' : 'display'} color={colors.white}>
        Telehealth
      </AppText>
      {tagline ? (
        <AppText variant="body" color="rgba(255,255,255,0.88)" align="center">
          {tagline}
        </AppText>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + spacing.md,
    overflow: 'hidden',
  },
  compact: {
    paddingBottom: spacing.xl + spacing.md,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    transform: [{ rotate: '-6deg' }],
  },
  logoCompact: {
    width: 56,
    height: 56,
    borderRadius: 20,
  },
  bubble: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bubbleOne: {
    width: 260,
    height: 260,
    top: -120,
    right: -80,
  },
  bubbleTwo: {
    width: 180,
    height: 180,
    bottom: -90,
    left: -50,
  },
});
