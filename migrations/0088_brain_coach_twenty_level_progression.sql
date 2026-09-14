-- Brain Coach 20-level progression for the visible activity catalogue.
-- Hidden activities such as Spatial Navigator and Routine Memory remain outside this phase.

create or replace function public.vyva_brain_coach_seed_uuid(seed text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(seed), 1, 8) || '-' ||
    substr(md5(seed), 9, 4) || '-' ||
    substr(md5(seed), 13, 4) || '-' ||
    substr(md5(seed), 17, 4) || '-' ||
    substr(md5(seed), 21, 12)
  )::uuid;
$$;

alter table if exists public.remember_later_rounds
  drop constraint if exists remember_later_rounds_difficulty_tier_check;
alter table if exists public.remember_later_rounds
  add constraint remember_later_rounds_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.remember_later_sessions
  drop constraint if exists remember_later_sessions_difficulty_tier_check;
alter table if exists public.remember_later_sessions
  add constraint remember_later_sessions_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.remember_later_user_state
  drop constraint if exists remember_later_user_state_current_tier_check;
alter table if exists public.remember_later_user_state
  add constraint remember_later_user_state_current_tier_check
  check (current_tier between 1 and 20);
alter table if exists public.remember_later_user_state
  alter column current_tier set default 1;
update public.remember_later_user_state
set has_seen_tutorial = true,
    updated_at = now()
where current_tier >= 2
  and has_seen_tutorial = false;

alter table if exists public.listen_closely_soundscapes
  drop constraint if exists listen_closely_soundscapes_difficulty_tier_check;
alter table if exists public.listen_closely_soundscapes
  add constraint listen_closely_soundscapes_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.listen_closely_sessions
  drop constraint if exists listen_closely_sessions_difficulty_tier_check;
alter table if exists public.listen_closely_sessions
  add constraint listen_closely_sessions_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.listen_closely_user_state
  drop constraint if exists listen_closely_user_state_current_tier_check;
alter table if exists public.listen_closely_user_state
  add constraint listen_closely_user_state_current_tier_check
  check (current_tier between 1 and 20);

alter table if exists public.dual_task_sequences
  drop constraint if exists dual_task_sequences_difficulty_tier_check;
alter table if exists public.dual_task_sequences
  add constraint dual_task_sequences_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.dual_task_sessions
  drop constraint if exists dual_task_sessions_difficulty_tier_check;
alter table if exists public.dual_task_sessions
  add constraint dual_task_sessions_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.dual_task_user_state
  drop constraint if exists dual_task_user_state_current_tier_check;
alter table if exists public.dual_task_user_state
  add constraint dual_task_user_state_current_tier_check
  check (current_tier between 1 and 20);

alter table if exists public.category_sort_sequences
  drop constraint if exists category_sort_sequences_difficulty_tier_check;
alter table if exists public.category_sort_sequences
  add constraint category_sort_sequences_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.category_sort_sessions
  drop constraint if exists category_sort_sessions_difficulty_tier_check;
alter table if exists public.category_sort_sessions
  add constraint category_sort_sessions_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.category_sort_user_state
  drop constraint if exists category_sort_user_state_current_tier_check;
alter table if exists public.category_sort_user_state
  add constraint category_sort_user_state_current_tier_check
  check (current_tier between 1 and 20);

alter table if exists public.number_trails_configs
  drop constraint if exists number_trails_configs_difficulty_tier_check;
alter table if exists public.number_trails_configs
  add constraint number_trails_configs_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.number_trails_sessions
  drop constraint if exists number_trails_sessions_difficulty_tier_check;
alter table if exists public.number_trails_sessions
  add constraint number_trails_sessions_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.number_trails_user_state
  drop constraint if exists number_trails_user_state_current_tier_check;
alter table if exists public.number_trails_user_state
  add constraint number_trails_user_state_current_tier_check
  check (current_tier between 1 and 20);

alter table if exists public.face_name_sets
  drop constraint if exists face_name_sets_difficulty_tier_check;
alter table if exists public.face_name_sets
  add constraint face_name_sets_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.face_name_sessions
  drop constraint if exists face_name_sessions_difficulty_tier_check;
