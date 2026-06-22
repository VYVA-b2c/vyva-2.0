create extension if not exists pgcrypto;

create table if not exists public.breath_garden_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz default now(),
  breath_taps jsonb not null default '[]'::jsonb,
  session_duration_seconds integer not null,
  breath_cycle_count integer not null default 0,
  avg_breath_cycle_seconds numeric(5,2),
  breath_consistency_index numeric(5,2),
  final_pace_breaths_per_min numeric(4,1),
  garden_theme text not null default 'garden',
  bloom_level_reached integer not null default 1 check (bloom_level_reached between 1 and 5),
  completed boolean not null default false,
  abandoned boolean not null default false
);

create table if not exists public.breath_garden_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_sessions integer not null default 0,
  last_played_at timestamptz,
  streak_days integer not null default 0,
  last_streak_date date,
  preferred_theme text default 'garden',
  updated_at timestamptz default now()
);

create index if not exists breath_garden_sessions_user_played_idx
  on public.breath_garden_sessions (user_id, played_at desc);

alter table public.breath_garden_sessions enable row level security;
alter table public.breath_garden_user_state enable row level security;

drop policy if exists breath_garden_sessions_user_all on public.breath_garden_sessions;
create policy breath_garden_sessions_user_all on public.breath_garden_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists breath_garden_state_user_all on public.breath_garden_user_state;
create policy breath_garden_state_user_all on public.breath_garden_user_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
