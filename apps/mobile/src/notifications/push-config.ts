import Constants from 'expo-constants';

/**
 * False in iPhone builds signed with a free Apple ID (FREE_APPLE_ID=1): they have no push
 * entitlement, so the phone rings and gets notifications only while the app is open.
 */
export const pushNotificationsEnabled = Constants.expoConfig?.extra?.pushNotifications !== false;
