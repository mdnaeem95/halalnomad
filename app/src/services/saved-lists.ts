/**
 * Trip Planning M1 — saved_lists data access.
 *
 * Writes are idempotent so the durable write-queue can replay them safely:
 *   - create = UPSERT by the client-supplied UUID (ignoreDuplicates), so a
 *     replay after a lost ack is a no-op rather than a duplicate-key error,
 *     and it never clobbers a server-side rename that landed in between.
 *   - rename / delete are keyed by id and idempotent by construction.
 *
 * RLS (migration-023) scopes every row to its owner with WITH CHECK, so these
 * can't read or write across users even though we also pass user_id explicitly.
 */

import { supabase } from '../lib/supabase';
import { sanitizeText } from '../lib/sanitize';
import { registerWriteHandler } from '../lib/write-queue';
import { SavedList } from '../types';

export const LIST_NAME_MAX = 80; // matches the saved_lists_name_len CHECK

export async function fetchSavedLists(userId: string): Promise<SavedList[]> {
  const { data, error } = await supabase
    .from('saved_lists')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SavedList[];
}

/**
 * Create via UPSERT-by-id. `ignoreDuplicates` makes a replay of the same
 * client UUID a no-op. We send only the columns we own; `updated_at` is set by
 * the DB trigger, never by the client.
 */
export async function createSavedList(row: {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from('saved_lists')
    .upsert(
      {
        id: row.id,
        user_id: row.user_id,
        name: sanitizeText(row.name).slice(0, LIST_NAME_MAX),
        is_default: row.is_default,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (error) throw error;
}

export async function renameSavedList(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('saved_lists')
    .update({ name: sanitizeText(name).slice(0, LIST_NAME_MAX) })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSavedList(id: string): Promise<void> {
  const { error } = await supabase.from('saved_lists').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Wire the durable write-queue handlers to the idempotent service calls.
 * Call this once at app launch BEFORE initWriteQueue() so a launch-drain has
 * its handlers registered. Payload shapes are the enqueue payloads from
 * useSavedLists.
 */
export function registerSavedListWriteHandlers(): void {
  registerWriteHandler('list_create', (p: {
    id: string;
    user_id: string;
    name: string;
    is_default: boolean;
  }) => createSavedList(p));
  registerWriteHandler('list_rename', (p: { id: string; name: string }) =>
    renameSavedList(p.id, p.name)
  );
  registerWriteHandler('list_delete', (p: { id: string }) => deleteSavedList(p.id));
}
