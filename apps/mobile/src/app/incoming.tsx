import Ionicons from '@expo/vector-icons/Ionicons';
import { AcsCalling } from '@modules/acs-calling';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callsApi } from '@/api/calls';
import { useAuth } from '@/auth/AuthProvider';
import { colors, spacing } from '@/theme';

const BACKGROUND = '#0B1220';
const ANSWER_GREEN = '#1DB954';
const DECLINE_RED = '#E5241B';

/**
 * The app's own ringing screen (Android, and any time the app is opened on a ringing call).
 * iOS normally rings through CallKit instead.
 */
export default function IncomingCallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const call = useQuery({
    queryKey: ['call', callId],
    queryFn: () => callsApi.get(token!, callId),
    enabled: !!token && !!callId,
    refetchInterval: 2000,
    gcTime: 0,
  });

  // Stop ringing and close once the call is no longer ringing (cancelled, answered elsewhere, timed out).
  const state = call.data?.state;
  useEffect(() => {
    if (state && state !== 'RINGING') {
      void AcsCalling.dismissIncomingCall(callId);
      router.back();
    }
  }, [state, callId]);

  const answer = () => {
    void AcsCalling.dismissIncomingCall(callId);
    router.replace({
      pathname: '/call',
      params: { callId, media: call.data?.media ?? 'AUDIO', answer: '1' },
    });
  };

  const decline = () => {
    void AcsCalling.dismissIncomingCall(callId);
    if (token) void callsApi.end(token, callId).catch(() => {});
    router.back();
  };

  const isVideo = call.data?.media === 'VIDEO';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <StatusBar style="light" />
      <View style={styles.caller}>
        <Text style={styles.kind}>{isVideo ? 'Videothirrje hyrëse' : 'Thirrje hyrëse'}</Text>
        <Text style={styles.name}>{call.data?.patient.name ?? 'Pacient'}</Text>
      </View>

      <View style={styles.actions}>
        <RoundButton color={DECLINE_RED} icon="call" rotate label="Refuzo" onPress={decline} />
        <RoundButton color={ANSWER_GREEN} icon={isVideo ? 'videocam' : 'call'} label="Përgjigju" onPress={answer} />
      </View>
    </View>
  );
}

function RoundButton({
  color,
  icon,
  rotate = false,
  label,
  onPress,
}: {
  color: string;
  icon: 'call' | 'videocam';
  rotate?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.action}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.round, { backgroundColor: color }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={32} color={colors.white} style={rotate ? styles.rotated : undefined} />
      </Pressable>
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: BACKGROUND,
  },
  caller: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  kind: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.8,
  },
  name: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  action: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  round: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotated: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    fontSize: 15,
    color: colors.white,
  },
  pressed: {
    opacity: 0.8,
  },
});
