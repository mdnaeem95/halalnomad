-- Migration 010: lifecycle notifications (welcome + dormancy)
--
-- Server-side cron jobs that periodically scan profiles and enqueue
-- lifecycle notifications. The send-push edge function still does the
-- actual delivery (and respects notifications_enabled + quiet hours).
--
-- Two campaigns:
--   1. welcome — fires ~24-48h after signup, exactly once per user
--   2. dormancy_7d — fires when user inactive 7-8 days, max once per
--      30-day window
--
-- Idempotency is enforced via NOT EXISTS checks against both
-- notifications_queue (pending) and notifications_log (already
-- processed), so re-running the cron is safe and never double-sends.
--
-- See docs/notifications.md for the full architecture.


-- ============================================
-- Welcome (24h after signup, once per user, ever)
-- ============================================

create or replace function enqueue_welcome_notifications()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  insert into notifications_queue (user_id, type, title, body, data)
  select
    p.id,
    'welcome',
    'Welcome to HalalNomad 👋',
    'You''re an Explorer. Add a place or verify one nearby to start earning contributor points.',
    jsonb_build_object('screen', '/(tabs)/profile')
  from profiles p
  where p.created_at between now() - interval '48 hours' and now() - interval '24 hours'
    and p.notifications_enabled = true
    and p.push_token is not null
    and not exists (
      select 1 from notifications_log nl
      where nl.user_id = p.id and nl.type = 'welcome'
    )
    and not exists (
      select 1 from notifications_queue nq
      where nq.user_id = p.id and nq.type = 'welcome'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function enqueue_welcome_notifications is
  'Enqueues a welcome notification for users created 24-48 hours ago who have a push_token, opted in, and have not received this campaign before. Idempotent — safe to call repeatedly.';


-- ============================================
-- Dormancy (7d inactive, max once per 30 days)
-- ============================================

create or replace function enqueue_dormancy_notifications()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  insert into notifications_queue (user_id, type, title, body, data)
  select
    p.id,
    'dormancy_7d',
    'New halal spots near you',
    'Other travellers have been adding places. Open the app to see what''s new.',
    jsonb_build_object('screen', '/(tabs)')
  from profiles p
  where p.last_active_at between now() - interval '8 days' and now() - interval '7 days'
    and p.notifications_enabled = true
    and p.push_token is not null
    and not exists (
      select 1 from notifications_log nl
      where nl.user_id = p.id
        and nl.type = 'dormancy_7d'
        and nl.sent_at > now() - interval '30 days'
    )
    and not exists (
      select 1 from notifications_queue nq
      where nq.user_id = p.id and nq.type = 'dormancy_7d'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function enqueue_dormancy_notifications is
  'Enqueues a dormancy nudge for users inactive 7-8 days who haven''t received this campaign in the last 30 days. Idempotent.';


-- ============================================
-- Cron schedules
-- ============================================
-- The welcome window is 24h wide and the cron runs every hour, so any
-- given user gets caught exactly once during their eligible window
-- (subsequent runs hit the NOT EXISTS check).
--
-- The dormancy window is 24h wide; daily cron is enough.
-- Runs at 10:00 UTC — most of our target audience (MY/ID/SG/East Asia)
-- is in UTC+7..+9, so 10:00 UTC = 17:00..19:00 local, which is past
-- quiet hours. The send-push edge function applies per-user
-- timezone-aware quiet-hours deferral as a backstop anyway.

select cron.schedule(
  'enqueue-welcome',
  '0 * * * *',
  $$ select enqueue_welcome_notifications(); $$
);

select cron.schedule(
  'enqueue-dormancy-7d',
  '0 10 * * *',
  $$ select enqueue_dormancy_notifications(); $$
);


-- ============================================
-- Manual usage (for testing / one-offs)
-- ============================================
-- Trigger immediately:
--   select enqueue_welcome_notifications();
--   select enqueue_dormancy_notifications();
--
-- Inspect what's eligible without inserting:
--   select id, email, display_name, created_at, last_active_at
--   from profiles
--   where created_at between now() - interval '48 hours' and now() - interval '24 hours'
--     and notifications_enabled = true
--     and push_token is not null;
--
-- Disable a campaign:
--   select cron.unschedule('enqueue-welcome');
--   select cron.unschedule('enqueue-dormancy-7d');
