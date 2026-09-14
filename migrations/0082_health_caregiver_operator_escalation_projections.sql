create extension if not exists pgcrypto;

create table if not exists public.health_caregiver_operator_escalation_projections (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  projection_id text not null unique,
  idempotency_key text not null unique,
  subject_user_id text not null,
  profile_id text,
  target_audience text not null,
  target_actor_id text,
  target_actor_role text not null,
  flow_id text not null,
  flow_version text not null,
  flow_instance_id text not null,
  source_event_id text not null,
  source_alert_id text,
  completion_reference text not null,
  answer_digest text not null,
  escalation_purpose text not null,
  safe_summary jsonb not null,
  authorization_decision text not null,
  authorization_reason_code text not null,
  consent_decision text not null,
  consent_reason_code text not null,
  policy_decision_digest text not null,
  consent_revision integer,
  approval_reference text,
  status text not null default 'visible',
  acknowledgement_state text not null default 'unacknowledged',
  acknowledgement_id text,
  acknowledged_at timestamptz,
  acknowledged_by text,
  acknowledged_by_role text,
  semantic_digest text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_escalation_projection_schema_version_chk
    check (schema_version = '1.0.0'),
  constraint health_escalation_projection_identity_text_chk
    check (
      length(projection_id) between 1 and 200
      and length(idempotency_key) between 1 and 512
      and length(subject_user_id) between 1 and 160
      and (profile_id is null or length(profile_id) between 1 and 160)
      and (target_actor_id is null or length(target_actor_id) between 1 and 160)
      and length(flow_instance_id) between 1 and 200
      and length(source_event_id) between 1 and 200
      and (source_alert_id is null or length(source_alert_id) between 1 and 200)
      and length(completion_reference) between 1 and 200
    ),
  constraint health_escalation_projection_flow_chk
    check (flow_id = 'health.preventive_check' and flow_version = '1.0.0'),
  constraint health_escalation_projection_digest_chk
    check (
      answer_digest ~ '^sha256:[a-f0-9]{64}$'
      and policy_decision_digest ~ '^sha256:[a-f0-9]{64}$'
      and semantic_digest ~ '^sha256:[a-f0-9]{64}$'
    ),
  constraint health_escalation_projection_purpose_chk
    check (escalation_purpose = 'health.preventive_check.caregiver_operator_escalation'),
  constraint health_escalation_projection_audience_chk
    check (target_audience in ('caregiver', 'operator')),
  constraint health_escalation_projection_actor_role_chk
    check (target_actor_role in ('caregiver', 'family', 'admin', 'operator')),
  constraint health_escalation_projection_actor_scope_chk
    check (
      (
        target_audience = 'caregiver'
        and target_actor_id is not null
        and target_actor_role in ('caregiver', 'family')
      )
      or
      (
        target_audience = 'operator'
        and target_actor_role in ('admin', 'operator')
      )
    ),
  constraint health_escalation_projection_decision_chk
    check (authorization_decision = 'allow' and consent_decision = 'allow'),
  constraint health_escalation_projection_status_chk
    check (status in ('visible', 'suppressed')),
  constraint health_escalation_projection_ack_state_chk
    check (acknowledgement_state in ('unacknowledged', 'acknowledged')),
  constraint health_escalation_projection_ack_fields_chk
    check (
      (
        acknowledgement_state = 'unacknowledged'
        and acknowledgement_id is null
        and acknowledged_at is null
        and acknowledged_by is null
        and acknowledged_by_role is null
      )
      or
      (
        acknowledgement_state = 'acknowledged'
        and acknowledgement_id is not null
        and acknowledged_at is not null
        and acknowledged_by is not null
        and acknowledged_by_role in ('caregiver', 'family', 'admin', 'operator')
      )
    ),
  constraint health_escalation_projection_consent_revision_chk
    check (consent_revision is null or consent_revision >= 0),
  constraint health_escalation_projection_safe_summary_chk
    check (
      safe_summary ? 'category'
      and safe_summary ? 'reasonCode'
      and safe_summary ? 'rawHealthAnswerContentRetained'
      and safe_summary->>'rawHealthAnswerContentRetained' = 'false'
    )
);

create index if not exists health_escalation_projection_actor_idx
  on public.health_caregiver_operator_escalation_projections
  (target_audience, target_actor_id, status, created_at desc);

create index if not exists health_escalation_projection_subject_flow_idx
  on public.health_caregiver_operator_escalation_projections
  (subject_user_id, flow_id, flow_version, flow_instance_id);

create index if not exists health_escalation_projection_source_event_idx
  on public.health_caregiver_operator_escalation_projections (source_event_id);

create index if not exists health_escalation_projection_ack_idx
  on public.health_caregiver_operator_escalation_projections
  (acknowledgement_state, updated_at);
