CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE user_providers
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS appointment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_type text NOT NULL,
  reason_detail text,
  preferences jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  selected_provider_id uuid REFERENCES user_providers(id) ON DELETE SET NULL,
  selected_provider_option_id uuid,
  selected_channel text,
  linked_pending_id uuid REFERENCES concierge_pending(id) ON DELETE SET NULL,
  linked_scheduled_event_id uuid REFERENCES scheduled_events(id) ON DELETE SET NULL,
  route_prefill_source text,
  language text NOT NULL DEFAULT 'es',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_provider_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES user_providers(id) ON DELETE SET NULL,
  provider_source text NOT NULL DEFAULT 'saved',
  provider_snapshot jsonb NOT NULL DEFAULT '{}',
  match_reason text,
  available_channels text[] NOT NULL DEFAULT '{}',
  rank integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'suggested',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES appointment_requests(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_option_id uuid REFERENCES appointment_provider_options(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES user_providers(id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pending_id uuid REFERENCES concierge_pending(id) ON DELETE SET NULL,
  result_notes text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_requests_user_status_idx
  ON appointment_requests (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS appointment_provider_options_request_rank_idx
  ON appointment_provider_options (request_id, rank);

CREATE INDEX IF NOT EXISTS appointment_attempts_request_created_idx
  ON appointment_attempts (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_providers_user_place_idx
  ON user_providers (user_id, place_id)
  WHERE place_id IS NOT NULL;
