/**
 * Durable, launch-drained, idempotent, FIFO write-queue. (Trip Planning M1.)
 *
 * Why this exists (scoping finding, 2026-06-24): TanStack persists only the
 * READ cache. A pure-optimistic offline write that's killed before reconnect
 * is lost — and worse, the persisted optimistic row shows after relaunch then
 * silently vanishes on the first online refetch (a "ghost write"). Unordered
 * paused-mutation replay can also orphan a list (delete-before-create). Both
 * are silent-wrong-data. This queue buys both out:
 *
 *   - durable:   entries live in AsyncStorage, survive app-kill.
 *   - FIFO:      the head is always processed first; create→rename→delete of
 *                the same list replays in order (NO coalescing this milestone).
 *   - per-op ack: each entry is removed from storage immediately after its
 *                handler succeeds — never batch-removed.
 *   - idempotent: replay safety lives in the HANDLERS (create = upsert-by-id,
 *                rename/delete by id), keyed off the client-supplied UUID.
 *
 * Drains on launch (initWriteQueue) and whenever onlineManager flips online.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager } from '@tanstack/react-query';
import { captureError } from './sentry';

export type WriteOp =
  | 'list_create'
  | 'list_rename'
  | 'list_delete'
  | 'default_trip_create'
  | 'place_add'
  | 'place_remove';

export interface WriteQueueEntry {
  uid: string; // unique per queue entry — the ack-and-remove key
  op: WriteOp;
  clientId: string; // the entity UUID — idempotency key (shared across its ops)
  payload: unknown;
  ts: number;
  attempts: number;
}

type Handler = (payload: any, entry: WriteQueueEntry) => Promise<void>;

const STORAGE_KEY = 'halalnomad-write-queue';
// A permanently-failing ("poison") entry would block the FIFO head forever.
// After this many failed drains we drop it (captured to Sentry) so later
// writes aren't held hostage. Transient offline failures don't count toward
// this — we only attempt a handler while online.
const MAX_ATTEMPTS = 5;

const handlers: Partial<Record<WriteOp, Handler>> = {};
const idleListeners = new Set<() => void>();
let queue: WriteQueueEntry[] = [];
let loadPromise: Promise<void> | null = null;
let draining = false;
let uidCounter = 0;
let beforeDrain: (() => Promise<void>) | null = null;

export function registerWriteHandler(op: WriteOp, fn: Handler): void {
  handlers[op] = fn;
}

/**
 * Runs once at the start of every (online) drain, before any handler. Used to
 * refresh the auth session so writes never execute on a stale/expired token —
 * critical because an RLS-filtered DELETE with no valid `auth.uid()` silently
 * affects 0 rows (no error), which the queue would then ack as success, losing
 * the write. If it throws, the drain is skipped and retried next time.
 */
export function setBeforeDrain(fn: () => Promise<void>): void {
  beforeDrain = fn;
}

/**
 * Fires after a drain commits ≥1 op AND fully empties the queue. Consumers use
 * this to reconcile (refetch) once all pending writes have landed — doing it
 * per-op would let a refetch run between two queued writes and momentarily drop
 * the second's still-pending optimistic row. Returns an unsubscribe fn.
 */
export function onQueueIdle(fn: () => void): () => void {
  idleListeners.add(fn);
  return () => idleListeners.delete(fn);
}

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        queue = raw ? (JSON.parse(raw) as WriteQueueEntry[]) : [];
      })
      .catch(() => {
        queue = [];
      });
  }
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    captureError(e as Error, { area: 'write-queue.persist' });
  }
}

function nextUid(): string {
  uidCounter += 1;
  return `${Date.now()}-${uidCounter}`;
}

/**
 * A failure is transient (connectivity, not the data) when we've gone offline
 * mid-drain or the error looks like a network error. Transient failures must
 * NOT count toward MAX_ATTEMPTS — otherwise a device that's simply offline
 * across several launches would burn through the attempt budget and drop a
 * perfectly valid queued write, defeating the durability guarantee. Only
 * permanent errors (constraint/RLS/validation) count toward the poison-drop.
 */
