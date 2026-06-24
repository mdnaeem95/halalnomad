"""Read-only orphan check for the saved_lists -> join-table migration.

Reproduces, via the PostgREST client, this SQL:

    select sl.id as list_id, pid.place_id as orphan_place_id
    from saved_lists sl
    cross join lateral unnest(sl.place_ids) as pid(place_id)
    left join places p on p.id = pid.place_id
    where p.id is null;

No writes. Only reads saved_lists and places.
"""

from __future__ import annotations

from db import supa


def _all_rows(table: str, fields: str) -> list[dict]:
    """Paginate through every row of a table (PostgREST caps each page)."""
    rows: list[dict] = []
    page = 1000
    start = 0
    while True:
        chunk = (
            supa().table(table).select(fields).range(start, start + page - 1).execute().data
        )
        rows.extend(chunk)
        if len(chunk) < page:
            break
        start += page
    return rows


def main() -> None:
    lists = _all_rows("saved_lists", "id,place_ids")
    place_ids = {p["id"] for p in _all_rows("places", "id")}

    orphans: list[tuple[str, str]] = []
    for sl in lists:
        for pid in sl.get("place_ids") or []:
            if pid not in place_ids:
                orphans.append((sl["id"], pid))

    print(f"saved_lists rows scanned: {len(lists)}")
    print(f"places in catalog:        {len(place_ids)}")
    print(f"orphan_count:             {len(orphans)}")
    print()
    if orphans:
        print("list_id, orphan_place_id")
        for list_id, orphan in orphans:
            print(f"{list_id}, {orphan}")
    else:
        print("No orphans. Migration backfill runs clean.")


if __name__ == "__main__":
    main()
