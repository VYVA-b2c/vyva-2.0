create extension if not exists pgcrypto;

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  activity_type text not null,
  duration_minutes integer not null,
  calories integer not null default 0,
  logged_at timestamptz not null default now()
);

create table if not exists daily_step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  log_date text not null,
  steps integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint daily_step_logs_user_date_unique unique (user_id, log_date)
);
