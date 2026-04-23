import * as SecureStore from 'expo-secure-store';

/**
 * Supabase-compatible storage adapter using expo-secure-store.
 * Stores auth tokens in the OS Keychain (iOS) or EncryptedSharedPreferences (Android)
 * instead of plain AsyncStorage.
 */
export const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};
