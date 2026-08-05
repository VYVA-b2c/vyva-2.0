create extension if not exists pgcrypto;

alter table public.user_channel_preferences
  add column if not exists preventive_web_push_enabled boolean not null default false,
  add column if not exists preventive_web_push_consent_revision integer not null default 0,
  add column if not exists preventive_web_push_consent_updated_at timestamptz,
  add column if not exists preventive_web_push_consent_granted_at timestamptz,
  add column if not exists preventive_web_push_consent_revoked_at timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'user_channel_preferences_preventive_web_push_revision_chk'
  ) then
    alter table public.user_channel_preferences
      add constraint user_channel_preferences_preventive_web_push_revision_chk
      check (preventive_web_push_consent_revision >= 0);
  end if;
end $$;

create table if not exists public.preventive_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null,
  endpoint_digest text not null unique,
  p256dh text not null,
  auth text not null,
  content_encoding text not null default 'aes128gcm',
  user_agent text,
  status text not null default 'active',
  consent_revision integer not null default 0,
  failure_count integer not null default 0,
  last_provider_status integer,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preventive_web_push_subscriptions_status_chk
    check (status in ('active', 'inactive', 'revoked', 'expired')),
  constraint preventive_web_push_subscriptions_endpoint_digest_chk
    check (endpoint_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_web_push_subscriptions_endpoint_https_chk
    check (endpoint like 'https://%'),
  constraint preventive_web_push_subscriptions_keys_nonempty_chk
    check (length(p256dh) between 80 and 120 and length(auth) between 16 and 40),
  constraint preventive_web_push_subscriptions_failure_count_chk
    check (failure_count >= 0)
);

create index if not exists preventive_web_push_subscriptions_user_status_idx
  on public.preventive_web_push_subscriptions (user_id, status);

create index if not exists preventive_web_push_subscriptions_updated_idx
  on public.preventive_web_push_subscriptions (updated_at);

