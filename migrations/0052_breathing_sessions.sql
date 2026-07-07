create extension if not exists pgcrypto;

create table if not exists public.breathing_exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  purposes text[] not null default '{}',
  mood_tags text[] not null default '{}',
  difficulty integer not null default 1,
  duration_options integer[] not null default '{3}',
  default_duration_minutes integer not null default 3,
  pattern jsonb not null default '{}'::jsonb,
  safety_notes text[] not null default '{}',
  contraindications text[] not null default '{}',
  voice_style text not null default 'gentle',
  content jsonb not null default '{}'::jsonb,
  progression jsonb not null default '{}'::jsonb,
  language text not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_breathing_exercises_active_purpose
  on public.breathing_exercises (is_active, language, difficulty);

create table if not exists public.breathing_user_preferences (
  user_id text primary key references public.profiles(id) on delete cascade,
  preferred_difficulty integer not null default 1,
  preferred_duration_minutes integer not null default 3,
  preferred_voice_style text not null default 'gentle',
  preferred_mode text not null default 'voice',
  favorite_exercises text[] not null default '{}',
  disliked_exercises text[] not null default '{}',
  safety_flags text[] not null default '{}',
  last_completed_exercise_slug text,
  last_mood text,
  updated_at timestamptz not null default now()
);

create table if not exists public.breathing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  source text not null default 'app',
  voice_session_id text,
  exercise_id uuid references public.breathing_exercises(id) on delete set null,
  exercise_slug text not null,
  status text not null default 'planned',
  purpose text,
  mood_before text,
  mood_after text,
  intent jsonb not null default '{}'::jsonb,
  plan jsonb not null default '{}'::jsonb,
  preference_snapshot jsonb not null default '{}'::jsonb,
  difficulty integer not null default 1,
  duration_minutes integer not null default 3,
  comfort_rating integer,
  stopped_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_breathing_sessions_user_created
  on public.breathing_sessions (user_id, created_at desc);

create index if not exists idx_breathing_sessions_user_status
  on public.breathing_sessions (user_id, status, created_at desc);

create index if not exists idx_breathing_sessions_exercise
  on public.breathing_sessions (exercise_slug, created_at desc);

