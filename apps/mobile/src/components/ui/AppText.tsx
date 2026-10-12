import type { ComponentProps } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, type TypographyVariant } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
}

/** Text in one of the theme's styles. */
export function AppText({ variant = 'body', color = colors.text, align, weight, style, ...props }: AppTextProps) {
  return (
    <Text
      {...props}
      style={[typography[variant], { color }, align ? { textAlign: align } : null, weight ? { fontWeight: weight } : null, style]}
    />
  );
}