alter table if exists public.face_name_sessions
  add constraint face_name_sessions_difficulty_tier_check
  check (difficulty_tier between 1 and 20);

alter table if exists public.face_name_user_state
  drop constraint if exists face_name_user_state_current_tier_check;
alter table if exists public.face_name_user_state
  add constraint face_name_user_state_current_tier_check
  check (current_tier between 1 and 20);

with base as (
  select
    tier,
    variant,
    (array[
      'shape_circle',
      'shape_square',
      'shape_triangle',
      'color_red',
      'color_blue',
      'color_yellow',
      'number_even',
      'number_odd'
    ])[((tier + variant - 2) % 8) + 1] as ongoing_task_rule,
    (array['bell', 'star', 'flag', 'key', 'moon', 'music', 'leaf', 'heart'])[((tier + variant + 1) % 8) + 1] as cue_icon,
    case
      when tier >= 19 then 102
      when tier >= 17 then 106
      when tier >= 15 then 110
      else 118
    end as round_duration_seconds,
    (56 + ((tier - 11) * 2) + (variant % 5))::integer as filler_item_count,
    greatest(1200, 1660 - ((tier - 11) * 45))::integer as filler_item_interval_ms,
    case when tier >= 18 then 1 else 2 end as response_window_items,
    case when tier >= 19 then 3 when tier >= 15 then 4 else 5 end as tolerance_seconds,
    (10 + ((variant * 3 + tier) % 20))::integer as cue_position_index
  from generate_series(11, 20) as tier
  cross join generate_series(1, 20) as variant
),
remember_later_seed as (
  select
    public.vyva_brain_coach_seed_uuid('remember-later-20-' || tier || '-' || variant) as id,
    'dual' as round_type,
    tier as difficulty_tier,
    round_duration_seconds,
    ongoing_task_rule,
    (
      select jsonb_agg(
        case
          when item_index = cue_position_index then jsonb_build_object(
            'type', 'icon',
            'value', 'cue',
            'icon', 'cue',
            'matches_rule', false,
            'cue', true
          )
          else jsonb_build_object(
            'type',
            case
              when ongoing_task_rule like 'shape_%' then 'shape'
              when ongoing_task_rule like 'color_%' then 'color'
              else 'number'
            end,
            'value',
            case
              when ongoing_task_rule = 'shape_circle' then case when is_match then 'circle' else (array['square', 'triangle'])[((item_index + variant) % 2) + 1] end
              when ongoing_task_rule = 'shape_square' then case when is_match then 'square' else (array['circle', 'triangle'])[((item_index + variant) % 2) + 1] end
              when ongoing_task_rule = 'shape_triangle' then case when is_match then 'triangle' else (array['circle', 'square'])[((item_index + variant) % 2) + 1] end
              when ongoing_task_rule = 'color_red' then case when is_match then 'red' else (array['blue', 'yellow'])[((item_index + variant) % 2) + 1] end
              when ongoing_task_rule = 'color_blue' then case when is_match then 'blue' else (array['red', 'yellow'])[((item_index + variant) % 2) + 1] end
              when ongoing_task_rule = 'color_yellow' then case when is_match then 'yellow' else (array['red', 'blue'])[((item_index + variant) % 2) + 1] end
              when ongoing_task_rule = 'number_even' then case when is_match then (array['2', '4', '6', '8'])[((item_index + tier) % 4) + 1] else (array['1', '3', '5', '7', '9'])[((item_index + variant) % 5) + 1] end
              else case when is_match then (array['1', '3', '5', '7', '9'])[((item_index + tier) % 5) + 1] else (array['2', '4', '6', '8'])[((item_index + variant) % 4) + 1] end
            end,
            'matches_rule', is_match
          )
        end
        order by item_index
      )
      from (
        select
          item_index,
          item_index <> cue_position_index
            and ((item_index + tier + variant) % 11) in (0, 2, 3, 6, 8) as is_match
        from generate_series(0, filler_item_count - 1) as item_index
      ) filler
    ) as filler_stream,
    filler_item_count,
    filler_item_interval_ms,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'event',
        'cue_icon', cue_icon,
        'cue_position_index', cue_position_index,
        'response_window_items', response_window_items
      ),
      jsonb_build_object(
        'type', 'time',
        'target_delay_seconds', least(round_duration_seconds - 16, 42 + ((tier + variant) % 26)),
        'tolerance_seconds', tolerance_seconds
      )
    ) as intentions
  from base
)
insert into public.remember_later_rounds (
  id,
  round_type,
  difficulty_tier,
  round_duration_seconds,
  ongoing_task_rule,
  filler_stream,
  filler_item_count,
  filler_item_interval_ms,
  intentions
)
select
  id,
  round_type,
  difficulty_tier,
  round_duration_seconds,
  ongoing_task_rule,
  filler_stream,
  filler_item_count,
  filler_item_interval_ms,
  intentions
