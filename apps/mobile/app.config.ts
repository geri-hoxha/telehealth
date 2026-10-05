/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Android needs the Firebase config file: expo-callkit-telecom registers for FCM pushes when the
// app starts and crashes without it. An Android build without the file fails with a clear error
// instead (see docs/CALLS_SETUP.md). iOS doesn't use it.
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    googleServicesFile: GOOGLE_SERVICES_FILE,
  },
});
