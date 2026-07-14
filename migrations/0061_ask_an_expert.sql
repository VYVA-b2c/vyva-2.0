CREATE TABLE IF NOT EXISTS advisor_agents (
  slug text PRIMARY KEY,
  icon_key text NOT NULL,
  chip_bg text NOT NULL,
  icon_color text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  agent_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advisor_agents_enabled_order_idx
  ON advisor_agents (is_enabled, sort_order);

INSERT INTO advisor_agents (slug, icon_key, chip_bg, icon_color, sort_order, is_enabled, agent_config)
VALUES
  ('amara', 'coach', '#E8F7EF', '#0A7C4E', 5, true, '{"resourceRoutes":["/social-rooms/morning-movement","/social-rooms/morning-movement/exercises/:exerciseId"],"inputModes":["voice","touch","text"]}'::jsonb),
  ('nora', 'nutrition', '#E4F3E7', '#3F8752', 10, true, '{}'::jsonb),
  ('tomas', 'garden', '#F6E7DE', '#B4623E', 20, true, '{}'::jsonb),
  ('elena', 'deals', '#FBF0D9', '#C68A1A', 30, true, '{}'::jsonb),
  ('sabio', 'research', '#E3EDF7', '#3C6E9E', 40, true, '{}'::jsonb),
  ('marta', 'paperwork', '#EEE7F6', '#6B4C95', 50, true, '{}'::jsonb),
  ('diego', 'tech', '#ECEAE6', '#5C5648', 60, true, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  icon_key = EXCLUDED.icon_key,
  chip_bg = EXCLUDED.chip_bg,
  icon_color = EXCLUDED.icon_color,
  sort_order = EXCLUDED.sort_order,
  is_enabled = EXCLUDED.is_enabled,
  agent_config = EXCLUDED.agent_config,
  updated_at = now();

CREATE TABLE IF NOT EXISTS advisor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_slug text NOT NULL REFERENCES advisor_agents(slug) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  ended_at timestamptz,
  message_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS advisor_sessions_user_agent_last_idx
  ON advisor_sessions (user_id, agent_slug, last_message_at DESC);

CREATE INDEX IF NOT EXISTS advisor_sessions_user_status_idx
  ON advisor_sessions (user_id, status);

CREATE TABLE IF NOT EXISTS advisor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES advisor_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_slug text NOT NULL REFERENCES advisor_agents(slug) ON DELETE RESTRICT,
  role text NOT NULL,
  source text NOT NULL DEFAULT 'text',
  text text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advisor_messages_session_created_idx
  ON advisor_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS advisor_messages_user_agent_created_idx
  ON advisor_messages (user_id, agent_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS advisor_user_agent_state (
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agent_slug text NOT NULL REFERENCES advisor_agents(slug) ON DELETE RESTRICT,
  session_count integer NOT NULL DEFAULT 0,
  first_started_at timestamptz,
  last_session_id uuid,
  last_message_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advisor_user_agent_state_pk PRIMARY KEY (user_id, agent_slug)
);

CREATE INDEX IF NOT EXISTS advisor_user_agent_state_user_last_idx
  ON advisor_user_agent_state (user_id, last_message_at DESC);
