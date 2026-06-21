create extension if not exists pgcrypto;

create table if not exists public.curious_minds_hooks (
  id uuid primary key default gen_random_uuid(),
  fact_prompt text not null,
  fact_answer text not null,
  category text not null check (category in ('nature','animals','body','weather','food','history','everyday_objects','science')),
  language text not null default 'es',
  source text not null default 'ai_generated' check (source in ('ai_generated','human_written')),
  reviewed_at timestamptz,
  reviewed_by text,
  is_active boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.curious_minds_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_type text not null check (prompt_type in ('alternate_uses','what_if','connections')),
  prompt_text text not null,
  topic text not null,
  language text not null default 'es',
  source text not null default 'ai_generated' check (source in ('ai_generated','human_written')),
  reviewed_at timestamptz,
  reviewed_by text,
  is_active boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.curious_minds_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  played_at timestamptz default now(),

  hook_id uuid references public.curious_minds_hooks(id),
  hook_guess_text text,
  hook_guess_input_method text check (hook_guess_input_method in ('voice','typed')),

  prompt_id uuid references public.curious_minds_prompts(id),
  ideas_generated jsonb not null default '[]'::jsonb,
  ideas_count integer not null default 0,

  callback_attempted boolean not null default false,
  callback_response_text text,
  callback_input_method text check (callback_input_method in ('voice','typed')),

  completed boolean not null default false,
  abandoned boolean not null default false,
  duration_seconds integer
);

create table if not exists public.curious_minds_user_state (
  user_id text primary key,
  total_sessions integer not null default 0,
  last_played_at timestamptz,
  streak_days integer not null default 0,
  last_streak_date date,
  updated_at timestamptz default now()
);

create index if not exists curious_minds_sessions_user_played_idx
  on public.curious_minds_sessions (user_id, played_at desc);

create index if not exists curious_minds_sessions_user_hook_played_idx
  on public.curious_minds_sessions (user_id, hook_id, played_at desc);

create index if not exists curious_minds_sessions_user_prompt_played_idx
  on public.curious_minds_sessions (user_id, prompt_id, played_at desc);

create index if not exists curious_minds_hooks_language_active_idx
  on public.curious_minds_hooks (language, is_active);

create index if not exists curious_minds_prompts_language_active_idx
  on public.curious_minds_prompts (language, is_active);

alter table if exists public.cognitive_profiles
  add column if not exists divergent_thinking_score numeric,
  add column if not exists divergent_thinking_trend text;
