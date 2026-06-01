alter table hero_messages
  add column if not exists copy_modes jsonb not null default '{}'::jsonb;

alter table hero_messages
  add column if not exists copy_source_metadata jsonb not null default '{}'::jsonb;
