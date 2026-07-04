import 'react-native-url-polyfill/auto';
import { createClient, Session } from '@supabase/supabase-js';
import { secureStorageAdapter } from './secure-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// The storage key supabase-js derives by default: `sb-<ref>-auth-token`. We
// don't override `storageKey` (that would move existing users' sessions to a
// new key and sign everyone out), so we reconstruct the same default to read it.
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/**
 * Read the persisted auth session straight from secure storage.
 *
 * Offline fallback: when the access token is expired, `supabase.auth.getSession()`
 * tries to refresh it, and if the network is unreachable it returns
 * `{ session: null }` — even though the session is still in storage (it's only
 * removed on a NON-retryable error). That makes a killed-then-reopened offline
 * app look signed out. This lets us recover the stored session so the traveller
 * stays signed in offline; auto-refresh revalidates the token once back online.
 */
export async function readPersistedSession(): Promise<Session | null> {
  try {
    const raw = await secureStorageAdapter.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token && parsed?.refresh_token && parsed?.user
      ? (parsed as Session)
      : null;
  } catch {
    return null;
  }
}

/**
 * TEMP diagnostic (remove after debugging offline-auth). Surfaces, on-device,
 * the exact auth/storage state so we can see whether the session is persisted,
 * whether getSession sees it, whether our fallback recovers it, and whether
 * SecureStore round-trips at all. Rendered on the Profile screen footer.
 */
export async function authDiagnostics(): Promise<string> {
  let raw: string | null = null;
  let readErr = '';
  try {
    raw = await secureStorageAdapter.getItem(AUTH_STORAGE_KEY);
  } catch (e) {
    readErr = String((e as Error)?.message ?? e).slice(0, 30);
  }
  let sess = 'null';
  try {
    const { data } = await supabase.auth.getSession();
    sess = data.session?.user?.id?.slice(0, 8) ?? 'null';
  } catch (e) {
    sess = 'err:' + String((e as Error)?.message ?? e).slice(0, 20);
  }
  const fallback = (await readPersistedSession()) ? 'found' : 'null';
  let rt = '';
  try {
    await secureStorageAdapter.setItem('diag_rt', 'x');
    rt = (await secureStorageAdapter.getItem('diag_rt')) === 'x' ? 'ok' : 'fail';
  } catch (e) {
    rt = 'err:' + String((e as Error)?.message ?? e).slice(0, 20);
  }
  const rawInfo = raw ? `${raw.length}b` : readErr || 'null';
  return `key=…${AUTH_STORAGE_KEY.slice(-18)} raw=${rawInfo} getSession=${sess} fallback=${fallback} rt=${rt}`;
}
