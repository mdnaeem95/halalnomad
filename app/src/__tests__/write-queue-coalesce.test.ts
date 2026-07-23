/**
 * Trip Planning M2 Wk2 — queue-coalescing collapse rules (pure logic).
 *
 * The brief's rules, proven at the queue level:
 *   - create → … → delete of an unsynced list id → the whole chain drops
 *     (including place add/removes into that list).
 *   - create → rename(s) of an unsynced id → final name folds into the create.
 *   - multiple renames of one id → last-write-wins, one op.
 *   - add → remove of the same (list_id, place_id) while unsynced → both drop.
 *   - FIFO order of the surviving ops is untouched.
 */

import { coalesceQueue, WriteQueueEntry, WriteOp } from '../lib/write-queue';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

let uidN = 0;
function entry(op: WriteOp, clientId: string, payload: unknown): WriteQueueEntry {
  uidN += 1;
  return { uid: `u${uidN}`, op, clientId, payload, ts: uidN, attempts: 0 };
}

const create = (id: string, name = 'Trip') =>
  entry('list_create', id, { id, user_id: 'u1', name, is_default: false });
const defaultCreate = (id: string, title = 'Tokyo') =>
  entry('default_trip_create', id, { list_id: id, title });
const rename = (id: string, name: string) => entry('list_rename', id, { id, name });
const del = (id: string) => entry('list_delete', id, { id });
const add = (listId: string, placeId: string) =>
  entry('place_add', listId, { list_id: listId, place_id: placeId, added_at: 't' });
const remove = (listId: string, placeId: string) =>
  entry('place_remove', `${listId}:${placeId}`, { list_id: listId, place_id: placeId });

const ops = (q: WriteQueueEntry[]) => q.map((e) => e.op);

describe('coalesceQueue', () => {
  beforeEach(() => {
    uidN = 0;
  });

  it('drops the whole chain for create → rename → delete of an unsynced list', () => {
    const q = [create('A'), rename('A', 'x'), rename('A', 'y'), del('A')];
    expect(coalesceQueue(q)).toEqual([]);
  });

  it('drops place ops into a created-then-deleted unsynced list too', () => {
    const q = [create('A'), add('A', 'p1'), add('A', 'p2'), del('A')];
    expect(coalesceQueue(q)).toEqual([]);
  });

  it('treats default_trip_create as a create for the chain rule', () => {
    const q = [defaultCreate('A'), add('A', 'p1'), del('A')];
    expect(coalesceQueue(q)).toEqual([]);
  });

  it('keeps a delete of a SYNCED list (no create in queue)', () => {
    const q = [rename('A', 'x'), del('A')];
    const out = coalesceQueue(q);
    expect(ops(out)).toEqual(['list_rename', 'list_delete']);
  });

  it('does not chain-drop when delete precedes create (different lifecycle)', () => {
    const q = [del('A'), create('A')];
    expect(ops(coalesceQueue(q))).toEqual(['list_delete', 'list_create']);
  });

  it('folds the final rename into an unsynced create payload', () => {
    const q = [create('A', 'first'), rename('A', 'mid'), rename('A', 'final')];
    const out = coalesceQueue(q);
    expect(out).toHaveLength(1);
    expect(out[0].op).toBe('list_create');
    expect((out[0].payload as { name: string }).name).toBe('final');
  });

  it('folds a rename into default_trip_create as the title', () => {
    const q = [defaultCreate('A', 'Tokyo'), rename('A', 'Honeymoon')];
    const out = coalesceQueue(q);
    expect(out).toHaveLength(1);
    expect(out[0].op).toBe('default_trip_create');
    expect((out[0].payload as { title: string }).title).toBe('Honeymoon');
  });

  it('collapses multiple renames of a synced id to the last one', () => {
    const q = [rename('A', 'one'), rename('A', 'two'), rename('A', 'three')];
    const out = coalesceQueue(q);
    expect(out).toHaveLength(1);
    expect((out[0].payload as { name: string }).name).toBe('three');
  });

  it('cancels add → remove of the same unsynced pair', () => {
    const q = [add('L', 'p1'), remove('L', 'p1')];
    expect(coalesceQueue(q)).toEqual([]);
  });

  it('keeps a remove whose add is NOT in the queue (synced membership)', () => {
    const q = [remove('L', 'p1')];
    expect(ops(coalesceQueue(q))).toEqual(['place_remove']);
  });

  it('pairs alternations nearest-first: add, remove, add → final add survives', () => {
    const q = [add('L', 'p1'), remove('L', 'p1'), add('L', 'p1')];
    const out = coalesceQueue(q);
    expect(out).toHaveLength(1);
    expect(out[0].op).toBe('place_add');
    expect(out[0].uid).toBe('u3');
  });

  it('does not cancel across different pairs', () => {
    const q = [add('L', 'p1'), remove('L', 'p2'), add('M', 'p1'), remove('M', 'p3')];
    expect(ops(coalesceQueue(q))).toEqual([
      'place_add',
      'place_remove',
      'place_add',
      'place_remove',
    ]);
  });

  it('preserves FIFO order of survivors across mixed entities', () => {
    const q = [
      create('A', 'a1'),          // survives (renamed below)
      add('L', 'p1'),             // survives
      create('B'),                // dropped (chain with delete)
      rename('A', 'a2'),          // folded into create A
      add('B', 'p2'),             // dropped with B
      del('B'),                   // dropped with B
      remove('L', 'p9'),          // survives (no matching add)
    ];
    const out = coalesceQueue(q);
    expect(out.map((e) => [e.op, e.uid])).toEqual([
      ['list_create', 'u1'],
      ['place_add', 'u2'],
      ['place_remove', 'u7'],
    ]);
    expect((out[0].payload as { name: string }).name).toBe('a2');
  });

  it('leaves an untouched queue byte-identical (no accidental rewrites)', () => {
    const q = [create('A'), add('B', 'p1'), rename('C', 'x')];
    const out = coalesceQueue(q);
    // create A has no renames → no fold; every entry passes through by reference.
    expect(out[0]).toBe(q[0]);
    expect(out[1]).toBe(q[1]);
    expect(out[2]).toBe(q[2]);
  });
});
