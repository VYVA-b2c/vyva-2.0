CREATE TABLE IF NOT EXISTS ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_event_id uuid REFERENCES scheduled_events(id) ON DELETE SET NULL,
  appointment_request_id uuid REFERENCES appointment_requests(id) ON DELETE SET NULL,
  selected_provider_id uuid REFERENCES user_providers(id) ON DELETE SET NULL,
  linked_pending_id uuid REFERENCES concierge_pending(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  pickup jsonb NOT NULL DEFAULT '{}',
  destination jsonb NOT NULL DEFAULT '{}',
  requested_time text,
  pickup_time timestamptz,
  mobility_needs text[] NOT NULL DEFAULT '{}',
  provider_snapshot jsonb NOT NULL DEFAULT '{}',
  plan_summary text,
  source text NOT NULL DEFAULT 'concierge',
  metadata jsonb NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'es',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ride_requests_user_status_created_idx
  ON ride_requests (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ride_requests_scheduled_event_idx
  ON ride_requests (scheduled_event_id)
  WHERE scheduled_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ride_requests_linked_pending_idx
  ON ride_requests (linked_pending_id)
  WHERE linked_pending_id IS NOT NULL;
