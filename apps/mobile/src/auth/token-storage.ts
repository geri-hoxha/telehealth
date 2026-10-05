import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth.accessToken";

/**
 * iOS: readable once the phone has been unlocked after starting, so a doctor can answer a call
 * on the lock screen (the app then starts in the background and needs the token for the API).
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** The access token lives in the Keychain (iOS) / Keystore (Android), never in plain storage. */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY, OPTIONS),
  // Deleted first because updating an existing entry keeps its old accessibility.
  set: async (token: string) => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.setItemAsync(TOKEN_KEY, token, OPTIONS);
  },
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
