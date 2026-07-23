/**
 * Trip Planning M1 — durable write-queue correctness proof.
 *
 * These cover the brief's offline→kill→reopen test matrix at the queue level
 * (the device-level kill/reopen is exercised manually on TestFlight):
 *   - create offline → "kill" → reopen offline → reopen online: persists,
 *     applied exactly once (no ghost, no duplicate).
 *   - create→rename→delete same list offline → reconnect: FIFO holds, no orphan.
 *   - double-drain: no double-processing.
 *   - per-op ack + FIFO stop on a failing entry; retry drains the rest in order.
 */

import { onlineManager } from '@tanstack/react-query';

// In-memory AsyncStorage so "kill" = drop module memory while disk survives.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store[k] = v;
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        delete store[k];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueue,
  drainWriteQueue,
  registerWriteHandler,
  onQueueIdle,
  setBeforeDrain,
  getQueueSnapshot,
  __resetWriteQueueForTests,
  WriteOp,
} from '../lib/write-queue';

beforeEach(async () => {
  await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
  __resetWriteQueueForTests();
  onlineManager.setOnline(true);
});

/** Simulate an app-kill: module memory is wiped, AsyncStorage persists, then
 *  handlers are re-registered at the next "launch". */
function simulateRelaunch(register: () => void) {
  __resetWriteQueueForTests();
  register();
}

describe('write-queue — offline create survives kill, applies exactly once', () => {
  it('persists across a kill and replays once when back online', async () => {
    const created: string[] = [];
    const register = () =>
      registerWriteHandler('list_create', async (p: { id: string }) => {
        created.push(p.id);
      });
    register();

    // Offline create.
    onlineManager.setOnline(false);
    await enqueue('list_create', 'list-1', { id: 'list-1' });
    await drainWriteQueue(); // offline → no-op
    expect(created).toEqual([]);
    expect(await getQueueSnapshot()).toHaveLength(1);

    // Kill + reopen, still offline.
    simulateRelaunch(register);
    onlineManager.setOnline(false);
    await drainWriteQueue();
    expect(created).toEqual([]);
    expect(await getQueueSnapshot()).toHaveLength(1); // still durably queued

    // Reopen online → drains exactly once.
    onlineManager.setOnline(true);
    await drainWriteQueue();
    expect(created).toEqual(['list-1']);
    expect(await getQueueSnapshot()).toHaveLength(0);

    // A redundant drain does nothing (no duplicate).
    await drainWriteQueue();
    expect(created).toEqual(['list-1']);
  });
});

describe('write-queue — create→rename→delete of an unsynced list coalesces away (M2 Wk2)', () => {
  it('sends ZERO ops to the server — the whole chain is dead work', async () => {
    const calls: string[] = [];
    registerWriteHandler('list_create', async (p: { id: string }) => {
      calls.push(`create:${p.id}`);
    });
    registerWriteHandler('list_rename', async (p: { id: string; name: string }) => {
      calls.push(`rename:${p.id}:${p.name}`);
    });
    registerWriteHandler('list_delete', async (p: { id: string }) => {
      calls.push(`delete:${p.id}`);
    });

    onlineManager.setOnline(false);
    await enqueue('list_create', 'L', { id: 'L', name: 'A' });
    await enqueue('list_rename', 'L', { id: 'L', name: 'B' });
    await enqueue('list_delete', 'L', { id: 'L' });

    onlineManager.setOnline(true);
    await drainWriteQueue();

    // M1 replayed all three; the Wk2 drain-time coalescer collapses the chain
    // for a list the server never saw. Nothing hits the network.
    expect(calls).toEqual([]);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });

  it('still replays rename→delete in order for a SYNCED list (no create queued)', async () => {
    const calls: string[] = [];
    registerWriteHandler('list_rename', async (p: { id: string; name: string }) => {
      calls.push(`rename:${p.id}:${p.name}`);
    });
    registerWriteHandler('list_delete', async (p: { id: string }) => {
      calls.push(`delete:${p.id}`);
    });

    onlineManager.setOnline(false);
    await enqueue('list_rename', 'L', { id: 'L', name: 'B' });
    await enqueue('list_delete', 'L', { id: 'L' });

    onlineManager.setOnline(true);
    await drainWriteQueue();

    expect(calls).toEqual(['rename:L:B', 'delete:L']);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });
});

