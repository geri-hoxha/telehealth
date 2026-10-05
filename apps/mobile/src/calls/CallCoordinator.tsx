import * as CallKit from 'expo-callkit-telecom';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { callsApi, devicesApi, type CallState, type PushDevice } from '@/api/calls';
import { useAuth } from '@/auth/AuthProvider';
import { activeCall } from './active-call';
import { ensureCallPermissions } from './permissions';

const INCOMING_POLL_MS = 3000;
const RINGING_CHECK_MS = 2000;

/** How the phone's ringing screen should close when the call stopped ringing on the server. */
const RINGING_END_REASONS: Partial<Record<CallState, CallKit.CallEndedReason>> = {
  ACCEPTED: 'answeredElsewhere',
  DECLINED: 'declinedElsewhere',
  UNANSWERED: 'unanswered',
  FAILED: 'failed',
};

/** The incoming call a session of the phone's call screen belongs to, if it is one. */
function incomingCallOf(session: CallKit.CallSession | null | undefined) {
  const event = session?.origin === 'incoming' ? session.incomingCallEvent : undefined;
  return event ? { callId: event.serverCallId, hasVideo: event.hasVideo } : null;
}

/**
 * App-wide call plumbing, rendered once next to the navigator. Ringing itself is done by the
 * phone (CallKit on iOS, Telecom on Android) through expo-callkit-telecom, which also reads the
 * VoIP/FCM pushes natively, so a closed app rings too. This component:
 * - registers this phone's push token so the doctor's phone rings when the app is closed;
 * - opens the call screen when a call is answered on the phone's call screen, and tells the API
 *   when it is declined there;
 * - stops the ringing when the call stops ringing on the server (cancelled, not answered);
 * - for doctors with the app open, checks for ringing calls, so the phone rings even without push.
 */
export function CallCoordinator() {
  const { user, token } = useAuth();
  const navigationReady = !!useRootNavigationState()?.key;
  const registered = useRef<{ token: string; device: PushDevice } | null>(null);

  // Push registration.
  useEffect(() => {
    if (!token) {
      // Signed out: stop ringing this phone for the previous user.
      const previous = registered.current;
      registered.current = null;
      if (previous) {
        void devicesApi.unregister(previous.token, previous.device).catch(() => {});
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
      void devicesApi.register(token, device).catch(() => {});
    };

    CallKit.registerVoIPPush();
    register(CallKit.getVoIPPushToken()?.token);
    const subscription = CallKit.addVoIPPushTokenUpdatedListener((event) => register(event.token));
    return () => subscription.remove();
  }, [token]);

  // Doctors must allow the microphone and camera before a call arrives, since a call answered
  // on the lock screen can't show a permission prompt.
  useEffect(() => {
    if (user?.role === 'DOCTOR') {
      void ensureCallPermissions(true, true);
    }
  }, [user?.role]);

  // Answers and declines on the phone's call screen. The module keeps an answer until a listener
  // is added, so the answer that launched the app isn't lost while signing in. Declines aren't kept:
  // one made before the app is running reaches the API only through its ring timeout.
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
        router.push({
          pathname: '/call',
          params: {
            callId: incoming.callId,
            media: incoming.hasVideo ? 'VIDEO' : 'AUDIO',
            sessionId: id,
            requestId,
          },
        });
      }),
      // Declined on the ringing screen. Calls on the call screen end there instead. Decline only
      // works while the call rings, so declining on a second device can't end an answered call.
      CallKit.addCallEndedListener(({ session }) => {
        const incoming = incomingCallOf(session);
        if (incoming && incoming.callId !== activeCall.get()) {
          void callsApi.decline(token, incoming.callId).catch(() => {});
        }
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [navigationReady, token]);

  // While this phone rings, stop the ringing once the call stops ringing on the server: the
  // patient hung up or nobody answered. Pushes can't do this (iOS forbids VoIP pushes that don't
  // ring), and without the app running the phone stops at its own ring timeout.
  useEffect(() => {
    if (!token || user?.role !== 'DOCTOR') return;

    const timer = setInterval(async () => {
      try {
        const session = await CallKit.getActiveCallSession();
        const incoming = incomingCallOf(session);
        if (!session || session.status !== 'ringing' || !incoming) return;
        const call = await callsApi.get(token, incoming.callId);
        if (call.state === 'RINGING') return;
        // The doctor may have answered on this phone while the API was asked.
        const current = await CallKit.getActiveCallSession();
        if (current?.id !== session.id || current.status !== 'ringing' || activeCall.get() === incoming.callId) return;
        await CallKit.reportCallEnded(session.id, RINGING_END_REASONS[call.state] ?? 'remoteEnded');
      } catch {
        // Try again on the next tick.
      }
    }, RINGING_CHECK_MS);
    return () => clearInterval(timer);
  }, [token, user?.role]);

  // Doctors with the app open: ring for calls found by polling, for when push isn't set up.
  // A call is only rung on the second poll that sees it, so a push that is on its way rings it
  // first; ringing it twice would show two calls.
  useEffect(() => {
    if (!navigationReady || !token || user?.role !== 'DOCTOR') return;

    const seen = new Set<string>();
    const rung = new Set<string>();
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      if (activeCall.get()) return;
      try {
        const { call } = await callsApi.incoming(token);
        if (!call || rung.has(call.id)) return;
        if (!seen.has(call.id)) {
          seen.add(call.id);
          return;
        }
        if (activeCall.get() || (await CallKit.getActiveCallSession())) return;
        rung.add(call.id);
        await CallKit.reportIncomingCall({
          eventId: call.id,
          serverCallId: call.id,
          hasVideo: call.media === 'VIDEO',
          startedAt: call.createdAt,
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
  }, [navigationReady, token, user?.role]);

  return null;
}
