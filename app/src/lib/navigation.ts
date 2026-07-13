// Single source of truth for the `source_screen` dimension on place_viewed.
// Passed as a ?from= param on every router.push into /place/[id] so the
// detail screen can attribute the view to where it came from.
//
// Note vs the original spec: 'explore_browse' is intentionally absent — the
// Browse view navigates to /city/[city], never directly to a place, so the
// browse path always arrives as 'city_detail'. 'add_dedup' (the "view
// existing" link on the Add screen's duplicate dialog) and 'notification'
// (push deep-link) are added because they are real entry points.
export type PlaceSource =
  | 'explore_map'
  | 'explore_list'
  | 'search'
  | 'city_detail'
  | 'add_dedup'
  | 'notification'
  | 'trip_detail';

const KNOWN: readonly PlaceSource[] = [
  'explore_map',
  'explore_list',
  'search',
  'city_detail',
  'add_dedup',
  'notification',
  'trip_detail',
];

/** Build the href for a place detail navigation carrying its source. */
export function placeHref(id: string, source: PlaceSource): string {
  return `/place/${id}?from=${source}`;
}

/** Coerce a raw ?from= param to a known source, or 'unknown' (deep link, etc.). */
export function normalizePlaceSource(raw: string | undefined): PlaceSource | 'unknown' {
  return raw && (KNOWN as readonly string[]).includes(raw) ? (raw as PlaceSource) : 'unknown';
}
