import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { track, EVENTS } from './analytics';

const REVIEW_STORAGE_KEY = 'halalnomad_review_state';
const POSITIVE_ACTIONS_THRESHOLD = 3;

interface ReviewState {
  positiveActions: number;
  hasPrompted: boolean;
  lastPromptedAt: string | null;
}

async function getState(): Promise<ReviewState> {
  const raw = await AsyncStorage.getItem(REVIEW_STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { positiveActions: 0, hasPrompted: false, lastPromptedAt: null };
}

async function setState(state: ReviewState) {
  await AsyncStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Record a positive user action (verified a place, added a place, wrote a review).
 * After 3 positive actions, prompt for app store review — but only once.
 *
 * This follows Apple/Google guidelines:
 * - Don't prompt on first launch
 * - Prompt after the user has had a positive experience
 * - Don't prompt repeatedly
 */
export async function recordPositiveAction() {
  const state = await getState();

  if (state.hasPrompted) return;

  state.positiveActions += 1;
  await setState(state);

  if (state.positiveActions >= POSITIVE_ACTIONS_THRESHOLD) {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      track(EVENTS.APP_RATING_PROMPTED);

      // Small delay so it doesn't feel jarring after an action
      setTimeout(async () => {
        await StoreReview.requestReview();
        track(EVENTS.APP_RATING_ACCEPTED);
        await setState({
          ...state,
          hasPrompted: true,
          lastPromptedAt: new Date().toISOString(),
        });
      }, 1500);
    }
  }
}