describe('write-queue — concurrent/double drain does not double-process', () => {
  it('runs each entry once under two simultaneous drains', async () => {
    const created: string[] = [];
    registerWriteHandler('list_create', async (p: { id: string }) => {
      // small async gap to widen any race window
      await Promise.resolve();
      created.push(p.id);
    });
    await enqueue('list_create', 'x', { id: 'x' });

    await Promise.all([drainWriteQueue(), drainWriteQueue()]);
    expect(created).toEqual(['x']);
  });
});

describe('write-queue — per-op ack + FIFO stop on failure', () => {
  it('acks each op individually and stops at the first failure, preserving order', async () => {
    const done: string[] = [];
    let failOn: string | null = 'B';
    const handler = async (p: { id: string }) => {
      if (p.id === failOn) throw new Error('boom');
      done.push(p.id);
    };
    const reg = () => registerWriteHandler('list_create', handler as (p: unknown) => Promise<void>);
    reg();

    await enqueue('list_create', 'A', { id: 'A' });
    await enqueue('list_create', 'B', { id: 'B' });
    await enqueue('list_create', 'C', { id: 'C' });

    // First drain: A acked+removed, B fails (stays at head), C not attempted.
    await drainWriteQueue();
    expect(done).toEqual(['A']);
    const snap = await getQueueSnapshot();
    expect(snap.map((e) => (e.payload as { id: string }).id)).toEqual(['B', 'C']);
    expect(snap[0].attempts).toBe(1);

    // Recover: B now succeeds → B then C drain in order.
    failOn = null;
    await drainWriteQueue();
    expect(done).toEqual(['A', 'B', 'C']);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });
});

describe('write-queue — transient (network) failures never poison-drop', () => {
  it('keeps a valid entry across many network-failed drains, then applies it', async () => {
    const done: string[] = [];
    let online = false; // handler "sees" the network as down
    registerWriteHandler('list_create', async (p: { id: string }) => {
      if (!online) throw new Error('Network request failed');
      done.push(p.id);
    });
    await enqueue('list_create', 'keep', { id: 'keep' });

    // 8 drains while the network errors (> MAX_ATTEMPTS of 5). Entry must survive.
    for (let i = 0; i < 8; i++) await drainWriteQueue();
    const snap = await getQueueSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].attempts).toBe(0); // transient failures don't burn attempts

    // Connectivity returns → it applies.
    online = true;
    await drainWriteQueue();
    expect(done).toEqual(['keep']);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });
});

describe('write-queue — idle reconcile fires once after full drain', () => {
  it('fires onQueueIdle exactly once when a multi-op drain empties the queue', async () => {
    registerWriteHandler('list_create', async () => {});
    const idle = jest.fn();
    onQueueIdle(idle);

    await enqueue('list_create', 'a', { id: 'a' });
    await enqueue('list_create', 'b', { id: 'b' });
    await drainWriteQueue();

    // Once — not per-op — and only after the queue is empty.
    expect(idle).toHaveBeenCalledTimes(1);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });

  it('does NOT fire idle on an empty/no-op drain', async () => {
    registerWriteHandler('list_create', async () => {});
    const idle = jest.fn();
    onQueueIdle(idle);
    await drainWriteQueue(); // nothing queued
    expect(idle).not.toHaveBeenCalled();
  });

  it('does NOT fire idle while an entry is still stuck (failure mid-drain)', async () => {
    let fail = true;
    registerWriteHandler('list_create', async (p: { id: string }) => {
      if (p.id === 'b' && fail) throw new Error('boom'); // permanent (online, non-network)
    });
    const idle = jest.fn();
    onQueueIdle(idle);

    await enqueue('list_create', 'a', { id: 'a' });
    await enqueue('list_create', 'b', { id: 'b' });
    await drainWriteQueue(); // a commits, b stuck → queue not empty
    expect(idle).not.toHaveBeenCalled();
    expect(await getQueueSnapshot()).toHaveLength(1);

    fail = false;
    await drainWriteQueue(); // b commits → queue empty → idle fires
    expect(idle).toHaveBeenCalledTimes(1);
  });
});

