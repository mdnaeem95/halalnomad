# Push notifications

Transactional push notifications triggered by database events. The pattern
is "row in the DB changes → a trigger enqueues a notification → an edge
function drains the queue and sends via Expo Push." No user-targeted mass
blasts for now — those get built when there's data telling us what to say.

## Architecture

```
  Mobile app                   Supabase                     Expo
  ---------                    --------                     ----

  sign-in ─► save push_token ─► profiles
                                    │
                                    │  INSERT on verifications
                                    ▼
                              trigger (SQL)
                                    │
                                    │  INSERT
                                    ▼
                          notifications_queue ◄─── manual inserts too
                                    │
                                    │  cron every 5 min
                                    ▼
                          send-push edge fn ──── POST ───► Expo Push API
                                    │                         │
                                    ▼                         ▼
                          notifications_log              device push
```

### Why queue-based

- Retries: if Expo times out, the row stays unprocessed and gets retried.
- Quiet hours: sends destined for 03:00 in the user's TZ get deferred by
  bumping `scheduled_for`, not by blocking a hot trigger.
- Opt-out enforcement: checked at enqueue AND at send time.
- Audit: every attempt (sent / failed / skipped) lands in `notifications_log`.

## Data model

### `profiles` additions

| column                 | purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `push_token`           | Expo token, written on sign-in by the app                     |
| `last_active_at`       | stamped on app foreground (throttled 1/hr), used for dormancy |
| `notifications_enabled`| master opt-out, default `true`                                |
| `timezone`             | IANA string, used for quiet-hours math                        |

### `notifications_queue`

Pending sends. The edge function drains rows where
`processed_at IS NULL AND scheduled_for <= now()` oldest-first, up to 500
per run. Sets `processed_at` when done.

### `notifications_log`

One row per attempt. Statuses: `sent`, `failed`, `skipped_opted_out`,
`skipped_no_token`, `skipped_quiet_hours_deferred`.

Both tables are locked down by RLS with no policies — only the service role
(edge function) can read or write them.

## Setup

### 1. Run the migration

In Supabase SQL Editor, paste and run
[`app/src/lib/migration-006-notifications.sql`](../app/src/lib/migration-006-notifications.sql).

That creates the tables, the `enqueue_notification()` helper, and the two
initial triggers:

- `verifications_notify_verified` → "Your place was verified" to the owner
- `verifications_notify_reported` → "A place you added was reported" to the owner

### 2. Deploy the edge function

```bash
# Install Supabase CLI if you don't have it
brew install supabase/tap/supabase

# From repo root
supabase link --project-ref aytvorjaetitthzuijkv
supabase functions deploy send-push --no-verify-jwt
```

The `--no-verify-jwt` flag is required because pg_cron uses Supabase's
new `sb_secret_*` keys, which are not JWT format. Without it, every
cron tick gets `401 UNAUTHORIZED_INVALID_JWT_FORMAT` from the gateway.
The `verify_jwt = false` line in `supabase/config.toml` is meant to
do the same thing but recent CLI versions ignore it — pass the flag
explicitly. Security-wise this is fine: the function uses its
auto-injected `SUPABASE_SERVICE_ROLE_KEY` for DB access, so the
gateway-level auth is just rate-limit hygiene.

No secrets to set — the function uses the auto-injected
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Schedule it

The function is idempotent and cheap — running it every 5 minutes is fine.

**Setup — store the service role key in Supabase Vault** (legacy
`alter database` is no longer permitted on managed Supabase):

```sql
select vault.create_secret(
  '<SERVICE_ROLE_KEY>',
  'service_role_key',
  'Used by pg_cron to authenticate calls to the send-push edge function'
);
```

**Schedule the job:**

