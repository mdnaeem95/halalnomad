/**
 * Trip Planning M3 Wk2 — within-day reorder math (pure logic).
 *
 * Proves the brief's guarantees without a device:
 *   - a move is section-scoped: a row never crosses a day header (edge = no-op)
 *   - within a day, position becomes the midpoint of the new section neighbours
 *   - on gap exhaustion the WHOLE trip re-spaces to (i+1)*1000, and every OTHER
 *     day keeps its relative order (the moved row re-inserts by its neighbour)
 *   - Ungrouped (day null) and a dayless trip behave as one section
 */
import { computeWithinDayMove, computeWithinDayDrop } from '../lib/trip-reorder';
import { ListPlace } from '../types';

// Minimal ListPlace — the math only reads id / position / day_index.
const p = (id: string, position: number, day: number | null): ListPlace =>
  ({ id, position, day_index: day } as ListPlace);

describe('computeWithinDayMove — section scoping', () => {
  it('is a no-op at the top edge of a section', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 1)];
    expect(computeWithinDayMove(all, 1, 0, -1)).toBeNull();
  });

  it('is a no-op at the bottom edge of a section', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 1)];
    expect(computeWithinDayMove(all, 1, 1, 1)).toBeNull();
  });

  it('cannot move a row across a day header (last of Day 1 down = no-op)', () => {
    // Day 1 has only [a]; a "down" would land in Day 2 — forbidden.
    const all = [p('a', 1000, 1), p('b', 2000, 2)];
    expect(computeWithinDayMove(all, 1, 0, 1)).toBeNull();
  });

  it('only considers the target section, not interleaved other-day positions', () => {
    // Day-2 place sits between the two Day-1 positions; must be ignored.
    const all = [p('a', 1000, 1), p('x', 1500, 2), p('b', 2000, 1)];
    const r = computeWithinDayMove(all, 1, 0, 1); // move a below b within Day 1
    expect(r).not.toBeNull();
    expect(r!.placeId).toBe('a');
    expect(r!.position).toBe(3000); // b.position + 1000, no respace
    expect(r!.respace).toBeUndefined();
  });
});

describe('computeWithinDayMove — midpoint', () => {
  it('moves down to the midpoint of the new neighbours', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 1), p('c', 3000, 1)];
    const r = computeWithinDayMove(all, 1, 0, 1); // a moves between b and c
    expect(r!.placeId).toBe('a');
    expect(r!.fromIndex).toBe(0);
    expect(r!.toIndex).toBe(1);
    expect(r!.position).toBe(2500);
    expect(r!.respace).toBeUndefined();
  });

  it('moves up past the top to below-first-minus-1000', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 1), p('c', 3000, 1)];
    const r = computeWithinDayMove(all, 1, 2, -1); // c up between a and b
    expect(r!.position).toBe(1500);
  });
});

describe('computeWithinDayMove — respace on gap exhaustion', () => {
  it('re-spaces the whole trip and preserves other days’ order', () => {
    // Day 1: a,b,c packed 1 apart → moving c up collides → full respace.
    // Day 2: x,y must keep their relative order after the respace.
    const all = [
      p('a', 1000, 1),
      p('b', 1001, 1),
      p('c', 1002, 1),
      p('x', 5000, 2),
      p('y', 6000, 2),
    ];
    const r = computeWithinDayMove(all, 1, 2, -1); // c between a and b
    expect(r!.respace).toBeDefined();
    const byId = Object.fromEntries(r!.respace!.map((e) => [e.placeId, e.position]));
    // New global order: a, c, b, x, y → (i+1)*1000
    expect(byId).toEqual({ a: 1000, c: 2000, b: 3000, x: 4000, y: 5000 });
    // moved place's own position matches its respace slot
    expect(r!.position).toBe(2000);
    // Day 2 order intact: x before y
    expect(byId.x).toBeLessThan(byId.y);
  });
});

describe('Ungrouped + dayless', () => {
  it('reorders within the Ungrouped (null) section', () => {
    const all = [p('a', 1000, null), p('b', 2000, null), p('c', 3000, 1)];
    const r = computeWithinDayMove(all, null, 0, 1); // a below b (both ungrouped)
    expect(r!.placeId).toBe('a');
    expect(r!.position).toBe(3000);
  });

  it('a dayless trip is one section (day null spans everything)', () => {
    const all = [p('a', 1000, null), p('b', 2000, null), p('c', 3000, null)];
    const r = computeWithinDayMove(all, null, 0, 1);
    expect(r!.position).toBe(2500);
  });
});

describe('computeWithinDayDrop — arbitrary target', () => {
  it('drops a row to the end of its section', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 1), p('c', 3000, 1)];
    const r = computeWithinDayDrop(all, 1, 'a', 2);
    expect(r!.placeId).toBe('a');
    expect(r!.position).toBe(4000); // after c
    expect(r!.fromIndex).toBe(0);
    expect(r!.toIndex).toBe(2);
  });

  it('is a no-op when dropped on its own index', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 1)];
    expect(computeWithinDayDrop(all, 1, 'a', 0)).toBeNull();
  });

  it('returns null for a place not in the section', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 2)];
    expect(computeWithinDayDrop(all, 1, 'b', 0)).toBeNull();
  });

  it('clamps an out-of-range target into the section', () => {
    const all = [p('a', 1000, 1), p('b', 2000, 1)];
    const r = computeWithinDayDrop(all, 1, 'a', 99); // clamps to last
    expect(r!.position).toBe(3000);
  });
});
