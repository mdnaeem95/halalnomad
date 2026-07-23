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
import { queryClient } from '../lib/query-client';
import { sanitizeText } from '../lib/sanitize';
import { registerWriteHandler, onQueueIdle, setBeforeDrain } from '../lib/write-queue';
import { ListPlace, Place, SavedList } from '../types';

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

// --- Save-to-trip (Wk2) ---------------------------------------------------

/**
 * Atomic default-trip create (clears any old default, sets this one) via the
 * set_default_trip RPC. Idempotent on the client UUID. Bypasses the soft cap.
 */
export async function setDefaultTrip(listId: string, title: string): Promise<void> {
  const { error } = await supabase.rpc('set_default_trip', {
    p_list_id: listId,
    p_title: sanitizeText(title).slice(0, LIST_NAME_MAX),
  });
  if (error) throw error;
}

/** Add a place to a list at the next 1000-step position (server-computed),
 *  idempotent on the (list_id, place_id) PK, via the add_place_to_list RPC. */
export async function addPlaceToList(
  listId: string,
  placeId: string,
  addedAt: string
): Promise<void> {
  const { error } = await supabase.rpc('add_place_to_list', {
    p_list_id: listId,
    p_place_id: placeId,
    p_added_at: addedAt,
  });
  if (error) throw error;
}

export interface SavedPlacePair {
  list_id: string;
  place_id: string;
}

/** Every (list_id, place_id) membership row the caller owns — ONE cache entry
 *  powering both the place-detail "Saved to N trips" state and the save-sheet
 *  membership checks (correct offline since it's persisted). RLS scopes
 *  saved_list_places to the owner, so no explicit user filter is needed. */
export async function fetchSavedPlacePairs(): Promise<SavedPlacePair[]> {
  const { data, error } = await supabase.from('saved_list_places').select('list_id, place_id');
  if (error) throw error;
  return (data ?? []) as SavedPlacePair[];
}

/** The places in a trip, ordered by `position` ASC (insertion order; the same
 *  key drag-reorder will mutate in Wk3). Joins the full place record so the
 *  detail screen renders offline from one persisted cache entry. RLS scopes the
 *  join rows to the owner; places are public-readable. */
export async function fetchListPlaces(listId: string): Promise<ListPlace[]> {
  const { data, error } = await supabase
    .from('saved_list_places')
    .select('position, places(*)')
    .eq('list_id', listId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.places)
    .map((r) => ({ ...(r.places as unknown as Place), position: r.position as number }));
}

/** Remove a place from a trip. Idempotent — deleting an already-removed
 *  (list_id, place_id) row is a no-op, so a queue replay never errors. */
export async function removePlaceFromList(listId: string, placeId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_list_places')
    .delete()
    .eq('list_id', listId)
    .eq('place_id', placeId);
  if (error) throw error;
}

/** Per-list place counts (list_id → count). Powers the My Trips place-count
 *  subtitle, the delete-confirm copy, and the A11y row label. RLS-scoped. */
export async function fetchSavedListPlaceCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('saved_list_places').select('list_id');
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const id = r.list_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Wire the durable write-queue handlers to the idempotent service calls.
 * Call this once at app launch BEFORE initWriteQueue() so a launch-drain has
 * its handlers registered. Payload shapes are the enqueue payloads from
 * useSavedLists.
 *
 * Reconciliation (refetch) is fired from the queue's onQueueIdle — once all
 * pending writes have committed and the queue is empty — NOT from the mutation's
 * onSettled. The write is async (the queue drains it), so a settle-time refetch
 * would race and beat the write, read stale server state, and clobber the
 * optimistic row. Reconciling on idle (vs per-op) also avoids a refetch landing
 * between two queued writes and momentarily dropping the second's optimistic row.
 */
export function registerSavedListWriteHandlers(): void {
  // Before any drain, resolve the session — online + expired, getSession()
  // refreshes the token, so writes (esp. RLS-filtered deletes) never run
  // unauthed and silently no-op. Prevents an offline remove from resurrecting.
  setBeforeDrain(async () => {
    await supabase.auth.getSession();
  });
  registerWriteHandler(
    'list_create',
    (p: { id: string; user_id: string; name: string; is_default: boolean }) => createSavedList(p)
  );
  registerWriteHandler('list_rename', (p: { id: string; name: string }) =>
    renameSavedList(p.id, p.name)
  );
  registerWriteHandler('list_delete', (p: { id: string }) => deleteSavedList(p.id));
  registerWriteHandler('default_trip_create', (p: { list_id: string; title: string }) =>
    setDefaultTrip(p.list_id, p.title)
  );
  registerWriteHandler(
    'place_add',
    (p: { list_id: string; place_id: string; added_at: string }) =>
      addPlaceToList(p.list_id, p.place_id, p.added_at)
  );
  registerWriteHandler('place_remove', (p: { list_id: string; place_id: string }) =>
    removePlaceFromList(p.list_id, p.place_id)
  );

  // After the queue fully drains, reconcile both caches with post-commit server
  // state. Fire-and-forget: a failed refetch must not affect the queue.
  onQueueIdle(() => {
    void queryClient.invalidateQueries({ queryKey: ['saved-lists'] });
    void queryClient.invalidateQueries({ queryKey: ['saved-places'] });
  });
}
