import { permissions } from '@livekit/react-native-webrtc';
import { PermissionsAndroid, Platform, type Permission } from 'react-native';

/**
 * Asks for the microphone (and camera for video). Returns false if a required one was refused.
 * `notifications` also asks Android for notifications (ringing, ongoing call); leave it off while
 * answering, so no prompt appears in the middle of a call.
 */
export async function ensureCallPermissions(video: boolean, notifications = false): Promise<boolean> {
  if (Platform.OS !== 'android') {
    const microphone: boolean = await permissions.request({ name: 'microphone' });
    const camera: boolean = video ? await permissions.request({ name: 'camera' }) : true;
    return microphone && camera;
  }

  const { RECORD_AUDIO, CAMERA, POST_NOTIFICATIONS } = PermissionsAndroid.PERMISSIONS;
  const wanted: Permission[] = [RECORD_AUDIO];
  if (video) wanted.push(CAMERA);
  // Not required to make a call.
  if (notifications && Platform.Version >= 33) wanted.push(POST_NOTIFICATIONS);

  const result = await PermissionsAndroid.requestMultiple(wanted);
  const granted = (permission: Permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED;
  return granted(RECORD_AUDIO) && (!video || granted(CAMERA));
}
