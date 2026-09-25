import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioSession,
  LiveKitRoom,
  useConnectionState,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConnectionState, Track } from 'livekit-client';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callsApi } from '@/api/calls';
import { useAuth } from '@/auth/AuthProvider';
import { colors, radius, spacing } from '@/theme';

const BACKGROUND = '#0B1220';
const HANG_UP_RED = '#E5241B';

export default function CallScreen() {
  const { token } = useAuth();
  const [endMessage, setEndMessage] = useState<string | null>(null);

  const callToken = useQuery({
    queryKey: ['call-token'],
    queryFn: () => callsApi.createToken(token!),
    enabled: !!token,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  let content;
  if (callToken.isError || endMessage) {
    content = (
      <CallMessage text={endMessage ?? 'Nuk mund të fillojmë thirrjen. Provoni përsëri.'}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Kthehu</Text>
        </Pressable>
      </CallMessage>
    );
  } else if (!callToken.data) {
    content = <CallMessage text="Duke u lidhur..." loading />;
  } else {
    content = (
      <LiveKitRoom
        serverUrl={callToken.data.serverUrl}
        token={callToken.data.token}
        connect
        audio
        video
        onError={() => setEndMessage((current) => current ?? 'Thirrja nuk u lidh. Provoni përsëri.')}
        onDisconnected={() => setEndMessage((current) => current ?? 'Thirrja përfundoi.')}
      >
        <RoomView />
      </LiveKitRoom>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {content}
    </View>
  );
}

function RoomView() {
  const insets = useSafeAreaInsets();
  const connectionState = useConnectionState();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const localTrack = cameraTracks.find((track) => track.participant.isLocal);
  const remoteTrack = cameraTracks.find((track) => !track.participant.isLocal);

  return (
    <View style={styles.screen}>
      {remoteTrack ? (
        <VideoTrack trackRef={remoteTrack} style={StyleSheet.absoluteFill} objectFit="cover" zOrder={0} />
      ) : (
        <CallMessage
          text={
            connectionState === ConnectionState.Connected
              ? 'Në pritje të pjesëmarrësit tjetër...'
              : 'Duke u lidhur...'
          }
          loading
        />
      )}

      {localTrack ? (
        <VideoTrack
          trackRef={localTrack}
          style={{ ...styles.selfView, top: insets.top + spacing.md }}
          objectFit="cover"
          mirror
          zOrder={1}
        />
      ) : null}

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
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

function CallMessage({
  text,
  loading = false,
  children,
}: {
  text: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={styles.message}>
      {loading ? <ActivityIndicator color={colors.white} /> : null}
      <Text style={styles.messageText}>{text}</Text>
      {children}
    </View>
  );
}

const SELF_VIEW_WIDTH = 110;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  messageText: {
    fontSize: 16,
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
    alignItems: 'center',
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
