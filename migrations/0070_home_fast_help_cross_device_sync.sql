create extension if not exists pgcrypto;

create table if not exists public.home_fast_help_journeys (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null check (action_id in (
    'feel-better',
    'stay-well',
    'find-care',
    'book-ride',
    'paperwork-help',
    'safe-home'
  )),
  status text not null check (status in (
    'opened',
    'completed',
    'dismissed',
    'abandoned',
    'blocked'
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
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in (
    'opened',
    'completed',
    'dismissed',
    'abandoned',
    'blocked'
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

create index if not exists home_fast_help_journeys_user_updated_idx
  on public.home_fast_help_journeys (user_id, updated_at desc);

create index if not exists home_fast_help_journeys_user_action_updated_idx
  on public.home_fast_help_journeys (user_id, action_id, updated_at desc);

create index if not exists home_fast_help_journey_events_user_occurred_idx
  on public.home_fast_help_journey_events (user_id, occurred_at desc);

create index if not exists home_fast_help_journey_events_journey_occurred_idx
  on public.home_fast_help_journey_events (journey_id, occurred_at asc);

alter table public.home_fast_help_journeys enable row level security;
alter table public.home_fast_help_journey_events enable row level security;

drop policy if exists home_fast_help_journeys_user_all on public.home_fast_help_journeys;
create policy home_fast_help_journeys_user_all
  on public.home_fast_help_journeys
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists home_fast_help_journey_events_user_all on public.home_fast_help_journey_events;
create policy home_fast_help_journey_events_user_all
  on public.home_fast_help_journey_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

