-- Daily check-in persistence and no-response escalation support.
-- Safe to run more than once.

create table if not exists public.checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  energy_level integer,
  mood text,
  body_areas text[] not null default '{}',
  sleep_quality text,
  symptoms text[] not null default '{}',
  symptom_details text[] not null default '{}',
  safety_flags text[] not null default '{}',
  social_contact text,
  feeling_label text,
  overall_state text,
  vyva_reading text,
  right_now jsonb not null default '[]'::jsonb,
  today_actions jsonb not null default '[]'::jsonb,
  highlight text,
  flag_caregiver boolean not null default false,
  watch_for text,
  language text not null default 'es',
  completed boolean not null default false,
  abandoned boolean not null default false,
  duration_seconds integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.checkin_sessions add column if not exists body_areas text[] not null default '{}';
alter table public.checkin_sessions add column if not exists symptom_details text[] not null default '{}';
alter table public.checkin_sessions add column if not exists safety_flags text[] not null default '{}';
alter table public.checkin_sessions add column if not exists right_now jsonb not null default '[]'::jsonb;
alter table public.checkin_sessions add column if not exists today_actions jsonb not null default '[]'::jsonb;
alter table public.checkin_sessions add column if not exists completed boolean not null default false;
alter table public.checkin_sessions add column if not exists abandoned boolean not null default false;
alter table public.checkin_sessions add column if not exists started_at timestamptz not null default now();
alter table public.checkin_sessions add column if not exists completed_at timestamptz not null default now();
alter table public.checkin_sessions add column if not exists created_at timestamptz not null default now();

create table if not exists public.checkin_trend_state (
  user_id text primary key,
  streak_days integer not null default 0,
  best_streak integer not null default 0,
  last_checkin_date date,
  total_checkins integer not null default 0,
  avg_energy_7d numeric,
  avg_mood_score_7d numeric,
  consecutive_low_energy integer not null default 0,
  consecutive_poor_sleep integer not null default 0,
  consecutive_no_social integer not null default 0,
  consecutive_low_mood integer not null default 0,
  caregiver_flag_active boolean not null default false,
  flag_reason text,
  flag_triggered_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists checkin_sessions_user_completed_idx
  on public.checkin_sessions(user_id, completed_at desc)
  where completed = true;

create index if not exists checkin_sessions_user_created_idx
  on public.checkin_sessions(user_id, created_at desc);

create index if not exists caregiver_alerts_daily_checkin_no_response_idx
  on public.caregiver_alerts(user_id, created_at desc)
  where alert_type = 'daily_checkin_no_response';
