import { AcsCalling } from '@modules/acs-calling';
import { PermissionsAndroid, Platform, type Permission } from 'react-native';

/** Asks for the microphone (and camera for video). Returns false if a required one was refused. */
export async function ensureCallPermissions(video: boolean): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return AcsCalling.requestPermissions(video);
  }

  const { RECORD_AUDIO, CAMERA, POST_NOTIFICATIONS } = PermissionsAndroid.PERMISSIONS;
  const wanted: Permission[] = [RECORD_AUDIO];
  if (video) wanted.push(CAMERA);
  // Needed for the ringing notification; not required to make a call.
  if (Platform.Version >= 33) wanted.push(POST_NOTIFICATIONS);

  const result = await PermissionsAndroid.requestMultiple(wanted);
  const granted = (permission: Permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED;
  return granted(RECORD_AUDIO) && (!video || granted(CAMERA));
}
