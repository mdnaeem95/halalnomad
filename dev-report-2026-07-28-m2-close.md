# Dev report — Trip Planning M2, Week 3 + milestone close

Date: 2026-07-28. Responds to: the 2026-07-23 Wk-3 brief. Status: **all
tasks complete, M2 closed** (commits `bd031eb` + `5b15996`; preview OTAs
`e30b1ca3` → `fb36306e`; internal TestFlight build + paired
production-channel OTA — build number in the addendum below). The close
uncovered and fixed the milestone's most important bug on its final day.

## Task 0 — B11 aftermath

Resolved as **pass, with a corrected narrative**. Ghost trips are absent
server-side and gone from the device. "F" turned out to be a real (empty)
Wk-1 trip, not a ghost. Sentry forensics (read token now available) showed
the B11-era failures were **RLS 42501 rejections** ("new row violates
row-level security policy for saved_list_places"), grouped under an opaque
unhandled-rejection issue — same class as far back as **Jul 4**. The
original FK-flavoured diagnosis was directionally right (writes into lists
the server never had) but the mechanism was RLS, and the *origin* of the
ghosts themselves is the networkMode finding below.

## Task 1 — Reorder: fallback path shipped (the time-box worked as designed)

Called early rather than after two burned days: free drag on the current
stack (FlashList + Swipeable + Animated-only, variable-height rows) is the
brief's anticipated gesture-fight. Shipped the sanctioned fallback — an
explicit **edit mode with 44pt move up/down controls**: zero gesture
conflicts (swipe/navigation park while editing), better VoiceOver semantics
than drag, and a stable non-virtualized edit list after staging feedback
caught a scroll-jump (FlashList re-measures on every mutation). Positions
move by neighbour-midpoint in the 1000-step space with client-side
re-spacing when gaps exhaust (documented in code). Rapid moves coalesce to
one server write per place. **Drag → M3**, alongside day-grouping's drag
work. `trip_list_place_reordered` live with 0-based from/to indices —
server-side convergence of a real reorder was verified by SQL (positions
matched the midpoint math exactly).

## Task 2 — Search-within-trip: chip approach shipped

Trip header → search tab pre-scoped with a clearable "In {trip}" chip.
Scoped search is **fully client-side over the trip's persisted cache**
(works offline, matches both scripts, composes with cuisine chips; empty
query browses the trip). `search_performed` gained `scope:
'catalog'|'trip'` + `list_id` — no new event name. A11y: chip announces
scope; clearing is announced.

## Task 3 — Migration 025 + numbering

Applied by Sani. 024 confirmed as latest before assigning; the repo
migration list (CLAUDE.md) was 11 entries stale and is now current through
025 with **026 explicitly reserved for the M4 share model**.
`add_place_to_list` now no-ops on a missing list (RLS-correct: "not yours"
and "doesn't exist" are indistinguishable, both no-op).

## Task 4 — The close: validation, the find, TestFlight

**Event sweep: all confirmed in PostHog EU** with full payloads —
`place_saved_to_list` (both paths), `place_removed_from_list` (both
paths), `trip_list_created {source:'manual'}`, `trip_list_opened`,
`trip_list_place_reordered {from,to}`, `search_performed
{scope, list_id}`. A11y sweep passed at the M1 bar (VoiceOver on the
sheet, edit mode, and scope chip).

**The offline matrix failed twice — and that was the milestone's real
work.** Offline writes made under the matrix's kill step were lost
silently: no server rows, no queued ops, no telemetry. Root cause, found
via elimination (Supabase truth + PostHog lifecycles + Sentry silence):

> **React Query's default `networkMode: 'online'` pauses `mutationFn`
> while offline.** Our mutationFns only enqueue into the durable queue —
> so the optimistic update ran (UI perfect, persisted read cache kept it
> perfect across kills) but the enqueue never executed, and an app-kill
> destroyed the paused mutation. The queue never received the write;
> nothing failed anywhere. This also explains the original Wk-1 ghost
> trips (offline creates that died the same way). The 98-test queue suite
> couldn't catch it: it drives `enqueue()` directly, below the layer
> where the pause lives.

Fix: `networkMode: 'always'` on all six queue-backed mutations
(`5b15996`). **Third matrix run converged**: offline toggles + created
trip + reorders → kill → reopen → reconnect → exact-once server truth
("Test2" landed, verified by SQL).

Defense-in-depth shipped from the same investigation (all evidence-backed
by Sentry): the drain's auth gate now hard-fails when no session is
restorable (an unauthed drain converts every write into an RLS failure
the permanent-error logic would drop — silent loss); failed gates retry
on a bounded timer and the queue drains on app-foreground; the coalescer
is fail-open.

**TestFlight:** internal build from commit `5b15996` with the paired
production-channel OTA per the override-trap discipline (prod devices on
1.0.0 binaries remain untouched until the public-release decision at the
Aug 2 gate). "What to Test" notes as drafted in the brief.

## For the Aug 2 gate / retro

- **Process lesson worth keeping:** "state held after kill" on the UI only
  proves the persisted read cache — never the write path. Durable-write
  claims are only proven by offline→kill→reopen→reconnect **with
  server-side verification**. That check is now part of the matrix
  definition.
- Instrumentation checkpoint inputs: permission event now counts
  decisions; `photo_source`, `scope`, reorder payloads all live;
  PostHog-RN offline-buffer loss on kill remains parked (analytics-only).
- M3 carry-ins: drag elegance (with day grouping), app-wide haptics pass
  (one shared pressable pattern; new surfaces already covered), Sentry
  grouping hygiene (route `captureError` context into searchable tags).

## Addendum — build + release artifacts

- Internal TestFlight binary: **1.1.0 (build 13)**, commit `5b15996`,
  EAS build `298884cb` — submitted to App Store Connect for internal
  TestFlight.
- Paired production-channel OTA: update group `06c62843` (same JS).
- Build caveat — RESOLVED 2026-07-29: the EAS-stored `SENTRY_AUTH_TOKEN`
  had gone invalid (401), so build 13 shipped with sourcemap upload
  disabled (its JS crash stacks are unsymbolicated — internal-only,
  acceptable). A fresh `project:releases` token is now in the EAS
  production env (validated against the releases API) and the disable
  override is removed — the public-release build gets full symbolication
  with no further action.
