create extension if not exists pgcrypto;

create table if not exists social_room_plans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references social_rooms(id) on delete cascade,
  plan_key text not null,
  kind text not null default 'plan',
  title_es text not null,
  title_de text not null,
  title_en text not null,
  body_es text not null default '',
  body_de text not null default '',
  body_en text not null default '',
  location_label text not null default '',
  comfort_needs text[] not null default '{}',
  starts_at timestamptz,
  status text not null default 'active',
  source text not null default 'seed',
  created_by text references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_room_plans_room_key_unique unique (room_id, plan_key)
);

alter table social_room_plans
  add column if not exists kind text not null default 'plan';

alter table social_room_plans
  add column if not exists comfort_needs text[] not null default '{}';

alter table social_room_plans
  add column if not exists experience_category text not null default 'other';

alter table social_room_plans
  add column if not exists preferred_time text not null default 'flexible';

alter table social_room_plans
  add column if not exists cost_range text not null default 'discuss';

alter table social_room_plans
  add column if not exists group_size text not null default 'one_to_one';

alter table social_room_plans
  add column if not exists safety_flags text[] not null default '{}';

alter table social_room_plans
  add column if not exists needs_review boolean not null default false;

create table if not exists social_room_plan_responses (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references social_room_plans(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_room_plan_responses_plan_user_unique unique (plan_id, user_id)
);

create table if not exists social_room_replies (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references social_room_plans(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  body text not null,
  tone text not null default 'support',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists social_room_polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references social_rooms(id) on delete cascade,
  poll_key text not null,
  question_es text not null,
  question_de text not null,
  question_en text not null,
  options jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  closes_at timestamptz,
  created_by text references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_room_polls_room_key_unique unique (room_id, poll_key)
);

create table if not exists social_room_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references social_room_polls(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_room_votes_poll_user_unique unique (poll_id, user_id)
);

create table if not exists social_room_safety_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references social_rooms(id) on delete cascade,
  reporter_id text not null references profiles(id) on delete cascade,
  target_type text not null default 'room',
  target_id text,
  reason text not null,
  details text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text references profiles(id) on delete set null
);

create table if not exists social_room_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references social_rooms(id) on delete cascade,
  admin_user_id text not null references profiles(id) on delete cascade,
  action_type text not null,
  target_type text not null,
  target_id text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists social_room_member_roles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references social_rooms(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  comfort_needs text[] not null default '{}',
  agreement_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_room_member_roles_room_user_unique unique (room_id, user_id)
);

alter table social_room_member_roles
  add column if not exists agreement_acknowledged_at timestamptz;

alter table social_room_member_roles
  add column if not exists comfort_needs text[] not null default '{}';

create table if not exists social_room_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  room_id uuid references social_rooms(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists social_room_plans_room_status_idx
  on social_room_plans (room_id, status);

create index if not exists social_room_plan_responses_user_idx
  on social_room_plan_responses (user_id);

create index if not exists social_room_replies_plan_status_created_idx
  on social_room_replies (plan_id, status, created_at);

create index if not exists social_room_polls_room_status_idx
  on social_room_polls (room_id, status);

create index if not exists social_room_votes_poll_option_idx
  on social_room_votes (poll_id, option_id);

create index if not exists social_room_safety_reports_room_status_idx
  on social_room_safety_reports (room_id, status, created_at desc);

create index if not exists social_room_moderation_actions_room_created_idx
  on social_room_moderation_actions (room_id, created_at desc);

create index if not exists social_room_notifications_user_created_idx
  on social_room_notifications (user_id, created_at desc);
