import { AudioDeviceModule, AudioEngineAvailability } from '@livekit/react-native';
import * as CallKit from 'expo-callkit-telecom';
import { Platform } from 'react-native';

/**
 * iOS: CallKit decides when a call may use the microphone and speaker. expo-callkit-telecom
 * activates the audio session, but it can't reach LiveKit's WebRTC (a separate build), so LiveKit's
 * audio engine is kept off until CallKit activates the session, as in LiveKit's CallKit example.
 * Call once at startup, before any call starts. Android needs nothing: Core-Telecom handles audio.
 */
export function linkAudioEngineToCallKit(): void {
  if (Platform.OS !== 'ios') return;

  const setEngine = (availability: AudioEngineAvailability) =>
    void AudioDeviceModule.setEngineAvailability(availability).catch(() => {});

  setEngine(AudioEngineAvailability.none);
  CallKit.addAudioSessionActivatedListener(() => setEngine(AudioEngineAvailability.default));
  CallKit.addAudioSessionDeactivatedListener(() => setEngine(AudioEngineAvailability.none));
}
