create extension if not exists pgcrypto;

create table if not exists public.longevity_action_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references public.profiles(id) on delete cascade,
  plan_id        uuid references public.longevity_prevention_plans(id) on delete set null,
  pillar         text check (pillar is null or pillar in ('heart','brain','strength','nourishment','calm')),
  action_key     text not null,
  action_title   text not null,
  event_type     text not null check (event_type in ('shown','opened','done','too_hard','not_relevant')),
  barrier        text,
  source_context jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

comment on table public.longevity_action_events is
  'Backend-owned event memory for Longevity plan actions, used to avoid repeating rejected steps and adapt future daily support.';

create index if not exists idx_longevity_action_events_user_created
  on public.longevity_action_events (user_id, created_at desc);

create index if not exists idx_longevity_action_events_user_action_created
  on public.longevity_action_events (user_id, action_key, created_at desc);

alter table public.longevity_action_events enable row level security;

drop policy if exists longevity_action_events_backend_owned on public.longevity_action_events;

create policy longevity_action_events_backend_owned on public.longevity_action_events
  for all using (true) with check (true);

alter table public.longevity_daily_content
  alter column is_active set default true;

update public.longevity_daily_content
set is_active = true
where content_type in ('exercise','meal','tip')
  and language in ('es','en');

insert into public.longevity_daily_content
  (content_type, title, description, detail_text, condition_tags, pillar_tag, time_of_day, language, rotation_weight, is_active)
values
('exercise','Walk after lunch',
 'Ten steady minutes after a meal is a practical first step.',
 'Keep the pace easy. Stop if you feel unwell, dizzy, or short of breath.',
 array['all','heart','diabetes'],'heart','afternoon','en',3,true),
('exercise','Supported chair strength',
 'One seated round keeps movement simple when energy is lower.',
 'Sit tall, stand if comfortable, or press your feet gently into the floor. Keep it light.',
 array['all','falls','strength'],'strength','morning','en',3,true),
('exercise','Two-minute breathing reset',
 'A short breathing pause is enough when the plan needs to stay small.',
 'Breathe in gently, then exhale slowly. Repeat for two minutes.',
 array['all','anxiety','calm'],'calm','any','en',3,true),
('meal','Protein at breakfast',
 'Eggs, yogurt, beans, or fish can make the first meal steadier.',
 'Choose one familiar protein food. Keep the meal simple.',
 array['all','diabetes','falls','strength'],'nourishment','morning','en',3,true),
('meal','Water where you sit',
 'Keeping water nearby makes hydration easier to remember.',
 'Place a glass or bottle near the chair or table you use most.',
 array['all'],'nourishment','any','en',2,true),
('tip','One familiar Brain Coach round',
 'A familiar activity keeps today''s brain step low effort.',
 array['all','brain','alzheimers'],'brain','any','en',3,true),
('tip','Same bedtime tonight',
 'A familiar evening time supports tomorrow''s energy and attention.',
 array['all','calm','diabetes'],'calm','evening','en',2,true),
('tip','Clear one walking path',
 'One clear route at home makes movement easier and steadier.',
 array['all','falls','strength'],'strength','evening','en',2,true),
('tip','Save one health question',
 'One saved question makes the next visit easier to use well.',
 array['all','heart','diabetes','falls'],'heart','any','en',2,true)
on conflict (content_type, title, language) do update
set description = excluded.description,
    detail_text = excluded.detail_text,
    condition_tags = excluded.condition_tags,
    pillar_tag = excluded.pillar_tag,
    time_of_day = excluded.time_of_day,
    rotation_weight = excluded.rotation_weight,
    is_active = true;