create table if not exists public.preventive_web_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  user_id text not null,
  subscription_id uuid not null,
  schedule_occurrence_id text not null,
  schedule_id text not null,
  purpose_id text not null,
  channel text not null default 'web_push',
  flow_id text not null,
  flow_version text not null,
  status text not null default 'requested',
  policy_audit_id text,
  policy_decision_digest text,
  entry_token_digest text,
  provider_attempt_id text,
  provider_attempt_number integer not null default 0,
  provider_status integer,
  failure_reason text,
  requested_at timestamptz not null default now(),
  sending_claim_token text,
  sending_claim_expires_at timestamptz,
  provider_attempt_started_at timestamptz,
  provider_attempt_accepted_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  opened_at timestamptz,
  flow_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preventive_web_push_deliveries_status_chk
    check (status in ('requested', 'sending', 'provider_attempt_started', 'delivery_uncertain', 'sent', 'failed_permanent', 'failed_retryable', 'opened', 'flow_started')),
  constraint preventive_web_push_deliveries_channel_chk
    check (channel = 'web_push'),
  constraint preventive_web_push_deliveries_purpose_chk
    check (purpose_id = 'daily_wellbeing_check'),
  constraint preventive_web_push_deliveries_flow_chk
    check (flow_id = 'health.preventive_check' and flow_version = '1.0.0'),
  constraint preventive_web_push_deliveries_delivery_key_chk
    check (length(delivery_key) between 1 and 512),
  constraint preventive_web_push_deliveries_required_ids_chk
    check (length(user_id) between 1 and 160 and length(schedule_occurrence_id) between 1 and 200 and length(schedule_id) between 1 and 200),
  constraint preventive_web_push_deliveries_token_digest_chk
    check (entry_token_digest is null or entry_token_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_web_push_deliveries_policy_digest_chk
    check (policy_decision_digest is null or policy_decision_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_web_push_deliveries_claim_chk
    check ((sending_claim_token is null and sending_claim_expires_at is null) or (length(sending_claim_token) between 1 and 160 and sending_claim_expires_at is not null)),
  constraint preventive_web_push_deliveries_provider_attempt_count_chk
    check (provider_attempt_number >= 0),
  constraint preventive_web_push_deliveries_provider_attempt_id_chk
    check (provider_attempt_id is null or length(provider_attempt_id) between 1 and 160),
  constraint preventive_web_push_deliveries_provider_attempt_required_chk
    check (status not in ('provider_attempt_started', 'delivery_uncertain', 'sent') or provider_attempt_id is not null)
);

alter table public.preventive_web_push_deliveries
  add column if not exists provider_attempt_id text,
  add column if not exists provider_attempt_number integer not null default 0,
  add column if not exists provider_attempt_started_at timestamptz,
  add column if not exists provider_attempt_accepted_at timestamptz;

alter table public.preventive_web_push_deliveries
  drop constraint if exists preventive_web_push_deliveries_status_chk,
  drop constraint if exists preventive_web_push_deliveries_channel_chk,
  drop constraint if exists preventive_web_push_deliveries_purpose_chk,
  drop constraint if exists preventive_web_push_deliveries_flow_chk,
  drop constraint if exists preventive_web_push_deliveries_delivery_key_chk,
  drop constraint if exists preventive_web_push_deliveries_required_ids_chk,
  drop constraint if exists preventive_web_push_deliveries_token_digest_chk,
  drop constraint if exists preventive_web_push_deliveries_policy_digest_chk,
  drop constraint if exists preventive_web_push_deliveries_claim_chk,
  drop constraint if exists preventive_web_push_deliveries_provider_attempt_count_chk,
  drop constraint if exists preventive_web_push_deliveries_provider_attempt_id_chk,
  drop constraint if exists preventive_web_push_deliveries_provider_attempt_required_chk,
  add constraint preventive_web_push_deliveries_status_chk
    check (status in ('requested', 'sending', 'provider_attempt_started', 'delivery_uncertain', 'sent', 'failed_permanent', 'failed_retryable', 'opened', 'flow_started')),
  add constraint preventive_web_push_deliveries_channel_chk
    check (channel = 'web_push'),
  add constraint preventive_web_push_deliveries_purpose_chk
    check (purpose_id = 'daily_wellbeing_check'),
  add constraint preventive_web_push_deliveries_flow_chk
    check (flow_id = 'health.preventive_check' and flow_version = '1.0.0'),
  add constraint preventive_web_push_deliveries_delivery_key_chk
    check (length(delivery_key) between 1 and 512),
  add constraint preventive_web_push_deliveries_required_ids_chk
    check (length(user_id) between 1 and 160 and length(schedule_occurrence_id) between 1 and 200 and length(schedule_id) between 1 and 200),
  add constraint preventive_web_push_deliveries_token_digest_chk
    check (entry_token_digest is null or entry_token_digest ~ '^sha256:[a-f0-9]{64}$'),
  add constraint preventive_web_push_deliveries_policy_digest_chk
    check (policy_decision_digest is null or policy_decision_digest ~ '^sha256:[a-f0-9]{64}$'),
  add constraint preventive_web_push_deliveries_claim_chk
    check ((sending_claim_token is null and sending_claim_expires_at is null) or (length(sending_claim_token) between 1 and 160 and sending_claim_expires_at is not null)),
  add constraint preventive_web_push_deliveries_provider_attempt_count_chk
    check (provider_attempt_number >= 0),
  add constraint preventive_web_push_deliveries_provider_attempt_id_chk
    check (provider_attempt_id is null or length(provider_attempt_id) between 1 and 160),
  add constraint preventive_web_push_deliveries_provider_attempt_required_chk
    check (status not in ('provider_attempt_started', 'delivery_uncertain', 'sent') or provider_attempt_id is not null);

create index if not exists preventive_web_push_deliveries_user_status_idx
  on public.preventive_web_push_deliveries (user_id, status);

create index if not exists preventive_web_push_deliveries_occurrence_idx
  on public.preventive_web_push_deliveries (schedule_occurrence_id, purpose_id);

create table if not exists public.preventive_web_push_entry_tokens (
  id uuid primary key default gen_random_uuid(),
  token_digest text not null unique,
  delivery_id uuid not null,
  user_id text not null,
  flow_id text not null,
  flow_version text not null,
  schedule_occurrence_id text not null,
  allowed_route text not null default '/health/check-in',
  status text not null default 'active',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  opened_at timestamptz,
  flow_started_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preventive_web_push_entry_tokens_status_chk
    check (status in ('active', 'opened', 'flow_started', 'revoked', 'expired')),
  constraint preventive_web_push_entry_tokens_digest_chk
    check (token_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint preventive_web_push_entry_tokens_route_chk
    check (allowed_route = '/health/check-in'),
  constraint preventive_web_push_entry_tokens_flow_chk
    check (flow_id = 'health.preventive_check' and flow_version = '1.0.0'),
  constraint preventive_web_push_entry_tokens_expiry_chk
    check (expires_at > issued_at)
);

create index if not exists preventive_web_push_entry_tokens_delivery_idx
  on public.preventive_web_push_entry_tokens (delivery_id);

create index if not exists preventive_web_push_entry_tokens_user_status_idx
  on public.preventive_web_push_entry_tokens (user_id, status);
