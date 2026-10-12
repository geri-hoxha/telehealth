import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '@/theme';
import { AppText, type IconName } from './AppText';

export interface SnackbarMessage {
  message: string;
  /** A second line, e.g. a notification's body. */
  detail?: string;
  tone?: 'default' | 'success' | 'error';
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  /** Milliseconds; longer when there is an action. */
  duration?: number;
}

const SnackbarContext = createContext<((message: SnackbarMessage) => void) | null>(null);

const TONE_ICON: Record<NonNullable<SnackbarMessage['tone']>, { icon: IconName; color: string }> = {
  default: { icon: 'notifications', color: colors.primarySoft },
  success: { icon: 'checkmark-circle', color: '#86EFAC' },
  error: { icon: 'alert-circle', color: '#FDA4AF' },
};

/** Short messages at the bottom of the screen, with an optional action ("Show"). */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<SnackbarMessage | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setCurrent(null);
    });
  }, [progress]);

  const show = useCallback(
    (message: SnackbarMessage) => {
      clearTimeout(timer.current);
      setCurrent(message);
      progress.setValue(0);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(hide, message.duration ?? (message.action ? 6000 : 3500));
    },
    [progress, hide],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const tone = TONE_ICON[current?.tone ?? 'default'];

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {current ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrapper,
            { bottom: insets.bottom + 90 },
            {
              opacity: progress,
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          <Pressable onPress={hide} style={styles.snackbar} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Ionicons name={current.icon ?? tone.icon} size={22} color={tone.color} />
            <View style={styles.text}>
              <AppText variant="bodyStrong" color={colors.white} numberOfLines={2}>
                {current.message}
              </AppText>
              {current.detail ? (
                <AppText variant="caption" color="rgba(255,255,255,0.75)" numberOfLines={2}>
                  {current.detail}
                </AppText>
              ) : null}
            </View>
            {current.action ? (
              <Pressable
                onPress={() => {
                  hide();
                  current.action?.onPress();
                }}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.action}
              >
                <AppText variant="caption" weight="800" color={colors.primarySoft}>
                  {current.action.label.toUpperCase()}
                </AppText>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const show = useContext(SnackbarContext);
  if (!show) throw new Error('useSnackbar must be used inside <SnackbarProvider>');
  return show;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  snackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#13283A',
    ...shadows.raised,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  action: {
    paddingHorizontal: spacing.xs,
  },
});
