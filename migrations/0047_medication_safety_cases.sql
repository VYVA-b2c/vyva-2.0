create extension if not exists pgcrypto;

create table if not exists medication_safety_signals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  signal_type text not null,
  severity text not null default 'watch',
  title text not null,
  summary text not null,
  medication_name text,
  source text not null default 'meds',
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  related_case_id uuid,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint medication_safety_signals_type_check
    check (signal_type in ('missed_dose_pattern', 'possible_side_effect', 'interaction_question', 'vitals_overlap', 'symptom_followup')),
  constraint medication_safety_signals_severity_check
    check (severity in ('watch', 'attention', 'urgent')),
  constraint medication_safety_signals_status_check
    check (status in ('open', 'linked', 'dismissed'))
);

create table if not exists medication_safety_cases (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  status text not null default 'draft',
  severity text not null default 'watch',
  signal_type text not null default 'possible_side_effect',
  suspected_medication text,
  reaction text,
  reaction_started_at timestamptz,
  seriousness_flags text[] not null default '{}',
  outcome text,
  action_taken text,
  reporter_name text,
  reporter_contact text,
  reporter_role text not null default 'patient_or_caregiver',
  narrative text,
  evidence jsonb not null default '[]'::jsonb,
  missing_fields text[] not null default '{}',
  export_ready boolean not null default false,
  latest_export_json jsonb,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_safety_cases_type_check
    check (signal_type in ('missed_dose_pattern', 'possible_side_effect', 'interaction_question', 'vitals_overlap', 'symptom_followup')),
  constraint medication_safety_cases_status_check
    check (status in ('draft', 'needs_review', 'shared', 'closed', 'dismissed')),
  constraint medication_safety_cases_severity_check
    check (severity in ('watch', 'attention', 'urgent'))
);

create table if not exists medication_safety_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references medication_safety_cases(id) on delete cascade,
  user_id text not null,
  event_type text not null,
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists medication_safety_signals_user_time_idx
  on medication_safety_signals (user_id, detected_at desc);

create index if not exists medication_safety_signals_user_status_idx
  on medication_safety_signals (user_id, status);

create index if not exists medication_safety_cases_user_status_idx
  on medication_safety_cases (user_id, status);

create index if not exists medication_safety_cases_user_type_idx
  on medication_safety_cases (user_id, signal_type, created_at desc);

create index if not exists medication_safety_case_events_case_time_idx
  on medication_safety_case_events (case_id, created_at desc);

create index if not exists medication_safety_case_events_user_time_idx
  on medication_safety_case_events (user_id, created_at desc);
