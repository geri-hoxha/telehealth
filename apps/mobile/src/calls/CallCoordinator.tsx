import * as CallKit from 'expo-callkit-telecom';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { callsApi, devicesApi } from '@/api/calls';
import type { Call, PushDevice } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { activeCall, invitationScreen } from './active-call';
import { ensureCallPermissions } from './permissions';

const INCOMING_POLL_MS = 3000;
const RINGING_CHECK_MS = 2000;

/** How the phone's ringing screen should close when the call stopped ringing for this doctor. */
function ringingEndReason(call: Call, doctorId: string): CallKit.CallEndedReason {
  if (call.state === 'ACCEPTED' && call.doctor?.id !== doctorId) return 'answeredElsewhere';
  if (call.state === 'FAILED') return 'failed';
  // Passed on to another doctor, or nobody answered in time.
  if (call.state === 'QUEUED' || call.state === 'RINGING' || call.state === 'UNANSWERED') return 'unanswered';
  return 'remoteEnded';
}

/** The incoming call a session of the phone's call screen belongs to, if it is one. */
function incomingCallOf(session: CallKit.CallSession | null | undefined) {
  const event = session?.origin === 'incoming' ? session.incomingCallEvent : undefined;
  return event ? { callId: event.serverCallId, hasVideo: event.hasVideo } : null;
}

/** The in-app invitation (patient's name, plan, Answer / Hang up) for a ringing session. */
function showInvitation(session: CallKit.CallSession) {
  const incoming = incomingCallOf(session);
  if (!incoming || session.status !== 'ringing' || invitationScreen.get() === session.id || activeCall.get()) return;
  invitationScreen.set(session.id);
  router.push({
    pathname: '/incoming',
    params: { sessionId: session.id, callId: incoming.callId, media: incoming.hasVideo ? 'VIDEO' : 'AUDIO' },
  });
}

/**
 * App-wide call plumbing, rendered once next to the navigator. Ringing itself is done by the
 * phone (CallKit on iOS, Telecom on Android) through expo-callkit-telecom, which also reads the
 * VoIP/FCM pushes natively, so a closed app rings too. This component:
 * - registers this phone's push token so the doctor's phone rings when the app is closed;
 * - shows the full-screen invitation while the app is open and a call rings;
 * - opens the call screen when a call is answered (system screen or invitation), and tells the
 *   API when it is declined;
 * - stops the ringing when the call no longer rings for this doctor (cancelled, not answered,
 *   passed on to another doctor);
 * - for doctors with the app open, checks for ringing calls, so the phone rings even without push.
 */
