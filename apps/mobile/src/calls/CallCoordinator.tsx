import { AcsCalling, type CallAction, type PushToken } from '@modules/acs-calling';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { callsApi, devicesApi } from '@/api/calls';
import { API_URL } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { activeCall } from './active-call';
import { ensureCallPermissions } from './permissions';

const INCOMING_POLL_MS = 3000;

/**
 * App-wide call plumbing, rendered once next to the navigator:
 * - gives native code the API address and token (it declines calls and looks up names on its own);
 * - registers this phone's push token so the doctor's phone rings when the app is closed;
 * - opens the call screen when a call is answered from CallKit or the Android notification;
 * - for doctors with the app open, checks for ringing calls, so the phone rings even without push.
 */
export function CallCoordinator() {
  const { user, token } = useAuth();
  const navigationReady = !!useRootNavigationState()?.key;
  const registered = useRef<{ token: string; device: PushToken } | null>(null);
  // The call whose ringing screen was last opened, so polling and a notification tap don't open it twice.
  const ringingScreenFor = useRef<string | null>(null);
  const openRingingScreen = (callId: string) => {
    if (ringingScreenFor.current === callId || activeCall.get() === callId) return;
    ringingScreenFor.current = callId;
    router.push({ pathname: '/incoming', params: { callId } });
  };

  // API access for native code, and push registration.
  useEffect(() => {
    AcsCalling.configureApi(token ? `${API_URL}/api` : null, token);

    if (!token) {
      // Signed out: stop ringing this phone for the previous user.
      const previous = registered.current;
      registered.current = null;
      if (previous) {
        void devicesApi.unregister(previous.token, previous.device).catch(() => {});
      }
      return;
    }

    const register = (device: PushToken) => {
      registered.current = { token, device };
      void devicesApi.register(token, device).catch(() => {});
    };
    void AcsCalling.getPushToken().then((device) => device && register(device));
    const subscription = AcsCalling.addListener('onPushToken', register);
    return () => subscription.remove();
  }, [token]);

  // Doctors must allow the microphone and camera before a call arrives, since a call answered
  // on the lock screen can't show a permission prompt.
  useEffect(() => {
    if (user?.role === 'DOCTOR') {
      void ensureCallPermissions(true);
    }
  }, [user?.role]);

  // Answers from the system call UI, including the one that launched the app.
  useEffect(() => {
    if (!navigationReady || !token) return;

    const open = (action: CallAction) => {
      if (action.type === 'answer') {
        router.push({ pathname: '/call', params: { callId: action.callId, media: action.media, answer: '1' } });
      } else {
        openRingingScreen(action.callId);
      }
    };
    // The event carries the action too, but taking it clears it so it isn't handled twice.
    const takeAndOpen = () => void AcsCalling.takeLaunchAction().then((action) => action && open(action));

    takeAndOpen();
    const subscription = AcsCalling.addListener('onCallAction', takeAndOpen);
    return () => subscription.remove();
  }, [navigationReady, token]);

  // Doctors: ring for calls found while the app is open.
  useEffect(() => {
    if (!navigationReady || !token || user?.role !== 'DOCTOR') return;

    const rung = new Set<string>();
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      if (activeCall.get()) return;
      try {
        const { call } = await callsApi.incoming(token);
        if (!call || rung.has(call.id) || activeCall.get()) return;
        rung.add(call.id);
        await AcsCalling.showIncomingCall(call.id, call.media, call.patient.name);
        // iOS shows CallKit's own screen; Android also gets the app's ringing screen.
        if (Platform.OS === 'android') {
          openRingingScreen(call.id);
        }
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
