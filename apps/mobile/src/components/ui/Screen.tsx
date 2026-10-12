import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  header?: ReactNode;
  /** Scrolls the content (the default). Lists pass false and scroll themselves. */
  scroll?: boolean;
  /** Pull to refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Content stays above the keyboard (forms). */
  keyboard?: boolean;
  /** Pinned under the content, e.g. a form's main button. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  background?: string;
}

/** A screen: safe area, background, header, and scrolling content with the standard padding. */
export function Screen({
  children,
  header,
  scroll = true,
  onRefresh,
  refreshing = false,
  keyboard = false,
  footer,
  contentStyle,
  edges,
  background = colors.background,
}: ScreenProps) {
  // A footer button sits above the home indicator.
  const safeEdges: Edge[] = edges ?? (footer ? ['top', 'bottom'] : ['top']);
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {header}
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }]} edges={safeEdges}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
});