export function CallCoordinator() {
  const { user, token } = useAuth();
  const navigationReady = !!useRootNavigationState()?.key;
  const registered = useRef<{ token: string; device: PushDevice } | null>(null);
  const isDoctor = user?.role === 'DOCTOR';

  // Push registration.
  useEffect(() => {
    if (!token) {
      // Signed out: stop ringing this phone for the previous user.
      const previous = registered.current;
      registered.current = null;
      if (previous) {
        void devicesApi.unregister(previous.device, previous.token).catch(() => {});
      }
      return;
    }

    const register = (pushToken: string | undefined) => {
      if (!pushToken) return;
      const device: PushDevice = {
        platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        kind: Platform.OS === 'ios' ? 'VOIP' : 'FCM',
        token: pushToken,
      };
      registered.current = { token, device };
      void devicesApi.register(device, token).catch(() => {});
    };

    CallKit.registerVoIPPush();
    register(CallKit.getVoIPPushToken()?.token);
    const subscription = CallKit.addVoIPPushTokenUpdatedListener((event) => register(event.token));
    return () => subscription.remove();
  }, [token]);

  // Doctors must allow the microphone and camera before a call arrives, since a call answered
  // on the lock screen can't show a permission prompt.
  useEffect(() => {
    if (isDoctor) {
      void ensureCallPermissions(true, true);
    }
  }, [isDoctor]);

  // Answers and declines on the phone's call screen (or through the invitation, which goes through
  // it). The module keeps an answer until a listener is added, so the answer that launched the app
  // isn't lost while signing in. Declines aren't kept: one made before the app is running reaches
  // the API only through its ring timeout.
  const answered = useRef(new Set<string>());
  useEffect(() => {
    if (!navigationReady || !token) return;

    const subscriptions = [
      CallKit.addCallAnsweredListener(async ({ id, requestId }) => {
        const session = await CallKit.getActiveCallSession();
        const incoming = session?.id === id ? incomingCallOf(session) : null;
        // A second answer event for the same call (Android can send one from the headset too).
        if (!incoming || answered.current.has(id) || activeCall.get() === incoming.callId) return;
        answered.current.add(id);
        const href = {
          pathname: '/call' as const,
          params: { callId: incoming.callId, media: incoming.hasVideo ? 'VIDEO' : 'AUDIO', sessionId: id, requestId },
        };
        // The invitation is replaced by the call, so going back doesn't return to it.
        if (invitationScreen.get() === id) {
          invitationScreen.set(null);
          router.replace(href);
        } else {
          router.push(href);
        }
      }),
      // Declined on the ringing screen. Calls on the call screen end there instead. Decline only
      // works while the call rings for this doctor, so declining on a second device can't end an
      // answered call.
      CallKit.addCallEndedListener(({ session }) => {
        const incoming = incomingCallOf(session);
        if (incoming && incoming.callId !== activeCall.get()) {
          void callsApi.decline(incoming.callId, token).catch(() => {});
        }
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [navigationReady, token]);

  // While the app is open, a ringing call also gets the full-screen invitation with the patient's
  // details; the system's ringing banner stays on top of it.
  useEffect(() => {
    if (!navigationReady || !token || !isDoctor) return;

    const showIfRinging = async () => {
      if (AppState.currentState !== 'active') return;
      const session = await CallKit.getActiveCallSession().catch(() => null);
      if (session) showInvitation(session);
    };

    void showIfRinging();
    const subscriptions = [
      CallKit.addIncomingCallReportedListener(() => void showIfRinging()),
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void showIfRinging();
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [navigationReady, token, isDoctor]);

  // While this phone rings, stop the ringing once the call no longer rings for this doctor: the
  // patient hung up, nobody answered, or it moved on to another doctor. Pushes can't do this (iOS
  // forbids VoIP pushes that don't ring), and without the app running the phone stops at its own
  // ring timeout.
  useEffect(() => {
    if (!token || !user || !isDoctor) return;

    const timer = setInterval(async () => {
      try {
        const session = await CallKit.getActiveCallSession();
        const incoming = incomingCallOf(session);
        if (!session || session.status !== 'ringing' || !incoming) return;
        const call = await callsApi.get(incoming.callId, token);
        if (call.ringingForMe) return;
        // The doctor may have answered on this phone while the API was asked.
        const current = await CallKit.getActiveCallSession();
        if (current?.id !== session.id || current.status !== 'ringing' || activeCall.get() === incoming.callId) return;
        await CallKit.reportCallEnded(session.id, ringingEndReason(call, user.id));
      } catch {
        // Try again on the next tick.
      }
    }, RINGING_CHECK_MS);
    return () => clearInterval(timer);
  }, [token, user, isDoctor]);

  // Doctors with the app open: ring for calls found by polling, for when push isn't set up. Each
  // ring (a doctor's attempt or an "Add doctor" invite) has its own id, so a call passed back to
  // this doctor later rings again. A ring is only reported on the second poll that sees it, so a
  // push that is on its way rings it first; ringing it twice would show two calls.
  useEffect(() => {
    if (!navigationReady || !token || !isDoctor) return;

    const seen = new Set<string>();
    const rung = new Set<string>();
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      if (activeCall.get()) return;
      try {
        const { call, ringId } = await callsApi.incoming(token);
        if (!call || !ringId || rung.has(ringId)) return;
        if (!seen.has(ringId)) {
          seen.add(ringId);
          return;
        }
        if (activeCall.get() || (await CallKit.getActiveCallSession())) return;
        rung.add(ringId);
        await CallKit.reportIncomingCall({
          eventId: ringId,
          serverCallId: call.id,
          hasVideo: call.media === 'VIDEO',
          startedAt: call.ringingAt ?? call.createdAt,
          caller: { id: call.patient.id, displayName: call.patient.name },
        });
      } catch {
        // Try again on the next tick.
      }
    };

    const start = () => {
      if (timer) return;
      void check();
      timer = setInterval(check, INCOMING_POLL_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };

    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
    return () => {
      stop();
      subscription.remove();
    };
  }, [navigationReady, token, isDoctor]);

  return null;
}
