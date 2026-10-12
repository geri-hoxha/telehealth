import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText, type IconName } from './AppText';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  /** Rendered inside the input on the right, e.g. a show/hide password button. */
  accessory?: ReactNode;
  ref?: Ref<TextInput>;
}

export function TextField({
  label,
  error,
  hint,
  icon,
  accessory,
  style,
  ref,
  multiline,
  onFocus,
  onBlur,
  editable = true,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="caption" weight="600" color={colors.textSecondary}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.inputRow,
          multiline && styles.multilineRow,
          focused && styles.focused,
          error ? styles.errorRow : null,
          !editable && styles.disabled,
        ]}
      >
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.multilineInput, style]}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          editable={editable}
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
        {accessory}
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 2,
  },
  multilineRow: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm + 2,
  },
  focused: {
    borderColor: colors.primary,
  },
  errorRow: {
    borderColor: colors.danger,
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
  },
  multilineInput: {
    minHeight: 84,
    paddingVertical: 2,
    textAlignVertical: 'top',
  },
});
