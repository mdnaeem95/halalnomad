import { useCallback, useEffect, useState } from 'react';
import {
  checkPremiumStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../lib/revenue-cat';
import { PurchasesPackage } from 'react-native-purchases';
import { track, EVENTS } from '../lib/analytics';

interface PremiumState {
  /** Whether the user has an active premium subscription */
  isPremium: boolean;
  /** Whether we're still checking subscription status */
  isLoading: boolean;
  /** Available subscription packages from the store */
  packages: PurchasesPackage[];
  /** Purchase a package. Returns true if successful. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  /** Restore previous purchases. Returns true if premium restored. */
  restore: () => Promise<boolean>;
  /** Re-check premium status */
  refresh: () => Promise<void>;
}

export function usePremium(): PremiumState {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [status, pkgs] = await Promise.all([
        checkPremiumStatus(),
        getOfferings(),
      ]);
      setIsPremium(status);
      setPackages(pkgs);
    } catch {
      // Fail silently — free tier still works
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const info = await purchasePackage(pkg);
      if (info?.entitlements.active['HalalNomad Premium']) {
        setIsPremium(true);
        track('subscription_purchased', {
          package: pkg.identifier,
          price: pkg.product.priceString,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const restored = await restorePurchases();
      setIsPremium(restored);
      if (restored) {
        track('subscription_restored');
      }
      return restored;
    } catch {
      return false;
    }
  }, []);

  return { isPremium, isLoading, packages, purchase, restore, refresh };
}
