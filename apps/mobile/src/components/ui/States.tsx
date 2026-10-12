import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { errorMessage } from '@/api/errors';
import { useI18n } from '@/i18n';
import { colors, radius, spacing } from '@/theme';
import { AppText, type IconName } from './AppText';
import { Button } from './Button';

/** Nothing to show yet: an icon, a sentence, and maybe an action. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
  style,
}: {
  icon: IconName;
  title?: string;
  text: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.state, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      {title ? (
        <AppText variant="headline" align="center">
          {title}
        </AppText>
      ) : null}
      <AppText variant="body" color={colors.textMuted} align="center">
        {text}
      </AppText>
      {action && onAction ? <Button label={action} onPress={onAction} size="md" variant="secondary" /> : null}
    </View>
  );
}

/** A request failed: its message and a retry button. */
export function ErrorState({ error, onRetry, style }: { error: unknown; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n();
  return (
    <View style={[styles.state, style]}>
      <View style={[styles.iconCircle, styles.errorCircle]}>
        <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
      </View>
      <AppText variant="body" color={colors.textSecondary} align="center">
        {errorMessage(error, t)}
      </AppText>
      {onRetry ? <Button label={t('common.retry')} onPress={onRetry} size="md" variant="outline" icon="refresh" /> : null}
    </View>
  );
}

export function LoadingState({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.state, style]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

/** A grey placeholder block that pulses while content loads. */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.border, opacity }, style]} />;
}

/** A few card-shaped skeletons for lists. */
export function ListSkeleton({ count = 3, height = 84 }: { count?: number; height?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={height} rounded={radius.lg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md - 4,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorCircle: {
    backgroundColor: colors.dangerSoft,
  },
  list: {
    gap: spacing.md - 4,
  },
});
