import type { StyleProp, ViewStyle } from 'react-native';

export type CallMedia = 'AUDIO' | 'VIDEO';

export interface PushToken {
  platform: 'IOS' | 'ANDROID';
  /** VOIP: an iOS PushKit token. FCM: an Android Firebase token. */
  kind: 'VOIP' | 'FCM';
  token: string;
}

/**
 * Something the user did on the system's incoming-call UI.
 * answer: they answered (CallKit on iOS, the notification's Answer button on Android).
 * show: they tapped the ringing notification (Android), so the app should show its own ringing screen.
 */
export interface CallAction {
  type: 'answer' | 'show';
  callId: string;
  media: CallMedia;
}

export interface JoinOptions {
  callId: string;
  roomId: string;
  /** ACS access token for the room. */
  token: string;
  displayName: string;
  /** Start with the camera on. */
  video: boolean;
}

/** ACS call states, lower-cased (connecting, connected, disconnecting, disconnected, …). */
export type NativeCallState = string;

export type AcsCallingEvents = {
  onPushToken: (token: PushToken) => void;
  onCallAction: (action: CallAction) => void;
  /** A ringing call stopped ringing: declined on this phone, cancelled by the patient, or timed out. */
  onIncomingCallEnded: (event: { callId: string; reason: 'declined' | 'cancelled' | 'timeout' }) => void;
  onCallStateChanged: (event: { state: NativeCallState }) => void;
  /** The joined call ended: hung up from the system UI (local) or by the other side / network (remote). */
  onCallEnded: (event: { callId: string; reason: 'local' | 'remote' }) => void;
  onRemoteParticipantsChanged: (event: { count: number }) => void;
  onRemoteVideoChanged: (event: { available: boolean }) => void;
  onLocalVideoChanged: (event: { enabled: boolean }) => void;
  onMutedChanged: (event: { muted: boolean }) => void;
};

export interface AcsVideoViewProps {
  /** Which video to show: this phone's camera or the other participant's. */
  source: 'local' | 'remote';
  style?: StyleProp<ViewStyle>;
}
