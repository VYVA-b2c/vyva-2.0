-- Tables that are part of the application schema but predate the SQL
-- migration catalogue. Keep this migration additive so existing installs are
-- unaffected.
create table if not exists public.home_scans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  risk_level text not null,
  result_title text not null,
  hazards text[] not null default '{}',
  advice text not null,
  image_data text,
  linked_pending_id uuid references public.concierge_pending(id) on delete set null,
  source text,
  flow_reference text,
  scanned_at timestamptz not null default now()
);

create table if not exists public.wound_scans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  severity text not null,
  result_title text not null,
  advice text not null,
  image_data text,
  scanned_at timestamptz not null default now()
);

create table if not exists public.concierge_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  recommendation_id text not null,
  action text not null,
  category text,
  title text,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hero_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  surface text not null,
  reason text not null default 'evergreen',
  priority integer not null default 10,
  cooldown_hours integer not null default 8,
  periods text[] not null default '{}',
  safety_levels text[] not null default '{}',
  event_types text[] not null default '{}',
  activity_types text[] not null default '{}',
  copy jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.longevity_moment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.longevity_prevention_plans(id) on delete set null,
  local_date date not null,
  moment text not null check (moment in ('morning','midday','afternoon','evening')),
  program_day_id uuid references public.longevity_program_days(id) on delete set null,
  primary_action_key text not null,
  content_id uuid references public.longevity_daily_content(id) on delete set null,
  resource_id uuid references public.longevity_video_resources(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint longevity_moment_sessions_user_date_moment_key unique (user_id, local_date, moment)
);

create index if not exists idx_longevity_moment_sessions_user_date
  on public.longevity_moment_sessions (user_id, local_date desc);
