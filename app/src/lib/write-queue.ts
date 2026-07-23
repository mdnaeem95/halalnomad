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

/**
 * A data-integrity failure that can NEVER succeed on retry: the referenced row
 * doesn't exist (FK violation — e.g. a place_add into a "ghost" list that only
 * ever existed client-side) or RLS rejects the write outright (checked AFTER
 * the beforeDrain session refresh, so it's not an auth blip). Retrying blocks
 * the FIFO head for MAX_ATTEMPTS drains while every queued write behind it —
 * and the queue-idle reconciliation — silently stalls (the B11 incident,
 * 2026-07-22). Drop immediately instead; the post-drain reconcile then pulls
 * server truth and clears the stale optimistic state that caused it.
 */
function isPermanentDataError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /foreign key|row-level security|violates.*constraint|42501|23503/.test(msg);
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
  let dropped = 0;
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
    // Coalesce dead work for unsynced entities (create→delete chains, rename
    // folds, add→remove cancels) before touching the network. Safe here: the
    // `draining` guard means nothing is in-flight, and acked ops are already
    // gone from the queue. Ops enqueued mid-drain coalesce on the next drain.
    queue = coalesceQueue(queue);
    await persist();
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
        if (isPermanentDataError(e)) {
          // Can never succeed (missing FK target / RLS reject post-refresh).
          // Drop NOW so it can't block the queue for MAX_ATTEMPTS drains.
          captureError(e as Error, {
            area: 'write-queue',
            op: entry.op,
            clientId: entry.clientId,
            dropped: 'permanent-data-error',
          });
          await removeByUid(entry.uid);
          dropped += 1;
          continue;
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
          dropped += 1;
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
  // Reconcile only once everything pending has resolved — never mid-drain.
  // Drops count too: a drain that discarded dead ops MUST reconcile, or the
  // optimistic state they created lingers as silent client-server divergence
  // (the B11 incident — ghost trips survived because idle never fired).
  if ((committed > 0 || dropped > 0) && queue.length === 0) {
    idleListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        captureError(e as Error, { area: 'write-queue.idle' });
      }
    });
  }
}

// --- Coalescing (M2 Wk2) ----------------------------------------------------
//
// Collapse dead work for UNSYNCED entities before a drain so it never hits the
// server. An entity is unsynced exactly when its create op is still in the
// queue (acked ops are removed on commit, so anything present here has not
// been applied). Runs at drain time only — never touches in-flight or acked
// ops — and preserves FIFO order for the survivors (drops and in-place payload
// rewrites only; no reordering).

function entityListId(e: WriteQueueEntry): string | null {
  const p = e.payload as Record<string, unknown> | null;
  switch (e.op) {
    case 'list_create':
    case 'list_rename':
    case 'list_delete':
      return (p?.id as string) ?? null;
    case 'default_trip_create':
    case 'place_add':
    case 'place_remove':
      return (p?.list_id as string) ?? null;
    default:
      return null;
  }
}

export function coalesceQueue(entries: WriteQueueEntry[]): WriteQueueEntry[] {
  const drop = new Set<string>(); // entry uids to drop
  const isCreate = (e: WriteQueueEntry) =>
    e.op === 'list_create' || e.op === 'default_trip_create';

  // Rule A — create → … → delete of an unsynced list: the list never existed
  // server-side, so every op touching it (create, renames, the delete itself,
  // and place add/removes into it) is dead work.
  const createdIds = new Set(entries.filter(isCreate).map((e) => entityListId(e)!));
  for (const e of entries) {
    if (e.op !== 'list_delete') continue;
    const id = entityListId(e);
    if (!id || !createdIds.has(id)) continue; // synced list — delete must run
    const createIdx = entries.findIndex((x) => isCreate(x) && entityListId(x) === id);
    const deleteIdx = entries.indexOf(e);
    if (createIdx === -1 || deleteIdx < createIdx) continue; // delete precedes create → not a chain
    for (const x of entries) {
      if (entityListId(x) === id) drop.add(x.uid);
    }
  }

  // Rule C — multiple renames of the same id: last-write-wins, keep only the
  // final rename (in its original position, so ordering vs later ops holds).
  const lastRenameUid = new Map<string, string>();
  for (const e of entries) {
    if (e.op === 'list_rename' && !drop.has(e.uid)) lastRenameUid.set(entityListId(e)!, e.uid);
  }
  for (const e of entries) {
    if (e.op === 'list_rename' && !drop.has(e.uid) && lastRenameUid.get(entityListId(e)!) !== e.uid) {
      drop.add(e.uid);
    }
  }

  // Rule B — create → rename(s) of an unsynced id (no delete, or A would have
  // fired): fold the final name into the create payload, drop the rename.
  const rewrites = new Map<string, WriteQueueEntry>(); // uid → replacement entry
  for (const e of entries) {
    if (e.op !== 'list_rename' || drop.has(e.uid)) continue;
    const id = entityListId(e)!;
    const create = entries.find(
      (x) => isCreate(x) && entityListId(x) === id && !drop.has(x.uid)
    );
    if (!create) continue;
    const name = (e.payload as { name: string }).name;
    const cp = create.payload as Record<string, unknown>;
    rewrites.set(create.uid, {
      ...create,
      payload:
        create.op === 'default_trip_create'
          ? { ...cp, title: name }
          : { ...cp, name },
    });
    drop.add(e.uid);
  }

  // Rule D — add → (later) remove of the same (list_id, place_id) while the
  // add is still unsynced: both cancel. Alternations pair off nearest-first,
  // so add,remove,add leaves the final add.
  const pairKey = (e: WriteQueueEntry) => {
    const p = e.payload as { list_id?: string; place_id?: string };
    return `${p.list_id}:${p.place_id}`;
  };
  const openAdds = new Map<string, string[]>(); // pair → stack of add uids
  for (const e of entries) {
    if (drop.has(e.uid)) continue;
    if (e.op === 'place_add') {
      const k = pairKey(e);
      openAdds.set(k, [...(openAdds.get(k) ?? []), e.uid]);
    } else if (e.op === 'place_remove') {
      const k = pairKey(e);
      const stack = openAdds.get(k) ?? [];
      const addUid = stack.pop();
      if (addUid) {
        drop.add(addUid);
        drop.add(e.uid);
        openAdds.set(k, stack);
      }
    }
  }

  return entries
    .filter((e) => !drop.has(e.uid))
    .map((e) => rewrites.get(e.uid) ?? e);
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
