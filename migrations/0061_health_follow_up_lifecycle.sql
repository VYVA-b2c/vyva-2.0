create extension if not exists pgcrypto;

create table if not exists public.health_follow_up_lifecycle (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null references public.profiles(id) on delete cascade,
  triage_report_id  uuid not null references public.triage_reports(id) on delete cascade,
  status            text not null default 'active'
                    check (status in ('active', 'handled', 'snoozed', 'expired')),
  source            text not null default 'prevention',
  snoozed_until     timestamptz,
  expires_at        timestamptz,
  resolved_at       timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.health_follow_up_lifecycle
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'prevention',
  add column if not exists snoozed_until timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists health_follow_up_lifecycle_user_report_uidx
  on public.health_follow_up_lifecycle (user_id, triage_report_id);

create index if not exists health_follow_up_lifecycle_user_status_idx
  on public.health_follow_up_lifecycle (user_id, status, expires_at);

create index if not exists health_follow_up_lifecycle_report_idx
  on public.health_follow_up_lifecycle (triage_report_id);