create table if not exists public.breathing_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.breathing_sessions(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_breathing_session_events_session
  on public.breathing_session_events (session_id, created_at desc);

create index if not exists idx_breathing_session_events_user
  on public.breathing_session_events (user_id, created_at desc);

insert into public.breathing_exercises (
  slug,
  name,
  description,
  purposes,
  mood_tags,
  difficulty,
  duration_options,
  default_duration_minutes,
  pattern,
  safety_notes,
  contraindications,
  voice_style,
  content,
  progression,
  language
) values
(
  'gentle-calm-breath',
  'Gentle Calm Breath',
  'A simple calming session with a longer exhale.',
  array['calm', 'stress', 'anxiety', 'settle'],
  array['worried', 'tense', 'overwhelmed', 'restless'],
  1,
  array[2, 3, 5],
  3,
  '{"inhale":4,"exhale":6,"rounds":8,"label":"Longer exhale"}'::jsonb,
  array['Stop if breathing feels painful, difficult, dizzy, or unusual.'],
  array['acute shortness of breath', 'chest pain', 'severe dizziness'],
  'gentle',
  '{"phases":[{"key":"arrive","title":"Arrive","instruction":"Sit comfortably and feel the chair supporting you.","cue":"Settle in.","seconds":30},{"key":"breathe","title":"Breathe slowly","instruction":"Breathe in gently. Breathe out a little longer.","cue":"In 4, out 6.","seconds":120},{"key":"return","title":"Return","instruction":"Notice the room and take one normal breath.","cue":"Come back gently.","seconds":30}]}'::jsonb,
  '{"afterComfortableCompletions":3,"offerDifficulty":2}'::jsonb,
  'en'
),
(
  'sleep-soft-breath',
  'Sleep Soft Breath',
  'A slower wind-down session for bedtime.',
  array['sleep', 'rest', 'wind_down'],
  array['tired', 'restless', 'awake', 'wired'],
  1,
  array[3, 5, 8],
  5,
  '{"inhale":4,"exhale":7,"rounds":10,"label":"Soft bedtime exhale"}'::jsonb,
  array['Keep the breath comfortable. Do not hold your breath if it feels unpleasant.'],
  array['acute shortness of breath', 'chest pain', 'severe dizziness'],
  'soft',
  '{"phases":[{"key":"settle","title":"Settle","instruction":"Let your eyes rest and soften your jaw.","cue":"Quiet body.","seconds":45},{"key":"breathe","title":"Slow down","instruction":"Breathe in softly. Let the breath leave slowly.","cue":"In 4, out 7.","seconds":210},{"key":"rest","title":"Rest","instruction":"Let the breath return to normal.","cue":"No effort now.","seconds":45}]}'::jsonb,
  '{"afterComfortableCompletions":4,"offerDuration":8}'::jsonb,
  'en'
),
(
  'focus-reset-breath',
  'Focus Reset Breath',
  'A short, steady breathing reset before a task.',
  array['focus', 'reset', 'clarity'],
  array['scattered', 'foggy', 'busy', 'distracted'],
  2,
  array[2, 3, 4],
  3,
  '{"inhale":4,"exhale":4,"rounds":8,"label":"Even breathing"}'::jsonb,
  array['Stay easy. If the rhythm feels uncomfortable, return to normal breathing.'],
  array['acute shortness of breath', 'chest pain', 'severe dizziness'],
  'clear',
  '{"phases":[{"key":"orient","title":"Orient","instruction":"Choose one point to rest your eyes on.","cue":"One calm point.","seconds":30},{"key":"breathe","title":"Even breath","instruction":"Breathe in and out evenly, without strain.","cue":"In 4, out 4.","seconds":120},{"key":"choose","title":"Choose next","instruction":"Name the next small thing you will do.","cue":"One next step.","seconds":30}]}'::jsonb,
  '{"afterComfortableCompletions":3,"offerDifficulty":3}'::jsonb,
  'en'
),
(
  'steady-box-breath',
  'Steady Box Breath',
  'A more structured breathing pattern for users who like clear rhythm.',
  array['steady', 'focus', 'control'],
  array['tense', 'busy', 'scattered'],
  3,
  array[3, 5],
  3,
  '{"inhale":4,"holdAfterInhale":2,"exhale":4,"holdAfterExhale":2,"rounds":6,"label":"Box breath, gentle holds"}'::jsonb,
  array['Skip the holds if they feel uncomfortable. Never force the breath.'],
  array['acute shortness of breath', 'chest pain', 'severe dizziness', 'breath holding discomfort'],
  'steady',
  '{"phases":[{"key":"prepare","title":"Prepare","instruction":"We will use a gentle rhythm. You can skip any hold.","cue":"Easy rhythm.","seconds":30},{"key":"box","title":"Steady rhythm","instruction":"Breathe in, small pause, breathe out, small pause.","cue":"In, pause, out, pause.","seconds":120},{"key":"release","title":"Release","instruction":"Let your breathing become natural again.","cue":"Natural breath.","seconds":30}]}'::jsonb,
  '{"requiresComfortableCompletions":3}'::jsonb,
  'en'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  purposes = excluded.purposes,
  mood_tags = excluded.mood_tags,
  difficulty = excluded.difficulty,
  duration_options = excluded.duration_options,
  default_duration_minutes = excluded.default_duration_minutes,
  pattern = excluded.pattern,
  safety_notes = excluded.safety_notes,
  contraindications = excluded.contraindications,
  voice_style = excluded.voice_style,
  content = excluded.content,
  progression = excluded.progression,
  language = excluded.language,
  is_active = true,
  updated_at = now();
