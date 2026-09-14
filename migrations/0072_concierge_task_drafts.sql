create extension if not exists pgcrypto;

create table if not exists public.concierge_task_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  kind text not null,
  entry_payload jsonb not null default '{}'::jsonb,
  progress_payload jsonb not null default '{}'::jsonb,
  stage text not null default 'details',
  status text not null default 'active',
  linked_pending_id uuid references public.concierge_pending(id) on delete set null,
  language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  constraint concierge_task_drafts_kind_check check (
    kind in ('document', 'appointment', 'home_service', 'provider_contact', 'scam_review', 'transport', 'otc_pharmacy')
  ),
  constraint concierge_task_drafts_stage_check check (stage in ('details', 'review')),
  constraint concierge_task_drafts_status_check check (status in ('active', 'completed', 'deleted'))
);

create index if not exists idx_concierge_task_drafts_user_status_updated
  on public.concierge_task_drafts(user_id, status, updated_at desc);

create index if not exists idx_concierge_task_drafts_linked_pending
  on public.concierge_task_drafts(linked_pending_id)
  where linked_pending_id is not null;
