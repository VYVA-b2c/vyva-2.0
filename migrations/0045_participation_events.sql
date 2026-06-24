create extension if not exists pgcrypto;

create table if not exists participation_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  title_es text not null,
  title_de text not null,
  title_en text not null,
  summary_es text not null default '',
  summary_de text not null default '',
  summary_en text not null default '',
  description_es text not null default '',
  description_de text not null default '',
  description_en text not null default '',
  format text not null default 'nearby',
  location_label text not null default 'nearby',
  city text,
  country_code text,
  time_label_es text not null default '',
  time_label_de text not null default '',
  time_label_en text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  cost_label_es text not null default '',
  cost_label_de text not null default '',
  cost_label_en text not null default '',
  language_codes text[] not null default '{}',
  tags text[] not null default '{}',
  interest_tags text[] not null default '{}',
  accessibility_tags text[] not null default '{}',
  helper_actions text[] not null default '{}',
  source text not null default 'curated',
  source_url text,
  status text not null default 'active',
  is_curated boolean not null default true,
  needs_live_check boolean not null default true,
  safety_status text not null default 'approved',
  metadata jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participation_events_format_check
    check (format in ('nearby', 'online', 'hybrid')),
  constraint participation_events_status_check
    check (status in ('active', 'draft', 'hidden', 'archived')),
  constraint participation_events_safety_check
    check (safety_status in ('approved', 'needs_review', 'hidden'))
);

create index if not exists participation_events_status_idx
  on participation_events (status, safety_status);

create index if not exists participation_events_country_city_idx
  on participation_events (country_code, city);

create table if not exists participation_event_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references participation_events(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participation_event_responses_response_check
    check (response in ('interested', 'maybe', 'not_for_me')),
  constraint participation_event_responses_event_user_unique
    unique (event_id, user_id)
);

create index if not exists participation_event_responses_user_idx
  on participation_event_responses (user_id, updated_at desc);

create table if not exists participation_event_checks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references participation_events(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  status text not null default 'requested',
  request_note text not null default '',
  helper_actions text[] not null default '{}',
  concierge_prefill jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint participation_event_checks_status_check
    check (status in ('requested', 'checking', 'checked', 'cancelled'))
);

create index if not exists participation_event_checks_user_idx
  on participation_event_checks (user_id, created_at desc);

create index if not exists participation_event_checks_event_idx
  on participation_event_checks (event_id, created_at desc);

create table if not exists participation_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  event_id uuid references participation_events(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  metadata jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists participation_notifications_user_idx
  on participation_notifications (user_id, created_at desc);
