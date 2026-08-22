import * as Haptics from 'expo-haptics';

/**
 * App-wide haptics — one semantic surface so feedback is consistent everywhere
 * (M3 Wk-3 close). Before this, callsites reached for `expo-haptics` directly
 * with inconsistent types (selection vs light-impact for the same gesture).
 *
 * Fire-and-forget: never awaited, never throws into the UI. On iOS,
 * `expo-haptics` already honours the system "System Haptics" setting (the
 * silent/haptics-off toggle), so a device-level opt-out is respected here for
 * free — no extra gating needed.
 *
 * Semantics (pick by MEANING, not by feel):
 *   selection() — a discrete choice changed: toggles, tab press, day pick,
 *                 a reorder step, filter change.
 *   impact()    — a primary button/affordance was activated (default light).
 *   success()   — a write committed: saved, verified, added, reported.
 *   warning()   — a blocked / negative outcome: a gate hit, an invalid action.
 */
function safe(run: () => Promise<unknown>): void {
  // Haptics are non-critical cosmetic feedback — a failure (unsupported
  // device, backgrounded app) must never surface or reject.
  run().catch(() => {});
}

type ImpactLevel = 'light' | 'medium' | 'heavy';
const IMPACT: Record<ImpactLevel, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export const haptics = {
  selection: () => safe(() => Haptics.selectionAsync()),
  impact: (level: ImpactLevel = 'light') => safe(() => Haptics.impactAsync(IMPACT[level])),
  success: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
