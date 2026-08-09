"""Reporting + auto-action commands for the seed pipeline.

Use `breakdown` after each scrape / review stage to capture the state
in a comparable form. Use `auto-approve` and `auto-reject` to apply
the standard rule sets in one go (you can re-run with --dry-run first).

The defaults are tuned from Tokyo's first batch (~78% auto-action rate,
~97% approval). Tighten the regexes per city in the constants below
if a city's mix is materially different.

Usage:
    python report.py breakdown tokyo
    python report.py auto-approve tokyo --dry-run
    python report.py auto-approve tokyo
    python report.py auto-reject tokyo --dry-run
    python report.py auto-reject tokyo
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

import typer
from rich import print
from rich.table import Table

from db import supa
import posthog_client as ph

app = typer.Typer(add_completion=False, no_args_is_help=True)


# Halal-positive name signals + cuisine types that almost always pass review.
# When tuning: add new signals here, never remove unless a regression appears.
# Non-English markers added after the Seoul/Bangkok runs surfaced names
# we missed because our regex was English-only.
APPROVE_NAME_REGEX = (
    # English / transliterated halal cuisine markers
    r"halal|muslim|kebab|biryani|tandoor|shawarma|pakistani|rendang|nasi|"
    r"turkish|persian|iranian|arab|lebanese|moroccan|egyptian|yemeni|"
    r"uyghur|uighur|xinjiang|lanzhou|hui|samarkand|uzbek|"
    r"masjid|mosque|qaboos|sultan|"
    # CJK / Thai / Korean halal markers
    r"清真|"            # Chinese: halal (huí cuisine)
    r"ハラル|ハラール|"  # Japanese: halal (two common spellings)
    r"할랄|이슬람|무슬림|"  # Korean: halal / Islam / Muslim
    r"ฮาลาล|"           # Thai: halal
    r"มุสลิม|อาหารมุสลิม"  # Thai: Muslim / Muslim food (self-labels, added Bangkok run)
)
APPROVE_CUISINES = ("middle_eastern", "indian", "malay_indonesian", "chinese_muslim", "central_asian")

# "Weak" ethnonyms — common in non-food proper nouns (Turkish Airlines,
# Turkish Trade Office, Arab Bank) and in ambiguous venues (Turkish coffee
# shops, a "Turkish Kedi" cat cafe). The Taipei cuisine-keyword sweep dragged
# these in: infer_cuisine tags anything with "turkish" as middle_eastern, which
# then auto-approves. So when the halal signal rests on one of these tokens,
# require a co-occurring FOOD signal before auto-approving — otherwise hold the
# row for manual review. Deliberately excludes coffee/cafe/dessert words.
WEAK_ETHNONYM_REGEX = r"turkish|\barab\b"
FOOD_SIGNAL_REGEX = (
    r"restaurant|eatery|diner|bistro|grill|kebab|shawarma|doner|kofte|pita|"
    r"kitchen|food|halal|cuisine|料理|餐廳|餐館|食堂|小吃|烤肉|牛肉麵"
)

# --- Free-text trust lint (WS4, data-accuracy program 2026-08-08) ------------
# A stored, in-app-rendered free-text field (description today; any future
# rendered free text) on a row BELOW level 4 may never assert certification —
# that's the Coconut Club incident (a demo description claimed "Halal-certified"
# on a level-1 row). Also block prayer/mosque scope-creep per the brand
# guardrail. "Certified" may only ever enter via a genuine level-4 promotion,
# never as free text. NOTE: this is deliberately distinct from HALAL_MARKER_REGEX
# above — "mosque" in a NAME helps DETECT a halal venue (fine); "mosque" in a
# stored DESCRIPTION is the guardrail violation this catches.
FORBIDDEN_FREETEXT_REGEX = re.compile(
    r"certif|"           # certified / certification (the trust violation)
    r"\bprayer\b|"       # prayer room / prayer facilities (scope guardrail)
    r"mosque|masjid",    # mosque/masjid framing (scope guardrail)
    re.IGNORECASE,
)


def freetext_violations(text: str | None) -> list[str]:
    """Return the distinct forbidden tokens found in a free-text field, or []
    if clean. Caller decides severity; used by the lint command and as the
    promote-time gate so no sub-level-4 row ships a certification claim."""
    if not text:
        return []
    return sorted({m.group(0).lower() for m in FORBIDDEN_FREETEXT_REGEX.finditer(text)})


# Non-halal chains that consistently appear in scrapes. Lowercase, regex.
REJECT_NAME_REGEX = (
    r"mcdonald|kfc|starbucks|burger king|subway|7-?eleven|family ?mart|"
    r"lawson|yoshinoya|coco ?ichibanya|ootoya|saizeriya|"
    r"jollibee|pizza hut|domino|wendy|tim ?ho ?wan"
)


# ---------------------------------------------------------------------------


def _fetch_city(city: str, fields: str = "*") -> list[dict[str, Any]]:
    return (
        supa()
        .table("places_staging")
        .select(fields)
        .eq("city", city.lower())
        .execute()
        .data
    )


def _state(row: dict[str, Any]) -> str:
    if not row.get("reviewed"):
        return "pending"
    if row.get("approved") is True and row.get("promoted_to_place_id"):
        return "promoted"
    if row.get("approved") is True:
        return "approved"
    if row.get("approved") is False:
        return "rejected"
    return "unknown"


# ---------------------------------------------------------------------------


@app.command("breakdown")
def cmd_breakdown(city: str = typer.Argument(...)) -> None:
    """Snapshot of staging state for a city."""
    rows = _fetch_city(
        city,
        "id, cuisine_type, reviewed, approved, promoted_to_place_id",
    )
    if not rows:
        print(f"[yellow]No staging rows for '{city}'.[/]")
        return

    state_counts: Counter[str] = Counter()
    cuisine_by_state: dict[str, Counter[str]] = {}
    for r in rows:
        s = _state(r)
        state_counts[s] += 1
        cuisine_by_state.setdefault(s, Counter())[r.get("cuisine_type") or "unknown"] += 1

    total = len(rows)
    reviewed = sum(c for s, c in state_counts.items() if s != "pending")
    review_pct = reviewed / total * 100 if total else 0
    approved = state_counts.get("approved", 0) + state_counts.get("promoted", 0)
    approval_pct = approved / reviewed * 100 if reviewed else 0

    summary = Table(title=f"{city} — staging state ({total} total)")
    summary.add_column("state")
    summary.add_column("count", justify="right")
    summary.add_column("%", justify="right")
    for s in ["pending", "approved", "rejected", "promoted", "unknown"]:
        if state_counts.get(s, 0) == 0 and s != "pending":
            continue
        c = state_counts.get(s, 0)
        summary.add_row(s, str(c), f"{c / total * 100:.1f}")
    print(summary)
    print(
        f"[dim]reviewed: {reviewed}/{total} ({review_pct:.1f}%)  "
        f"·  approval rate: {approval_pct:.1f}% of reviewed[/]"
    )

    cuisines = Table(title="cuisine × state")
    cuisines.add_column("cuisine")
    states = [s for s in ["pending", "approved", "promoted", "rejected"] if cuisine_by_state.get(s)]
    for s in states:
        cuisines.add_column(s, justify="right")
    cuisines.add_column("total", justify="right")

    all_cuisines = sorted(
        {c for ctr in cuisine_by_state.values() for c in ctr},
        key=lambda c: -sum(ctr.get(c, 0) for ctr in cuisine_by_state.values()),
    )
    for cuisine in all_cuisines:
        row = [cuisine]
        total_for_cuisine = 0
        for s in states:
            n = cuisine_by_state.get(s, Counter()).get(cuisine, 0)
            row.append(str(n) if n else "—")
            total_for_cuisine += n
        row.append(str(total_for_cuisine))
        cuisines.add_row(*row)
    print(cuisines)


# ---------------------------------------------------------------------------


def _is_auto_approvable(name: str, cuisine: str | None) -> bool:
    """True if a pending row should auto-approve.

    Base signal: an approve-cuisine bucket OR a halal name marker. But if the
    name carries a weak ethnonym (turkish/arab) and NO food signal, hold it for
    manual review — that's the pattern behind the false positives (Turkish
    Airlines office, a Turkish coffee shop, a "Turkish Kedi" cat cafe).
    """
    import re

    name = name or ""
    has_signal = cuisine in APPROVE_CUISINES or bool(
        re.search(APPROVE_NAME_REGEX, name, re.IGNORECASE)
    )
    if not has_signal:
        return False
    weak = re.search(WEAK_ETHNONYM_REGEX, name, re.IGNORECASE)
    food = re.search(FOOD_SIGNAL_REGEX, name, re.IGNORECASE)
    if weak and not food:
        return False
    return True


@app.command("auto-approve")
def cmd_auto_approve(
    city: str = typer.Argument(...),
    dry_run: bool = typer.Option(False, help="Show count without writing."),
) -> None:
    """Mark obviously-halal pending rows as approved."""
    # One fetch of all pending rows for this city, then filter in Python.
    # (supabase-py mutates the builder chain across calls — sharing it
    # between two queries silently inherits the first query's filters.)
    rows = (
        supa()
        .table("places_staging")
        .select("id, name_en, cuisine_type")
        .eq("city", city.lower())
        .eq("reviewed", False)
        .execute()
        .data
    )

    matches = [
        r for r in rows if _is_auto_approvable(r.get("name_en"), r.get("cuisine_type"))
    ]
    print(f"[bold]Auto-approve: {len(matches)} pending rows match the rules.[/]")
    if not matches:
        return

    print("[dim]Sample (first 10):[/]")
    for r in matches[:10]:
        print(f"  • [{r['cuisine_type']}] {r['name_en']}")

    ph.capture("auto_approve_run", {"city": city, "match_count": len(matches), "dry_run": dry_run})

    if dry_run:
        print("[yellow]Dry run — no writes.[/]")
        return

    ids = [r["id"] for r in matches]
    supa().table("places_staging").update(
        {"reviewed": True, "approved": True, "reviewed_at": "now()"}
    ).in_("id", ids).execute()
    print(f"[green]✓ Approved {len(ids)} rows.[/]")


@app.command("auto-reject")
def cmd_auto_reject(
    city: str = typer.Argument(...),
    dry_run: bool = typer.Option(False, help="Show count without writing."),
) -> None:
    """Mark known non-halal chains as rejected."""
    rows = (
        supa()
        .table("places_staging")
        .select("id, name_en, cuisine_type")
        .eq("city", city.lower())
        .eq("reviewed", False)
        .execute()
        .data
    )

    import re

    pat = re.compile(REJECT_NAME_REGEX, re.IGNORECASE)
    matches = [r for r in rows if pat.search(r["name_en"] or "")]
    print(f"[bold]Auto-reject: {len(matches)} pending rows match the chain blacklist.[/]")
    ph.capture("auto_reject_run", {"city": city, "match_count": len(matches), "dry_run": dry_run})
    if not matches:
        return

    print("[dim]Sample (first 10):[/]")
    for r in matches[:10]:
        print(f"  • [{r['cuisine_type']}] {r['name_en']}")

    if dry_run:
        print("[yellow]Dry run — no writes.[/]")
        return

    ids = [r["id"] for r in matches]
    supa().table("places_staging").update(
        {
            "reviewed": True,
            "approved": False,
            "rejected_reason": "non-halal chain (auto)",
            "reviewed_at": "now()",
        }
    ).in_("id", ids).execute()
    print(f"[green]✓ Rejected {len(ids)} rows.[/]")


@app.command("reviews")
def cmd_reviews(
    city: str = typer.Argument(..., help="City key (lowercase)"),
    limit: int = typer.Option(200, help="Max pending rows to scan."),
) -> None:
    """Review-time helper: scan Google reviews of PENDING rows for halal signals.

    Automates the manual "do recent reviews mention halal?" pass. For each
    pending row it fetches Google reviews (New API, Enterprise/Atmosphere tier
    — a few $/thousand), flags halal-positive mentions and RED flags
    (pork/alcohol/not-halal), and prints a per-place summary + snippet.

    ToS: reviews are fetched at review-time and DISCARDED — never stored (same
    line as the photos decision). This is ephemeral decision-support, not a
    cache. Nothing here writes review text to the DB.
    """
    import os
    import time
    import httpx

    api_key = os.environ.get("GOOGLE_MAPS_NEW_API_KEY") or os.environ.get(
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
    )
    if not api_key:
        # fall back to the app's env if the seed .env doesn't carry the New-API key
        from pathlib import Path

        app_env = Path(__file__).resolve().parents[2] / "app" / ".env"
        if app_env.exists():
            for line in app_env.read_text().splitlines():
                if line.startswith("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
    if not api_key:
        print("[red]No New-API key found (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY).[/]")
        raise typer.Exit(1)

    rows = (
        supa()
        .table("places_staging")
        .select("name_en, source_id")
        .eq("city", city.lower())
        .eq("reviewed", False)
        .eq("source", "google_places")
        .limit(limit)
        .execute()
        .data
        or []
    )
    print(f"[bold]Scanning reviews for {len(rows)} pending {city} rows[/] (Enterprise tier)\n")

    pos = re.compile(r"\bhalal\b|muslim[- ]friendly|muslim owned", re.IGNORECASE)
    red = re.compile(r"not halal|non[- ]halal|pork|bacon|lard|alcohol|beer|serves? wine", re.IGNORECASE)
    scanned = signalled = 0
    with httpx.Client(timeout=25) as client:
        for r in rows:
            pid = r["source_id"]
            try:
                resp = client.get(
                    f"https://places.googleapis.com/v1/places/{pid}",
                    headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": "id,reviews"},
                )
                reviews = resp.json().get("reviews", []) if resp.status_code == 200 else []
            except Exception:
                reviews = []
            scanned += 1
            pos_hits = []
            red_hits = []
            for rv in reviews:
                txt = (rv.get("text") or {}).get("text") or (rv.get("originalText") or {}).get("text") or ""
                if pos.search(txt):
                    i = txt.lower().find("halal")
                    pos_hits.append(txt[max(0, i - 35) : i + 55].replace("\n", " ").strip())
                if red.search(txt):
                    m = red.search(txt)
                    red_hits.append(txt[max(0, m.start() - 30) : m.start() + 40].replace("\n", " ").strip())
            if pos_hits or red_hits:
                signalled += 1
                tag = "[red]⚠ RED[/]" if red_hits else "[green]✓ halal[/]"
                print(f"{tag} {r['name_en'][:44]}  ({len(pos_hits)} halal / {len(red_hits)} flag)")
                if pos_hits:
                    print(f"    ✓ …{pos_hits[0]}…")
                if red_hits:
                    print(f"    [red]⚠ …{red_hits[0]}…[/]")
            time.sleep(0.14)  # polite rate-limit
    print(f"\n[dim]scanned {scanned} | {signalled} had a halal/red signal in reviews[/]")


@app.command("lint")
def cmd_lint(
    city: str = typer.Option(None, help="Filter to one city (default: whole catalog)"),
) -> None:
    """Scan stored free text for forbidden claims on sub-level-4 rows.

    Flags any active `places` row (and any `places_staging` row) below level 4
    whose description asserts certification (certif*) or prayer/mosque framing.
    A description may never claim what the trust level doesn't hold — the
    Coconut Club incident (2026-08-08). Should report clean after the WS2 purge.
    """
    total_violations = 0
    for table, level_col, active_filter in (
        ("places", "halal_level", ("is_active", True)),
        ("places_staging", "proposed_halal_level", None),
    ):
        # Filter to the only rows that CAN violate — a non-null description on a
        # sub-level-4 row — AND paginate: the described sub-L4 set can exceed the
        # client's 1000-row page cap (it does once descriptions are backfilled
        # catalog-wide), so a single .execute() would silently miss rows past
        # 1000 and false-"clean". The lint must scan every row.
        rows = []
        page = 0
        while True:
            q = (
                supa()
                .table(table)
                .select(f"id, name_en, city, description, {level_col}")
                .not_.is_("description", "null")
                .lt(level_col, 4)
                .range(page * 1000, page * 1000 + 999)
            )
            if city:
                q = q.eq("city", city)
            if active_filter:
                q = q.eq(*active_filter)
            batch = q.execute().data or []
            rows.extend(batch)
            if len(batch) < 1000:
                break
            page += 1
        hits = [(r, freetext_violations(r.get("description"))) for r in rows]
        hits = [(r, v) for r, v in hits if v]
        print(f"[bold]{table}[/]: {len(hits)} violation(s) across {len(rows)} described sub-L4 rows")
        for r, v in hits:
            print(f"  [red]✗[/] {r.get('city','?')} | {r['name_en'][:40]} → {', '.join(v)}")
            print(f"      {r.get('description','')[:120]}")
        total_violations += len(hits)

    if total_violations == 0:
        print("[green]✓ Clean — no forbidden free-text claims on sub-level-4 rows.[/]")
    else:
        print(f"[red]✗ {total_violations} row(s) need fixing.[/]")
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
