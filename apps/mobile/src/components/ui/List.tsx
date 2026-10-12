import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme';
import { AppText, type IconName } from './AppText';

/** A white rounded group of rows with dividers between them, like iOS settings. */
export function ListGroup({ children, title, style }: { children: ReactNode; title?: string; style?: StyleProp<ViewStyle> }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={style}>
      {title ? (
        <AppText variant="overline" color={colors.textMuted} style={styles.groupTitle}>
          {title}
        </AppText>
      ) : null}
      <View style={styles.group}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  iconBackground?: string;
  /** Shown before the chevron, e.g. the current language. */
  value?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  disabled?: boolean;
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconColor = colors.primaryDark,
  iconBackground = colors.primaryTint,
  value,
  right,
  left,
  onPress,
  destructive,
  chevron = !!onPress,
  disabled,
}: ListRowProps) {
  const content = (
    <>
      {left}
      {icon ? (
        <View style={[styles.icon, { backgroundColor: destructive ? colors.dangerSoft : iconBackground }]}>
          <Ionicons name={icon} size={19} color={destructive ? colors.danger : iconColor} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="bodyStrong" color={destructive ? colors.danger : colors.text} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

/** A section title with an optional action on the right ("See all"). */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline" accessibilityRole="header" style={styles.sectionTitle} numberOfLines={1}>
        {title}
      </AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <AppText variant="caption" weight="700" color={colors.primary}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A label and its value, stacked, for detail screens. */
export function InfoItem({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  return (
    <View style={styles.info}>
      {icon ? <Ionicons name={icon} size={18} color={colors.primary} style={styles.infoIcon} /> : null}
      <View style={styles.text}>
        <AppText variant="small" color={colors.textMuted}>
          {label}
        </AppText>
        <AppText variant="bodyStrong" selectable>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    marginLeft: spacing.xs,
    marginBottom: spacing.sm,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 64,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 1,
  },
  value: {
    maxWidth: '40%',
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  info: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginTop: 2,
  },
});
