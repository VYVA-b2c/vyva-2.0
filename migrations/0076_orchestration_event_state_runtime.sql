-- Task 7: durable shared event/state runtime compatibility records.
--
-- Additive only. No existing readers or writers are redirected, no domain
-- tables are altered, and no backfill is performed.
--
-- Rollback, after reviewed retention approval:
--   drop table if exists public.orchestration_flow_state_projections;
--   drop table if exists public.orchestration_event_state_events;

create table if not exists public.orchestration_event_state_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  schema_version text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz,
  correlation_id text not null,
  causation_id text,
  user_id text not null,
  profile_id text,
  session_id text,
  flow_id text,
  flow_version text,
  channel text not null,
  locale text,
  source text not null,
  modality text,
  trigger_source text,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  safety_context jsonb not null default '{}'::jsonb,
  normalized_event jsonb not null,
  semantic_digest text not null,
  created_at timestamptz not null default now(),
  constraint orchestration_event_state_events_event_id_bounded
    check (char_length(event_id) between 1 and 160),
  constraint orchestration_event_state_events_correlation_bounded
    check (char_length(correlation_id) between 1 and 160),
  constraint orchestration_event_state_events_session_bounded
    check (session_id is null or char_length(session_id) between 1 and 160),
  constraint orchestration_event_state_events_digest_shape
    check (semantic_digest ~ '^sha256:[a-f0-9]{64}$')
);

create index if not exists orchestration_event_state_events_correlation_idx
  on public.orchestration_event_state_events (correlation_id, occurred_at);

create index if not exists orchestration_event_state_events_causation_idx
  on public.orchestration_event_state_events (causation_id);

create index if not exists orchestration_event_state_events_session_idx
  on public.orchestration_event_state_events (session_id, occurred_at);

create index if not exists orchestration_event_state_events_occurred_idx
  on public.orchestration_event_state_events (occurred_at);

create table if not exists public.orchestration_flow_state_projections (
  id uuid primary key default gen_random_uuid(),
  flow_key text not null,
  flow_version_key text not null,
  flow_id text,
  flow_version text,
  session_id text not null,
  user_id text not null,
  state text not null,
  is_active boolean not null default false,
  expected_input jsonb,
  pending_tool jsonb,
  interrupted_state text,
  resume_metadata jsonb,
  context jsonb not null default '{}'::jsonb,
  completion_outcome jsonb,
  correlation_id text,
  causation_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  normalized_flow_state jsonb not null,
  semantic_digest text not null,
  updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  persisted_at timestamptz not null default now(),
  constraint orchestration_flow_state_projections_identity_unique
    unique (session_id, flow_key, flow_version_key),
  constraint orchestration_flow_state_projections_session_bounded
    check (char_length(session_id) between 1 and 160),
  constraint orchestration_flow_state_projections_flow_key_bounded
    check (char_length(flow_key) between 1 and 160),
  constraint orchestration_flow_state_projections_version_key_bounded
    check (char_length(flow_version_key) between 1 and 160),
  constraint orchestration_flow_state_projections_digest_shape
    check (semantic_digest ~ '^sha256:[a-f0-9]{64}$')
);

create unique index if not exists orchestration_flow_state_projections_one_active_session_idx
  on public.orchestration_flow_state_projections (session_id)
  where is_active = true;

create index if not exists orchestration_flow_state_projections_session_idx
  on public.orchestration_flow_state_projections (session_id, updated_at);

create index if not exists orchestration_flow_state_projections_flow_idx
  on public.orchestration_flow_state_projections (flow_id, flow_version);

create index if not exists orchestration_flow_state_projections_correlation_idx
  on public.orchestration_flow_state_projections (correlation_id);
