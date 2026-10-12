import { router } from 'expo-router';
import type { CallMedia } from '@/api/types';

/**
 * Patient: opens the call screen, which creates the call. `preferredDoctorId` comes from a free
 * line notification ("Call now"), `eventId` from "Request a call" in a live activity.
 */
export function startCall(media: CallMedia, options: { preferredDoctorId?: string; eventId?: string } = {}) {
  router.push({
    pathname: '/call',
    params: {
      media,
      ...(options.preferredDoctorId ? { preferredDoctorId: options.preferredDoctorId } : {}),
      ...(options.eventId ? { eventId: options.eventId } : {}),
    },
  });
}
