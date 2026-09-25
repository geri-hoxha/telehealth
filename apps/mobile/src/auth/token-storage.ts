import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth.accessToken";

/** The access token lives in the Keychain (iOS) / Keystore (Android), never in plain storage. */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
