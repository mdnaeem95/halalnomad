/**
 * B11 incident repro (2026-07-22): device showed a place in 4 trips; server had
 * 1 membership row. This reproduces the exact staging sequence at queue level:
 *
 *   offline → toggle adds into two existing trips → create a trip via the
 *   sheet (list_create then place_add, in that order) → KILL → reopen offline
 *   (launch drain no-ops) → reconnect → drain.
 *
 * Expected contract: all four ops replay FIFO, exactly once, nothing coalesced
 * (no deletes/removes queued — no rule applies).
 */

import { onlineManager } from '@tanstack/react-query';

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
  setBeforeDrain,
  onQueueIdle,
  getQueueSnapshot,
  __resetWriteQueueForTests,
} from '../lib/write-queue';

beforeEach(async () => {
  await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
  __resetWriteQueueForTests();
  onlineManager.setOnline(true);
});

function simulateRelaunch(register: () => void) {
  __resetWriteQueueForTests();
  register();
}

describe('B11 repro — offline sheet toggles + create survive kill and all land', () => {
  it('replays add, add, create, add — FIFO, exactly once, nothing eaten', async () => {
    const calls: string[] = [];
    const register = () => {
      setBeforeDrain(async () => {
        calls.push('beforeDrain');
      });
      registerWriteHandler('place_add', async (p: { list_id: string; place_id: string }) => {
        calls.push(`add:${p.list_id}:${p.place_id}`);
      });
      registerWriteHandler('list_create', async (p: { id: string }) => {
        calls.push(`create:${p.id}`);
      });
    };
    register();

    // B9 — offline sheet session
    onlineManager.setOnline(false);
    await enqueue('place_add', 'test1', { list_id: 'test1', place_id: 'nawab', added_at: 't1' });
    await enqueue('place_add', 'test2', { list_id: 'test2', place_id: 'nawab', added_at: 't2' });
    // sheet create-&-save: create enqueued (awaited) before the add
    await enqueue('list_create', 'F', { id: 'F', user_id: 'u1', name: 'F', is_default: false });
    await enqueue('place_add', 'F', { list_id: 'F', place_id: 'nawab', added_at: 't3' });
    await drainWriteQueue(); // best-effort drains from the mutations — offline no-op
    expect(await getQueueSnapshot()).toHaveLength(4);

    // B10 — kill, reopen still offline, launch drain
    simulateRelaunch(register);
    onlineManager.setOnline(false);
    await drainWriteQueue();
    expect(calls).toEqual([]);
    expect(await getQueueSnapshot()).toHaveLength(4);

    // B11 — reconnect
    onlineManager.setOnline(true);
    await drainWriteQueue();

    expect(calls).toEqual([
      'beforeDrain',
      'add:test1:nawab',
      'add:test2:nawab',
      'create:F',
      'add:F:nawab',
    ]);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });

  it('a ghost-list add (FK violation) drops IMMEDIATELY — one drain, tail lands, no blockage', async () => {
    // The B11 incident: adds into client-only "ghost" lists FK-fail forever.
    // Pre-fix they blocked the FIFO for MAX_ATTEMPTS drains; now they drop on
    // first sight and everything behind them lands in the same drain.
    const calls: string[] = [];
    registerWriteHandler('place_add', async (p: { list_id: string; place_id: string }) => {
      if (p.list_id === 'ghost1' || p.list_id === 'ghost2') {
        throw new Error('insert or update on table "saved_list_places" violates foreign key constraint');
      }
      calls.push(`add:${p.list_id}:${p.place_id}`);
    });
    registerWriteHandler('list_create', async (p: { id: string }) => {
      calls.push(`create:${p.id}`);
    });

    onlineManager.setOnline(false);
    await enqueue('place_add', 'ghost1', { list_id: 'ghost1', place_id: 'nawab', added_at: 't1' });
    await enqueue('place_add', 'ghost2', { list_id: 'ghost2', place_id: 'nawab', added_at: 't2' });
    await enqueue('list_create', 'F', { id: 'F', user_id: 'u1', name: 'F', is_default: false });
    await enqueue('place_add', 'F', { list_id: 'F', place_id: 'nawab', added_at: 't3' });

    onlineManager.setOnline(true);
    await drainWriteQueue(); // ONE drain suffices now

    expect(calls).toEqual(['create:F', 'add:F:nawab']);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });

  it('fires the idle reconcile after a drop-only drain (so divergent caches re-sync)', async () => {
    let idleFired = 0;
    onQueueIdle(() => {
      idleFired += 1;
    });
    registerWriteHandler('place_add', async () => {
      throw new Error('new row violates row-level security policy');
    });

    onlineManager.setOnline(false);
    await enqueue('place_add', 'ghost1', { list_id: 'ghost1', place_id: 'nawab', added_at: 't1' });

    onlineManager.setOnline(true);
    await drainWriteQueue();

    // Nothing committed, but the drop emptied the queue — reconciliation MUST
    // still run, or the optimistic ghost state lingers forever.
    expect(idleFired).toBe(1);
    expect(await getQueueSnapshot()).toHaveLength(0);
  });

  it('an RLS/FK error still never drops an entry while OFFLINE-transient conditions hold', async () => {
    // Guard the guard: transient (offline mid-drain) failures must keep
    // taking priority over the permanent-data-error classification.
    const calls: string[] = [];
    registerWriteHandler('place_add', async () => {
      onlineManager.setOnline(false); // connection died as the request ran
      throw new Error('network request failed');
    });

    onlineManager.setOnline(false);
    await enqueue('place_add', 'L', { list_id: 'L', place_id: 'P', added_at: 't' });
    onlineManager.setOnline(true);
    await drainWriteQueue();

    expect(await getQueueSnapshot()).toHaveLength(1); // preserved, not dropped
    expect(calls).toEqual([]);
  });
});
