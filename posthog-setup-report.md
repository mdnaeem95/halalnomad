<wizard-report>
# PostHog post-wizard report

The wizard has completed integration of PostHog analytics into the HalalNomad seed pipeline (`scripts/seed/`). A shared client module was created and 10 events were instrumented across three CLI scripts — covering scraping, staging, promotion, and automated review of halal place data.

**New file:** `scripts/seed/posthog_client.py` — singleton PostHog client initialized from `POSTHOG_API_KEY` and `POSTHOG_HOST` environment variables, with `atexit`-registered shutdown to guarantee event flushing on normal exit and exception autocapture enabled.

**Modified files:**
- `scripts/seed/google_places.py` — 5 events added
- `scripts/seed/promote.py` — 3 events added
- `scripts/seed/report.py` — 2 events added
- `scripts/seed/pyproject.toml` — `posthog>=3.0.0` added to dependencies; `posthog_client` and `report` added to `py-modules`
- `scripts/seed/.env.example` — `POSTHOG_API_KEY` and `POSTHOG_HOST` documented
- `scripts/seed/.env` — keys written (gitignored)

| Event | Description | File |
|-------|-------------|------|
| `scrape_started` | Fired when a city scrape begins; captures `city`, `district_count`, `dry_run` | `google_places.py` |
| `scrape_completed` | Fired after all districts processed; includes full summary metrics (fetched, staged, dedup counts) | `google_places.py` |
| `district_scrape_failed` | Fired when `nearbysearch` fails for a district; captures `city`, `district`, `error` | `google_places.py` |
| `place_details_failed` | Fired when a Place Details API call fails; captures `city`, `district`, `error` | `google_places.py` |
| `places_staged` | Fired after rows are upserted to `places_staging`; captures `city`, `inserted_count` | `google_places.py` |
| `promote_run_started` | Fired when promotion begins; captures `city`, `eligible_count`, `dry_run` | `promote.py` |
| `promote_run_completed` | Fired after promotion finishes; captures `city`, `succeeded`, `failed`, `total` | `promote.py` |
| `place_promote_failed` | Fired for each individual place that fails to promote; captures `city`, `error` | `promote.py` |
| `auto_approve_run` | Fired when auto-approve executes; captures `city`, `match_count`, `dry_run` | `report.py` |
| `auto_reject_run` | Fired when auto-reject executes; captures `city`, `match_count`, `dry_run` | `report.py` |

## Next steps

Install the SDK into the venv before running the scripts:

```bash
cd scripts/seed && source .venv/bin/activate && pip install posthog
```

We've built a dashboard and five insights to monitor seed pipeline activity:

- **Dashboard:** [Seed Pipeline Analytics](/project/191007/dashboard/715770)
- **Scrape runs over time** — [/project/191007/insights/FLtGtGpU](/project/191007/insights/FLtGtGpU)
- **Places staged per city** — [/project/191007/insights/gbKVvnHD](/project/191007/insights/gbKVvnHD)
- **Promote success vs failures** — [/project/191007/insights/wwDaHv54](/project/191007/insights/wwDaHv54)
- **Scrape errors** — [/project/191007/insights/sZYThIqN](/project/191007/insights/sZYThIqN)
- **Auto-review actions** — [/project/191007/insights/3xwdQwID](/project/191007/insights/3xwdQwID)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
