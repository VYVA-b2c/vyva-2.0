-- Task 8: proactive engagement audit-shadow policy records.
--
-- Additive only. No schedule, dispatcher, communication, provider, consent or
-- domain tables are altered, redirected or backfilled.
--
-- Operational rollback:
--   1. disable VYVA_ENGAGEMENT_AUDIT_SHADOW_MODE or set it to disabled;
--   2. after reviewed retention approval, drop this table.

create table if not exists public.proactive_engagement_shadow_audits (
  id uuid primary key default gen_random_uuid(),
  audit_id text not null unique,
  schema_version text not null,
  policy_version text not null,
  idempotency_key text not null unique,
  schedule_occurrence_id text not null,
  schedule_id text not null,
  purpose_id text not null,
  decision text not null check (decision in ('allow', 'block')),
  proposed_channel text,
  reason_codes text[] not null default '{}',
  due_at timestamptz not null,
  evaluated_at timestamptz not null,
  timezone text not null,
  consent_status text not null,
  quiet_hours_status text not null,
  limit_status text not null,
  duplicate_status text not null,
  source_classification text not null,
  normalized_audit jsonb not null,
  semantic_digest text not null,
  shadow_only boolean not null default true,
  non_executable boolean not null default true,
  created_at timestamptz not null default now(),
  constraint proactive_engagement_shadow_audits_audit_id_bounded
    check (char_length(audit_id) between 1 and 160),
  constraint proactive_engagement_shadow_audits_idempotency_bounded
    check (char_length(idempotency_key) between 1 and 160),
  constraint proactive_engagement_shadow_audits_occurrence_bounded
    check (char_length(schedule_occurrence_id) between 1 and 160),
  constraint proactive_engagement_shadow_audits_digest_shape
    check (semantic_digest ~ '^sha256:[a-f0-9]{64}$'),
  constraint proactive_engagement_shadow_audits_shadow_only
    check (shadow_only = true),
  constraint proactive_engagement_shadow_audits_non_executable
    check (non_executable = true)
);

create index if not exists proactive_engagement_shadow_audits_occurrence_idx
  on public.proactive_engagement_shadow_audits (schedule_occurrence_id, policy_version);

create index if not exists proactive_engagement_shadow_audits_schedule_idx
  on public.proactive_engagement_shadow_audits (schedule_id, evaluated_at);

create index if not exists proactive_engagement_shadow_audits_decision_idx
  on public.proactive_engagement_shadow_audits (decision, evaluated_at);

create index if not exists proactive_engagement_shadow_audits_created_idx
  on public.proactive_engagement_shadow_audits (created_at);
