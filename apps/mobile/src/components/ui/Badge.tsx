import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';
import { AppText, type IconName } from './AppText';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'live';

const TONES: Record<BadgeTone, { background: string; foreground: string }> = {
  neutral: { background: colors.surfaceMuted, foreground: colors.textSecondary },
  primary: { background: colors.primarySoft, foreground: colors.primaryDark },
  success: { background: colors.successSoft, foreground: colors.success },
  warning: { background: colors.warningSoft, foreground: colors.warning },
  danger: { background: colors.dangerSoft, foreground: colors.danger },
  info: { background: colors.infoSoft, foreground: colors.info },
  live: { background: colors.danger, foreground: colors.white },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  /** A dot before the label, e.g. for "Live now". */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A small rounded status label. */
export function Badge({ label, tone = 'neutral', icon, dot, style }: BadgeProps) {
  const { background, foreground } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: foreground }]} /> : null}
      {icon ? <Ionicons name={icon} size={12} color={foreground} /> : null}
      <AppText variant="small" weight="700" color={foreground} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