describe('write-queue — save-to-trip: default create then place add (FIFO)', () => {
  it('replays default_trip_create before place_add, even queued offline', async () => {
    const calls: string[] = [];
    registerWriteHandler('default_trip_create', async (p: { list_id: string }) => {
      calls.push(`default:${p.list_id}`);
    });
    registerWriteHandler('place_add', async (p: { list_id: string; place_id: string }) => {
      calls.push(`add:${p.list_id}:${p.place_id}`);
    });

    onlineManager.setOnline(false);
    await enqueue('default_trip_create', 'L', { list_id: 'L', title: 'Tokyo' });
    await enqueue('place_add', 'L', { list_id: 'L', place_id: 'P', added_at: 't' });
    await drainWriteQueue(); // offline no-op
    expect(calls).toEqual([]);

    onlineManager.setOnline(true);
    await drainWriteQueue();
    // Create commits before add → the place-add never references a missing list.
    expect(calls).toEqual(['default:L', 'add:L:P']);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });
});

describe('write-queue — unsynced add→remove of the same pair coalesces away (M2 Wk2)', () => {
  it('sends neither op — they cancel before the drain touches the network', async () => {
    const calls: string[] = [];
    registerWriteHandler('place_add', async (p: { place_id: string }) => {
      calls.push(`add:${p.place_id}`);
    });
    registerWriteHandler('place_remove', async (p: { place_id: string }) => {
      calls.push(`remove:${p.place_id}`);
    });

    onlineManager.setOnline(false);
    await enqueue('place_add', 'L', { list_id: 'L', place_id: 'P', added_at: 't' });
    await enqueue('place_remove', 'L:P', { list_id: 'L', place_id: 'P' });

    onlineManager.setOnline(true);
    await drainWriteQueue();
    expect(calls).toEqual([]);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });

  it('a lone remove (synced membership) still drains', async () => {
    const calls: string[] = [];
    registerWriteHandler('place_remove', async (p: { place_id: string }) => {
      calls.push(`remove:${p.place_id}`);
    });

    onlineManager.setOnline(false);
    await enqueue('place_remove', 'L:P', { list_id: 'L', place_id: 'P' });

    onlineManager.setOnline(true);
    await drainWriteQueue();
    expect(calls).toEqual(['remove:P']);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });
});

describe('write-queue — beforeDrain (auth refresh) gates the drain', () => {
  it('runs beforeDrain before any handler, and bails the drain if it throws', async () => {
    const order: string[] = [];
    registerWriteHandler('place_remove', async () => {
      order.push('handler');
    });

    // beforeDrain fails (e.g. session refresh unreachable) → no handler runs,
    // entry stays queued for the next drain.
    let ok = false;
    setBeforeDrain(async () => {
      order.push('beforeDrain');
      if (!ok) throw new Error('session refresh failed');
    });

    await enqueue('place_remove', 'L:P', { list_id: 'L', place_id: 'P' });
    await drainWriteQueue();
    expect(order).toEqual(['beforeDrain']); // handler never ran
    expect(await getQueueSnapshot()).toHaveLength(1); // preserved, not lost

    // Session now refreshes → beforeDrain runs, then the handler commits.
    ok = true;
    await drainWriteQueue();
    expect(order).toEqual(['beforeDrain', 'beforeDrain', 'handler']);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });
});

describe('write-queue — drain is a no-op when empty', () => {
  it('does nothing with an empty queue', async () => {
    const handler = jest.fn();
    registerWriteHandler('list_create' as WriteOp, handler as (p: unknown) => Promise<void>);
    await drainWriteQueue();
    expect(handler).not.toHaveBeenCalled();
  });
});
