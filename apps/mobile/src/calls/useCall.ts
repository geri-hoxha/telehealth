import { mediaDevices } from '@livekit/react-native-webrtc';
import { useQueryClient } from '@tanstack/react-query';
import * as CallKit from 'expo-callkit-telecom';
import { Room, RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { callsApi, type CallOptions } from '@/api/calls';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queries';
import type { Call, CallMedia, CallState } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { useI18n } from '@/i18n';
import { activeCall } from './active-call';
import { ensureCallPermissions } from './permissions';

const STATE_POLL_MS = 2000;
/**
 * How long the other side may be missing from the room before the call counts as over. LiveKit
 * briefly removes everyone while it reconnects after a network change; a real hang-up is seen
 * sooner through the API and the room being deleted.
 */
const REMOTE_GONE_MS = 15_000;

/**
 * starting: talking to the API · waiting: in the queue, no doctor ringing · ringing: a doctor's
 * phone rings · connecting: answered, joining the room · inCall · ended
 */
export type CallPhase = 'starting' | 'waiting' | 'ringing' | 'connecting' | 'inCall' | 'ended';

/** Why the call screen shows the call as over; the screen translates it. */
export type EndReason =
  | 'ended'
  | 'canceled'
  | 'linesBusy'
  | 'failed'
  | 'permissions'
  | 'alreadyActive'
  | 'conflict'
  | 'subscription'
  | 'blocked'
  | 'eventNotLive'
  | 'network';

/**
 * outgoing: the patient calls; the system picks the doctor.
 * answer: a doctor answered on the phone's call screen (CallKit / Android) or the in-app invitation;
 * `sessionId` and `requestId` come from expo-callkit-telecom's answer event.
 */
export type CallRequest =
  | ({ kind: 'outgoing'; media: CallMedia } & CallOptions)
  | { kind: 'answer'; callId: string; media: CallMedia; sessionId: string; requestId: string };

const END_REASONS: Partial<Record<CallState, EndReason>> = {
  ENDED: 'ended',
  CANCELED: 'canceled',
  UNANSWERED: 'linesBusy',
  DECLINED: 'linesBusy',
  FAILED: 'failed',
};

/** Why the phone's call screen should show the call as over, for calls the other side ended. */
const SYSTEM_END_REASONS: Partial<Record<CallState, CallKit.CallEndedReason>> = {
  UNANSWERED: 'unanswered',
  FAILED: 'failed',
};

function errorReason(error: unknown): EndReason {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'network';
    switch (error.code) {
      case 'NO_DOCTOR_AVAILABLE':
        return 'linesBusy';
      case 'CALL_ALREADY_ACTIVE':
        return 'alreadyActive';
      case 'CALL_STATE_CONFLICT':
        return 'conflict';
      case 'SUBSCRIPTION_REQUIRED':
        return 'subscription';
      case 'PATIENT_BLOCKED':
        return 'blocked';
      case 'EVENT_NOT_LIVE':
      case 'EVENT_NOT_JOINED':
        return 'eventNotLive';
    }
  }
  return 'failed';
}

/** The phase a call that isn't connected yet is in, from its state on the server. */
function waitingPhase(state: CallState): CallPhase | null {
  if (state === 'QUEUED') return 'waiting';
  if (state === 'RINGING') return 'ringing';
  if (state === 'ACCEPTED') return 'connecting';
  return null;
}

/**
 * Runs one call from start to end: creates or accepts it with the API, registers it with the
 * phone's call screen (CallKit on iOS, Telecom on Android, through expo-callkit-telecom), joins the
 * LiveKit room, follows its state (API polling plus room and system events) and exposes the
 * in-call controls. The phone's call screen owns the audio session, so this never starts
 * LiveKit's AudioSession.
 */
