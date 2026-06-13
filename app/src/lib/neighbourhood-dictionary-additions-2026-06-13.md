# Neighbourhood dictionary — additions (2026-06-13)

**For:** PM, to fold into `product-halalnomad/data/neighbourhoods.md`.
**Why:** the 2026-06-14 auto-backfill left 124 Singapore + 6 Tokyo places NULL.
Working them by hand surfaced **14 legitimate Singapore neighbourhoods the
dictionary didn't yet cover.** Sani's call (2026-06-13): add them rather than
leave the places NULL — they're real planning areas / traveller-recognised
districts. Applied via `backfill-neighbourhood-2026-06-13-manual-round2.sql`.

## Baseline correction — align to live (2026-06-13)

`neighbourhoods.md` currently states **1,413 active places** / Tokyo **176** /
Singapore **260**. Live prod is **1,379** / Tokyo **181** / Singapore **265**.
Please update those figures. The doc's "coverage owed before Q3" list is also
incomplete — there's already seed data in 13 cities, not just the 7 Y1-priority
ones:

| Active | City (country) | In Y1 priority list? |
|---|---|---|
| 265 | Singapore (SG) | yes |
| 181 | Tokyo (JP) | yes |
| 143 | Bangkok (TH) | yes |
| 133 | Phuket (TH) | **no** |
| 94 | Seoul (KR) | yes |
| 93 | Hong Kong (HK) | **no** |
| 77 | Manila (PH) | **no** |
| 76 | Ho Chi Minh City (VN) | **no** |
| 74 | Osaka (JP) | yes |
| 67 | Chiang Mai (TH) | **no** |
| 66 | Hanoi (VN) | **no** |
| 63 | Kyoto (JP) | yes |
| 47 | Taipei (TW) | yes |
| **1,379** | **13 cities** | |

Flag for PM: the 6 non-priority cities (Phuket, HK, Manila, HCMC, Chiang Mai,
Hanoi = 512 places, **37% of the dataset**) sit outside the CLAUDE.md Y1 focus.
Worth a deliberate call on whether they stay surfaced or get scoped out — and
neighbourhood dictionaries are owed for any that stay.

## New canonical neighbourhoods (Singapore)

| Canonical | Region | English aliases (address match) | Postal prefix | Count this round | Notes |
|---|---|---|---|---|---|
| Raffles Place | CBD core | Raffles Pl, Market St, Cecil St, Robinson Rd, Battery Rd, Circular Rd, North Canal, Phillip St, Church St, Chulia, Malacca St | 04 | 11 | The financial core; distinct from Marina Bay. |
| Bukit Batok | West | Bukit Batok, Bukit Gombak | 65 | 14 | Largest single gap. HDB West. |
| Paya Lebar | East-central | Paya Lebar, Eunos, Ubi, Kaki Bukit | 40 | 13 | Paya Lebar hub + Eunos/Ubi industrial-retail belt. |
| Geylang | Central-east | Geylang Rd, Sims, Geylang East, Geylang Lor, Aljunied, Lorong | 38 | 8 | **Distinct from Geylang Serai** — must run AFTER it. |
| MacPherson | Central | MacPherson, Kampong Ampat, Harper Rd, Tai Seng, Circuit Rd | 34, 36 | 5 | Light-industrial + food-cluster area. |
| Marine Parade | East coast | Marine Parade, Marine Cove, East Coast Park, Marine Terrace | 44 | 4 | Coastal; some halal relevance. |
| Jurong West | West | Jurong West, Boon Lay, Pioneer | 64 | 3 | Pairs with existing Jurong East. |
| Taman Jurong | West | Yuan Ching, Yung Sheng, Yung Ho, Yung Kuang, Taman Jurong, Ho Ching | 61 | 3 | Lakeside / Taman Jurong. |
| River Valley | Central | River Valley | 24 (partial) | 2 | Sits between Orchard & Clarke Quay. |
| Kallang | Central | Kallang, Lavender, Boon Keng, Bendemeer, Geylang Bahru | 33 | 2 | Stadium / Lavender. |
| Jalan Besar | Central | Jalan Besar, Tyrwhitt, Kitchener, Petain | — | 1 | Adjacent to Little India. |
| HarbourFront | South | HarbourFront, VivoCity, Telok Blangah, Seah Im | 09 | 1 | Sentosa gateway. |
| Bras Basah | Central | Bras Basah, Stamford, Bencoolen, Waterloo, Prinsep, Middle Rd | 17 | 1 | Arts/museum district. |
| Bukit Merah | Central-south | Bukit Merah, Redhill, Henderson, Depot Rd | 15 | 1 | HDB. |
| Newton | Central | Newton, Winstedt, Newton Circus, Monk's Hill | 22/30 | 1 | Newton Food Centre area. |
| Siglap | East | Siglap, Figaro, Frankel, Upper East Coast | 45/46 | 1 | East-coast residential. |

## New canonical neighbourhood (Tokyo — non-ward)

| Canonical | English aliases | Local-script | Count | Notes |
|---|---|---|---|---|
| Kichijoji | Kichijoji, Kichijōji, Musashino | 吉祥寺, 武蔵野 | 2 | **Not a special ward** — Musashino City, western Tokyo. First entry needing a "western Tokyo cities" tier alongside the 23 wards (Mitaka, Chofu, etc. will follow). |

## Ordering / collision notes (for any future re-backfill)

- **Geylang must run AFTER Geylang Serai** (Geylang Serai is the cultural core;
  generic Geylang Rd / Sims / Aljunied is the wider strip).
- **Raffles Place vs Marina Bay** — both are sector 01/03/04. Raffles Place =
  the named CBD streets above; Marina Bay = Marina Square/Centre/Coastal/View.
- **Paya Lebar swallows sector 40** (Eunos/Ubi) — don't let a stray "Geylang
  Serai×1" in 40 generalise.

## Deferred → now added (Sani, 2026-06-13)

Newton, Siglap, and Kichijoji were initially left NULL but are now tagged (see
the new-neighbourhood tables above). Result: **Tokyo and Singapore are 100%
neighbourhood-tagged**, zero NULL remaining.

## Loose folds applied this round (flagged for PM review)

- **Simei → Tampines** (sector 52; Simei is technically its own subzone).
- **Havelock Rd → Tiong Bahru** (Chinatown/Tiong Bahru border).
