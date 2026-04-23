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
supabase functions deploy send-push
```

No secrets to set — the function uses the auto-injected
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Schedule it

The function is idempotent and cheap — running it every 5 minutes is fine.

**Option A — Supabase dashboard cron** (easiest):
Database → Cron → New job, command:

```sql
select net.http_post(
  url := 'https://aytvorjaetitthzuijkv.supabase.co/functions/v1/send-push',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
    'Content-Type', 'application/json'
  )
);
```

You'll need to `alter database postgres set app.settings.service_role_key = '<key>'`
once so `current_setting` returns it.

**Option B — pg_cron directly** (if you prefer SQL):

```sql
select cron.schedule('send-push', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://aytvorjaetitthzuijkv.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    )
  );
$$);
```

**Option C — external cron** (e.g. GitHub Actions on a schedule):
just `curl -X POST` the function URL with the service-role Bearer token.

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
