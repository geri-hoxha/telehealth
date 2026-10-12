import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type Ref } from 'react';
import { Pressable, type TextInput, type TextInputProps } from 'react-native';
import { useI18n } from '@/i18n';
import { colors } from '@/theme';
import { TextField } from './ui';

/** A password input with a show/hide button. */
export function PasswordField(props: TextInputProps & { label: string; error?: string; ref?: Ref<TextInput> }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      icon="lock-closed-outline"
      placeholder="••••••••"
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      accessory={
        <Pressable
          onPress={() => setVisible((value) => !value)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
        </Pressable>
      }
    />
  );
}
