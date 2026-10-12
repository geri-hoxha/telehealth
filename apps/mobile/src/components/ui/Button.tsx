import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText, type IconName } from './AppText';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerSoft' | 'light';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretches to its container's width (the default for large buttons). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const BACKGROUND: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.primarySoft,
  outline: colors.surface,
  ghost: 'transparent',
  danger: colors.danger,
  dangerSoft: colors.dangerSoft,
  light: 'rgba(255, 255, 255, 0.18)',
};

const FOREGROUND: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.primaryDark,
  outline: colors.text,
  ghost: colors.primary,
  danger: colors.white,
  dangerSoft: colors.danger,
  light: colors.white,
};

const HEIGHT: Record<Size, number> = { lg: 54, md: 46, sm: 36 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  fullWidth = size === 'lg',
  style,
  accessibilityHint,
}: ButtonProps) {
  const foreground = FOREGROUND[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={() => {
        if (variant === 'primary' || variant === 'danger') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: BACKGROUND[variant],
          paddingHorizontal: size === 'sm' ? spacing.md - 4 : spacing.lg - 4,
          borderRadius: size === 'sm' ? radius.pill : radius.lg - 2,
        },
        variant === 'outline' && styles.outline,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={foreground} /> : null}
          <AppText variant={size === 'sm' ? 'caption' : 'subhead'} weight="700" color={foreground} numberOfLines={1}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
