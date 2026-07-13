/**
 * Trip Planning M1 — saved_lists CRUD hooks.
 *
 * Mutation shape (mirrors useVerifyPlace): optimistic onMutate + rollback, then
 * the write is handed to the durable FIFO write-queue rather than executed
 * inline. `mutationFn` only ENQUEUES (+ best-effort drain) — so create / rename
 * / delete behave identically online and offline, and survive an app-kill. The
 * queue replays via the idempotent service handlers on launch / reconnect.
 *
 * Events fire on enqueue success ("durably accepted"), not on server ack —
 * offline the ack may never arrive this session, and PostHog queues offline too.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSavedLists,
  fetchSavedPlaceIds,
  fetchSavedListPlaceCounts,
  fetchListPlaces,
} from '../services/saved-lists';
import { enqueue, drainWriteQueue } from '../lib/write-queue';
import { useAuth } from './useAuth';
import { uuidv4 } from '../lib/uuid';
import { captureError } from '../lib/sentry';
import { track, EVENTS } from '../lib/analytics';
import { ListPlace, Place, SavedList } from '../types';

// v1 soft cap. Enforced client-side (the screen disables create at the cap and
// the create() helper throws LIST_CAP_REACHED as a backstop). No server CHECK —
// kept soft so we can relax it without a migration.
export const LIST_SOFT_CAP = 10;

export const savedListKeys = {
  all: ['saved-lists'] as const,
  list: (userId: string) => ['saved-lists', userId] as const,
};

export const savedPlaceKeys = {
  all: ['saved-places'] as const,
  ids: (userId: string) => ['saved-places', userId] as const,
  // Keyed under 'saved-places' so the write-queue's onQueueIdle invalidation
  // (which invalidates the whole 'saved-places' family) refreshes it too.
  listPlaces: (listId: string) => ['saved-places', 'list', listId] as const,
};

export function useSavedLists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: savedListKeys.list(user?.id ?? 'anon'),
    queryFn: () => fetchSavedLists(user!.id),
    enabled: !!user,
  });
}

/** Place ids saved across all of the user's trips — for the place-detail
 *  "Saved" indicator. */
export function useSavedPlaceIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: savedPlaceKeys.ids(user?.id ?? 'anon'),
    queryFn: () => fetchSavedPlaceIds(),
    enabled: !!user,
  });
}

/** Per-list place counts (list_id → count). Keyed under 'saved-places' so the
 *  write-queue's onQueueIdle invalidation refreshes it after any place add. */
export function useSavedListCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...savedPlaceKeys.all, 'counts', user?.id ?? 'anon'] as const,
    queryFn: () => fetchSavedListPlaceCounts(),
    enabled: !!user,
  });
}

/** The places inside a trip, ordered by position ASC. One joined query →
 *  one persisted cache entry, so a trip opened online renders offline. */
export function useListPlaces(listId: string | undefined) {
  return useQuery({
    queryKey: savedPlaceKeys.listPlaces(listId ?? ''),
    queryFn: () => fetchListPlaces(listId!),
    enabled: !!listId,
  });
}

export function useRemovePlace() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (vars: { listId: string; placeId: string }) => {
      await enqueue('place_remove', `${vars.listId}:${vars.placeId}`, {
        list_id: vars.listId,
        place_id: vars.placeId,
      });
      void drainWriteQueue();
    },
    onMutate: async ({ listId, placeId }) => {
      const listKey = savedPlaceKeys.listPlaces(listId);
      const countsKey = [...savedPlaceKeys.all, 'counts', user?.id ?? 'anon'] as const;
      await queryClient.cancelQueries({ queryKey: listKey });
      const prevList = queryClient.getQueryData<ListPlace[]>(listKey);
      const prevCounts = queryClient.getQueryData<Record<string, number>>(countsKey);
      // Drop the row + keep the My Trips count subtitle consistent (cache
      // update, not a refetch dependency).
      queryClient.setQueryData<ListPlace[]>(listKey, (old = []) =>
        old.filter((p) => p.id !== placeId)
      );
      queryClient.setQueryData<Record<string, number>>(countsKey, (old = {}) => ({
        ...old,
        [listId]: Math.max(0, (old[listId] ?? 1) - 1),
      }));
      return { prevList, prevCounts, listKey, countsKey };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevList) queryClient.setQueryData(ctx.listKey, ctx.prevList);
      if (ctx?.prevCounts) queryClient.setQueryData(ctx.countsKey, ctx.prevCounts);
      captureError(err as Error, { mutation: 'removePlace' });
    },
    onSuccess: (_data, { listId, placeId }) => {
      track(EVENTS.PLACE_REMOVED_FROM_LIST, { place_id: placeId, list_id: listId });
    },
    // Reconciliation (incl. the place-detail "Saved" indicator) fires post-commit
    // from the write-queue onQueueIdle.
  });
}

