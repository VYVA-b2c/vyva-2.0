create table if not exists public.home_fast_help_impressions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
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
      'feel-better',
      'stay-well',
      'find-care',
      'book-ride',
      'paperwork-help',
      'safe-home'
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

create index if not exists home_fast_help_impressions_user_shown_idx
  on public.home_fast_help_impressions (user_id, shown_at desc);

create index if not exists home_fast_help_impressions_version_shown_idx
  on public.home_fast_help_impressions (ranking_version, shown_at desc);

create index if not exists home_fast_help_journeys_impression_idx
  on public.home_fast_help_journeys (impression_id);

alter table public.home_fast_help_impressions enable row level security;

drop policy if exists home_fast_help_impressions_user_all on public.home_fast_help_impressions;
drop policy if exists home_fast_help_impressions_user_select on public.home_fast_help_impressions;
create policy home_fast_help_impressions_user_select
  on public.home_fast_help_impressions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists home_fast_help_impressions_user_insert on public.home_fast_help_impressions;
create policy home_fast_help_impressions_user_insert
  on public.home_fast_help_impressions
  for insert
  to authenticated
  with check (auth.uid() = user_id);
