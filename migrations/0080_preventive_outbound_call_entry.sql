create extension if not exists pgcrypto;

create table if not exists public.preventive_outbound_call_consents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  profile_id text not null,
  enabled boolean not null default false,
  consent_revision integer not null default 0,
  phone_e164 text,
  phone_digest text,
  phone_last4 text,
  phone_verified_at timestamptz,
  verification_source text,
  verification_reference text,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preventive_outbound_call_consents_revision_chk
    check (consent_revision >= 0),
  constraint preventive_outbound_call_consents_phone_chk
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint preventive_outbound_call_consents_phone_digest_chk
    check (phone_digest is null or phone_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_outbound_call_consents_last4_chk
    check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$'),
  constraint preventive_outbound_call_consents_enabled_requires_phone_chk
    check (enabled = false or (phone_e164 is not null and phone_digest is not null and phone_verified_at is not null))
);

create unique index if not exists preventive_outbound_call_consents_user_profile_uidx
  on public.preventive_outbound_call_consents (user_id, profile_id);

create index if not exists preventive_outbound_call_consents_phone_digest_idx
  on public.preventive_outbound_call_consents (phone_digest);

create table if not exists public.preventive_outbound_call_attempts (
  id uuid primary key default gen_random_uuid(),
  call_key text not null unique,
  user_id text not null,
  profile_id text not null,
  schedule_occurrence_id text not null,
  schedule_id text not null,
  purpose_id text not null,
  channel text not null default 'voice_call',
  flow_id text not null,
  flow_version text not null,
  status text not null default 'requested',
  consent_id uuid not null,
  consent_revision integer not null,
  phone_digest text not null,
  policy_audit_id text,
  policy_decision_digest text,
  claim_token text,
  claim_expires_at timestamptz,
  provider_attempt_id text,
  provider_attempt_number integer not null default 0,
  provider_conversation_id text,
  twilio_call_sid text,
  confirmation_token_digest text,
  confirmation_token_expires_at timestamptz,
  confirmation_token_consumed_at timestamptz,
  confirmation_token_revoked_at timestamptz,
  flow_entry_claim_token text,
  flow_entry_claim_expires_at timestamptz,
  flow_entry_evidence_reference text,
  flow_entry_failure_reason text,
  cancellation_requested_at timestamptz,
  cancellation_completed_at timestamptz,
  cancellation_status text,
  cancellation_reason text,
  failure_reason text,
  requested_at timestamptz not null default now(),
  provider_attempt_started_at timestamptz,
  provider_started_at timestamptz,
  ringing_at timestamptz,
  answered_at timestamptz,
  identity_confirmed_at timestamptz,
  flow_entry_started_at timestamptz,
  flow_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preventive_outbound_call_attempts_status_chk
    check (status in ('requested', 'claimed', 'provider_attempt_started', 'provider_started', 'ringing', 'answered', 'identity_confirmed', 'flow_entry_started', 'flow_started', 'no_answer', 'busy', 'declined', 'cancelled', 'failed_retryable', 'failed_permanent', 'delivery_uncertain')),
  constraint preventive_outbound_call_attempts_channel_chk
    check (channel = 'voice_call'),
  constraint preventive_outbound_call_attempts_purpose_chk
    check (purpose_id = 'daily_wellbeing_check'),
  constraint preventive_outbound_call_attempts_flow_chk
    check (flow_id = 'health.preventive_check' and flow_version = '1.0.0'),
  constraint preventive_outbound_call_attempts_phone_digest_chk
    check (phone_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_outbound_call_attempts_policy_digest_chk
    check (policy_decision_digest is null or policy_decision_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_outbound_call_attempts_token_digest_chk
    check (confirmation_token_digest is null or confirmation_token_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_outbound_call_attempts_claim_chk
    check ((claim_token is null and claim_expires_at is null) or (length(claim_token) between 1 and 160 and claim_expires_at is not null)),
  constraint preventive_outbound_call_attempts_flow_entry_claim_chk
    check ((flow_entry_claim_token is null and flow_entry_claim_expires_at is null) or (length(flow_entry_claim_token) between 1 and 160 and flow_entry_claim_expires_at is not null)),
  constraint preventive_outbound_call_attempts_cancellation_status_chk
    check (cancellation_status is null or cancellation_status in ('requested', 'accepted', 'failed', 'uncertain')),
  constraint preventive_outbound_call_attempts_provider_conversation_chk
    check (provider_conversation_id is null or provider_conversation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  constraint preventive_outbound_call_attempts_twilio_sid_chk
    check (twilio_call_sid is null or twilio_call_sid ~ '^CA[a-fA-F0-9]{32}$'),
  constraint preventive_outbound_call_attempts_provider_attempt_count_chk
    check (provider_attempt_number >= 0),
  constraint preventive_outbound_call_attempts_provider_attempt_required_chk
    check (status not in ('provider_attempt_started', 'provider_started', 'ringing', 'answered', 'identity_confirmed', 'flow_entry_started', 'flow_started', 'delivery_uncertain') or provider_attempt_id is not null),
  constraint preventive_outbound_call_attempts_provider_correlation_required_chk
    check (status not in ('provider_started', 'ringing', 'answered', 'identity_confirmed', 'flow_entry_started', 'flow_started') or (provider_conversation_id is not null and twilio_call_sid is not null)),
  constraint preventive_outbound_call_attempts_flow_entry_evidence_chk
    check (status <> 'flow_started' or (flow_entry_evidence_reference is not null and confirmation_token_consumed_at is not null)),
  constraint preventive_outbound_call_attempts_token_expiry_chk
    check (confirmation_token_expires_at is null or confirmation_token_expires_at > requested_at)
);

create index if not exists preventive_outbound_call_attempts_user_status_idx
  on public.preventive_outbound_call_attempts (user_id, status);

create index if not exists preventive_outbound_call_attempts_occurrence_idx
  on public.preventive_outbound_call_attempts (schedule_occurrence_id, purpose_id);

create unique index if not exists preventive_outbound_call_attempts_conversation_uidx
  on public.preventive_outbound_call_attempts (provider_conversation_id)
  where provider_conversation_id is not null;

create unique index if not exists preventive_outbound_call_attempts_sid_uidx
  on public.preventive_outbound_call_attempts (twilio_call_sid)
  where twilio_call_sid is not null;

create unique index if not exists preventive_outbound_call_attempts_token_uidx
  on public.preventive_outbound_call_attempts (confirmation_token_digest)
  where confirmation_token_digest is not null;

create table if not exists public.preventive_outbound_call_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  attempt_id uuid,
  provider text not null,
  provider_call_sid text not null,
  provider_status text not null,
  transition_result text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint preventive_outbound_call_webhook_events_provider_chk
    check (provider = 'twilio'),
  constraint preventive_outbound_call_webhook_events_key_chk
    check (event_key ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_outbound_call_webhook_events_status_chk
    check (provider_status in ('queued', 'initiated', 'ringing', 'in-progress', 'completed', 'no-answer', 'busy', 'failed', 'canceled'))
);

create index if not exists preventive_outbound_call_webhook_events_attempt_idx
  on public.preventive_outbound_call_webhook_events (attempt_id);

create index if not exists preventive_outbound_call_webhook_events_sid_idx
  on public.preventive_outbound_call_webhook_events (provider_call_sid);
