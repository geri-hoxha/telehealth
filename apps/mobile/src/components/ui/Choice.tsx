import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme';
import { AppText, type IconName } from './AppText';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/** Two or three tabs in a pill, e.g. Upcoming / Past. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!selected) void Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            {option.icon ? (
              <Ionicons name={option.icon} size={16} color={selected ? colors.primaryDark : colors.textMuted} />
            ) : null}
            <AppText variant="caption" weight="700" color={selected ? colors.text : colors.textMuted} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Choose one of several options shown as chips (sex, policy type, category…). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** One scrolling row instead of wrapping. */
  scroll?: boolean;
}) {
  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          onChange(option.value);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
      >
        {option.icon ? <Ionicons name={option.icon} size={16} color={selected ? colors.white : colors.textSecondary} /> : null}
        <AppText variant="caption" weight="600" color={selected ? colors.white : colors.textSecondary}>
          {option.label}
        </AppText>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityRole="radiogroup">
        {chips}
      </ScrollView>
    );
  }
  return (
    <View style={styles.chipWrap} accessibilityRole="radiogroup">
      {chips}
    </View>
  );
}

/** A rounded search box. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear">
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 1–5 stars; read-only without `onChange`. */
export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (value: number) => void; size?: number }) {
  return (
    <View style={styles.stars} accessibilityRole={onChange ? 'adjustable' : 'text'} accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const icon = (
          <Ionicons name={star <= value ? 'star' : 'star-outline'} size={size} color={star <= value ? '#F59E0B' : colors.border} />
        );
        return onChange ? (
          <Pressable
            key={star}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(star);
            }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`${star}`}
          >
            {icon}
          </Pressable>
        ) : (
          <View key={star}>{icon}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md + 2,
    backgroundColor: colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md - 2,
  },
  segmentSelected: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.md + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
  },
});