from remember_later_seed
on conflict (id) do nothing;

with listen_base as (
  select
    tier,
    variant,
    case ((tier + variant) % 3)
      when 0 then 'find_it'
      when 1 then 'oddball'
      else 'count_compare'
    end as mode,
    case
      when tier <= 12 then 30
      when tier <= 16 then 34
      else 38
    end as duration_seconds,
    greatest(760, 1950 - (tier * 55))::integer as response_window_ms,
    (array['chime', 'chirp', 'tap', 'whoosh', 'drip', 'hum', 'click', 'ring'])[((tier + variant - 2) % 8) + 1] as target_sound_character,
    (array['chime', 'chirp', 'tap', 'whoosh', 'drip', 'hum', 'click', 'ring'])[((tier + variant + 2) % 8) + 1] as second_target_sound_character,
    least(9, greatest(3, 3 + ((tier + variant) / 5)))::integer as tap_target_count,
    least(8, greatest(3, 3 + (tier / 4) + (variant % 2)))::integer as compare_first_count,
    least(11, greatest(4, 4 + (tier / 3)))::integer as distractor_count
  from generate_series(11, 20) as tier
  cross join generate_series(1, 20) as variant
),
listen_counts as (
  select
    *,
    case when mode = 'count_compare' then compare_first_count else tap_target_count end as first_count,
    greatest(1, compare_first_count + case when variant % 2 = 0 then 1 else -1 end)::integer as second_count
  from listen_base
),
listen_events as (
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
          (array['chime', 'chirp', 'tap', 'whoosh', 'drip', 'hum', 'click', 'ring'])[((tier + variant + event_index + 1) % 8) + 1],
          'time_ms',
          2600
            + (((duration_seconds * 1000 - 4600) / greatest(distractor_count, 1)) * (event_index - 1))
            + (((variant + 11) * (event_index + 3) * 97) % 430)
        )
        order by event_index
      )
      from generate_series(1, distractor_count) as event_index
    ) end as distractor_events
  from listen_counts
),
listen_seed as (
  select
    public.vyva_brain_coach_seed_uuid('listen-closely-20-' || tier || '-' || variant) as id,
    mode,
    tier as difficulty_tier,
    duration_seconds,
    jsonb_build_object(
      'type', 'soft_room',
      'intensity', case when tier <= 15 then 'busy' else 'layered' end
    ) as ambient_layer,
    target_sound_character,
    target_event_times,
    distractor_events,
    case when mode = 'oddball' then 1500 else null end as oddball_intro_time_ms,
    case when mode = 'count_compare' then second_target_sound_character else null end as second_target_sound_character,
    second_target_event_times,
    response_window_ms
  from listen_events
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
from listen_seed
on conflict (id) do nothing;

with source as (
  select *
  from (
    select
      row_number() over (partition by language order by difficulty_tier desc, start_number, symbol_stream::text) as variant_number,
      *
    from public.dual_task_sequences
    where difficulty_tier in (9, 10)
      and is_active = true
  ) ranked
  where variant_number <= 20
),
seed as (
  select
    public.vyva_brain_coach_seed_uuid('dual-task-20-' || target_tier || '-' || language || '-' || variant_number) as id,
    least(999, start_number + ((target_tier - 10) * 7))::integer as start_number,
    jsonb_array_length(expected_answers) as answer_count,
    symbol_stream,
    match_indices,
    symbol_count,
    match_count,
    least(70000, round_duration_ms + ((target_tier - 10) * 750))::integer as round_duration_ms,
    target_tier as difficulty_tier,
    language
  from source
  cross join generate_series(11, 20) as target_tier
)
insert into public.dual_task_sequences (
  id,
  start_number,
  expected_answers,
  symbol_stream,
  match_indices,
  symbol_count,
  match_count,
  round_duration_ms,
  difficulty_tier,
  language
)
select
  id,
  start_number,
  (
    select jsonb_agg(start_number - (step * 7) order by step)
    from generate_series(1, answer_count) as step
  ) as expected_answers,
  symbol_stream,
  match_indices,
  symbol_count,
  match_count,
  round_duration_ms,
  difficulty_tier,
  language
from seed
on conflict (id) do nothing;

with source as (
  select *
  from (
    select
      row_number() over (partition by language order by difficulty_tier desc, id) as variant_number,
      *
    from public.number_trails_configs
    where difficulty_tier in (9, 10)
      and is_active = true
  ) ranked
  where variant_number <= 20
)
insert into public.number_trails_configs (
  id,
  trail_type,
  node_count,
  nodes,
  par_time_seconds,
  difficulty_tier,
  language
)
select
  public.vyva_brain_coach_seed_uuid('number-trails-20-' || target_tier || '-' || language || '-' || variant_number) as id,
  trail_type,
  node_count,
  nodes,
  greatest(95, par_time_seconds - ((target_tier - 10) * 3))::integer as par_time_seconds,
  target_tier as difficulty_tier,
  language
from source
cross join generate_series(11, 20) as target_tier
on conflict (id) do update set
  trail_type = excluded.trail_type,
  node_count = excluded.node_count,
  nodes = excluded.nodes,
  par_time_seconds = excluded.par_time_seconds,
  difficulty_tier = excluded.difficulty_tier,
  language = excluded.language,
  is_active = true;

with source as (
  select *
  from (
    select
      row_number() over (partition by language order by difficulty_tier desc, id) as variant_number,
      *
    from public.category_sort_sequences
    where difficulty_tier in (9, 10)
      and is_active = true
  ) ranked
  where variant_number <= 20
)
insert into public.category_sort_sequences (
  id,
  difficulty_tier,
  card_ids,
  card_count,
  rules,
  language
)
select
  public.vyva_brain_coach_seed_uuid('category-sort-20-' || target_tier || '-' || language || '-' || variant_number) as id,
  target_tier as difficulty_tier,
  card_ids,
  card_count,
  rules,
  language
from source
cross join generate_series(11, 20) as target_tier
on conflict (id) do update set
  difficulty_tier = excluded.difficulty_tier,
  card_ids = excluded.card_ids,
  card_count = excluded.card_count,
  rules = excluded.rules,
  language = excluded.language,
  is_active = true;

with source as (
  select *
  from (
    select
      row_number() over (partition by language order by difficulty_tier desc, id) as variant_number,
      *
    from public.face_name_sets
    where difficulty_tier in (9, 10)
      and is_active = true
  ) ranked
  where variant_number <= 20
)
insert into public.face_name_sets (
  id,
  persona_ids,
  face_count,
  difficulty_tier,
  recall_modes,
  study_seconds,
  language
)
select
  public.vyva_brain_coach_seed_uuid('face-name-20-' || target_tier || '-' || language || '-' || variant_number) as id,
  persona_ids,
  case when target_tier >= 16 then 8 when target_tier >= 11 then 7 else face_count end as face_count,
  target_tier as difficulty_tier,
  case
    when target_tier >= 16 then '["name_to_face", "face_to_name", "name_to_face", "face_to_name"]'::jsonb
    else '["name_to_face", "face_to_name", "face_to_name"]'::jsonb
  end as recall_modes,
  case
    when target_tier >= 18 then 22
    when target_tier >= 14 then 25
    else 30
  end as study_seconds,
  language
from source
cross join generate_series(11, 20) as target_tier
on conflict (id) do update set
  persona_ids = excluded.persona_ids,
  face_count = excluded.face_count,
  difficulty_tier = excluded.difficulty_tier,
  recall_modes = excluded.recall_modes,
  study_seconds = excluded.study_seconds,
  language = excluded.language,
  is_active = true;

drop function if exists public.vyva_brain_coach_seed_uuid(text);
