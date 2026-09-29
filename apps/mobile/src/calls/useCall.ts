import { AcsCalling, type CallMedia } from '@modules/acs-calling';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { callsApi, type Call, type CallState } from '@/api/calls';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { activeCall } from './active-call';
import { ensureCallPermissions } from './permissions';

const STATE_POLL_MS = 2000;

/** starting: talking to the API · ringing: waiting for the doctor · connecting: joining after answering */
export type CallPhase = 'starting' | 'ringing' | 'connecting' | 'inCall' | 'ended';

export type CallRequest =
  | { kind: 'outgoing'; media: CallMedia }
  | { kind: 'answer'; callId: string; media: CallMedia };

const END_MESSAGES: Partial<Record<CallState, string>> = {
  DECLINED: 'Mjeku nuk mund ta pranojë thirrjen tani.',
  UNANSWERED: 'Nuk u përgjigj askush. Provoni përsëri pas pak.',
  CANCELED: 'Thirrja u anulua.',
  FAILED: 'Thirrja dështoi. Provoni përsëri.',
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
 * Runs one call from start to end: creates or accepts it with the API, joins the ACS room,
 * follows its state (API polling plus native events) and exposes the in-call controls.
 */
export function useCall(request: CallRequest) {
  const { user, token } = useAuth();
  const [phase, setPhase] = useState<CallPhase>('starting');
  const [call, setCall] = useState<Call | null>(null);
  const [endMessage, setEndMessage] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [localVideo, setLocalVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOnState] = useState(request.media === 'VIDEO');

  const callIdRef = useRef<string | null>(request.kind === 'answer' ? request.callId : null);
  const endedRef = useRef(false);
  const hadRemoteRef = useRef(false);
  const wantsVideo = request.media === 'VIDEO';

  /** Ends the call once: leaves the room, tells the API, shows `message`. */
  const finish = useCallback(
    (message: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setPhase('ended');
      setEndMessage(message);
      activeCall.set(null);
      void AcsCalling.hangUp().catch(() => {});
      const callId = callIdRef.current;
      if (callId && token) {
        void callsApi.end(token, callId).catch(() => {});
      }
    },
    [token],
  );

  // Start: API first, then join the room.
  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;

    async function start() {
      if (request.kind === 'answer') activeCall.set(request.callId);
      try {
        if (!(await ensureCallPermissions(wantsVideo))) {
          finish(wantsVideo ? 'Lejoni mikrofonin dhe kamerën te cilësimet.' : 'Lejoni mikrofonin te cilësimet.');
          return;
        }
        const { call: created, join } =
          request.kind === 'answer'
            ? await callsApi.accept(token!, request.callId)
            : await callsApi.create(token!, request.media);
        if (cancelled) return;

        callIdRef.current = created.id;
        activeCall.set(created.id);
        setCall(created);
        await AcsCalling.join({
          callId: created.id,
          roomId: join.roomId,
          token: join.token,
          displayName: `${user!.firstName} ${user!.lastName}`,
          video: wantsVideo,
        });
        await AcsCalling.setSpeakerOn(wantsVideo).catch(() => {});
        if (!cancelled && !endedRef.current) {
          setPhase((current) => (current === 'starting' ? (request.kind === 'answer' ? 'connecting' : 'ringing') : current));
        }
      } catch (error) {
        if (!cancelled) finish(errorMessage(error));
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

  // Native events.
  useEffect(() => {
    const subscriptions = [
      AcsCalling.addListener('onRemoteParticipantsChanged', ({ count }) => {
        if (count > 0) {
          hadRemoteRef.current = true;
          setPhase('inCall');
          setConnectedAt((current) => current ?? Date.now());
        } else if (hadRemoteRef.current) {
          finish('Thirrja përfundoi.');
        }
      }),
      AcsCalling.addListener('onCallEnded', () => finish('Thirrja përfundoi.')),
      AcsCalling.addListener('onRemoteVideoChanged', ({ available }) => setRemoteVideo(available)),
      AcsCalling.addListener('onLocalVideoChanged', ({ enabled }) => setLocalVideo(enabled)),
      AcsCalling.addListener('onMutedChanged', ({ muted: isMuted }) => setMuted(isMuted)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [finish]);

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
          finish(END_MESSAGES[latest.state] ?? 'Thirrja përfundoi.');
        }
      } catch {
        // Keep the call going through short network hiccups.
      }
    }, STATE_POLL_MS);
    return () => clearInterval(timer);
  }, [token, finish]);

  // A video call answered on the lock screen starts without the camera (iOS doesn't allow it
  // in the background); turn it on once the app is open.
  useEffect(() => {
    if (!wantsVideo) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !endedRef.current && callIdRef.current) {
        void AcsCalling.setCameraEnabled(true).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [wantsVideo]);

  const controls = {
    hangUp: () => finish('Thirrja përfundoi.'),
    toggleMute: () => void AcsCalling.setMicrophoneMuted(!muted).catch(() => {}),
    toggleCamera: () => void AcsCalling.setCameraEnabled(!localVideo).catch(() => {}),
    switchCamera: () => void AcsCalling.switchCamera().catch(() => {}),
    toggleSpeaker: () => {
      const next = !speakerOn;
      setSpeakerOnState(next);
      void AcsCalling.setSpeakerOn(next).catch(() => {});
    },
  };

  const otherParty = call ? (user?.role === 'DOCTOR' ? call.patient.name : call.doctor.name) : null;

  return {
    phase,
    media: request.media,
    otherParty,
    endMessage,
    connectedAt,
    remoteVideo,
    localVideo,
    muted,
    speakerOn,
    controls,
  };
}
