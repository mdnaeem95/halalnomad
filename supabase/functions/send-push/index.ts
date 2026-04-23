// Edge Function: send-push
//
// Drains pending rows from notifications_queue, sends them via the
// Expo Push API, and writes results to notifications_log.
//
// Invocation:
//   - Cron (recommended): every 1-5 min via Supabase Scheduled Functions or pg_cron
//   - Manual: `curl -X POST <project>.supabase.co/functions/v1/send-push -H "Authorization: Bearer <service-role>"`
//
// Behaviour:
//   - Respects profiles.notifications_enabled (skips, logs skipped_opted_out)
//   - Skips users without push_token (logs skipped_no_token)
//   - Defers sends that land in the user's quiet hours (21:00–09:00 local)
//     by bumping scheduled_for to the next 09:00 in their timezone
//   - Batches to Expo in groups of 100
//
// Env required on the function:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (both auto-injected by Supabase)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;
const MAX_ITEMS_PER_RUN = 500;

type QueueItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  profiles: {
    push_token: string | null;
    notifications_enabled: boolean;
    timezone: string | null;
  };
};

type LogStatus =
  | 'sent'
  | 'failed'
  | 'skipped_opted_out'
  | 'skipped_no_token'
  | 'skipped_quiet_hours_deferred';

type LogRow = {
  queue_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: LogStatus;
  error: string | null;
  expo_ticket_id: string | null;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
};

function quietHoursOffsetHours(tz: string | null, now: Date): number {
  // Returns hours to defer to reach ~09:00 in user's tz. 0 if not in quiet hours.
  // Quiet window: 21:00 (inclusive) through 09:00 (exclusive) local.
  try {
    const hour = Number(
      now.toLocaleString('en-US', {
        timeZone: tz ?? 'UTC',
        hour: '2-digit',
        hour12: false,
      }),
    );
    if (hour >= 21) return 24 - hour + 9;
    if (hour < 9) return 9 - hour;
    return 0;
  } catch {
    return 0;
  }
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const now = new Date();

  const { data, error } = await supabase
    .from('notifications_queue')
    .select(
      'id, user_id, type, title, body, data, profiles!inner(push_token, notifications_enabled, timezone)',
    )
    .is('processed_at', null)
    .lte('scheduled_for', now.toISOString())
    .order('created_at', { ascending: true })
    .limit(MAX_ITEMS_PER_RUN);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pending = (data ?? []) as unknown as QueueItem[];
  if (pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0, sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const logs: LogRow[] = [];
  const processedIds: string[] = [];
  const toSend: Array<{ msg: ExpoMessage; item: QueueItem }> = [];

  for (const item of pending) {
    if (!item.profiles.notifications_enabled) {
      processedIds.push(item.id);
      logs.push(mkLog(item, 'skipped_opted_out'));
      continue;
    }
    if (!item.profiles.push_token) {
      processedIds.push(item.id);
      logs.push(mkLog(item, 'skipped_no_token'));
      continue;
    }

    const offset = quietHoursOffsetHours(item.profiles.timezone, now);
    if (offset > 0) {
      const deferTo = new Date(now.getTime() + offset * 60 * 60 * 1000);
      await supabase
        .from('notifications_queue')
        .update({ scheduled_for: deferTo.toISOString() })
        .eq('id', item.id);
      logs.push(mkLog(item, 'skipped_quiet_hours_deferred'));
      continue;
    }

    toSend.push({
      item,
      msg: {
        to: item.profiles.push_token,
        title: item.title,
        body: item.body,
        data: item.data ?? {},
        sound: 'default',
        priority: 'high',
      },
    });
  }

  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const batch = toSend.slice(i, i + BATCH_SIZE);

    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch.map((b) => b.msg)),
      });
      const json = await resp.json();
      const tickets: Array<{ status: string; id?: string; message?: string }> =
        json?.data ?? [];

      for (let j = 0; j < batch.length; j++) {
        const { item } = batch[j];
        const ticket = tickets[j];
        processedIds.push(item.id);
        if (ticket?.status === 'ok') {
          logs.push(mkLog(item, 'sent', null, ticket.id ?? null));
        } else {
          logs.push(mkLog(item, 'failed', ticket?.message ?? 'unknown'));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const { item } of batch) {
        // Leave queue unprocessed so the next run retries
        logs.push(mkLog(item, 'failed', msg));
      }
    }
  }

  if (processedIds.length > 0) {
    await supabase
      .from('notifications_queue')
      .update({ processed_at: new Date().toISOString() })
      .in('id', processedIds);
  }
  if (logs.length > 0) {
    await supabase.from('notifications_log').insert(logs);
  }

  return new Response(
    JSON.stringify({
      processed: processedIds.length,
      sent: logs.filter((l) => l.status === 'sent').length,
      skipped: logs.filter((l) => l.status.startsWith('skipped')).length,
      failed: logs.filter((l) => l.status === 'failed').length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

function mkLog(
  item: QueueItem,
  status: LogStatus,
  error: string | null = null,
  expoTicketId: string | null = null,
): LogRow {
  return {
    queue_id: item.id,
    user_id: item.user_id,
    type: item.type,
    title: item.title,
    body: item.body,
    data: item.data,
    status,
    error,
    expo_ticket_id: expoTicketId,
  };
}
