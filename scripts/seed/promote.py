"""Promote approved places_staging rows into the live places table.

Workflow:
1. You scrape with google_places.py — rows land in places_staging.
2. You review in Supabase Studio (or via SQL) — set `reviewed=true` and
   `approved=true` (or `approved=false` with `rejected_reason`).
3. You run this script — it calls the `promote_staged_place(staging_id, user_id)`
   RPC for each row that's approved-and-not-yet-promoted.

Idempotent: re-running won't double-promote.

Usage:
    python promote.py run                       # promote all approved rows
    python promote.py run --city tokyo          # only Tokyo
    python promote.py run --dry-run             # show what would be promoted
    python promote.py status                    # counts by review state
"""

from __future__ import annotations

import typer
from rich import print
from rich.table import Table

from db import seed_user_id, supa

app = typer.Typer(add_completion=False, no_args_is_help=True)


@app.command("status")
def cmd_status(city: str = typer.Option(None, help="Filter to one city")) -> None:
    """Print counts by review state."""
    q = supa().table("places_staging").select("city, reviewed, approved, promoted_to_place_id")
    if city:
        q = q.eq("city", city.lower())
    rows = q.execute().data

    pending = sum(1 for r in rows if not r["reviewed"])
    approved_unpromoted = sum(
        1 for r in rows if r["reviewed"] and r["approved"] and not r["promoted_to_place_id"]
    )
    approved_promoted = sum(
        1 for r in rows if r["reviewed"] and r["approved"] and r["promoted_to_place_id"]
    )
    rejected = sum(1 for r in rows if r["reviewed"] and r["approved"] is False)

    table = Table(title=f"places_staging status{' — ' + city if city else ''}")
    table.add_column("state")
    table.add_column("count", justify="right")
    table.add_row("total", str(len(rows)))
    table.add_row("pending review", str(pending))
    table.add_row("approved, awaiting promote", str(approved_unpromoted))
    table.add_row("approved & promoted", str(approved_promoted))
    table.add_row("rejected", str(rejected))
    print(table)


@app.command("run")
def cmd_run(
    city: str = typer.Option(None, help="Only promote rows from this city."),
    dry_run: bool = typer.Option(False, help="Print but don't promote."),
    limit: int = typer.Option(500, help="Max rows to promote in one run."),
) -> None:
    """Promote approved-but-unpromoted staging rows into places."""
    user_id = seed_user_id()

    q = (
        supa()
        .table("places_staging")
        .select("id, city, name_en, address_en, source")
        .eq("reviewed", True)
        .eq("approved", True)
        .is_("promoted_to_place_id", "null")
        .limit(limit)
    )
    if city:
        q = q.eq("city", city.lower())
    rows = q.execute().data

    if not rows:
        print("[yellow]Nothing to promote.[/]")
        return

    print(f"[bold]{len(rows)} row(s) ready to promote[/]")

    if dry_run:
        for r in rows[:25]:
            print(f"  • [{r['city']}] {r['name_en']} ({r['address_en'] or '-'})")
        if len(rows) > 25:
            print(f"  …and {len(rows) - 25} more")
        return

    succeeded = 0
    failed: list[tuple[str, str]] = []
    for r in rows:
        try:
            result = supa().rpc(
                "promote_staged_place",
                {"p_staging_id": r["id"], "p_added_by": user_id},
            ).execute()
            new_id = result.data
            if new_id:
                succeeded += 1
        except Exception as e:
            failed.append((r["name_en"], str(e)))

    print(f"[green]✓ Promoted {succeeded} of {len(rows)}.[/]")
    if failed:
        print(f"[red]✗ {len(failed)} failed:[/]")
        for name, err in failed[:10]:
            print(f"  • {name}: {err}")
        if len(failed) > 10:
            print(f"  …and {len(failed) - 10} more")


if __name__ == "__main__":
    app()
