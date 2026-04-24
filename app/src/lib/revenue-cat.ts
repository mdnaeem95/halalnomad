import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

/**
 * Initialize RevenueCat.
 * Call once on app launch after auth is resolved.
 */
export async function initRevenueCat(userId?: string) {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn('RevenueCat API key not configured — subscriptions disabled');
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey,
    appUserID: userId ?? undefined,
  });
}

/**
 * Link a signed-in user to their RevenueCat account.
 */
export async function loginRevenueCat(userId: string) {
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('RevenueCat login failed:', e);
  }
}

/**
 * Reset RevenueCat identity on sign out.
 */
export async function logoutRevenueCat() {
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('RevenueCat logout failed:', e);
  }
}

/**
 * Check if the user has an active premium subscription.
 */
export async function checkPremiumStatus(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['HalalNomad Premium'] !== undefined;
  } catch (e) {
    console.warn('RevenueCat getCustomerInfo failed:', e);
    return false;
  }
}

/**
 * Fetch available subscription packages.
 */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      console.warn('RevenueCat: no current offering configured');
      return [];
    }
    return current.availablePackages;
  } catch (e) {
    console.warn('RevenueCat getOfferings failed:', e);
    return [];
  }
}

/**
 * Purchase a subscription package.
 * Returns the updated CustomerInfo if successful.
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: any) {
    if (e.userCancelled) return null;
    throw e;
  }
}

/**
 * Restore previous purchases (e.g., after reinstall).
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['HalalNomad Premium'] !== undefined;
  } catch {
    return false;
  }
}
