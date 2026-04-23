import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 2 minutes
      staleTime: 2 * 60 * 1000,
      // Keep unused data in cache for 24 hours (important for offline)
      gcTime: 24 * 60 * 60 * 1000,
      // Retry failed requests twice with exponential backoff
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      // Refetch when window/app regains focus
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Persists TanStack Query cache to AsyncStorage.
 * On app restart, previously viewed places are available immediately
 * (even offline) while fresh data loads in the background.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'halalnomad-query-cache',
  // Only persist data that's less than 24 hours old
  throttleTime: 2000,
});
