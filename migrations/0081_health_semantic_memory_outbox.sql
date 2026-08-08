create extension if not exists pgcrypto;

create table if not exists public.health_semantic_memory_outbox (
  id uuid primary key default gen_random_uuid(),
  proposal_id text not null unique,
  schema_version text not null,
  idempotency_key text not null unique,
  user_id text not null,
  profile_id text,
  mem0_user_id text not null,
  flow_id text not null,
  flow_version text not null,
  flow_instance_id text not null,
  completion_reference text not null,
  answer_digest text not null,
  category text not null,
  target text not null,
  operation text not null,
  status text not null,
  local_visibility text not null default 'active',
  suppressed_at timestamptz,
  superseded_by text,
  deleted_by text,
  content text,
  content_digest text,
  policy_decision text not null,
  policy_reason_code text not null,
  policy_decision_digest text not null,
  consent_revision integer,
  approval_reference text,
  provenance jsonb not null,
  provider text not null default 'mem0',
  provider_memory_id text,
  failure_reason text,
  normalized_proposal jsonb not null,
  semantic_digest text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_semantic_memory_outbox_schema_version_chk
    check (schema_version = '1.0.0'),
  constraint health_semantic_memory_outbox_identity_text_chk
    check (
      length(proposal_id) between 1 and 200
      and length(idempotency_key) between 1 and 512
      and length(user_id) between 1 and 160
      and (profile_id is null or length(profile_id) between 1 and 160)
      and length(mem0_user_id) between 1 and 160
      and length(flow_instance_id) between 1 and 200
      and length(completion_reference) between 1 and 200
    ),
  constraint health_semantic_memory_outbox_flow_chk
    check (flow_id = 'health.preventive_check' and flow_version = '1.0.0'),
  constraint health_semantic_memory_outbox_digest_chk
    check (
      answer_digest ~ '^sha256:[a-f0-9]{64}$'
      and policy_decision_digest ~ '^sha256:[a-f0-9]{64}$'
      and semantic_digest ~ '^sha256:[a-f0-9]{64}$'
      and (content_digest is null or content_digest ~ '^sha256:[a-f0-9]{64}$')
    ),
  constraint health_semantic_memory_outbox_category_chk
    check (category in (
      'general_preference',
      'routine_health_context',
      'restricted_health',
      'mental_health',
      'safety_emergency',
      'care_instruction'
    )),
  constraint health_semantic_memory_outbox_target_chk
    check (target = 'mem0'),
  constraint health_semantic_memory_outbox_operation_chk
    check (operation in ('write', 'correction', 'deletion')),
  constraint health_semantic_memory_outbox_status_chk
    check (status in (
      'approval_required',
      'proposal_only',
      'delivery_pending',
      'delivery_in_progress',
      'delivered',
      'delivery_failed',
      'denied',
      'corrected',
      'delete_pending',
      'delete_in_progress',
      'deleted',
      'deletion_failed'
    )),
  constraint health_semantic_memory_outbox_local_visibility_chk
    check (local_visibility in ('active', 'suppressed')),
  constraint health_semantic_memory_outbox_suppression_reference_chk
    check (
      (
        local_visibility = 'active'
        and suppressed_at is null
        and superseded_by is null
        and deleted_by is null
        and status not in ('corrected', 'deleted')
      )
      or
      (
        local_visibility = 'suppressed'
        and suppressed_at is not null
        and status in ('corrected', 'deleted')
        and (
          (case when superseded_by is not null then 1 else 0 end) +
          (case when deleted_by is not null then 1 else 0 end)
        ) = 1
      )
    ),
  constraint health_semantic_memory_outbox_suppression_text_chk
    check (
      (superseded_by is null or length(superseded_by) between 1 and 200)
      and (deleted_by is null or length(deleted_by) between 1 and 200)
    ),
  constraint health_semantic_memory_outbox_policy_decision_chk
    check (policy_decision in ('allow', 'deny', 'proposal_only', 'approval_required')),
  constraint health_semantic_memory_outbox_content_pair_chk
    check ((content is null and content_digest is null) or (content is not null and content_digest is not null)),
  constraint health_semantic_memory_outbox_provider_chk
    check (provider = 'mem0'),
  constraint health_semantic_memory_outbox_delivered_provider_chk
    check (status <> 'delivered' or provider_memory_id is not null),
  constraint health_semantic_memory_outbox_sensitive_delivery_chk
    check (
      status <> 'delivered'
      or category not in ('restricted_health', 'mental_health', 'safety_emergency', 'care_instruction')
    ),
  constraint health_semantic_memory_outbox_consent_revision_chk
    check (consent_revision is null or consent_revision >= 0),
  constraint health_semantic_memory_outbox_provenance_chk
    check (
      provenance ? 'source'
      and provenance ? 'sourceRecordId'
      and provenance ? 'sourceDigest'
      and provenance ? 'observedAt'
      and provenance ? 'flowInstanceId'
    )
);

create index if not exists health_semantic_memory_outbox_user_category_status_idx
  on public.health_semantic_memory_outbox (user_id, category, status, updated_at desc);

create index if not exists health_semantic_memory_outbox_visibility_idx
  on public.health_semantic_memory_outbox (user_id, category, local_visibility, status, updated_at desc);

create index if not exists health_semantic_memory_outbox_flow_completion_idx
  on public.health_semantic_memory_outbox (flow_id, flow_version, completion_reference);

create index if not exists health_semantic_memory_outbox_status_updated_idx
  on public.health_semantic_memory_outbox (status, updated_at);
