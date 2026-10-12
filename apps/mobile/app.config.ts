/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist } from 'expo/config-plugins';

// Android needs the Firebase config file: expo-callkit-telecom registers for FCM pushes when the
// app starts and crashes without it. An Android build without the file fails with a clear error
// instead (see docs/CALLS_SETUP.md). iOS doesn't use it.
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

// FREE_APPLE_ID=1 makes an iPhone build that a free Apple ID (Xcode's "Personal Team") can sign:
// - without push notifications, which need the paid Apple Developer Program, so the phone only
//   rings while the app is open;
// - with its own bundle ID, because a bundle ID can't move to another Apple team later and the
//   real one must stay free for the production account.
const FREE_APPLE_ID = process.env.FREE_APPLE_ID === '1';
const FREE_APPLE_ID_BUNDLE_ID = 'al.telehealth.app.test';

export default ({ config }: ConfigContext): ExpoConfig => {
  const result: ExpoConfig = {
    ...(config as ExpoConfig),
    ios: FREE_APPLE_ID ? { ...config.ios, bundleIdentifier: FREE_APPLE_ID_BUNDLE_ID } : config.ios,
    android: {
      ...config.android,
      googleServicesFile: GOOGLE_SERVICES_FILE,
    },
    // The app reads this to tell doctors to keep it open, and to skip asking iOS for a push token.
    extra: { ...config.extra, pushNotifications: !FREE_APPLE_ID },
  };
  if (!FREE_APPLE_ID) {
    return result;
  }
  // Added before app.json's plugins, so it runs after them and removes the entitlement that
  // expo-callkit-telecom adds.
  return withEntitlementsPlist(result, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
