"""Scrape Google Places for halal restaurants in a target city.

Strategy:
- For each district in the city (see cities.py), run a `nearbysearch`
  for `keyword="halal"` within DEFAULT_RADIUS_M.
- Paginate up to 3 pages per district (Google caps at 60 results).
- For each result, fetch place details to enrich (hours, phone, website).
- Dedupe against existing places_staging rows (by source_id) AND against
  the live places table (by name+location fuzzy match).
- Write fresh rows into places_staging with proposed_halal_level=1.
- Human reviewer (you) goes through Supabase Studio next, marks
  approve/reject, then runs promote.py.

Usage:
    python google_places.py scrape tokyo
    python google_places.py scrape tokyo --max-districts 3   # smoke test
    python google_places.py scrape tokyo --dry-run           # don't write
    python google_places.py list-cities

Pricing (approx, USD):
    Nearby Search:   $32 / 1k requests (until next-page-token expires)
    Place Details:   $17 / 1k requests with basic fields
    Tokyo: ~13 districts × 3 pages = ~40 nearby calls, ~150 details ≈ $4
    Full tier-1 sweep (7 cities): well under $40.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx
import typer
from rapidfuzz import fuzz
from rich import print
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from cities import DEFAULT_RADIUS_M, District, get_districts, list_cities
from db import google_api_key, supa

app = typer.Typer(add_completion=False, no_args_is_help=True)


# --- HTTP helpers -----------------------------------------------------------

NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Be a polite citizen — Google permits more, but our work isn't time-critical.
RATE_LIMIT_SLEEP_S = 0.2


def _get(client: httpx.Client, url: str, params: dict[str, Any]) -> dict[str, Any]:
    params = {**params, "key": google_api_key()}
    r = client.get(url, params=params, timeout=30.0)
    r.raise_for_status()
    data = r.json()
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        raise RuntimeError(f"Google API error: {status} — {data.get('error_message', '')}")
    time.sleep(RATE_LIMIT_SLEEP_S)
    return data


# --- Search -----------------------------------------------------------------


@dataclass
class NearbyResult:
    place_id: str
    name: str
    address: str | None
    lat: float
    lng: float
    types: list[str] = field(default_factory=list)
    price_level: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)


def nearby_search(
    client: httpx.Client, district: District, keyword: str = "halal"
) -> list[NearbyResult]:
    """Run nearby search around a district. Paginates up to 3 pages."""
    results: list[NearbyResult] = []
    next_token: str | None = None

    for page in range(3):
        params: dict[str, Any] = {
            "location": f"{district.lat},{district.lng}",
            "radius": DEFAULT_RADIUS_M,
            "keyword": keyword,
            "language": "en",
        }
        if next_token:
            params["pagetoken"] = next_token
            # Google requires a short delay before next-page-token becomes valid.
            time.sleep(2)

        data = _get(client, NEARBY_URL, params)
        for r in data.get("results", []):
            loc = r.get("geometry", {}).get("location", {})
            if "lat" not in loc or "lng" not in loc:
                continue
            results.append(
                NearbyResult(
                    place_id=r["place_id"],
                    name=r.get("name", "").strip(),
                    address=r.get("vicinity"),
                    lat=loc["lat"],
                    lng=loc["lng"],
                    types=r.get("types", []),
                    price_level=r.get("price_level"),
                    raw=r,
                )
            )

        next_token = data.get("next_page_token")
        if not next_token:
            break

    return results


# --- Details ----------------------------------------------------------------

DETAILS_FIELDS = ",".join(
    [
        "name",
        "formatted_address",
        "geometry/location",
        "international_phone_number",
        "website",
        "opening_hours/weekday_text",
        "price_level",
        "types",
        "url",
    ]
)


def fetch_details(client: httpx.Client, place_id: str) -> dict[str, Any] | None:
    data = _get(
        client,
        DETAILS_URL,
        {"place_id": place_id, "fields": DETAILS_FIELDS, "language": "en"},
    )
    return data.get("result")


# --- Cuisine inference ------------------------------------------------------

CUISINE_KEYWORDS: list[tuple[str, list[str]]] = [
    # Order matters — first match wins. Specific Muslim cuisines before
    # broader regional buckets, otherwise e.g. "Lanzhou Halal Beef Noodle"
    # gets tagged as generic chinese (matches "noodle").
    ("chinese_muslim", ["hui", "lanzhou", "xinjiang", "halal beef noodle", "清真", "qingzhen"]),
    ("central_asian", ["uyghur", "uighur", "uzbek", "samarkand", "kazakh", "kyrgyz"]),
    ("japanese", ["japanese", "ramen", "sushi", "izakaya", "udon", "soba", "tempura"]),
    ("korean", ["korean", "bbq", "bibimbap"]),
    ("chinese", ["chinese", "dim sum", "dumpling", "noodle"]),
    ("indian", ["indian", "biryani", "curry house", "tandoor", "nepali", "bangladeshi"]),
    ("middle_eastern", ["kebab", "shawarma", "falafel", "turkish", "arab", "persian", "lebanese", "iranian", "yemeni", "syrian"]),
    ("malay_indonesian", ["malay", "indonesian", "nasi", "rendang", "warung"]),
    ("thai", ["thai"]),
    ("vietnamese", ["vietnamese", "pho", "banh mi"]),
    ("western", ["pizza", "burger", "steakhouse", "italian", "american"]),
    ("seafood", ["seafood", "fish"]),
    ("dessert", ["cafe", "dessert", "bakery", "ice cream"]),
]


def infer_cuisine(name: str, types: list[str]) -> str:
    haystack = " ".join([name.lower(), *types]).lower()
    for cuisine, keywords in CUISINE_KEYWORDS:
        if any(k in haystack for k in keywords):
            return cuisine
    return "other"


# Order matters — first match wins. Restaurant is the default fallback.
PLACE_TYPE_RULES: list[tuple[str, list[str], list[str]]] = [
    # (place_type, google_types_match, name_keywords)
    (
        "grocery",
        ["supermarket", "grocery_or_supermarket", "convenience_store"],
        ["mart", "grocery", "supermarket", "halal shop", "asian shop", "asian store",
         "halal store", "minimart", "groceries"],
    ),
    (
        "butcher",
        [],
        ["butcher", "meat shop", "meat house", "halal meat"],
    ),
    (
        "bakery",
        ["bakery"],
        ["bakery", "patisserie", "boulangerie", "bread shop"],
    ),
    (
        "sweet_shop",
        [],
        ["confectionery", "sweet shop", "sweets", "chocolate", "ice cream"],
    ),
    (
        "cafe",
        ["cafe", "coffee_shop"],
        ["coffee", "espresso", "tea house", "tea room"],
    ),
    (
        "street_food",
        [],
        ["food truck", "street food", "stall", "food stall"],
    ),
]


def infer_place_type(name: str, types: list[str]) -> str:
    name_lower = name.lower()
    types_lower = {t.lower() for t in types}
    for place_type, type_match, keyword_match in PLACE_TYPE_RULES:
        if any(t in types_lower for t in type_match):
            return place_type
        if any(k in name_lower for k in keyword_match):
            return place_type
    return "restaurant"


# --- Dedupe -----------------------------------------------------------------


def already_staged(client: httpx.Client, place_id: str) -> bool:
    """Have we already imported this exact source_id into places_staging?"""
    res = (
        supa()
        .table("places_staging")
        .select("id")
        .eq("source", "google_places")
        .eq("source_id", place_id)
        .limit(1)
        .execute()
    )
    return len(res.data) > 0


def already_in_places(name: str, lat: float, lng: float) -> bool:
    """Fuzzy-match against live places. Returns True if this looks like a dup.

    Match rule: within ~80 m AND name fuzzy ratio >= 85.
    """
    # Tight bounding box (~100 m) — much faster than scanning everything.
    delta = 0.001  # ~111 m
    res = (
        supa()
        .table("places")
        .select("id, name_en, latitude, longitude")
        .gte("latitude", lat - delta)
        .lte("latitude", lat + delta)
        .gte("longitude", lng - delta)
        .lte("longitude", lng + delta)
        .execute()
    )
    for row in res.data:
        if fuzz.ratio(row["name_en"].lower(), name.lower()) >= 85:
            return True
    return False


# --- Write ------------------------------------------------------------------


def stage_row(
    nr: NearbyResult, details: dict[str, Any] | None, district: District, city: str
) -> dict[str, Any]:
    address = (details or {}).get("formatted_address") or nr.address
    hours_list = (details or {}).get("opening_hours", {}).get("weekday_text") or []
    hours = "; ".join(hours_list) if hours_list else None

    return {
        "source": "google_places",
        "source_id": nr.place_id,
        "source_url": (details or {}).get("url"),
        "name_en": nr.name,
        "name_local": None,
        "address_en": address,
        "address_local": None,
        "latitude": nr.lat,
        "longitude": nr.lng,
        "cuisine_type": infer_cuisine(nr.name, nr.types),
        "place_type": infer_place_type(nr.name, nr.types),
        "price_range": (details or {}).get("price_level") or nr.price_level,
        "phone": (details or {}).get("international_phone_number"),
        "website": (details or {}).get("website"),
        "hours": hours,
        "proposed_halal_level": 1,
        "raw": {"nearby": nr.raw, "details": details or {}},
        "city": city,
        "search_query": f'"halal" near {district.name}, {city}',
    }


# --- CLI --------------------------------------------------------------------


@app.command("list-cities")
def cmd_list_cities() -> None:
    """Show available cities."""
    for c in list_cities():
        print(f"  • {c}")


@app.command("scrape")
def cmd_scrape(
    city: str = typer.Argument(..., help="City key (lowercase, e.g. 'tokyo')"),
    max_districts: int = typer.Option(0, help="Limit districts (0 = all). For smoke tests."),
    dry_run: bool = typer.Option(False, help="Don't write to staging — just print summary."),
) -> None:
    """Scrape one city into places_staging."""
    city = city.lower().strip()
    districts = get_districts(city)
    if max_districts > 0:
        districts = districts[:max_districts]

    print(f"[bold]Scraping {city}[/] — {len(districts)} districts")

    summary = {
        "fetched": 0,
        "details_skipped": 0,
        "dup_in_batch": 0,
        "dup_in_staging": 0,
        "dup_in_places": 0,
        "staged": 0,
    }
    rows_to_insert: list[dict[str, Any]] = []
    seen_place_ids: set[str] = set()  # in-batch dedup; districts often overlap

    with httpx.Client() as client, Progress(
        SpinnerColumn(),
        TextColumn("{task.description}"),
        TextColumn("{task.completed}/{task.total}"),
    ) as progress:
        for district in districts:
            task = progress.add_task(f"  {district.name}", total=None)
            try:
                nearby = nearby_search(client, district)
            except Exception as e:
                print(f"[red]  ! {district.name}: {e}[/]")
                progress.remove_task(task)
                continue

            progress.update(task, total=len(nearby), completed=0)
            for nr in nearby:
                summary["fetched"] += 1
                progress.update(task, advance=1)

                # Cheap dedup checks first — avoid Place Details cost on dups.
                if nr.place_id in seen_place_ids:
                    summary["dup_in_batch"] += 1
                    continue
                seen_place_ids.add(nr.place_id)
                if already_staged(client, nr.place_id):
                    summary["dup_in_staging"] += 1
                    continue
                if already_in_places(nr.name, nr.lat, nr.lng):
                    summary["dup_in_places"] += 1
                    continue

                try:
                    details = fetch_details(client, nr.place_id)
                except Exception as e:
                    print(f"[yellow]  ~ details failed for {nr.name}: {e}[/]")
                    summary["details_skipped"] += 1
                    details = None

                rows_to_insert.append(stage_row(nr, details, district, city))
                summary["staged"] += 1

            progress.remove_task(task)

    print()
    table = Table(title=f"Summary — {city}")
    table.add_column("metric")
    table.add_column("count", justify="right")
    for k, v in summary.items():
        table.add_row(k, str(v))
    print(table)

    if dry_run:
        print("[yellow]Dry run — not writing to staging.[/]")
        return

    if not rows_to_insert:
        print("[yellow]Nothing new to stage.[/]")
        return

    # Bulk upsert in chunks. ignore_duplicates=True makes (source, source_id)
    # collisions a no-op rather than an error — backstop for future runs that
    # might rescrape (e.g. accidentally rerunning a partially-completed scrape).
    inserted = 0
    for i in range(0, len(rows_to_insert), 100):
        chunk = rows_to_insert[i : i + 100]
        supa().table("places_staging").upsert(
            chunk, on_conflict="source,source_id", ignore_duplicates=True
        ).execute()
        inserted += len(chunk)
    print(f"[green]✓ Upserted {inserted} rows into places_staging.[/]")
    print(f"  Review in Supabase Studio:")
    print(f"  SELECT * FROM places_staging WHERE city = '{city}' AND reviewed = false;")


if __name__ == "__main__":
    app()
