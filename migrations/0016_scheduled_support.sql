-- Scheduled Support for Zamora V2.
-- Safe to run more than once.

create table if not exists public.scheduled_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  interaction_type text not null check (interaction_type in (
    'CHECK_IN',
    'BRAIN_COACH',
    'MEDICATION',
    'SYMPTOM_FOLLOWUP',
    'CONCIERGE_FOLLOWUP'
  )),
  friendly_label text,
  user_description text,
  source_ref_id text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'CANCELLED')),
  frequency_type text not null default 'DAILY' check (frequency_type in ('DAILY', 'WEEKLY', 'CUSTOM', 'ONE_OFF')),
  frequency_value jsonb not null default '{}'::jsonb,
  days_of_week text[] not null default '{}',
  times_of_day text[] not null default '{}',
  timezone text not null default 'Europe/Madrid',
  preferred_language text not null default 'es',
  quiet_hours_start text not null default '21:00',
  quiet_hours_end text not null default '08:00',
  escalation_contacts jsonb not null default '[]'::jsonb,
  next_run_at timestamptz,
  last_completed_at timestamptz,
  last_result text,
  is_paused boolean not null default false,
  pause_until timestamptz,
  pause_reason text,
  consent_required boolean not null default false,
  consent_status text not null default 'not_required',
  admin_edit_allowed boolean not null default false,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interaction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  scheduled_interaction_id uuid references public.scheduled_interactions(id) on delete set null,
  interaction_type text not null,
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  outcome text not null check (outcome in ('COMPLETED', 'MISSED', 'NO_RESPONSE', 'CANCELLED', 'ESCALATED')),
  summary text,
  sentiment text,
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  schedule_id uuid references public.scheduled_interactions(id) on delete set null,
  changed_by text not null,
  changed_by_role text not null,
  previous_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  consent_source text not null default 'app',
  created_at timestamptz not null default now()
);

create index if not exists scheduled_interactions_user_status_idx
  on public.scheduled_interactions(user_id, status);

create index if not exists scheduled_interactions_user_type_idx
  on public.scheduled_interactions(user_id, interaction_type);

create index if not exists scheduled_interactions_next_run_idx
  on public.scheduled_interactions(next_run_at)
  where status = 'ACTIVE' and is_paused = false;

create index if not exists interaction_logs_user_created_idx
  on public.interaction_logs(user_id, created_at desc);

create index if not exists interaction_logs_schedule_idx
  on public.interaction_logs(scheduled_interaction_id);

create index if not exists consent_audit_logs_user_created_idx
  on public.consent_audit_logs(user_id, created_at desc);

create index if not exists consent_audit_logs_schedule_idx
  on public.consent_audit_logs(schedule_id);