function isTransientError(e: unknown): boolean {
  if (!onlineManager.isOnline()) return true;
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /network|fetch|timeout|timed out|connection|econn|offline/.test(msg);
}

/** Append an op. In-memory queue is the in-process source of truth; we persist
 *  the whole array on every change (it's tiny — bounded by the ~10-list cap). */
export async function enqueue(
  op: WriteOp,
  clientId: string,
  payload: unknown
): Promise<WriteQueueEntry> {
  await ensureLoaded();
  const entry: WriteQueueEntry = {
    uid: nextUid(),
    op,
    clientId,
    payload,
    ts: Date.now(),
    attempts: 0,
  };
  queue.push(entry);
  await persist();
  return entry;
}

export async function getQueueSnapshot(): Promise<WriteQueueEntry[]> {
  await ensureLoaded();
  return [...queue];
}

async function removeByUid(uid: string): Promise<void> {
  const i = queue.findIndex((e) => e.uid === uid);
  if (i !== -1) {
    queue.splice(i, 1);
    await persist();
  }
}

/**
 * Process the queue head-first while online. Stops at the first failing entry
 * to preserve FIFO order (it retries on the next drain). Guarded against
 * concurrent/double drains so a launch-drain racing a reconnect-drain can't
 * double-process — though upsert-by-UUID makes a double-process harmless anyway.
 */
export async function drainWriteQueue(): Promise<void> {
  await ensureLoaded();
  if (draining) return;
  if (!onlineManager.isOnline()) return;
  draining = true;
  let committed = 0;
  try {
    // Ensure a valid auth session before any write (see setBeforeDrain). Bail
    // the whole drain if it fails — better to retry than run writes unauthed.
    if (beforeDrain) {
      try {
        await beforeDrain();
      } catch (e) {
        captureError(e as Error, { area: 'write-queue.beforeDrain' });
        return;
      }
    }
    // Re-check the head each iteration so items enqueued mid-drain are picked
    // up at the tail and overall ordering is preserved.
    while (queue.length > 0 && onlineManager.isOnline()) {
      const entry = queue[0];
      const handler = handlers[entry.op];
      if (!handler) {
        captureError(new Error(`No write-queue handler for op '${entry.op}'`), {
          area: 'write-queue',
        });
        await removeByUid(entry.uid);
        continue;
      }
      try {
        await handler(entry.payload, entry);
        await removeByUid(entry.uid); // ack-and-remove PER OP
        committed += 1;
      } catch (e) {
        if (isTransientError(e)) {
          // Connectivity blip — preserve the entry untouched and retry on the
          // next drain. Does not burn an attempt.
          break;
        }
        entry.attempts += 1;
        await persist();
        if (entry.attempts >= MAX_ATTEMPTS) {
          captureError(e as Error, {
            area: 'write-queue',
            op: entry.op,
            clientId: entry.clientId,
            dropped: 'true',
          });
          await removeByUid(entry.uid); // drop poison; don't block the queue forever
          continue;
        }
        captureError(e as Error, {
          area: 'write-queue',
          op: entry.op,
          clientId: entry.clientId,
          attempts: String(entry.attempts),
        });
        break; // preserve FIFO; retry on next drain
      }
    }
  } finally {
    draining = false;
  }
  // Reconcile only once everything pending has committed — never mid-drain.
  if (committed > 0 && queue.length === 0) {
    idleListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        captureError(e as Error, { area: 'write-queue.idle' });
      }
    });
  }
}

let unsubscribe: (() => void) | null = null;

/** Wire drain-on-launch + drain-on-reconnect. Idempotent. */
export function initWriteQueue(): void {
  void drainWriteQueue();
  if (!unsubscribe) {
    unsubscribe = onlineManager.subscribe((online: boolean) => {
      if (online) void drainWriteQueue();
    });
  }
}

/** Test-only: clear in-memory state + handlers between cases. */
export function __resetWriteQueueForTests(): void {
  queue = [];
  loadPromise = null;
  draining = false;
  uidCounter = 0;
  for (const k of Object.keys(handlers) as WriteOp[]) delete handlers[k];
  idleListeners.clear();
  beforeDrain = null;
}
