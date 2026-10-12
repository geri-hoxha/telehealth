import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './ui';

/** A 6-digit code as six boxes, typed into one hidden input (so paste and SMS/email autofill work). */
export function CodeInput({
  value,
  onChange,
  length = 6,
  error = false,
  accessibilityLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  accessibilityLabel: string;
}) {
  const input = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.row} accessible={false}>
      {Array.from({ length }, (_, index) => {
        const digit = value[index];
        const active = index === Math.min(value.length, length - 1);
        return (
          <View key={index} style={[styles.box, active && styles.active, !!digit && styles.filled, error && styles.error]}>
            <AppText variant="title">{digit ?? ''}</AppText>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus
        style={styles.hidden}
        accessibilityLabel={accessibilityLabel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 56,
    borderRadius: radius.md + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    borderColor: colors.primary,
  },
  filled: {
    backgroundColor: colors.primaryTint,
  },
  error: {
    borderColor: colors.danger,
  },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
