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
import { fetchSavedLists } from '../services/saved-lists';
import { enqueue, drainWriteQueue } from '../lib/write-queue';
import { useAuth } from './useAuth';
import { uuidv4 } from '../lib/uuid';
import { captureError } from '../lib/sentry';
import { track, EVENTS } from '../lib/analytics';
import { SavedList } from '../types';

// v1 soft cap. Enforced client-side (the screen disables create at the cap and
// the create() helper throws LIST_CAP_REACHED as a backstop). No server CHECK —
// kept soft so we can relax it without a migration.
export const LIST_SOFT_CAP = 10;

export const savedListKeys = {
  all: ['saved-lists'] as const,
  list: (userId: string) => ['saved-lists', userId] as const,
};

export function useSavedLists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: savedListKeys.list(user?.id ?? 'anon'),
    queryFn: () => fetchSavedLists(user!.id),
    enabled: !!user,
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
