CREATE TABLE IF NOT EXISTS welcome_module_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL UNIQUE,
  audience text NOT NULL DEFAULT 'elder',
  moment_type text NOT NULL DEFAULT 'daily_profile_nudge',
  profile_action text,
  priority integer NOT NULL DEFAULT 10,
  cooldown_hours integer NOT NULL DEFAULT 24,
  periods text[] NOT NULL DEFAULT '{}',
  copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_route text,
  is_enabled boolean NOT NULL DEFAULT true,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS welcome_module_templates_audience_idx
  ON welcome_module_templates (audience);

CREATE INDEX IF NOT EXISTS welcome_module_templates_moment_idx
  ON welcome_module_templates (moment_type);

CREATE INDEX IF NOT EXISTS welcome_module_templates_action_idx
  ON welcome_module_templates (profile_action);

CREATE INDEX IF NOT EXISTS welcome_module_templates_enabled_idx
  ON welcome_module_templates (is_enabled);

CREATE TABLE IF NOT EXISTS welcome_module_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  profile_id text,
  template_id text NOT NULL,
  audience text NOT NULL,
  moment_type text NOT NULL,
  profile_action text,
  event_type text NOT NULL,
  language text NOT NULL DEFAULT 'es',
  route text NOT NULL DEFAULT '',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'built_in',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS welcome_module_events_user_idx
  ON welcome_module_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS welcome_module_events_profile_idx
  ON welcome_module_events (profile_id, created_at);

CREATE INDEX IF NOT EXISTS welcome_module_events_template_idx
  ON welcome_module_events (template_id);

CREATE INDEX IF NOT EXISTS welcome_module_events_moment_idx
  ON welcome_module_events (moment_type, event_date);

CREATE INDEX IF NOT EXISTS welcome_module_events_action_idx
  ON welcome_module_events (profile_action, event_date);
