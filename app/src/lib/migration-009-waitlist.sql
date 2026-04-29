-- Migration 009: pre-launch waitlist
--
-- Captures emails from the halalnomad.travel landing page so we have a
-- warm list ready when the app goes live. Public can insert via the
-- Supabase anon key (RLS policy below); no one can read except the
-- service role.
--
-- See web/index.html for the form, web/app.js for the submission code.

create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  source text not null default 'landing_page',
  ip_country text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_created_at on waitlist (created_at desc);

alter table waitlist enable row level security;

-- Public anon-key submissions. Insert-only; never read.
-- Email uniqueness is enforced at column level (returns 409 on duplicate).
create policy "Public can join waitlist"
  on waitlist for insert
  with check (true);

-- No select policy = no read access. Use service role to query the list.

comment on table waitlist is
  'Pre-launch email signups from halalnomad.travel. Insert-only via anon key; reads via service role only.';
