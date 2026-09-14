-- Task 9: Stage 4 — First Health Flow
--
-- Add durable, inert orchestration identity for the preventive Health check
-- completion path plus the pre-generation claim fields required to avoid
-- duplicate concurrent generation. This migration is additive only: existing
-- check-in rows keep their current meaning, and legacy check-in writes remain
-- valid.

alter table public.checkin_sessions
  add column if not exists why_today text,
  add column if not exists trend_note text,
  add column if not exists personal_plan text,
  add column if not exists app_suggestion text,
  add column if not exists suggested_app_action text,
  add column if not exists orchestration_flow_id text,
  add column if not exists orchestration_flow_version text,
  add column if not exists orchestration_flow_instance_id text,
  add column if not exists orchestration_completion_reference text,
  add column if not exists orchestration_answer_digest text,
  add column if not exists orchestration_completion_status text,
  add column if not exists orchestration_claim_token text,
  add column if not exists orchestration_claimed_at timestamptz,
  add column if not exists orchestration_claim_expires_at timestamptz,
  add column if not exists orchestration_failure_reason text;

create unique index if not exists checkin_sessions_task9_completion_unique_idx
  on public.checkin_sessions(
    user_id,
    orchestration_flow_id,
    orchestration_flow_version,
    orchestration_flow_instance_id,
    orchestration_completion_reference
  )
  where orchestration_completion_reference is not null;
