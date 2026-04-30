-- Migration 011: fix RLS lock-out in notification triggers
--
-- Bug: enqueue_notification() and the verifications triggers from
-- migration 006 weren't declared SECURITY DEFINER, so they ran as the
-- calling user (the authenticated user who's verifying or reporting).
-- notifications_queue has RLS enabled with no policies (only service
-- role should write), so the trigger's INSERT failed → the verifications
-- INSERT rolled back → the app showed "Could not confirm — please try again."
--
-- Symptom on prod: tapping "Confirm Halal" or "Report Closed/Not Halal"
-- on any place owned by another user threw a generic error and never
-- recorded the verification.
--
-- Fix: recreate all three functions with SECURITY DEFINER so they run
-- with the privileges of the function owner (typically postgres /
-- service role) and bypass RLS on notifications_queue.

create or replace function enqueue_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default null
) returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from profiles
    where id = p_user_id and notifications_enabled = true
  ) then
    return;
  end if;

  insert into notifications_queue (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, p_data);
end;
$$;

create or replace function trg_notify_place_verified()
returns trigger
language plpgsql
security definer
as $$
declare
  v_owner uuid;
  v_place_name text;
begin
  if new.type <> 'confirm' then
    return new;
  end if;

  select added_by, name_en
    into v_owner, v_place_name
  from places where id = new.place_id;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  perform enqueue_notification(
    v_owner,
    'place_verified',
    'Your place was verified! 🎉',
    format('Someone confirmed %s is Halal — thanks for contributing.', v_place_name),
    jsonb_build_object('placeId', new.place_id::text)
  );
  return new;
end;
$$;

create or replace function trg_notify_place_reported()
returns trigger
language plpgsql
security definer
as $$
declare
  v_owner uuid;
  v_place_name text;
  v_title text;
  v_body text;
begin
  if new.type not in ('flag_closed', 'flag_not_halal') then
    return new;
  end if;

  select added_by, name_en
    into v_owner, v_place_name
  from places where id = new.place_id;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  if new.type = 'flag_closed' then
    v_title := 'A place you added was reported closed';
    v_body := format('%s may have closed. Re-confirm next time you''re nearby.', v_place_name);
  else
    v_title := 'Halal status of your place was disputed';
    v_body := format('Someone reported %s as not Halal. Upload a certificate to settle it.', v_place_name);
  end if;

  perform enqueue_notification(
    v_owner,
    'place_reported',
    v_title,
    v_body,
    jsonb_build_object('placeId', new.place_id::text, 'reportType', new.type)
  );
  return new;
end;
$$;
