create table if not exists public.cross_pillar_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handoff_id text not null,
  attempt_number integer not null check (attempt_number > 0),
  action_id text not null,
  pillar text not null check (pillar in ('health', 'mind', 'community', 'concierge')),
  workflow_reference text not null,
  tool_families text[] not null default '{}',
  confirmation_id text,
  outcome text not null check (outcome in (
    'started', 'succeeded', 'failed', 'timed_out', 'duplicate',
    'blocked', 'fallback', 'resumed', 'cancelled'
  )),
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  fallback_path text,
  fallback_reason text,
  idempotency_key text not null,
  retry_of_attempt_id uuid references public.cross_pillar_execution_attempts(id) on delete set null,
  what_happened text,
  what_remains text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cross_pillar_execution_attempts_user_handoff_attempt_unique
    unique (user_id, handoff_id, attempt_number)
);

create index if not exists cross_pillar_execution_attempts_recent_failure_idx
  on public.cross_pillar_execution_attempts(outcome, started_at desc)
  where outcome in ('failed', 'timed_out', 'blocked', 'fallback');

create index if not exists cross_pillar_execution_attempts_tool_family_idx
  on public.cross_pillar_execution_attempts using gin(tool_families);

create index if not exists cross_pillar_execution_attempts_user_recent_idx
  on public.cross_pillar_execution_attempts(user_id, started_at desc);

alter table public.cross_pillar_execution_attempts enable row level security;

drop policy if exists "cross_pillar_execution_attempts_select_own" on public.cross_pillar_execution_attempts;
create policy "cross_pillar_execution_attempts_select_own"
  on public.cross_pillar_execution_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "cross_pillar_execution_attempts_insert_own" on public.cross_pillar_execution_attempts;
create policy "cross_pillar_execution_attempts_insert_own"
  on public.cross_pillar_execution_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "cross_pillar_execution_attempts_update_own" on public.cross_pillar_execution_attempts;
create policy "cross_pillar_execution_attempts_update_own"
  on public.cross_pillar_execution_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
