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

from collections import Counter
from typing import Any

import typer
from rich import print
from rich.table import Table

from db import supa

app = typer.Typer(add_completion=False, no_args_is_help=True)


# Halal-positive name signals + cuisine types that almost always pass review.
# When tuning: add new signals here, never remove unless a regression appears.
APPROVE_NAME_REGEX = (
    r"halal|muslim|kebab|biryani|tandoor|shawarma|pakistani|rendang|nasi|"
    r"turkish|persian|iranian|arab|lebanese|moroccan|egyptian|"
    r"masjid|mosque|qaboos|sultan"
)
APPROVE_CUISINES = ("middle_eastern", "indian", "malay_indonesian")

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


@app.command("auto-approve")
def cmd_auto_approve(
    city: str = typer.Argument(...),
    dry_run: bool = typer.Option(False, help="Show count without writing."),
) -> None:
    """Mark obviously-halal pending rows as approved."""
    import re

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

    pat = re.compile(APPROVE_NAME_REGEX, re.IGNORECASE)
    matches = [
        r
        for r in rows
        if r.get("cuisine_type") in APPROVE_CUISINES
        or pat.search(r.get("name_en") or "")
    ]
    print(f"[bold]Auto-approve: {len(matches)} pending rows match the rules.[/]")
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


if __name__ == "__main__":
    app()
