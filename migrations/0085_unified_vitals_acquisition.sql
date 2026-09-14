-- Canonical device registry for unified vitals acquisition. Additive and
-- idempotent so Replit publish can safely validate it more than once.

alter table public.user_device_connections
  add column if not exists device_kind text,
  add column if not exists external_device_id text,
  add column if not exists status text not null default 'ready',
  add column if not exists capabilities text[] not null default '{}';

alter table public.vyva_signal_readings
  add column if not exists assessment_session_id text;

alter table public.user_device_connections
  drop constraint if exists user_device_connections_user_provider_unique;

create unique index if not exists user_device_connections_user_provider_kind_unique
  on public.user_device_connections (user_id, provider, device_kind);

create index if not exists user_device_connections_user_active_idx
  on public.user_device_connections (user_id, is_active, last_synced_at desc);
