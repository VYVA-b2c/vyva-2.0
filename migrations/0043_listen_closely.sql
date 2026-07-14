create extension if not exists pgcrypto;

create table if not exists public.listen_closely_soundscapes (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('find_it','oddball','count_compare')),
  difficulty_tier integer not null check (difficulty_tier between 1 and 10),
  duration_seconds integer not null,
  ambient_layer jsonb not null default '{}'::jsonb,
  target_sound_character text not null check (target_sound_character in ('chime','chirp','tap','whoosh','drip','hum','click','ring')),
  target_event_times jsonb not null,
  distractor_events jsonb not null default '[]'::jsonb,
  oddball_intro_time_ms integer,
  second_target_sound_character text check (second_target_sound_character is null or second_target_sound_character in ('chime','chirp','tap','whoosh','drip','hum','click','ring')),
  second_target_event_times jsonb,
  response_window_ms integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.listen_closely_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  played_at timestamptz not null default now(),
  soundscape_id uuid references public.listen_closely_soundscapes(id),
  difficulty_tier integer not null check (difficulty_tier between 1 and 10),
  mode text not null check (mode in ('find_it','oddball','count_compare')),
  target_total integer not null default 0,
  hits integer not null default 0,
  misses integer not null default 0,
  false_positives integer not null default 0,
  avg_reaction_time_ms integer,
  accuracy_pct numeric(5, 2),
  user_comparison_choice text,
  comparison_correct boolean,
  score integer not null default 0,
  completed boolean not null default false,
  abandoned boolean not null default false,
  duration_seconds integer
);

create table if not exists public.listen_closely_user_state (
  user_id uuid primary key,
  current_tier integer not null default 1 check (current_tier between 1 and 10),
  sessions_at_tier integer not null default 0,
  consecutive_wins integer not null default 0,
  consecutive_losses integer not null default 0,
  total_sessions integer not null default 0,
  best_score integer not null default 0,
  last_played_at timestamptz,
  streak_days integer not null default 0,
  last_streak_date date,
  updated_at timestamptz not null default now()
);

alter table public.listen_closely_soundscapes enable row level security;
alter table public.listen_closely_sessions enable row level security;
alter table public.listen_closely_user_state enable row level security;

drop policy if exists listen_closely_soundscapes_read on public.listen_closely_soundscapes;
create policy listen_closely_soundscapes_read on public.listen_closely_soundscapes
  for select using (is_active = true);

drop policy if exists listen_closely_sessions_user_all on public.listen_closely_sessions;
create policy listen_closely_sessions_user_all on public.listen_closely_sessions
  for all using (true)
  with check (true);

drop policy if exists listen_closely_state_user_all on public.listen_closely_user_state;
create policy listen_closely_state_user_all on public.listen_closely_user_state
  for all using (true)
  with check (true);

create index if not exists listen_closely_soundscapes_tier_active_idx
  on public.listen_closely_soundscapes (difficulty_tier, is_active);

create index if not exists listen_closely_sessions_user_played_idx
  on public.listen_closely_sessions (user_id, played_at desc);

create index if not exists listen_closely_sessions_user_soundscape_played_idx
  on public.listen_closely_sessions (user_id, soundscape_id, played_at desc);

with base as (
  select
    tier,
    variant,
    case ((tier + variant) % 3)
      when 0 then 'find_it'
      when 1 then 'oddball'
      else 'count_compare'
    end as mode,
    case
      when tier <= 3 then 18
      when tier <= 6 then 24
      when tier <= 8 then 30
      else 36
    end as duration_seconds,
    greatest(850, 1900 - (tier * 90)) as response_window_ms,
    (array['chime','chirp','tap','whoosh','drip','hum','click','ring'])[((tier + variant - 2) % 8) + 1] as target_sound_character,
    (array['chime','chirp','tap','whoosh','drip','hum','click','ring'])[((tier + variant + 2) % 8) + 1] as second_target_sound_character,
    least(7, greatest(2, 2 + ((tier + variant) / 4)))::integer as tap_target_count,
    least(6, greatest(2, 2 + (tier / 3) + (variant % 2)))::integer as compare_first_count,
    least(8, greatest(2, 2 + (tier / 2)))::integer as distractor_count
  from generate_series(1, 10) as tier
  cross join generate_series(1, 20) as variant
),
counts as (
  select
    *,
    case
      when mode = 'count_compare' then compare_first_count
      else tap_target_count
    end as first_count,
    greatest(1, compare_first_count + case when variant % 2 = 0 then 1 else -1 end)::integer as second_count
  from base
),
events as (
  select
    *,
    (
      select jsonb_agg(
        (case when mode = 'oddball' then 3800 else 2100 end)
        + (((duration_seconds * 1000 - 3600) / greatest(first_count, 1)) * (event_index - 1))
        + (((variant + 3) * (event_index + 1) * 137) % 520)
        order by event_index
      )
      from generate_series(1, first_count) as event_index
    ) as target_event_times,
    case when mode = 'count_compare' then (
      select jsonb_agg(
        3100
        + (((duration_seconds * 1000 - 4200) / greatest(second_count, 1)) * (event_index - 1))
        + (((variant + 7) * (event_index + 2) * 113) % 480)
        order by event_index
      )
      from generate_series(1, second_count) as event_index
    ) else null end as second_target_event_times,
    case when mode = 'count_compare' then '[]'::jsonb else (
      select jsonb_agg(
        jsonb_build_object(
          'sound_character',
          (array['chime','chirp','tap','whoosh','drip','hum','click','ring'])[((tier + variant + event_index + 1) % 8) + 1],
          'time_ms',
          2600
            + (((duration_seconds * 1000 - 4600) / greatest(distractor_count, 1)) * (event_index - 1))
            + (((variant + 11) * (event_index + 3) * 97) % 430)
        )
        order by event_index
      )
      from generate_series(1, distractor_count) as event_index
    ) end as distractor_events
  from counts
),
seed as (
  select
    (
      substr(md5('listen-closely-' || tier || '-' || variant), 1, 8) || '-' ||
      substr(md5('listen-closely-' || tier || '-' || variant), 9, 4) || '-' ||
      substr(md5('listen-closely-' || tier || '-' || variant), 13, 4) || '-' ||
      substr(md5('listen-closely-' || tier || '-' || variant), 17, 4) || '-' ||
      substr(md5('listen-closely-' || tier || '-' || variant), 21, 12)
    )::uuid as id,
    mode,
    tier as difficulty_tier,
    duration_seconds,
    jsonb_build_object(
      'type', 'soft_room',
      'intensity', case when tier <= 4 then 'low' when tier <= 7 then 'medium' else 'busy' end
    ) as ambient_layer,
    target_sound_character,
    target_event_times,
    distractor_events,
    case when mode = 'oddball' then 1500 else null end as oddball_intro_time_ms,
    case when mode = 'count_compare' then second_target_sound_character else null end as second_target_sound_character,
    second_target_event_times,
    response_window_ms
  from events
)
insert into public.listen_closely_soundscapes (
  id,
  mode,
  difficulty_tier,
  duration_seconds,
  ambient_layer,
  target_sound_character,
  target_event_times,
  distractor_events,
  oddball_intro_time_ms,
  second_target_sound_character,
  second_target_event_times,
  response_window_ms
)
select
  id,
  mode,
  difficulty_tier,
  duration_seconds,
  ambient_layer,
  target_sound_character,
  target_event_times,
  distractor_events,
  oddball_intro_time_ms,
  second_target_sound_character,
  second_target_event_times,
  response_window_ms
from seed
on conflict (id) do nothing;
