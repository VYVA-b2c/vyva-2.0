create extension if not exists pgcrypto;

create table if not exists public.cognitive_session_index (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  activity_type text not null,
  domain text not null,
  secondary_domain text,
  difficulty integer not null default 1,
  difficulty_scale text not null default 'level',
  completed boolean not null default false,
  abandoned boolean not null default false,
  score integer not null default 0,
  accuracy_pct numeric(5, 2),
  speed_pct numeric(5, 2),
  duration_seconds integer not null default 0,
  played_at timestamptz not null default now(),
  language text not null default 'es',
  source text not null default 'app',
  source_table text,
  source_session_id text,
  client_result_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cognitive_session_index enable row level security;

drop policy if exists cognitive_session_index_user_select on public.cognitive_session_index;
create policy cognitive_session_index_user_select on public.cognitive_session_index
  for select using (true);

drop policy if exists cognitive_session_index_user_insert on public.cognitive_session_index;
create policy cognitive_session_index_user_insert on public.cognitive_session_index
  for insert with check (true);

drop policy if exists cognitive_session_index_user_update on public.cognitive_session_index;
create policy cognitive_session_index_user_update on public.cognitive_session_index
  for update using (true)
  with check (true);

drop policy if exists cognitive_session_index_user_delete on public.cognitive_session_index;
create policy cognitive_session_index_user_delete on public.cognitive_session_index
  for delete using (true);

create unique index if not exists cognitive_session_index_user_client_result_unique
  on public.cognitive_session_index (user_id, client_result_id);

create index if not exists idx_cognitive_session_index_user_played
  on public.cognitive_session_index (user_id, played_at desc);

create index if not exists idx_cognitive_session_index_user_activity
  on public.cognitive_session_index (user_id, activity_type, played_at desc);

create index if not exists idx_cognitive_session_index_user_domain
  on public.cognitive_session_index (user_id, domain, played_at desc);

create index if not exists idx_cognitive_session_index_user_completed
  on public.cognitive_session_index (user_id, completed, played_at desc);