export function useCall(request: CallRequest) {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [room] = useState(() => new Room({ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }));
  const [phase, setPhase] = useState<CallPhase>(request.kind === 'answer' ? 'connecting' : 'starting');
  const [call, setCall] = useState<Call | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);
  const [speakerOn, setSpeakerOnState] = useState(request.media === 'VIDEO');
  const [frontCamera, setFrontCamera] = useState(true);

  const callIdRef = useRef<string | null>(request.kind === 'answer' ? request.callId : null);
  /** The call's session on the phone's call screen. */
  const sessionIdRef = useRef<string | null>(request.kind === 'answer' ? request.sessionId : null);
  const endedRef = useRef(false);
  const hadRemoteRef = useRef(false);
  /** Muted before the room was joined (e.g. on the lock screen while connecting). */
  const mutedRef = useRef(false);
  /** The camera couldn't start because the app was in the background. */
  const cameraPendingRef = useRef(false);
  const wantsVideo = request.media === 'VIDEO';

  /**
   * Ends the call once: leaves the room, closes the phone's call screen, tells the API and shows
   * why. `systemReason` is set when the other side or the server ended the call; without it this
   * phone hung up.
   */
  const finish = useCallback(
    (reason: EndReason, systemReason?: CallKit.CallEndedReason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setPhase('ended');
      setEndReason(reason);
      activeCall.set(null);
      void room.disconnect();

      const sessionId = sessionIdRef.current;
      if (sessionId) {
        const closeSystemCall = systemReason ? CallKit.reportCallEnded(sessionId, systemReason) : CallKit.endCall(sessionId);
        void closeSystemCall.catch(() => {});
      }
      const callId = callIdRef.current;
      if (callId && token) {
        void callsApi
          .end(callId, token)
          .then(setCall)
          .catch(() => {})
          .finally(() => void queryClient.invalidateQueries({ queryKey: queryKeys.calls }));
      }
    },
    [room, token, queryClient],
  );

  /** The other side is in the room: the call is on. */
  const onRemotePresent = useCallback(() => {
    if (hadRemoteRef.current) return;
    hadRemoteRef.current = true;
    setPhase('inCall');
    setConnectedAt(Date.now());
    // Patient: the doctor is here, so stop the dial tone and show the call as connected.
    const sessionId = sessionIdRef.current;
    if (request.kind === 'outgoing' && sessionId) {
      void CallKit.reportOutgoingCallConnected(sessionId).catch(() => {});
    }
  }, [request.kind]);

  /** Joins the room with the microphone on, and the camera for video calls when the app is open. */
  const joinRoom = useCallback(
    async (serverUrl: string, roomToken: string) => {
      await room.connect(serverUrl, roomToken);
      await room.localParticipant.setMicrophoneEnabled(!mutedRef.current);
      // iOS can't start the camera in the background (a call answered on the lock screen);
      // the AppState effect below turns it on once the app is open.
      if (wantsVideo && AppState.currentState === 'active') {
        await room.localParticipant.setCameraEnabled(true).catch(() => {});
      } else if (wantsVideo) {
        cameraPendingRef.current = true;
      }
      // The doctor joins a room the patient is already in, so no ParticipantConnected fires.
      if (room.remoteParticipants.size > 0) onRemotePresent();
    },
    [room, wantsVideo, onRemotePresent],
  );

  // Start: API first, then the phone's call screen, then the room.
  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;

    async function startOutgoing(media: CallMedia, options: CallOptions) {
      const { call: created, join } = await callsApi.create(media, options, token!);
      if (endedRef.current) {
        // The screen closed while the call was being created: stop the doctor's phone ringing.
        void callsApi.end(created.id, token!).catch(() => {});
        return;
      }
      callIdRef.current = created.id;
      activeCall.set(created.id);
      setCall(created);
      setPhase(waitingPhase(created.state) ?? 'waiting');

      // Shows the call on the lock screen and in the status bar, and plays a dial tone. The
      // doctor isn't known yet (the queue picks one), so the system screen shows the service.
      const sessionId = await CallKit.startOutgoingCall({ id: 'telehealth', displayName: t('call.systemName') }, { hasVideo: wantsVideo });
      if (endedRef.current) {
        void CallKit.endCall(sessionId).catch(() => {});
        return;
      }
      sessionIdRef.current = sessionId;
      await joinRoom(join.serverUrl, join.token);
    }

    async function answer(callId: string, sessionId: string, requestId: string) {
      activeCall.set(callId);
      try {
        const { call: accepted, join } = await callsApi.accept(callId, token!);
        setCall(accepted);
        if (cancelled || endedRef.current) return;
        await joinRoom(join.serverUrl, join.token);
        // Tells the phone the call is connected; it then switches on the audio.
        await CallKit.fulfillIncomingCallConnected(requestId);
      } catch (error) {
        sessionIdRef.current = null; // Closed by failIncomingCallConnected.
        void CallKit.failIncomingCallConnected(sessionId, requestId).catch(() => {});
        throw error;
      }
    }

    async function start() {
      if (request.kind === 'answer') activeCall.set(request.callId);
      try {
        // The patient started this call, so asking for notifications (ongoing-call notice) is fine.
        if (!(await ensureCallPermissions(wantsVideo, request.kind === 'outgoing'))) {
          if (request.kind === 'answer') {
            void CallKit.failIncomingCallConnected(request.sessionId, request.requestId).catch(() => {});
            sessionIdRef.current = null;
          }
          finish('permissions');
          return;
        }
        if (request.kind === 'answer') {
          await answer(request.callId, request.sessionId, request.requestId);
        } else {
          await startOutgoing(request.media, { preferredDoctorId: request.preferredDoctorId, eventId: request.eventId });
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && typeof error.details.until === 'string') setBlockedUntil(error.details.until);
        finish(errorReason(error), 'failed');
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
    // Runs once per screen; the request doesn't change.
  }, []);

  // Leaving the screen ends the call.
  useEffect(() => () => finish('ended'), [finish]);

  /** Ends the call with the reason the API has (not answered, cancelled, …), or a generic one. */
  const finishFromServer = useCallback(async () => {
    const callId = callIdRef.current;
    let latest: Call | null = null;
    if (callId && token) {
      latest = await callsApi.get(callId, token).catch(() => null);
    }
    // A call still waiting on the server that the phone or the room dropped failed; one that was
    // talking simply ended.
    const fallback: EndReason = hadRemoteRef.current ? 'ended' : 'failed';
    if (!latest) {
      finish(fallback, 'failed');
    } else {
      setCall(latest);
      finish(END_REASONS[latest.state] ?? fallback, SYSTEM_END_REASONS[latest.state] ?? 'remoteEnded');
    }
  }, [finish, token]);

  // The other side joining or leaving, and the room closing (the API deletes it when the call ends).
  useEffect(() => {
    let goneTimer: ReturnType<typeof setTimeout> | undefined;

    const onParticipantConnected = () => {
      clearTimeout(goneTimer);
      onRemotePresent();
    };
    const onParticipantDisconnected = () => {
      if (hadRemoteRef.current && room.remoteParticipants.size === 0) {
        clearTimeout(goneTimer);
        goneTimer = setTimeout(() => void finishFromServer(), REMOTE_GONE_MS);
      }
    };
    const onDisconnected = () => {
      if (!endedRef.current) void finishFromServer();
    };

    room
      .on(RoomEvent.ParticipantConnected, onParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      .on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      clearTimeout(goneTimer);
      room
        .off(RoomEvent.ParticipantConnected, onParticipantConnected)
        .off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
        .off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room, onRemotePresent, finishFromServer]);

  // The phone's call screen: hang-up and mute buttons there, and the audio route.
  useEffect(() => {
    const isThisCall = (id: string) => id === sessionIdRef.current;
    const subscriptions = [
      CallKit.addCallEndedListener(({ id }) => {
        if (!isThisCall(id)) return;
        sessionIdRef.current = null; // Already closed.
        finish('ended');
      }),
      // The phone closed the call itself, e.g. its ring or answer timeout ran out.
      CallKit.addReportedCallEndedListener(({ id }) => {
        if (!isThisCall(id) || endedRef.current) return;
        sessionIdRef.current = null;
        void finishFromServer();
      }),
      CallKit.addSetMutedActionListener(({ id, isMuted }) => {
        if (!isThisCall(id)) return;
        mutedRef.current = isMuted;
        setMutedState(isMuted);
        void room.localParticipant.setMicrophoneEnabled(!isMuted).catch(() => {});
      }),
      CallKit.addAudioRouteChangedListener(({ currentRoute }) => {
        setSpeakerOnState(currentRoute.outputs.some((output) => output.portType === 'builtInSpeaker'));
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [room, finish, finishFromServer]);

  // The API has the final word: waiting, ringing another doctor, answered, or over. Polling also
  // keeps the server's queue moving (it has no background jobs).
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(async () => {
      const callId = callIdRef.current;
      if (!callId || endedRef.current) return;
      try {
        const latest = await callsApi.get(callId, token);
        setCall(latest);
        const waiting = waitingPhase(latest.state);
        if (!waiting) {
          finish(END_REASONS[latest.state] ?? 'ended', SYSTEM_END_REASONS[latest.state] ?? 'remoteEnded');
        } else if (!hadRemoteRef.current) {
          setPhase((current) => (current === 'ended' || current === 'inCall' ? current : waiting));
        }
      } catch {
        // Keep the call going through short network hiccups.
      }
    }, STATE_POLL_MS);
    return () => clearInterval(timer);
  }, [token, finish]);

  // A video call answered on the lock screen starts without the camera; turn it on once the app is open.
  useEffect(() => {
    if (!wantsVideo) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && cameraPendingRef.current && !endedRef.current && room.state === 'connected') {
        cameraPendingRef.current = false;
        void room.localParticipant.setCameraEnabled(true).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [room, wantsVideo]);

  const controls = {
    hangUp: () => finish(hadRemoteRef.current ? 'ended' : 'canceled'),
    toggleMute: () => {
      const next = !muted;
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        // The mute listener above applies it, as for the system's own mute button.
        void CallKit.setMuted(sessionId, next).catch(() => {});
      } else {
        mutedRef.current = next;
        setMutedState(next);
        void room.localParticipant.setMicrophoneEnabled(!next).catch(() => {});
      }
    },
    toggleCamera: async () => {
      cameraPendingRef.current = false;
      await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled).catch(() => {});
    },
    switchCamera: async () => {
      const facing = frontCamera ? 'environment' : 'front';
      const devices = (await mediaDevices.enumerateDevices()) as { kind: string; deviceId: string; facing?: string }[];
      const camera = devices.find((device) => device.kind === 'videoinput' && device.facing === facing);
      if (!camera) return;
      if (await room.switchActiveDevice('videoinput', camera.deviceId).catch(() => false)) {
        setFrontCamera(!frontCamera);
      }
    },
    // The button follows the route the phone reports, since a video call may keep the speaker.
    toggleSpeaker: () => CallKit.setAudioSessionPortOverride(!speakerOn),
  };

  const isDoctor = user?.role === 'DOCTOR';
  return {
    room,
    phase,
    call,
    media: request.media,
    /** The answering doctor of this call: may add another doctor. */
    canAddDoctor: isDoctor && !!call && call.doctor?.id === user?.id,
    endReason,
    blockedUntil,
    connectedAt,
    muted,
    speakerOn,
    frontCamera,
    controls,
  };
}
