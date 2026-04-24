import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

// In-memory diagnostic state. Read via getRevenueCatDiagnostics() and surfaced
// on the paywall when packages are empty, so we can debug production builds
// without a JS console. Remove once TestFlight subscriptions are confirmed
// working and the app ships.
export type RevenueCatDiagnostics = {
  apiKeyPrefix: string | null;
  configured: boolean;
  lastOfferingsError: string | null;
  lastOfferingsEmpty: boolean | null;
  offeringCount: number;
  currentOfferingId: string | null;
  packageCount: number;
};

const diag: RevenueCatDiagnostics = {
  apiKeyPrefix: null,
  configured: false,
  lastOfferingsError: null,
  lastOfferingsEmpty: null,
  offeringCount: 0,
  currentOfferingId: null,
  packageCount: 0,
};

export function getRevenueCatDiagnostics(): RevenueCatDiagnostics {
  return { ...diag };
}

/**
 * Initialize RevenueCat.
 * Call once on app launch after auth is resolved.
 */
export async function initRevenueCat(userId?: string) {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    diag.apiKeyPrefix = null;
    diag.configured = false;
    console.warn('RevenueCat API key not configured — subscriptions disabled');
    return;
  }

  diag.apiKeyPrefix = apiKey.slice(0, 5);

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey,
    appUserID: userId ?? undefined,
  });
  diag.configured = true;
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
    diag.offeringCount = Object.keys(offerings.all ?? {}).length;
    const current = offerings.current;
    diag.currentOfferingId = current?.identifier ?? null;
    diag.lastOfferingsError = null;

    if (!current) {
      diag.lastOfferingsEmpty = true;
      diag.packageCount = 0;
      console.warn('RevenueCat: no current offering configured');
      return [];
    }
    const pkgs = current.availablePackages;
    diag.packageCount = pkgs.length;
    diag.lastOfferingsEmpty = pkgs.length === 0;
    return pkgs;
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    diag.lastOfferingsError = msg;
    diag.lastOfferingsEmpty = null;
    diag.packageCount = 0;
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
