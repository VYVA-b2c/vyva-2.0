-- Runtime schema required by the Home and cross-pillar routes in Replit.
--
-- The original feature migrations referenced Supabase's auth.users table and
-- auth.uid() policies. The Replit deployment uses the application's
-- public.users/public.profiles authentication model instead, so those
-- migrations cannot be applied there. Keep user IDs as UUIDs for the existing
-- API contract, but let the authenticated server own access control.

create extension if not exists pgcrypto;

alter table if exists public.user_providers
  add column if not exists is_trusted boolean not null default true;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, category
      order by last_used_at desc nulls last, updated_at desc nulls last,
        created_at desc nulls last, id
    ) as category_rank
  from public.user_providers
  where is_active = true and is_trusted = true
)
update public.user_providers as provider
set is_primary = ranked.category_rank = 1
from ranked
where provider.id = ranked.id;

update public.user_providers
set is_primary = false
where is_active = false or is_trusted = false;

create unique index if not exists user_providers_one_primary_per_category_idx
  on public.user_providers (user_id, category)
  where is_primary = true and is_active = true and is_trusted = true;

create table if not exists public.home_fast_help_journeys (
  id uuid primary key,
  user_id uuid not null,
  action_id text not null check (action_id in (
    'feel-better', 'stay-well', 'find-care', 'book-ride',
    'paperwork-help', 'safe-home'
  )),
  status text not null check (status in (
    'opened', 'completed', 'dismissed', 'abandoned', 'blocked'
  )),
  started_at timestamptz not null,
  updated_at timestamptz not null,
  reference_id text check (
    reference_id is null
    or (
      char_length(reference_id) between 1 and 200
      and reference_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    )
  ),
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  check (updated_at >= started_at)
);

create table if not exists public.home_fast_help_journey_events (
  id uuid primary key,
  journey_id uuid not null references public.home_fast_help_journeys(id) on delete cascade,
  user_id uuid not null,
  status text not null check (status in (
    'opened', 'completed', 'dismissed', 'abandoned', 'blocked'
  )),
  occurred_at timestamptz not null,
  reference_id text check (
    reference_id is null
    or (
      char_length(reference_id) between 1 and 200
      and reference_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    )
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.home_fast_help_impressions (
  id uuid primary key,
  user_id uuid not null,
  action_ids text[] not null,
  ranking_version text not null,
  shown_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (
    array_ndims(action_ids) = 1
    and cardinality(action_ids) = 3
    and array_lower(action_ids, 1) = 1
    and array_upper(action_ids, 1) = 3
    and array_position(action_ids, null) is null
  ),
  check (
    action_ids <@ array[
      'feel-better', 'stay-well', 'find-care', 'book-ride',
      'paperwork-help', 'safe-home'
    ]::text[]
  ),
  check (
    action_ids[1] <> action_ids[2]
    and action_ids[1] <> action_ids[3]
    and action_ids[2] <> action_ids[3]
  ),
  check (
    char_length(ranking_version) between 1 and 40
    and ranking_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  )
);

alter table public.home_fast_help_journeys
  add column if not exists impression_id uuid;

create unique index if not exists home_fast_help_impressions_id_user_unique
  on public.home_fast_help_impressions (id, user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'home_fast_help_journeys_impression_id_fkey'
      and conrelid = 'public.home_fast_help_journeys'::regclass
  ) then
    alter table public.home_fast_help_journeys
      add constraint home_fast_help_journeys_impression_id_fkey
      foreign key (impression_id, user_id)
      references public.home_fast_help_impressions(id, user_id)
      deferrable initially deferred;
  end if;
end
$$;

create index if not exists home_fast_help_journeys_user_updated_idx
  on public.home_fast_help_journeys (user_id, updated_at desc);

create index if not exists home_fast_help_journeys_user_action_updated_idx
  on public.home_fast_help_journeys (user_id, action_id, updated_at desc);

create index if not exists home_fast_help_journeys_impression_idx
  on public.home_fast_help_journeys (impression_id);

create index if not exists home_fast_help_journey_events_user_occurred_idx
  on public.home_fast_help_journey_events (user_id, occurred_at desc);

create index if not exists home_fast_help_journey_events_journey_occurred_idx
  on public.home_fast_help_journey_events (journey_id, occurred_at asc);

create index if not exists home_fast_help_impressions_user_shown_idx
  on public.home_fast_help_impressions (user_id, shown_at desc);

create index if not exists home_fast_help_impressions_version_shown_idx
  on public.home_fast_help_impressions (ranking_version, shown_at desc);

create table if not exists public.cross_pillar_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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
