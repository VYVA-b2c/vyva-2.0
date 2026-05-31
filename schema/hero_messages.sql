create extension if not exists pgcrypto;

create table if not exists hero_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  surface text not null,
  reason text not null default 'evergreen',
  priority integer not null default 10,
  cooldown_hours integer not null default 8,
  periods text[] not null default '{}'::text[],
  safety_levels text[] not null default '{}'::text[],
  event_types text[] not null default '{}'::text[],
  activity_types text[] not null default '{}'::text[],
  copy jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hero_messages_message_id_idx on hero_messages(message_id);
create index if not exists hero_messages_surface_idx on hero_messages(surface);
create index if not exists hero_messages_enabled_idx on hero_messages(is_enabled);

create table if not exists hero_message_events (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  surface text not null,
  language text not null,
  event_type text not null,
  reason text not null,
  source text not null,
  route text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists hero_message_events_created_at_idx on hero_message_events(created_at);
create index if not exists hero_message_events_surface_idx on hero_message_events(surface);
create index if not exists hero_message_events_message_idx on hero_message_events(message_id);
create index if not exists hero_message_events_type_idx on hero_message_events(event_type);
