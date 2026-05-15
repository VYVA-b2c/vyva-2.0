CREATE TABLE IF NOT EXISTS voice_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  client_event_id text NOT NULL,
  session_id text,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  severity text NOT NULL DEFAULT 'info',
  domain text,
  agent_id text,
  agent_slug text,
  conversation_plan_id text,
  route text,
  action_id text,
  action_type text,
  source text NOT NULL DEFAULT 'app',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_timeline_events_user_client_event_unique UNIQUE (user_id, client_event_id)
);

CREATE INDEX IF NOT EXISTS voice_timeline_events_created_idx
ON voice_timeline_events (created_at DESC);

CREATE INDEX IF NOT EXISTS voice_timeline_events_user_created_idx
ON voice_timeline_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS voice_timeline_events_kind_created_idx
ON voice_timeline_events (kind, created_at DESC);

CREATE INDEX IF NOT EXISTS voice_timeline_events_session_idx
ON voice_timeline_events (session_id, created_at DESC);
