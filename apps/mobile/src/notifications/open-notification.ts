import { router } from 'expo-router';
import type { AppNotification } from '@/api/types';

/** What tapping a notification (in the list, a snackbar or a push) opens. */
export interface NotificationTarget {
  type?: AppNotification['type'] | string;
  folderId?: string | null;
  eventId?: string | null;
  doctorId?: string | null;
  url?: string | null;
}

/**
 * Opens the folder, event or link a notification points to. A free line opens the notifications
 * list, where its "Call now" button is: a tap should never start a call by surprise.
 */
export function openNotification(target: NotificationTarget, role: 'PATIENT' | 'DOCTOR', title?: string): boolean {
  if (target.folderId) {
    router.push({ pathname: '/folders/[id]', params: { id: target.folderId } });
    return true;
  }
  if (target.eventId && role === 'PATIENT') {
    router.push({ pathname: '/events/[id]', params: { id: target.eventId } });
    return true;
  }
  if (target.url) {
    router.push({ pathname: '/web', params: { url: target.url, title: title ?? '' } });
    return true;
  }
  if (target.type === 'FREE_LINE' && role === 'PATIENT') {
    router.push('/notifications');
    return true;
  }
  return false;
}
