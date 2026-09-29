import { NativeModule, requireNativeModule } from 'expo';
import type { AcsCallingEvents, CallAction, CallMedia, JoinOptions, PushToken } from './AcsCalling.types';

declare class AcsCallingModule extends NativeModule<AcsCallingEvents> {
  /**
   * Lets native code call the API on its own, e.g. to decline a call from the lock screen or to
   * look up the caller's name while the phone rings. Pass nulls on sign-out.
   */
  configureApi(baseUrl: string | null, accessToken: string | null): void;
  getPushToken(): Promise<PushToken | null>;
  /** The answer (or notification tap) that opened the app, if it hasn't been handled yet. Clears it. */
  takeLaunchAction(): Promise<CallAction | null>;
  /** Rings for a call the app found itself (while open), using the system call UI. */
  showIncomingCall(callId: string, media: CallMedia, callerName: string): Promise<void>;
  dismissIncomingCall(callId: string): Promise<void>;
  /** iOS: asks for the microphone (and camera). Android asks from JavaScript instead. */
  requestPermissions(video: boolean): Promise<boolean>;

  join(options: JoinOptions): Promise<void>;
  hangUp(): Promise<void>;
  setMicrophoneMuted(muted: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
  switchCamera(): Promise<void>;
  setSpeakerOn(on: boolean): Promise<void>;
}

export default requireNativeModule<AcsCallingModule>('AcsCalling');
