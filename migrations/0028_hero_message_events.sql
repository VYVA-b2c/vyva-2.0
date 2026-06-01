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
