import Ionicons from '@expo/vector-icons/Ionicons';
import {
  RoomContext,
  useIsSpeaking,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  VideoTrack,
  type TrackReference,
} from '@livekit/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Track, type Participant } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CallMedia, Call } from '@/api/types';
import { useUser } from '@/auth/AuthProvider';
import { useCall, type CallPhase, type CallRequest, type EndReason } from '@/calls/useCall';
import { FeedbackForm } from '@/components/FeedbackForm';
import { AppText, Avatar, Button, type IconName } from '@/components/ui';
import { useI18n, type TranslationKey } from '@/i18n';
import { formatClock, formatDateTime, formatDuration } from '@/i18n/format';
import { colors, gradients, radius, spacing } from '@/theme';

type Params = {
  media?: string;
  callId?: string;
  sessionId?: string;
  requestId?: string;
  preferredDoctorId?: string;
  eventId?: string;
};

type ActiveCall = ReturnType<typeof useCall>;

/**
 * The call screen. Opened with `media` to call a doctor (patient, optionally with
 * `preferredDoctorId` or `eventId`), or with `callId`, `sessionId` and `requestId` after a doctor
 * answered on the phone's call screen or the in-app invitation.
 */
export default function CallScreen() {
  const params = useLocalSearchParams<Params>();
  const media: CallMedia = params.media === 'AUDIO' ? 'AUDIO' : 'VIDEO';
  const request: CallRequest =
    params.callId && params.sessionId && params.requestId
      ? { kind: 'answer', callId: params.callId, media, sessionId: params.sessionId, requestId: params.requestId }
      : { kind: 'outgoing', media, preferredDoctorId: params.preferredDoctorId, eventId: params.eventId };

  const call = useCall(request);

  return (
    <LinearGradient colors={gradients.call} style={styles.screen}>
      <StatusBar style="light" />
      {call.phase === 'ended' ? (
        <EndedView call={call} retryParams={request.kind === 'outgoing' ? params : null} />
      ) : (
        <RoomContext.Provider value={call.room}>
          {call.phase === 'inCall' ? <InCallView call={call} /> : <WaitingView call={call} />}
        </RoomContext.Provider>
      )}
    </LinearGradient>
  );
}

// --- waiting: queued, ringing, connecting ---

function waitingText(phase: CallPhase, call: Call | null, t: ReturnType<typeof useI18n>['t'], tp: ReturnType<typeof useI18n>['tp']) {
  if (phase === 'starting') return t('call.starting');
  if (phase === 'connecting') return t('call.connecting');
  if (phase === 'ringing') return (call?.attemptCount ?? 0) > 1 ? t('call.tryingAnotherLine') : t('call.calling');
  // Waiting in the queue.
  if ((call?.attemptCount ?? 0) > 0) return t('call.tryingAnotherLine');
  const ahead = call?.queuePosition ?? 0;
  return ahead > 0 ? tp('call.peopleAhead', ahead) : t('call.youAreNext');
}

function WaitingView({ call }: { call: ActiveCall }) {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const { t, tp } = useI18n();
  const isPatient = user.role === 'PATIENT';
  // Patients see the service until a doctor answers; doctors see the patient.
  const person = isPatient ? (call.phase === 'connecting' ? call.call?.doctor : null) : call.call?.patient;
  const title = person ? person.name : isPatient ? t('call.waitingTitle') : t('call.doctor');
  const status = waitingText(call.phase, call.call, t, tp);

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <SelfView call={call} />
      <View style={styles.waitingCenter}>
        <PulsingRings active={call.phase !== 'connecting'}>
          {person ? (
            <Avatar name={person.name} url={person.avatarUrl} size={120} ring />
          ) : (
            <View style={styles.serviceIcon}>
              <Ionicons name="medical" size={52} color={colors.white} />
            </View>
          )}
        </PulsingRings>
        <AppText variant="title" color={colors.white} align="center">
          {title}
        </AppText>
        <View style={styles.statusPill} accessibilityLiveRegion="polite">
          {call.call?.state === 'QUEUED' && (call.call.queuePosition ?? 0) > 0 ? (
            <Ionicons name="people" size={16} color={colors.primarySoft} />
          ) : (
            <Ionicons name={call.media === 'VIDEO' ? 'videocam' : 'call'} size={16} color={colors.primarySoft} />
          )}
          <AppText variant="subhead" color={colors.white}>
            {status}
          </AppText>
        </View>
        {isPatient && (call.phase === 'waiting' || call.phase === 'ringing') ? (
          <AppText variant="caption" color="rgba(255,255,255,0.6)" align="center" style={styles.hint}>
            {t('call.waitingHint')}
          </AppText>
        ) : null}
      </View>
      <Controls call={call} waiting />
    </View>
  );
}

