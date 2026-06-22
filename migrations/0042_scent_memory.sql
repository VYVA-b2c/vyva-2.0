create extension if not exists pgcrypto;

create table if not exists public.scent_memory_prompts (
  id uuid primary key default gen_random_uuid(),
  scent_name text not null,
  scent_description text not null,
  guiding_question text not null,
  category text not null check (category in ('food','nature','home','season','place','occasion')),
  language text not null default 'es',
  source text not null default 'ai_generated' check (source in ('ai_generated','human_written')),
  reviewed_at timestamptz,
  reviewed_by text,
  rejected boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.scent_memory_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz default now(),
  prompt_id uuid references public.scent_memory_prompts(id),
  response_text text,
  response_input_method text check (response_input_method in ('voice','typed')),
  completed boolean not null default false,
  abandoned boolean not null default false,
  duration_seconds integer
);

create table if not exists public.scent_memory_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_sessions integer not null default 0,
  last_played_at timestamptz,
  streak_days integer not null default 0,
  last_streak_date date,
  updated_at timestamptz default now()
);

create index if not exists scent_memory_sessions_user_played_idx
  on public.scent_memory_sessions (user_id, played_at desc);

create index if not exists scent_memory_sessions_user_prompt_played_idx
  on public.scent_memory_sessions (user_id, prompt_id, played_at desc);

create index if not exists scent_memory_prompts_language_active_idx
  on public.scent_memory_prompts (language, is_active)
  where rejected = false;

alter table public.scent_memory_prompts enable row level security;
alter table public.scent_memory_sessions enable row level security;
alter table public.scent_memory_user_state enable row level security;

drop policy if exists scent_memory_prompts_read on public.scent_memory_prompts;
create policy scent_memory_prompts_read on public.scent_memory_prompts
  for select
  using (auth.role() = 'authenticated' and is_active = true and rejected = false);

drop policy if exists scent_memory_sessions_user_all on public.scent_memory_sessions;
create policy scent_memory_sessions_user_all on public.scent_memory_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists scent_memory_state_user_all on public.scent_memory_user_state;
create policy scent_memory_state_user_all on public.scent_memory_user_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
