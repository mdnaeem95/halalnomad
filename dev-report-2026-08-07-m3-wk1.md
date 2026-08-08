# Dev report — Trip Planning M3, Week 1 (day grouping: assign + render)

Date: 2026-08-07. Responds to: the 2026-07-28 M3 Wk-1 brief (started after
the 1.1.0 public release cleared, per the brief's priority note). Status:
**all five tasks shipped and validated** — commit `e8aa508`, preview OTAs
`3cf194ab` + `063342b4` (chip polish), runtime 1.1.0, JS-only.

## Status per task

**1. Assign/unassign UI — shipped (chip + picker).** Every place row in
trip detail carries a day chip (top-right of the card: "Day N", or an
outlined "+ Day" when unassigned); tap opens a compact bottom-sheet picker:
Ungrouped · Day 1…N · "New day (Day N+1)", soft-capped at 14 with the cap
note rendered when hit. `day_index` (dormant on the join since migration
023) is written by the **seventh queue-backed mutation**
(`place_day_assign`): `networkMode:'always'`, optimistic + rollback, FIFO.
Coalescer extended with a generalized last-write-wins class covering
repositions AND day-assigns per (op, list, place) — rapid re-assigns
collapse to one server write; chain-drop covers day-assigns into
unsynced-deleted lists. Suite: **101 tests** (4 new).

**2. Day sections — shipped per every locked decision.** Sections render
only once ≥1 place has a day (flat list otherwise — today's behaviour
preserved); **empty intermediate days render** (Day 1 + Day 3 → an empty
Day 2 keeps the trip's structure); numbers-only names; `position` orders
within a day (no second ordering dimension). Open choice made + kept
stable: **Ungrouped renders LAST** — days are the itinerary, Ungrouped is
the inbox at the bottom. Edit mode (move arrows) stays flat; within-day
reorder UX defers to the drag work as briefed.

**3. Auto-assign rule — shipped, centralized.** Lives in `useSaveToTrip`'s
mutationFn so the sheet and first-save paths share it: a save into a trip
whose existing places (≥1) are all on Day 1 enqueues a Day-1 assign
directly behind its `place_add`. Two documented boundary calls: (a) an
EMPTY trip's first save lands Ungrouped — otherwise every user's first
save would spawn day sections, contradicting "flat until used"; (b) the
rule is cache-evaluated (a trip unopened this session has no day data →
Ungrouped). Auto-assigns are **silent** — `trip_list_day_assigned` is
reserved for deliberate picker actions so the tile measures feature usage.
PM flag: say the word if auto-assigns should fire it with a
`source: 'auto'` property instead.

**4. Event — confirmed with slices.** `trip_list_day_assigned {list_id,
place_id, day_index}` live in PostHog EU; device-pass events slice cleanly
by day_index (1/2/3). The `null` (unassign) slice is typed and wired but
not yet observed on-device — one online picker-unassign will close it.

**5. Validation — passed, including the standing matrix with server
proof.** On-device: chips + picker + sections + empty-intermediate-day all
verified (screenshot matches spec); VoiceOver announces chips ("Assign
{name} to a day"), sections ("Day 2, 3 places"), radio-style picker rows.
**Offline matrix:** assigns made offline → kill → reopen offline (sections
correct from cache) → reconnect → **exact-once server convergence verified
by SQL** (all four day_index values landed, positions untouched). That's
two consecutive full matrices passed since the networkMode fix.

Post-pass polish (two rounds, both device-verified): the overlay chip
first anchored past the card edge, then still collided with long names
and the compact HalalBadge — root fix in `7e24751`: PlaceCard gained a
generic `headerAccessory` slot and the chip now lives in the header
row's flex layout (name truncates against it, badge fully visible,
Dynamic-Type safe). Overlay positioning is gone entirely.

## Gesture-stack findings for the Wk-2 drag brief (as requested)

The section list is now a mixed-type FlashList (header + place rows),
which raises the cost of *between-day* drag specifically: drop-target math
must handle header rows and empty sections, on the same no-reanimated
stack that pushed M2 to the arrows fallback. Recommendation for Wk-2
scoping: **within-day drag** piggybacks on the M2 edit-mode pattern
cleanly and is worth the attempt; **between-day movement** is already
served by the chip→picker (arguably better a11y and precision than drag)
— suggest the Wk-2 brief treats between-day drag as optional-stretch
rather than core, so the time-box protects the week again.

## Carry-ins unchanged

Haptics pass + Sentry grouping hygiene → Wk-3 polish slot. Share link →
M4 / migration 026 (reserved). Seoul/Bangkok pages remain gated on Sani's
hero sanity pass ×2 (+ optional cert review for /seoul's Trusted badges).
