import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type ColorValue, type GestureResponderEvent } from 'react-native';
import { colors, gradients, shadows } from '@/theme';
import { AppText, type IconName } from './ui';

/** Options shared by both roles' tab bars. */
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
  sceneStyle: { backgroundColor: colors.background },
};

export function tabIcon(focusedIcon: IconName, icon: IconName) {
  return ({ color, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? focusedIcon : icon} size={24} color={color} />
  );
}

type TabBarButtonProps = { onPress?: ((event: GestureResponderEvent) => void) | null; accessibilityState?: { selected?: boolean } };

/** The patient's big round Call button in the middle of the tab bar. */
export function CallTabButton({ onPress, accessibilityState, label }: TabBarButtonProps & { label: string }) {
  const selected = !!accessibilityState?.selected;
  return (
    <Pressable
      onPress={(event) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.(event);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.callSlot}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.callRing, pressed && styles.pressed]}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.callButton}>
              <Ionicons name={selected ? 'call' : 'call-outline'} size={28} color={colors.white} />
            </LinearGradient>
          </View>
          <AppText variant="small" weight="700" color={selected ? colors.primary : colors.textMuted} style={styles.callLabel}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  callSlot: {
    flex: 1,
    alignItems: 'center',
  },
  callRing: {
    marginTop: -26,
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 5,
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  callButton: {
    flex: 1,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callLabel: {
    fontSize: 11,
    marginTop: 3,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
