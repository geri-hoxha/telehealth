import { mediaDevices } from '@livekit/react-native-webrtc';
import * as CallKit from 'expo-callkit-telecom';
import { Room, RoomEvent } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { callsApi, type Call, type CallMedia, type CallState } from '@/api/calls';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { activeCall } from './active-call';
import { ensureCallPermissions } from './permissions';

const STATE_POLL_MS = 2000;
/**
 * How long the other side may be missing from the room before the call counts as over. LiveKit
 * briefly removes everyone while it reconnects after a network change; a real hang-up is seen
 * sooner through the API and the room being deleted.
 */
const REMOTE_GONE_MS = 15_000;

/** starting: talking to the API · ringing: waiting for the doctor · connecting: joining after answering */
export type CallPhase = 'starting' | 'ringing' | 'connecting' | 'inCall' | 'ended';

/**
 * outgoing: the patient calls a doctor.
 * answer: the doctor answered on the phone's call screen (CallKit / Android); `sessionId` and
 * `requestId` come from expo-callkit-telecom's answer event.
 */
export type CallRequest =
  | { kind: 'outgoing'; media: CallMedia }
  | { kind: 'answer'; callId: string; media: CallMedia; sessionId: string; requestId: string };

const END_MESSAGES: Partial<Record<CallState, string>> = {
  DECLINED: 'Mjeku nuk mund ta pranojë thirrjen tani.',
  UNANSWERED: 'Nuk u përgjigj askush. Provoni përsëri pas pak.',
  CANCELED: 'Thirrja u anulua.',
  FAILED: 'Thirrja dështoi. Provoni përsëri.',
};

/** Why the phone's call screen should show the call as over, for calls the other side ended. */
const SYSTEM_END_REASONS: Partial<Record<CallState, CallKit.CallEndedReason>> = {
  UNANSWERED: 'unanswered',
  FAILED: 'failed',
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NO_DOCTOR_AVAILABLE') return 'Asnjë mjek nuk është i lirë tani. Provoni pas pak.';
    if (error.code === 'CALL_ALREADY_ACTIVE') return 'Keni tashmë një thirrje në vazhdim.';
    if (error.code === 'CALL_STATE_CONFLICT') return 'Thirrja nuk është më aktive.';
    if (error.status === 0) return 'Nuk ka lidhje me serverin.';
  }
  return 'Nuk mund të fillojmë thirrjen. Provoni përsëri.';
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
  const [room] = useState(() => new Room({ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }));
  const [phase, setPhase] = useState<CallPhase>('starting');
  const [call, setCall] = useState<Call | null>(null);
  const [endMessage, setEndMessage] = useState<string | null>(null);
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
   * `message`. `systemReason` is set when the other side or the server ended the call; without it
   * this phone hung up.
   */
  const finish = useCallback(
    (message: string, systemReason?: CallKit.CallEndedReason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setPhase('ended');
      setEndMessage(message);
      activeCall.set(null);
      void room.disconnect();

      const sessionId = sessionIdRef.current;
      if (sessionId) {
        const closeSystemCall = systemReason
          ? CallKit.reportCallEnded(sessionId, systemReason)
          : CallKit.endCall(sessionId);
        void closeSystemCall.catch(() => {});
      }
      const callId = callIdRef.current;
      if (callId && token) {
        void callsApi.end(token, callId).catch(() => {});
      }
    },
    [room, token],
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

    async function startOutgoing(media: CallMedia) {
      const { call: created, join } = await callsApi.create(token!, media);
      if (endedRef.current) {
        // The screen closed while the call was being created: stop the doctor's phone ringing.
        void callsApi.end(token!, created.id).catch(() => {});
        return;
      }
      callIdRef.current = created.id;
      activeCall.set(created.id);
      setCall(created);

      // Shows the call on the lock screen and in the status bar, and plays a dial tone.
      const sessionId = await CallKit.startOutgoingCall(
        { id: created.doctor.id, displayName: created.doctor.name },
        { hasVideo: wantsVideo },
      );
      if (endedRef.current) {
        void CallKit.endCall(sessionId).catch(() => {});
        return;
      }
      sessionIdRef.current = sessionId;
      setPhase('ringing');
      await joinRoom(join.serverUrl, join.token);
    }

    async function answer(callId: string, sessionId: string, requestId: string) {
      activeCall.set(callId);
      setPhase('connecting');
      try {
        const { call: accepted, join } = await callsApi.accept(token!, callId);
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
          finish(wantsVideo ? 'Lejoni mikrofonin dhe kamerën te cilësimet.' : 'Lejoni mikrofonin te cilësimet.');
          return;
        }
        if (request.kind === 'answer') {
          await answer(request.callId, request.sessionId, request.requestId);
        } else {
          await startOutgoing(request.media);
        }
      } catch (error) {
        if (!cancelled) finish(errorMessage(error), 'failed');
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
    // Runs once per screen; the request doesn't change.
  }, []);

  // Leaving the screen ends the call.
  useEffect(() => () => finish('Thirrja përfundoi.'), [finish]);

  /** Ends the call with the reason the API has (declined, not answered, …), or a generic one. */
  const finishFromServer = useCallback(async () => {
    const callId = callIdRef.current;
    let state: CallState | null = null;
    if (callId && token) {
      state = await callsApi.get(token, callId).then((latest) => latest.state, () => null);
    }
    if (!state) {
      finish('Thirrja përfundoi.', 'failed');
    } else {
      finish(END_MESSAGES[state] ?? 'Thirrja përfundoi.', SYSTEM_END_REASONS[state] ?? 'remoteEnded');
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
        finish('Thirrja përfundoi.');
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

  // The API has the final word: declined, not answered, cancelled or ended by the other side.
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(async () => {
      const callId = callIdRef.current;
      if (!callId || endedRef.current) return;
      try {
        const latest = await callsApi.get(token, callId);
        setCall(latest);
        if (latest.state !== 'RINGING' && latest.state !== 'ACCEPTED') {
          finish(END_MESSAGES[latest.state] ?? 'Thirrja përfundoi.', SYSTEM_END_REASONS[latest.state] ?? 'remoteEnded');
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
    hangUp: () => finish('Thirrja përfundoi.'),
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

  const otherParty = call ? (user?.role === 'DOCTOR' ? call.patient.name : call.doctor.name) : null;

  return {
    room,
    phase,
    media: request.media,
    otherParty,
    endMessage,
    connectedAt,
    muted,
    speakerOn,
    frontCamera,
    controls,
  };
}
