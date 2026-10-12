import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { StyleProp, ViewStyle } from 'react-native';
import { accent, colors } from '@/theme';
import type { IconName } from './AppText';

/** An icon on one of the content gradients, as content cards and stories show them. */
export function GradientIcon({
  icon,
  color,
  size = 44,
  rounded,
  style,
}: {
  icon: string;
  /** A key of the theme's `accents`. */
  color: string;
  size?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={accent(color)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: size, height: size, borderRadius: rounded ?? size * 0.32, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Ionicons name={icon as IconName} size={size * 0.5} color={colors.white} />
    </LinearGradient>
  );
}
