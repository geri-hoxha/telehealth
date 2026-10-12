/// <reference types="node" />
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist } from 'expo/config-plugins';

// Android needs the Firebase config file: expo-callkit-telecom registers for FCM pushes when the
// app starts and crashes without it. An Android build without the file fails with a clear error
// instead (see docs/CALLS_SETUP.md). iOS doesn't use it.
const GOOGLE_SERVICES_FILE = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

// iPhone test builds until the app has its own paid Apple account. Each has its own bundle ID,
// because a bundle ID can't move to another Apple team later and the real one must stay free for
// the production account:
// - SIGAL_TEAM=1: SIGAL's paid team, with push. The API needs an APNs key from that team.
// - FREE_APPLE_ID=1: a free Apple ID (Xcode's "Personal Team"). It can't sign push, so the phone
//   only rings while the app is open, and the app stops opening after 7 days.
const SIGAL_TEAM = process.env.SIGAL_TEAM === '1';
const FREE_APPLE_ID = !SIGAL_TEAM && process.env.FREE_APPLE_ID === '1';

export default ({ config }: ConfigContext): ExpoConfig => {
  const result: ExpoConfig = {
    ...(config as ExpoConfig),
    ios: SIGAL_TEAM
      ? { ...config.ios, appleTeamId: 'UJM594GCMV', bundleIdentifier: 'al.telehealth.app.sigal' }
      : FREE_APPLE_ID
        ? { ...config.ios, bundleIdentifier: 'al.telehealth.app.test' }
        : config.ios,
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
