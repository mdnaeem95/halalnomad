// Feature flags. Single source of truth for in-app gates.
//
// Each flag exists for a deliberate reason — never toggle just to "see what
// happens." Keep the comment current with why a flag is on/off so future
// Claude or future-you doesn't re-litigate the decision.

export const FEATURES = {
  /**
   * Premium subscription tier (RevenueCat).
   *
   * Disabled at v1.0 launch (April 2026) because the Premium features
   * promised in the original paywall (offline maps, advanced filters,
   * trip planning) aren't actually built yet — they're scoped for
   * Phase 2 (May 2027 deadline per business-roadmap.md).
   *
   * Apple rejected the subscription metadata for this exact reason
   * ("description claims features the binary doesn't deliver"). Pulling
   * the paywall from the user-facing flow until Phase 2 features land
   * and we can offer real, defendable value.
   *
   * RevenueCat init + the entire premium code path stays intact — only
   * UI is gated. Re-enabling is a one-line flip.
   *
   * To re-enable:
   *   1. Build at least one Premium feature with real, demoable value
   *   2. Update App Store Connect subscription description to match
   *   3. Submit a new app version with the subs attached for review
   *   4. Mark `premiumEnabled: true` here, push OTA
   *   5. Re-enable products in ASC ("Available for Sale")
   */
  premiumEnabled: false,
} as const;
