-- Restore schema parity for features whose original migrations predate the
-- Replit publish bootstrap. Replit intentionally skips the normal migration
-- runner, so every statement here must remain additive and idempotent.

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
      and conrelid = 'public.user_channel_preferences'::regclass
  ) then
    alter table public.user_channel_preferences
      add constraint user_channel_preferences_preventive_web_push_revision_chk
      check (preventive_web_push_consent_revision >= 0);
  end if;
end
$$;

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
  on public.checkin_sessions (
    user_id,
    orchestration_flow_id,
    orchestration_flow_version,
    orchestration_flow_instance_id,
    orchestration_completion_reference
  )
  where orchestration_completion_reference is not null;
