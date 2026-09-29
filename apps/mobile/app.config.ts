/// <reference types="node" />
import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Android push (incoming calls) needs the Firebase config file. Builds still work without it;
// the phone then only rings while the app is open.
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    ...(existsSync(GOOGLE_SERVICES_FILE) ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
  },
});
