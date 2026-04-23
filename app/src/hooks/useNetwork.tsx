import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

const NetworkContext = createContext<NetworkState>({
  isConnected: true,
  isInternetReachable: true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    // Sync TanStack Query's online status with actual network state.
    // When offline, queries pause and mutations queue.
    // When back online, everything resumes automatically.
    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      const connected = netState.isConnected ?? true;
      const reachable = netState.isInternetReachable ?? true;

      setState({ isConnected: connected, isInternetReachable: reachable });
      onlineManager.setOnline(connected && reachable);
    });

    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={state}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
