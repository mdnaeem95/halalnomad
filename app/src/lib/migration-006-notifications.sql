-- Migration 006: Notifications infrastructure
--
-- Adds:
--   - Profile fields for preferences (opt-out, timezone, last active)
--   - notifications_queue: pending sends waiting for the edge function to pick up
--   - notifications_log: history of every send attempt (sent/failed/skipped)
--   - trigger on verifications → enqueues a "place verified" notification to the owner
--
-- After running, see docs/notifications.md for edge-function deploy + scheduling.

-- ============================================
-- PROFILE FIELDS
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT; -- IANA e.g. 'Asia/Singapore'

-- ============================================
-- QUEUE TABLE
-- ============================================
-- A row is inserted by triggers (or manually) and picked up by the
-- send-push edge function. processed_at is set once handled.

CREATE TABLE IF NOT EXISTS notifications_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- 'place_verified' | 'place_reported' | 'tier_up' | ...
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,                  -- deep-link payload, e.g. {"placeId": "..."}
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),  -- earliest time eligible to send
  processed_at TIMESTAMPTZ,    -- NULL while pending
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_queue_pending
  ON notifications_queue (scheduled_for)
  WHERE processed_at IS NULL;

ALTER TABLE notifications_queue ENABLE ROW LEVEL SECURITY;
-- Only the service role (edge functions) should read/write the queue.
-- No policies = no client access.

-- ============================================
-- LOG TABLE
-- ============================================
-- Every attempt (success, failure, skip) lands here for analytics + debugging.

CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID REFERENCES notifications_queue(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT NOT NULL,        -- 'sent' | 'failed' | 'skipped_opted_out' | 'skipped_no_token' | 'skipped_quiet_hours_deferred'
  error TEXT,
  expo_ticket_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_log_user
  ON notifications_log (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_log_type
  ON notifications_log (type, sent_at DESC);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
-- No policies = service-role only.

-- ============================================
-- HELPER: enqueue a notification
-- ============================================
-- Makes trigger code read cleanly. Skips silently if the user has
-- notifications disabled (cheap short-circuit — the edge function
-- checks again at send time for race-safe correctness).

CREATE OR REPLACE FUNCTION enqueue_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND notifications_enabled = true
  ) THEN
    RETURN;
  END IF;

  INSERT INTO notifications_queue (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: place_verified
-- ============================================
-- When someone confirms (type='confirm') a place they didn't add,
-- notify the owner.

CREATE OR REPLACE FUNCTION trg_notify_place_verified()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
  v_place_name TEXT;
BEGIN
  IF NEW.type <> 'confirm' THEN
    RETURN NEW;
  END IF;

  SELECT added_by, name_en
    INTO v_owner, v_place_name
  FROM places WHERE id = NEW.place_id;

  -- Don't notify the user who verified their own place, or an anonymously added place
  IF v_owner IS NULL OR v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  PERFORM enqueue_notification(
    v_owner,
    'place_verified',
    'Your place was verified! 🎉',
    format('Someone confirmed %s is Halal — thanks for contributing.', v_place_name),
    jsonb_build_object('placeId', NEW.place_id::text)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verifications_notify_verified ON verifications;
CREATE TRIGGER verifications_notify_verified
  AFTER INSERT ON verifications
  FOR EACH ROW EXECUTE FUNCTION trg_notify_place_verified();

-- ============================================
-- TRIGGER: place_reported (closed / not_halal)
-- ============================================
-- When someone reports a place the user added, tell them so they
-- can decide whether to re-confirm or let it lapse.

CREATE OR REPLACE FUNCTION trg_notify_place_reported()
RETURNS TRIGGER AS $$
DECLARE
  v_owner UUID;
  v_place_name TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.type NOT IN ('flag_closed', 'flag_not_halal') THEN
    RETURN NEW;
  END IF;

  SELECT added_by, name_en
    INTO v_owner, v_place_name
  FROM places WHERE id = NEW.place_id;

  IF v_owner IS NULL OR v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'flag_closed' THEN
    v_title := 'A place you added was reported closed';
    v_body := format('%s may have closed. Re-confirm next time you''re nearby.', v_place_name);
  ELSE
    v_title := 'Halal status of your place was disputed';
    v_body := format('Someone reported %s as not Halal. Upload a certificate to settle it.', v_place_name);
  END IF;

  PERFORM enqueue_notification(
    v_owner,
    'place_reported',
    v_title,
    v_body,
    jsonb_build_object('placeId', NEW.place_id::text, 'reportType', NEW.type)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verifications_notify_reported ON verifications;
CREATE TRIGGER verifications_notify_reported
  AFTER INSERT ON verifications
  FOR EACH ROW EXECUTE FUNCTION trg_notify_place_reported();
