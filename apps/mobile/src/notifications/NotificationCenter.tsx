import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { devicesApi } from '@/api/calls';
import { queryKeys } from '@/api/queries';
import { notificationsApi } from '@/api/records';
import type { PushDevice } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { useSnackbar } from '@/components/ui';
import { getLanguage, useI18n } from '@/i18n';
import { openNotification, type NotificationTarget } from './open-notification';
import { pushNotificationsEnabled } from './push-config';

const ANDROID_CHANNEL_ID = 'notifications';
const UNREAD_POLL_MS = 20_000;
/** A polled notification older than this is not "new" any more and gets no snackbar. */
const FRESH_MS = 2 * 60 * 1000;

// A push that arrives while the app is open shows our snackbar instead of the system banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function targetOf(data: Record<string, unknown> | undefined): NotificationTarget & { notificationId?: string } {
  const text = (key: string) => (typeof data?.[key] === 'string' ? (data[key] as string) : undefined);
  return {
    notificationId: text('notificationId'),
    type: text('type'),
    folderId: text('folderId'),
    eventId: text('eventId'),
    doctorId: text('doctorId'),
    url: text('url'),
  };
}

/**
 * Notifications besides calls, rendered once next to the navigator:
 * - registers this iPhone's notification token (Android's FCM token is registered with the calls');
 * - while the app is open, a new notification shows a snackbar with "Show", whether it came as a
 *   push or was found by polling (builds without push, e.g. a free Apple ID);
 * - a tapped push opens the folder, event or link it is about.
 */
export function NotificationCenter() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const showSnackbar = useSnackbar();
  const queryClient = useQueryClient();
  const navigationReady = !!useRootNavigationState()?.key;
  const shown = useRef(new Set<string>());
  const registered = useRef<{ token: string; device: PushDevice } | null>(null);
  const role = user?.role;

  // Permission, Android channel and the iPhone's token.
  useEffect(() => {
    if (!token) {
      const previous = registered.current;
      registered.current = null;
      if (previous) void devicesApi.unregister(previous.device, previous.token).catch(() => {});
      return;
    }
    void (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'Telehealth',
          importance: Notifications.AndroidImportance.HIGH,
        }).catch(() => {});
      }
      const permission = await Notifications.requestPermissionsAsync().catch(() => null);
      if (Platform.OS !== 'ios' || !pushNotificationsEnabled || !permission?.granted) return;
      try {
        const { data } = await Notifications.getDevicePushTokenAsync();
        const device: PushDevice = { platform: 'IOS', kind: 'APNS', token: String(data) };
        registered.current = { token, device };
        await devicesApi.register(device, token);
      } catch {
        // No push entitlement or no network: notifications still arrive by polling.
      }
    })();
  }, [token]);

  // Pushes received while open, and taps on pushes (including the one that opened the app).
  useEffect(() => {
    if (!navigationReady || !token || !role) return;

    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    const open = (data: Record<string, unknown> | undefined, title?: string) => {
      const target = targetOf(data);
      if (target.notificationId) void notificationsApi.markRead(target.notificationId).catch(() => {});
      openNotification(target, role, title);
      refresh();
    };

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const target = targetOf(data);
      if (target.notificationId) shown.current.add(target.notificationId);
      refresh();
      showSnackbar({
        message: title ?? t('notifications.title'),
        detail: body ?? undefined,
        action: { label: t('common.show'), onPress: () => open(data, title ?? undefined) },
      });
    });
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      const { title, data } = response.notification.request.content;
      open(data, title ?? undefined);
    });

    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      Notifications.clearLastNotificationResponse();
      const { title, data } = launch.notification.request.content;
      open(data, title ?? undefined);
    }
    return () => {
      received.remove();
      responded.remove();
    };
  }, [navigationReady, token, role, queryClient, showSnackbar, t]);

  // Without push (or when a push is late), polling finds new notifications while the app is open.
  useEffect(() => {
    if (!navigationReady || !token || !role) return;
    let first = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      try {
        const unread = await notificationsApi.unread();
        queryClient.setQueryData(queryKeys.unread(getLanguage()), unread);
        const latest = unread.latest;
        if (!latest || shown.current.has(latest.id)) return;
        shown.current.add(latest.id);
        const fresh = Date.now() - new Date(latest.createdAt).getTime() < FRESH_MS;
        // Notifications that were already there when the app opened get no snackbar.
        if (first || !fresh) return;
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        showSnackbar({
          message: latest.title,
          detail: latest.body,
          action: {
            label: t('common.show'),
            onPress: () => {
              void notificationsApi.markRead(latest.id).catch(() => {});
              openNotification(latest, role, latest.title);
            },
          },
        });
      } catch {
        // Try again on the next tick.
      } finally {
        first = false;
      }
    };

    const start = () => {
      if (timer) return;
      void check();
      timer = setInterval(check, UNREAD_POLL_MS);
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
  }, [navigationReady, token, role, queryClient, showSnackbar, t]);

  return null;
}
