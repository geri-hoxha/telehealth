import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, hitSlop, radius } from '@/theme';
import { AppText, type IconName } from './AppText';

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  /** Read by screen readers. */
  label: string;
  variant?: 'surface' | 'tint' | 'plain' | 'glass';
  size?: number;
  color?: string;
  /** A small number in a red dot, e.g. unread notifications. */
  badge?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const BACKGROUND = {
  surface: colors.surface,
  tint: colors.primarySoft,
  plain: 'transparent',
  glass: 'rgba(255, 255, 255, 0.2)',
} as const;

export function IconButton({
  icon,
  onPress,
  label,
  variant = 'surface',
  size = 42,
  color,
  badge,
  disabled,
  style,
}: IconButtonProps) {
  const iconColor = color ?? (variant === 'tint' ? colors.primaryDark : variant === 'glass' ? colors.white : colors.text);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label} (${badge})` : label}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: BACKGROUND[variant] },
        variant === 'surface' && styles.surface,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={iconColor} />
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="small" weight="800" color={colors.white} style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