type CreateSource = 'first_save' | 'manual';

export function useCreateList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (vars: { row: SavedList; source: CreateSource }) => {
      await enqueue('list_create', vars.row.id, {
        id: vars.row.id,
        user_id: vars.row.user_id,
        name: vars.row.name,
        is_default: vars.row.is_default,
      });
      void drainWriteQueue();
    },
    onMutate: async ({ row }) => {
      const key = savedListKeys.list(row.user_id);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<SavedList[]>(key);
      // updated_at desc → a fresh create sorts to the top.
      queryClient.setQueryData<SavedList[]>(key, (old = []) => [row, ...old]);
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev && ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
      captureError(err as Error, { mutation: 'createList' });
    },
    onSuccess: (_data, { row, source }) => {
      track(EVENTS.TRIP_LIST_CREATED, {
        list_id: row.id,
        is_default: row.is_default,
        source,
      });
    },
    // No onSettled refetch: the write is performed async by the queue, so a
    // settle-time invalidate would race and beat it. The reconciling refetch is
    // fired post-commit from the write-queue handler (see saved-lists service).
  });

  /**
   * Build the row (client UUID) and fire the optimistic mutation. Throws
   * synchronously if not signed in or at the soft cap, so the screen can show a
   * message without a half-applied optimistic state.
   */
  function create(name: string, source: CreateSource = 'manual'): void {
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const existing = queryClient.getQueryData<SavedList[]>(savedListKeys.list(user.id)) ?? [];
    if (existing.length >= LIST_SOFT_CAP) {
      const e = new Error('LIST_CAP_REACHED');
      (e as Error & { code?: string }).code = 'LIST_CAP_REACHED';
      throw e;
    }
    const now = new Date().toISOString();
    const row: SavedList = {
      id: uuidv4(),
      user_id: user.id,
      name: name.trim(),
      is_default: false, // Wk1 manual creates are never the default; that's Wk2's first-save path
      created_at: now,
      updated_at: now,
    };
    mutation.mutate({ row, source });
  }

  return { ...mutation, create };
}

export function useRenameList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (vars: { id: string; name: string }) => {
      await enqueue('list_rename', vars.id, { id: vars.id, name: vars.name.trim() });
      void drainWriteQueue();
    },
    onMutate: async ({ id, name }) => {
      if (!user) return {};
      const key = savedListKeys.list(user.id);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<SavedList[]>(key);
      const now = new Date().toISOString();
      // Rename + bump updated_at so the row jumps to the top, matching the
      // server trigger + the updated_at-desc sort.
      queryClient.setQueryData<SavedList[]>(key, (old = []) =>
        [...old]
          .map((l) => (l.id === id ? { ...l, name: name.trim(), updated_at: now } : l))
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      );
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev && ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
      captureError(err as Error, { mutation: 'renameList' });
    },
    onSuccess: (_data, { id }) => {
      track(EVENTS.TRIP_LIST_RENAMED, { list_id: id });
    },
    // Refetch is fired post-commit from the write-queue handler, not here.
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    // placeCount is 0 in Wk1 (no places-in-list until Wk2's join-table work);
    // threaded now so Wk2 can supply the real count without touching the event.
    mutationFn: async (vars: { id: string; placeCount?: number }) => {
      await enqueue('list_delete', vars.id, { id: vars.id });
      void drainWriteQueue();
    },
    onMutate: async ({ id }) => {
      if (!user) return {};
      const key = savedListKeys.list(user.id);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<SavedList[]>(key);
      queryClient.setQueryData<SavedList[]>(key, (old = []) => old.filter((l) => l.id !== id));
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev && ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
      captureError(err as Error, { mutation: 'deleteList' });
    },
    onSuccess: (_data, { id, placeCount }) => {
      track(EVENTS.TRIP_LIST_DELETED, { list_id: id, place_count_at_delete: placeCount ?? 0 });
    },
    // Refetch is fired post-commit from the write-queue handler, not here.
  });
}

