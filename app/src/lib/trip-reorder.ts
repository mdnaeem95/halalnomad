/**
 * Trip Planning M3 Wk2 — within-day reorder math (pure, no React/RN).
 *
 * The position model is unchanged from M2: every place carries a global
 * 1000-step `position`; within a day section, rows render sorted by that
 * position. A within-day move sets the moved place's position to the midpoint
 * of its new *section* neighbours (not the flat list) — so the move is scoped
 * to the day and can never cross a day header. When the midpoint gap is
 * exhausted (<2 apart), the WHOLE trip is re-spaced to (i+1)*1000, preserving
 * every section's relative order — the moved row is re-inserted adjacent to its
 * new section neighbour so no other day is disturbed.
 *
 * Extracted so the arrow AND drag paths share one code path, and so the math is
 * unit-tested without a device (the gesture layer can't be). `null` dayIndex =
 * the Ungrouped section (and the whole list when a trip has no days at all).
 */
import { ListPlace } from '../types';

export type ReorderResult = {
  placeId: string;
  /** Absolute new `position` for the moved place. */
  position: number;
  /** Section-local 0-based indices, for the analytics event. */
  fromIndex: number;
  toIndex: number;
  /** Present only when the gap was exhausted — every row's new position. */
  respace?: { placeId: string; position: number }[];
};

const dayOf = (p: ListPlace): number | null => p.day_index ?? null;

/** Shared core: given the moved item, its target section-neighbours, and the
 *  full global order, produce the position mutation (+ respace on collision). */
function resolve(
  globalOrder: ListPlace[],
  item: ListPlace,
  prev: ListPlace | null,
  next: ListPlace | null,
  fromIndex: number,
  toIndex: number
): ReorderResult {
  let position: number;
  if (!prev) position = (next?.position ?? 0) - 1000;
  else if (!next) position = prev.position + 1000;
  else position = Math.floor((prev.position + next.position) / 2);

  const collided =
    (!!prev && position <= prev.position) || (!!next && position >= next.position);

  if (!collided) {
    return { placeId: item.id, position, fromIndex, toIndex };
  }

  // Gap exhausted → re-space the whole trip. Re-insert `item` adjacent to its
  // new section neighbour so all sections keep their relative order.
  const without = globalOrder.filter((p) => p.id !== item.id);
  let insertAt: number;
  if (next) insertAt = without.findIndex((p) => p.id === next.id);
  else if (prev) insertAt = without.findIndex((p) => p.id === prev.id) + 1;
  else insertAt = without.length;
  const newOrder = [...without.slice(0, insertAt), item, ...without.slice(insertAt)];

  return {
    placeId: item.id,
    position: (newOrder.findIndex((p) => p.id === item.id) + 1) * 1000,
    fromIndex,
    toIndex,
    respace: newOrder.map((p, i) => ({ placeId: p.id, position: (i + 1) * 1000 })),
  };
}

/**
 * Move the place at section index `fromSectionIdx` one slot (dir = -1 up,
 * +1 down) within its day. Returns null at a section edge (no-op).
 */
export function computeWithinDayMove(
  all: ListPlace[],
  dayIndex: number | null,
  fromSectionIdx: number,
  dir: -1 | 1
): ReorderResult | null {
  const globalOrder = [...all].sort((a, b) => a.position - b.position);
  const section = globalOrder.filter((p) => dayOf(p) === dayIndex);
  const toIndex = fromSectionIdx + dir;
  if (fromSectionIdx < 0 || fromSectionIdx >= section.length) return null;
  if (toIndex < 0 || toIndex >= section.length) return null;

  const item = section[fromSectionIdx];
  const rest = section.filter((_, i) => i !== fromSectionIdx);
  const prev = toIndex > 0 ? rest[toIndex - 1] : null;
  const next = toIndex < rest.length ? rest[toIndex] : null;
  return resolve(globalOrder, item, prev, next, fromSectionIdx, toIndex);
}

/**
 * Drag/drop variant: move `placeId` to an arbitrary target index within its
 * day section. `toSectionIdx` is the desired final index AFTER the row is
 * conceptually lifted out. Returns null if the place isn't in the section or
 * the move is a no-op.
 */
export function computeWithinDayDrop(
  all: ListPlace[],
  dayIndex: number | null,
  placeId: string,
  toSectionIdx: number
): ReorderResult | null {
  const globalOrder = [...all].sort((a, b) => a.position - b.position);
  const section = globalOrder.filter((p) => dayOf(p) === dayIndex);
  const fromSectionIdx = section.findIndex((p) => p.id === placeId);
  if (fromSectionIdx === -1) return null;

  const clamped = Math.max(0, Math.min(toSectionIdx, section.length - 1));
  if (clamped === fromSectionIdx) return null;

  const item = section[fromSectionIdx];
  const rest = section.filter((p) => p.id !== placeId);
  const prev = clamped > 0 ? rest[clamped - 1] : null;
  const next = clamped < rest.length ? rest[clamped] : null;
  return resolve(globalOrder, item, prev, next, fromSectionIdx, clamped);
}
