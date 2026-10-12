import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import { colors, radius, spacing } from '@/theme';
import { AppText, type IconName } from './AppText';

/** A panel that slides up from the bottom over a dimmed screen. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, { toValue: visible ? 1 : 0, duration: visible ? 260 : 200, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished && !visible) setMounted(false);
      },
    );
  }, [visible, progress]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + spacing.md },
          { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] },
        ]}
      >
        <View style={styles.handle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

export interface ActionSheetOption {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetRequest {
  title?: string;
  options: ActionSheetOption[];
}

const ActionSheetContext = createContext<((request: ActionSheetRequest) => void) | null>(null);

/** Lets any screen show a list of choices from the bottom (Alert allows only 3 buttons on Android). */
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [request, setRequest] = useState<ActionSheetRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const show = useCallback((next: ActionSheetRequest) => {
    setRequest(next);
    setVisible(true);
  }, []);

  const close = (then?: () => void) => {
    pending.current = then ?? null;
    setVisible(false);
    // Run the choice once the sheet is gone: pickers and alerts can't open over a closing modal on iOS.
    setTimeout(() => {
      pending.current?.();
      pending.current = null;
    }, 280);
  };

  return (
    <ActionSheetContext.Provider value={show}>
      {children}
      <Sheet visible={visible} onClose={() => close()}>
        {request?.title ? (
          <AppText variant="caption" color={colors.textMuted} align="center" style={styles.title}>
            {request.title}
          </AppText>
        ) : null}
        {request?.options.map((option) => (
          <Pressable
            key={option.label}
            onPress={() => close(option.onPress)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            {option.icon ? (
              <View style={[styles.optionIcon, option.destructive && styles.optionIconDanger]}>
                <Ionicons name={option.icon} size={20} color={option.destructive ? colors.danger : colors.primaryDark} />
              </View>
            ) : null}
            <AppText variant="subhead" color={option.destructive ? colors.danger : colors.text}>
              {option.label}
            </AppText>
          </Pressable>
        ))}
        <Pressable onPress={() => close()} accessibilityRole="button" style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}>
          <AppText variant="subhead" weight="700" color={colors.textSecondary}>
            {t('common.cancel')}
          </AppText>
        </Pressable>
      </Sheet>
    </ActionSheetContext.Provider>
  );
}

export function useActionSheet() {
  const show = useContext(ActionSheetContext);
  if (!show) throw new Error('useActionSheet must be used inside <ActionSheetProvider>');
  return show;
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  optionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  cancel: {
    marginTop: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