```sql
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'send-push',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://aytvorjaetitthzuijkv.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'service_role_key' limit 1
      ),
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

**Verify it's running:**

```sql
select * from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'send-push')
order by start_time desc
limit 5;
```

Look for `status = 'succeeded'` and `return_message = '1 row'`.

**Alternative — external cron** (e.g. GitHub Actions on a schedule):
just `curl -X POST` the function URL with the service-role Bearer token.
Use this only if pg_cron / pg_net aren't available on your plan, or if
you want centralised cron management outside Supabase.

## Adding a new notification type

1. **Write a trigger** in a new migration file. Pattern:

   ```sql
   CREATE OR REPLACE FUNCTION trg_notify_my_thing()
   RETURNS TRIGGER AS $$
   BEGIN
     PERFORM enqueue_notification(
       <target_user_id>,
       'my_thing',                               -- type (free-form string)
       'Short title',
       'Body text with context',
       jsonb_build_object('placeId', <id>)       -- data payload (optional)
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER my_thing_notify
     AFTER INSERT ON some_table
     FOR EACH ROW EXECUTE FUNCTION trg_notify_my_thing();
   ```

2. **Supported `data` keys for deep linking** (see
   [`useNotifications.ts`](../app/src/hooks/useNotifications.ts) →
   `handleNotificationTap`):
   - `placeId`: routes to `/place/<id>`
   - `screen`: routes to that expo-router path

   Add more routes by extending `handleNotificationTap`.

3. **No edge function changes needed** — the generic drain handles it.

## Lifecycle campaigns (welcome + dormancy)

Beyond transactional triggers, we run two scheduled campaigns that
scan the user base periodically and enqueue notifications:

- **`welcome`** — 24-48h after signup, exactly once per user
- **`dormancy_7d`** — 7-8 days after `last_active_at`, max once per
  30-day window

Both are defined in
[`migration-010-lifecycle-notifications.sql`](../app/src/lib/migration-010-lifecycle-notifications.sql)
as SQL functions:

- `enqueue_welcome_notifications()` — runs hourly (`0 * * * *`)
- `enqueue_dormancy_notifications()` — runs daily at 10:00 UTC (`0 10 * * *`)

Both are **idempotent** — they check `notifications_log` AND
`notifications_queue` for prior sends/pending, so re-running never
causes double-sends. The same machinery the per-user transactional
triggers use applies (opt-out check, quiet hours, push_token check).

### Manual usage

```sql
-- See what's eligible right now without enqueueing
select id, email, created_at
from profiles
where created_at between now() - interval '48 hours' and now() - interval '24 hours'
  and notifications_enabled = true
  and push_token is not null;

-- Trigger immediately (for testing)
select enqueue_welcome_notifications();
select enqueue_dormancy_notifications();

-- Disable a campaign
select cron.unschedule('enqueue-welcome');
select cron.unschedule('enqueue-dormancy-7d');
```

### Adding a new lifecycle campaign

1. Write a SQL function `enqueue_<name>_notifications()` that does an
   `INSERT INTO notifications_queue ... SELECT FROM profiles WHERE ...`
   with NOT EXISTS guards against `notifications_log` and the queue.
2. Schedule it via `cron.schedule(name, cron_expr, $$ select ...; $$)`.
3. That's it. The send-push edge function handles delivery, opt-out,
   quiet hours, and logging automatically.

Likely future campaigns (deferred until we have data on what works):
- `tier_milestone` — fires when user is X points from next tier
- `dormancy_30d` — second-chance nudge at the 30-day mark
- `place_opened_in_new_city` — first time a known user opens the app
  in a city more than ~100km from their previous location

## Sending a one-off manually

For announcements or testing. Two options:

**From the Supabase SQL Editor:**

```sql
-- Send to one user
SELECT enqueue_notification(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'announcement',
  'New feature available',
  'Offline maps are here. Try them out.',
  '{}'::jsonb
);

-- Send to all opted-in users (be careful)
INSERT INTO notifications_queue (user_id, type, title, body, data)
SELECT id, 'announcement', 'Title', 'Body', '{}'::jsonb
FROM profiles
WHERE notifications_enabled = true AND push_token IS NOT NULL;
```

The scheduled edge function will pick them up on the next run.

**Trigger the function immediately** (skip waiting for cron):

```bash
curl -X POST https://aytvorjaetitthzuijkv.supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Response JSON reports `{processed, sent, skipped, failed}`.

## Operating notes

- **Quiet hours**: hardcoded to 21:00–09:00 in the user's timezone. If we
  want to make this per-user later, add a `quiet_start/quiet_end` column
  and read from it in `quietHoursOffsetHours()`.
- **Frequency caps**: not implemented yet. Transactional volume is low
  enough that this hasn't mattered. Add when we start doing retention
  blasts.
- **Token invalidation**: if Expo returns a ticket with `status=error` and
  `details.error='DeviceNotRegistered'`, the token is dead. We log it as
  `failed` but don't clear `push_token` yet. Worth doing once we see this
  in the wild — query `notifications_log` to see the pattern.
- **Debugging a user**: `SELECT * FROM notifications_log WHERE user_id = '<uuid>'
  ORDER BY sent_at DESC LIMIT 20;` shows the last 20 attempts and why they
  succeeded/skipped.

## Privacy / compliance

- The Apple/Google submission copy for push permissions should say "to
  notify you when your contributions are verified" — match what the app
  actually does.
- Opt-out is exposed in the Profile screen and takes effect immediately
  (checked at both enqueue and send time).
- `last_active_at` and `timezone` are personal data; they'll need to be
  included in any export/delete flow if/when we implement one under GDPR.
