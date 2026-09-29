import Ionicons from '@expo/vector-icons/Ionicons';
import { AcsVideoView, type CallMedia } from '@modules/acs-calling';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall, type CallPhase, type CallRequest } from '@/calls/useCall';
import { colors, radius, spacing } from '@/theme';

const BACKGROUND = '#0B1220';
const HANG_UP_RED = '#E5241B';
const CONTROL_BACKGROUND = 'rgba(255, 255, 255, 0.16)';

type Params = { media?: string; callId?: string; answer?: string };

/**
 * The call screen. Opened with `media` to call a doctor (patient), or with `callId` + `answer=1`
 * to answer a ringing call (doctor).
 */
export default function CallScreen() {
  const params = useLocalSearchParams<Params>();
  const media: CallMedia = params.media === 'VIDEO' ? 'VIDEO' : 'AUDIO';
  const request: CallRequest =
    params.answer && params.callId
      ? { kind: 'answer', callId: params.callId, media }
      : { kind: 'outgoing', media };

  const call = useCall(request);
  const insets = useSafeAreaInsets();
  const isVideo = call.media === 'VIDEO';

  if (call.phase === 'ended') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <Text style={styles.endText}>{call.endMessage}</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Kthehu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {call.remoteVideo ? (
        <AcsVideoView source="remote" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <View style={styles.avatar}>
            <Ionicons name={isVideo ? 'videocam' : 'person'} size={48} color={colors.white} />
          </View>
          <Text style={styles.name}>{call.otherParty ?? 'Mjeku'}</Text>
          <StatusLine phase={call.phase} connectedAt={call.connectedAt} />
        </View>
      )}

      {call.localVideo ? (
        <AcsVideoView source="local" style={[styles.selfView, { top: insets.top + spacing.md }]} />
      ) : null}

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        <ControlButton
          icon={call.muted ? 'mic-off' : 'mic'}
          label={call.muted ? 'Aktivizo mikrofonin' : 'Çaktivizo mikrofonin'}
          active={call.muted}
          onPress={call.controls.toggleMute}
        />
        {isVideo ? (
          <ControlButton
            icon={call.localVideo ? 'videocam' : 'videocam-off'}
            label={call.localVideo ? 'Fik kamerën' : 'Ndiz kamerën'}
            active={!call.localVideo}
            onPress={call.controls.toggleCamera}
          />
        ) : null}
        {call.localVideo ? (
          <ControlButton icon="camera-reverse" label="Ndërro kamerën" onPress={call.controls.switchCamera} />
        ) : null}
        <ControlButton
          icon={call.speakerOn ? 'volume-high' : 'volume-medium'}
          label={call.speakerOn ? 'Fik altoparlantin' : 'Ndiz altoparlantin'}
          active={call.speakerOn}
          onPress={call.controls.toggleSpeaker}
        />
        <Pressable
          onPress={call.controls.hangUp}
          style={({ pressed }) => [styles.hangUp, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Mbyll thirrjen"
        >
          <Ionicons name="call" size={30} color={colors.white} style={styles.hangUpIcon} />
        </Pressable>
      </View>
    </View>
  );
}

function StatusLine({ phase, connectedAt }: { phase: CallPhase; connectedAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!connectedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [connectedAt]);

  if (phase === 'inCall' && connectedAt) {
    const seconds = Math.max(0, Math.floor((now - connectedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    return <Text style={styles.status}>{`${minutes}:${String(seconds % 60).padStart(2, '0')}`}</Text>;
  }

  const text = phase === 'ringing' ? 'Duke thirrur...' : 'Duke u lidhur...';
  return (
    <View style={styles.statusRow}>
      <ActivityIndicator color={colors.white} />
      <Text style={styles.status}>{text}</Text>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.control, active && styles.controlActive, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={26} color={active ? BACKGROUND : colors.white} />
    </Pressable>
  );
}

const SELF_VIEW_WIDTH = 110;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CONTROL_BACKGROUND,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  status: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.85,
  },
  endText: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.white,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  selfView: {
    position: 'absolute',
    right: spacing.md,
    width: SELF_VIEW_WIDTH,
    height: SELF_VIEW_WIDTH * (16 / 9),
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  control: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CONTROL_BACKGROUND,
  },
  controlActive: {
    backgroundColor: colors.white,
  },
  hangUp: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HANG_UP_RED,
  },
  hangUpIcon: {
    transform: [{ rotate: '135deg' }],
  },
  pressed: {
    opacity: 0.8,
  },
});
