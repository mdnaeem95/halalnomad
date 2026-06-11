-- Migration 022: §8.5 monthly instrumentation firing-audit
--
-- Two pieces:
--   1) audit_counter_drift() — SQL function powering Check B of the
--      audit-instrumentation edge function. Returns one row per drifted
--      counter: places.{verification_count,closed_reports,not_halal_reports}
--      vs the count derived from the verifications table. Points are
--      intentionally NOT audited (not a simple derivable aggregate).
--   2) A monthly pg_cron job that invokes the audit-instrumentation edge
--      function (which runs Check A — PostHog event-firing — AND Check B,
--      emitting two separate, separately-prefixed, alert-only alerts).
--
-- ALERT-ONLY: nothing here reconciles or mutates counters. Drift is
-- surfaced, never silently fixed (a silent auto-fix would mask the trigger
-- bug that caused the drift — see the migration 018 lesson).
--
-- Derivation rules (must match the maintenance semantics):
--   verification_count = count(verifications: type='confirm' AND status='approved')
--   closed_reports     = count(verifications: type='flag_closed')
--   not_halal_reports  = count(verifications: type='flag_not_halal')

-- ============================================
-- 1) Counter-drift query function
-- ============================================
create or replace function audit_counter_drift()
returns table(place_id uuid, field text, stored integer, derived integer)
language sql
security definer
set search_path = public
as $$
  with d as (
    select
      p.id,
      p.verification_count as vc_stored,
      p.closed_reports     as cr_stored,
      p.not_halal_reports  as nh_stored,
      coalesce((select count(*) from verifications v
                where v.place_id = p.id and v.type = 'confirm' and v.status = 'approved'), 0)::int as vc_derived,
      coalesce((select count(*) from verifications v
                where v.place_id = p.id and v.type = 'flag_closed'), 0)::int as cr_derived,
      coalesce((select count(*) from verifications v
                where v.place_id = p.id and v.type = 'flag_not_halal'), 0)::int as nh_derived
    from places p
  )
  select id, 'verification_count', vc_stored, vc_derived from d where vc_stored <> vc_derived
  union all
  select id, 'closed_reports',     cr_stored, cr_derived from d where cr_stored <> cr_derived
  union all
  select id, 'not_halal_reports',  nh_stored, nh_derived from d where nh_stored <> nh_derived;
$$;

-- ============================================
-- 2) Monthly cron -> edge function
-- ============================================
-- Requires pg_net (net.http_post) — same mechanism used to drive the
-- send-push function. Runs 06:00 UTC on the 1st of each month.
--
-- BEFORE RUNNING: replace the two placeholders below.
--   __PROJECT_REF__       e.g. abcdefghijklmnop  (your Supabase project ref)
--   __SERVICE_ROLE_KEY__  the project service-role key
-- The edge function itself reads POSTHOG_PERSONAL_API_KEY and
-- ALERT_WEBHOOK_URL from its own function env (set via `supabase secrets set`
-- or the dashboard), NOT from here.

select cron.schedule(
  'instrumentation-audit-monthly',
  '0 6 1 * *',
  $$
  select net.http_post(
    url     := 'https://__PROJECT_REF__.supabase.co/functions/v1/audit-instrumentation',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer __SERVICE_ROLE_KEY__'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Manual run (testing):
--   select audit_counter_drift();          -- Check B locally
--   -- Check A + B together: invoke the edge function via curl (see its header)
