import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

interface BiometricState {
  /** Whether the device supports biometric auth */
  isAvailable: boolean;
  /** The type of biometric (fingerprint, facial, iris) */
  biometricType: string | null;
  /** Prompt the user for biometric authentication */
  authenticate: () => Promise<boolean>;
}

/**
 * Hook for biometric authentication (Face ID, Touch ID, fingerprint).
 * Used for optional "unlock with biometrics" on app resume.
 */
export function useBiometrics(): BiometricState {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    checkAvailability();
  }, []);

  async function checkAvailability() {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (compatible && enrolled) {
      setIsAvailable(true);

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Fingerprint');
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        setBiometricType('Iris');
      }
    }
  }

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock HalalNomad',
      cancelLabel: 'Use password',
      disableDeviceFallback: false,
    });

    return result.success;
  }, [isAvailable]);

  return { isAvailable, biometricType, authenticate };
}