/** Rings growing out of the avatar while the phone rings. */
function PulsingRings({ children, active }: { children: React.ReactNode; active: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse, active]);

  const ring = (offset: number) => {
    const value = pulse.interpolate({ inputRange: [0, 1], outputRange: [offset, offset + 1] });
    const wrapped = Animated.modulo(value, 1);
    return {
      opacity: wrapped.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
      transform: [{ scale: wrapped.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
    };
  };

  return (
    <View style={styles.rings}>
      {active ? (
        <>
          <Animated.View style={[styles.ring, ring(0)]} />
          <Animated.View style={[styles.ring, ring(0.33)]} />
          <Animated.View style={[styles.ring, ring(0.66)]} />
        </>
      ) : null}
      {children}
    </View>
  );
}

// --- in the call ---

function useParticipantName(call: ActiveCall) {
  const { t } = useI18n();
  return (identity: string) => {
    const participant = call.call?.participants.find((item) => item.id === identity);
    if (!participant) return t('call.doctor');
    return participant.role === 'PATIENT' ? participant.name : `${t('common.doctorPrefix')} ${participant.name}`;
  };
}

function InCallView({ call }: { call: ActiveCall }) {
  const insets = useSafeAreaInsets();
  const remotes = useRemoteParticipants();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const nameOf = useParticipantName(call);
  const findTrack = (participant: Participant) =>
    cameraTracks.find((track) => track.participant.identity === participant.identity && !track.publication.isMuted) as
      | TrackReference
      | undefined;

  return (
    <View style={styles.flex}>
      <View style={styles.tiles}>
        {remotes.length === 0 ? (
          <View style={[styles.flex, styles.center]}>
            <AppText variant="subhead" color="rgba(255,255,255,0.7)">
              …
            </AppText>
          </View>
        ) : (
          remotes.map((participant) => (
            <ParticipantTile
              key={participant.identity}
              participant={participant}
              track={findTrack(participant)}
              name={nameOf(participant.identity)}
              avatarUrl={call.call?.participants.find((item) => item.id === participant.identity)?.avatarUrl ?? null}
              compact={remotes.length > 1}
            />
          ))
        )}
      </View>

      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={[styles.topShade, { paddingTop: insets.top + spacing.sm }]}>
        <CallTimer connectedAt={call.connectedAt} />
      </LinearGradient>

      <SelfView call={call} />

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={[styles.bottomShade, { paddingBottom: insets.bottom + spacing.md }]}>
        <Controls call={call} />
      </LinearGradient>
    </View>
  );
}

function ParticipantTile({
  participant,
  track,
  name,
  avatarUrl,
  compact,
}: {
  participant: Participant;
  track?: TrackReference;
  name: string;
  avatarUrl: string | null;
  compact: boolean;
}) {
  const speaking = useIsSpeaking(participant);
  return (
    <View style={[styles.tile, compact && styles.tileCompact, speaking && compact && styles.tileSpeaking]}>
      {track ? (
        <VideoTrack trackRef={track} style={StyleSheet.absoluteFill} objectFit="cover" zOrder={0} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <View style={[styles.avatarHalo, speaking && styles.avatarHaloSpeaking]}>
            <Avatar name={name} url={avatarUrl} size={compact ? 84 : 124} />
          </View>
        </View>
      )}
      <View style={[styles.nameTag, compact ? styles.nameTagCompact : null]}>
        {participant.isMicrophoneEnabled ? null : <Ionicons name="mic-off" size={14} color={colors.white} />}
        <AppText variant="caption" weight="700" color={colors.white} numberOfLines={1}>
          {name}
        </AppText>
      </View>
    </View>
  );
}

function CallTimer({ connectedAt }: { connectedAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!connectedAt) return null;
  return (
    <View style={styles.timer}>
      <View style={styles.recDot} />
      <AppText variant="subhead" color={colors.white} style={styles.tabular}>
        {formatClock((now - connectedAt) / 1000)}
      </AppText>
    </View>
  );
}

/** This phone's camera, small in a corner. */
function SelfView({ call }: { call: ActiveCall }) {
  const insets = useSafeAreaInsets();
  const { isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const local = tracks.find((track) => track.participant.isLocal) as TrackReference | undefined;
  if (call.media !== 'VIDEO' || !local || !isCameraEnabled) return null;
  return (
    <View style={[styles.selfView, { top: insets.top + spacing.xl + spacing.md }]}>
      <VideoTrack trackRef={local} style={StyleSheet.absoluteFill} objectFit="cover" mirror={call.frontCamera} zOrder={1} />
    </View>
  );
}

function Controls({ call, waiting = false }: { call: ActiveCall; waiting?: boolean }) {
  const { t } = useI18n();
  const { isCameraEnabled } = useLocalParticipant();
  const isVideo = call.media === 'VIDEO';
  return (
    <View style={styles.controls}>
      <View style={styles.controlRow}>
        <ControlButton icon={call.muted ? 'mic-off' : 'mic'} label={t('call.mic')} active={call.muted} onPress={call.controls.toggleMute} />
        {isVideo ? (
          <ControlButton
            icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
            label={t('call.camera')}
            active={!isCameraEnabled}
            onPress={() => void call.controls.toggleCamera()}
          />
        ) : null}
        {isVideo && isCameraEnabled ? (
          <ControlButton icon="camera-reverse" label={t('call.flip')} onPress={() => void call.controls.switchCamera()} />
        ) : null}
        <ControlButton
          icon={call.speakerOn ? 'volume-high' : 'volume-medium'}
          label={t('call.speaker')}
          active={call.speakerOn}
          onPress={call.controls.toggleSpeaker}
        />
        {call.canAddDoctor && !waiting ? (
          <ControlButton
            icon="person-add"
            label={t('call.addDoctor')}
            onPress={() => router.push({ pathname: '/add-doctor', params: { callId: call.call?.id ?? '' } })}
          />
        ) : null}
      </View>
      <Pressable
        onPress={call.controls.hangUp}
        style={({ pressed }) => [styles.hangUp, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={waiting ? t('call.cancel') : t('call.end')}
      >
        <Ionicons name="call" size={32} color={colors.white} style={styles.hangUpIcon} />
      </Pressable>
    </View>
  );
}

function ControlButton({ icon, label, active = false, onPress }: { icon: IconName; label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} style={styles.controlItem}>
      {({ pressed }) => (
        <>
          <View style={[styles.control, active && styles.controlActive, pressed && styles.pressed]}>
            <Ionicons name={icon} size={24} color={active ? colors.callBackground : colors.white} />
          </View>
          <AppText variant="small" color="rgba(255,255,255,0.85)" numberOfLines={1}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

// --- over ---

const END_TEXT: Record<EndReason, TranslationKey> = {
  ended: 'call.endReason.ended',
  canceled: 'call.endReason.canceled',
  linesBusy: 'call.linesBusyText',
  failed: 'call.endReason.failed',
  permissions: 'call.endReason.permissions',
  alreadyActive: 'call.endReason.alreadyActive',
  conflict: 'call.endReason.conflict',
  subscription: 'call.endReason.subscription',
  blocked: 'call.endReason.blocked',
  eventNotLive: 'call.endReason.eventNotLive',
  network: 'call.endReason.network',
};

const END_ICON: Partial<Record<EndReason, IconName>> = {
  linesBusy: 'people',
  subscription: 'shield-outline',
  blocked: 'ban',
  permissions: 'mic-off',
  network: 'cloud-offline',
  failed: 'alert-circle',
};

function EndedView({ call, retryParams }: { call: ActiveCall; retryParams: Params | null }) {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const { t, language } = useI18n();
  const [rated, setRated] = useState(false);
  const reason = call.endReason ?? 'ended';
  const record = call.call;
  const talked = !!record?.answeredAt && reason === 'ended';
  const canRate = user.role === 'PATIENT' && talked && !!record && !record.feedback && !rated;
  const canRetry = !!retryParams && ['linesBusy', 'failed', 'network', 'canceled'].includes(reason);
  const duration =
    record?.durationSeconds ?? (call.connectedAt ? Math.round((Date.now() - call.connectedAt) / 1000) : null);
  const message =
    reason === 'blocked' && call.blockedUntil
      ? t('call.endReason.blocked', { date: formatDateTime(call.blockedUntil, language) })
      : t(END_TEXT[reason]);

  const retry = () => router.replace({ pathname: '/call', params: retryParams ?? {} });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.ended, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.endedTop}>
          <View style={[styles.endedIcon, reason === 'linesBusy' && styles.endedIconBusy]}>
            <Ionicons name={END_ICON[reason] ?? 'call'} size={40} color={colors.white} style={reason === 'ended' ? styles.hangUpIcon : undefined} />
          </View>
          <AppText variant="title" color={colors.white} align="center">
            {reason === 'linesBusy' ? t('call.linesBusyTitle') : t('call.endedTitle')}
          </AppText>
          {talked && duration !== null ? (
            <View style={styles.durationPill}>
              <Ionicons name="time-outline" size={16} color={colors.primarySoft} />
              <AppText variant="subhead" color={colors.white}>
                {t('call.duration')}: {formatDuration(duration, t)}
              </AppText>
            </View>
          ) : (
            <AppText variant="body" color="rgba(255,255,255,0.75)" align="center">
              {message}
            </AppText>
          )}
        </View>

        {canRate && record ? (
          <View style={styles.rateCard}>
            <FeedbackForm callId={record.id} tone="dark" onSent={() => setRated(true)} />
          </View>
        ) : null}

        <View style={styles.endedActions}>
          {reason === 'subscription' ? (
            <Button label={t('call.activateSubscription')} icon="shield-checkmark" onPress={() => router.replace('/subscription')} />
          ) : null}
          {canRetry ? <Button label={t('call.tryAgain')} icon="refresh" onPress={retry} /> : null}
          <Button label={t('call.done')} variant="light" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const SELF_VIEW_WIDTH = 108;
const RING_SIZE = 132;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rings: {
    width: RING_SIZE * 2.2,
    height: RING_SIZE * 2.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: colors.primary,
  },
  serviceIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  hint: {
    maxWidth: 300,
  },
  tiles: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    gap: 4,
  },
  tile: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#13202E',
  },
  tileCompact: {
    borderRadius: radius.lg,
    marginHorizontal: 4,
  },
  tileSpeaking: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarHalo: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarHaloSpeaking: {
    borderColor: colors.primary,
  },
  nameTag: {
    position: 'absolute',
    left: spacing.md,
    bottom: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    maxWidth: '70%',
  },
  nameTagCompact: {
    bottom: spacing.sm,
    left: spacing.sm,
  },
  topShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  selfView: {
    position: 'absolute',
    right: spacing.md,
    width: SELF_VIEW_WIDTH,
    height: SELF_VIEW_WIDTH * (16 / 9),
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: '#13202E',
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.xxl,
  },
  controls: {
    alignItems: 'center',
    gap: spacing.lg - 4,
    paddingHorizontal: spacing.md,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  controlItem: {
    width: 68,
    alignItems: 'center',
    gap: 6,
  },
  control: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  controlActive: {
    backgroundColor: colors.white,
  },
  hangUp: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.hangUp,
  },
  hangUpIcon: {
    transform: [{ rotate: '135deg' }],
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  ended: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    justifyContent: 'space-between',
  },
  endedTop: {
    alignItems: 'center',
    gap: spacing.md,
  },
  endedIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.hangUp,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  endedIconBusy: {
    backgroundColor: colors.warning,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  rateCard: {
    padding: spacing.lg - 4,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  endedActions: {
    gap: spacing.sm,
  },
});