// --- Save to a trip (Wk2) ---------------------------------------------------

type SaveVars = {
  placeId: string;
  listId: string;
  isFirst: boolean; // first-ever save → create the default trip first
  title: string; // default-trip title when isFirst (the place's city)
};

/**
 * "Save to a trip" for place detail. Wk2 scope: the first-save-into-the-default
 * path only (the multi-list picker is M2). On the user's first-ever save it
 * creates the default trip (atomic set_default_trip RPC) and then adds the
 * place; subsequent saves add to the existing default. Both writes go through
 * the Wk-1 FIFO queue, enqueued create-then-add so the place-add always follows
 * the trip it references.
 */
export function useSaveToTrip() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listsQuery = useSavedLists();
  const lists = listsQuery.data;

  const mutation = useMutation({
    mutationFn: async ({ placeId, listId, isFirst, title }: SaveVars) => {
      // FIFO: the default-trip create must be enqueued BEFORE the place-add that
      // references its list_id, so the queue commits them in that order.
      if (isFirst) {
        await enqueue('default_trip_create', listId, { list_id: listId, title });
      }
      await enqueue('place_add', listId, {
        list_id: listId,
        place_id: placeId,
        added_at: new Date().toISOString(),
      });
      void drainWriteQueue();
    },
    onMutate: async ({ placeId, listId, isFirst, title }) => {
      if (!user) return {};
      const placesKey = savedPlaceKeys.ids(user.id);
      const listsKey = savedListKeys.list(user.id);
      await queryClient.cancelQueries({ queryKey: placesKey });
      const prevPlaces = queryClient.getQueryData<string[]>(placesKey);
      queryClient.setQueryData<string[]>(placesKey, (old = []) =>
        old.includes(placeId) ? old : [...old, placeId]
      );

      let prevLists: SavedList[] | undefined;
      if (isFirst) {
        await queryClient.cancelQueries({ queryKey: listsKey });
        prevLists = queryClient.getQueryData<SavedList[]>(listsKey);
        const now = new Date().toISOString();
        const row: SavedList = {
          id: listId,
          user_id: user.id,
          name: title,
          is_default: true,
          created_at: now,
          updated_at: now,
        };
        queryClient.setQueryData<SavedList[]>(listsKey, (old = []) => [row, ...old]);
      }
      return { prevPlaces, prevLists, placesKey, listsKey };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevPlaces && ctx?.placesKey) queryClient.setQueryData(ctx.placesKey, ctx.prevPlaces);
      if (ctx?.prevLists && ctx?.listsKey) queryClient.setQueryData(ctx.listsKey, ctx.prevLists);
      captureError(err as Error, { mutation: 'saveToTrip' });
    },
    onSuccess: (_data, { placeId, listId, isFirst }) => {
      if (isFirst) {
        track(EVENTS.TRIP_LIST_CREATED, { list_id: listId, is_default: true, source: 'first_save' });
      }
      track(EVENTS.PLACE_SAVED_TO_LIST, {
        place_id: placeId,
        list_id: listId,
        source_screen: 'place_detail',
      });
    },
    // Reconciliation is fired post-commit from the write-queue (onQueueIdle).
  });

  /** Save a place into the default trip, creating that trip on first-ever save.
   *  Returns the resolved trip title (for the confirmation toast). Throws
   *  NOT_AUTHENTICATED if signed out. */
  function save(place: Place): { title: string; isFirst: boolean } {
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const existingDefault = (lists ?? []).find((l) => l.is_default);
    const isFirst = !existingDefault;
    const listId = existingDefault?.id ?? uuidv4();
    const title = existingDefault?.name ?? place.city ?? place.name_en ?? 'My Trip';
    mutation.mutate({ placeId: place.id, listId, isFirst, title });
    return { title, isFirst };
  }

  // Avoid creating a duplicate default before the lists query has resolved.
  const ready = listsQuery.isSuccess || !user;
  return { ...mutation, save, ready };
}
