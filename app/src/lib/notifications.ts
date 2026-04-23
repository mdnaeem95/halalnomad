import { supabase } from './supabase';

/**
 * Toggle the user's notification opt-in. The edge function respects this on
 * every send; the DB trigger short-circuits too so we don't fill the queue.
 */
export async function setNotificationsEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ notifications_enabled: enabled })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Heartbeat: stamp profiles.last_active_at. Used for dormancy targeting.
 * Called on app foreground; rate-limited at the call site so we don't spam.
 */
export async function touchLastActive(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
}

/**
 * Persist the user's IANA timezone so the edge function can compute quiet hours.
 */
export async function saveUserTimezone(userId: string, timezone: string): Promise<void> {
  await supabase.from('profiles').update({ timezone }).eq('id', userId);
}
