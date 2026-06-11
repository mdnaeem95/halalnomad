// Edge Function: audit-instrumentation
//
// §8.5 monthly firing-audit. Runs TWO independent checks and emits TWO
// independent, separately-prefixed alerts. They are never merged, and this
// is ALERT-ONLY — it never auto-reconciles anything.
//
//   Check A — event-firing audit
//     Asks the PostHog query API (project 191007, EU) which events fired in
//     the last 30 days, diffs against the EVENTS enum (lib/analytics.ts) plus
//     the SDK lifecycle-autocapture set (minus EXPECTED_DARK — events that
//     can't fire by design, e.g. the Premium-gated funnel), and alerts on
//     any audited event that is DEFINED but never FIRED. Catches events that
//     shipped but don't fire — the 5-week regional-bug lesson.
//
//   Check B — counter-drift audit
//     Diffs places.verification_count / closed_reports / not_halal_reports
//     against the counts derived from the verifications table (via the
//     audit_counter_drift() SQL function, migration 022). Alerts on any
//     drift. Points are intentionally skipped — not a simple derivable
//     aggregate.
//
// Invocation: monthly via pg_cron (see migration 022), or manually:
//   curl -X POST <project>.supabase.co/functions/v1/audit-instrumentation \
//     -H "Authorization: Bearer <service-role>"
//
// Env required on the function:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (auto-injected by Supabase)
//   POSTHOG_PERSONAL_API_KEY                  (personal API key, query scope)
//   ALERT_WEBHOOK_URL                         (Slack-compatible incoming webhook)
//   POSTHOG_PROJECT_ID  (optional, default 191007)
//   POSTHOG_HOST        (optional, default https://eu.posthog.com — EU, never US)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Mirror of the EVENTS enum in app/src/lib/analytics.ts. Keep in sync — this
// is the "defined" set Check A audits against. (Edge runtime can't import the
// RN module; it pulls in posthog-react-native.)
const DEFINED_EVENTS = [
  'place_viewed',
  'place_directions',
  'place_address_copied',
  'place_external_search',
  'search_performed',
  'cuisine_filter_used',
  'view_mode_changed',
  'place_added',
  'place_verified',
  'place_reported',
  'review_added',
  'photo_uploaded',
  'auth_prompt_shown',
  'sign_up_started',
  'sign_up_completed',
  'sign_in_completed',
  'permission_location_granted',
  'permission_location_denied',
  'permission_push_granted',
  'permission_push_denied',
  'paywall_viewed',
  'paywall_purchase_started',
  'subscription_purchased',
  'subscription_restored',
  'onboarding_viewed',
  'onboarding_skipped_to_disclaimer',
  'onboarding_disclaimer_acknowledged',
  'onboarding_completed',
  'language_changed',
  'app_rating_prompted',
  'app_rating_accepted',
];

// SDK lifecycle autocapture (captureAppLifecycleEvents:true). Only the
// recurring ones — 'Application Installed' / 'Application Updated' are
// install/update-gated and legitimately may not fire in a 30d window, so
// they are NOT audited (would false-alarm).
const LIFECYCLE_EVENTS = [
  'Application Opened',
  'Application Became Active',
  'Application Backgrounded',
];

// Events we KNOW can't fire right now, excluded so they don't make the audit
// cry wolf every month. Premium is disabled at launch
// (FEATURES.premiumEnabled = false, src/constants/features.ts), so the entire
// paywall/subscription funnel is unreachable by design.
//   ⚠️ DELETE these when Premium re-enables — otherwise a genuinely broken
//      paywall funnel would be silently excluded from the audit.
const EXPECTED_DARK = new Set([
  'paywall_viewed',
  'paywall_purchase_started',
  'subscription_purchased',
  'subscription_restored',
]);

const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') ?? 'https://eu.posthog.com';
const POSTHOG_PROJECT_ID = Deno.env.get('POSTHOG_PROJECT_ID') ?? '191007';

async function postAlert(prefix: string, lines: string[]): Promise<void> {
  const webhook = Deno.env.get('ALERT_WEBHOOK_URL');
  const text = `${prefix} ${lines.join('\n')}`;
  // Always log so the run is observable even without a webhook configured.
  console.log(text);
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error(`${prefix} failed to post alert:`, err);
  }
}

// Check A — event-firing audit.
async function checkEventFiring(): Promise<{ ok: boolean; detail: string }> {
  const apiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY');
  if (!apiKey) {
    return { ok: false, detail: 'POSTHOG_PERSONAL_API_KEY not set — cannot run event-firing audit.' };
  }

  // HogQL: distinct event names seen in the last 30 days.
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: 'select distinct event from events where timestamp > now() - interval 30 day',
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, detail: `PostHog query API ${res.status}: ${body.slice(0, 300)}` };
  }

  const json = await res.json();
  const fired = new Set<string>((json.results ?? []).map((row: unknown[]) => String(row[0])));

  const expected = [...DEFINED_EVENTS, ...LIFECYCLE_EVENTS].filter((e) => !EXPECTED_DARK.has(e));
  const missing = expected.filter((e) => !fired.has(e)).sort();

  if (missing.length === 0) {
    return {
      ok: true,
      detail: `All ${expected.length} audited events fired in last 30d (${EXPECTED_DARK.size} expected-dark excluded).`,
    };
  }
  return {
    ok: false,
    detail: `${missing.length} audited event(s) NOT fired in last 30d (${EXPECTED_DARK.size} expected-dark excluded):\n- ${missing.join('\n- ')}`,
  };
}

// Check B — counter-drift audit (SQL via audit_counter_drift, migration 022).
async function checkCounterDrift(): Promise<{ ok: boolean; detail: string }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('audit_counter_drift');
  if (error) {
    return { ok: false, detail: `audit_counter_drift RPC failed: ${error.message}` };
  }

  const rows = (data ?? []) as Array<{
    place_id: string;
    field: string;
    stored: number;
    derived: number;
  }>;

  if (rows.length === 0) {
    return { ok: true, detail: 'No counter drift — places counters match derived counts.' };
  }

  const lines = rows
    .slice(0, 50)
    .map((r) => `${r.place_id} ${r.field}: stored=${r.stored} derived=${r.derived}`);
  if (rows.length > 50) lines.push(`…and ${rows.length - 50} more`);
  return { ok: false, detail: `${rows.length} counter drift(s) found:\n${lines.join('\n')}` };
}

serve(async () => {
  const results: Record<string, unknown> = {};

  // The two checks are independent: one failing (or erroring) must not stop
  // the other or merge their alerts.
  try {
    const a = await checkEventFiring();
    results.event_firing = a;
    if (!a.ok) await postAlert('[firing-audit]', [a.detail]);
  } catch (err) {
    results.event_firing = { ok: false, detail: String(err) };
    await postAlert('[firing-audit]', [`audit errored: ${String(err)}`]);
  }

  try {
    const b = await checkCounterDrift();
    results.counter_drift = b;
    if (!b.ok) await postAlert('[counter-drift]', [b.detail]);
  } catch (err) {
    results.counter_drift = { ok: false, detail: String(err) };
    await postAlert('[counter-drift]', [`audit errored: ${String(err)}`]);
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
