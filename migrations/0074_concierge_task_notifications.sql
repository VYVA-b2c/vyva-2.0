alter table public.user_channel_preferences
  add column if not exists concierge_task_notifications_enabled boolean not null default true;

create table if not exists public.concierge_task_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  pending_id uuid not null references public.concierge_pending(id) on delete cascade,
  inbound_message_id uuid not null references public.concierge_inbound_messages(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  task_path text not null,
  delivery_status text not null default 'ready',
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_task_notifications_event_type_check
    check (event_type in ('provider_reply', 'information_needed')),
  constraint concierge_task_notifications_delivery_status_check
    check (delivery_status in ('ready', 'suppressed')),
  constraint concierge_task_notifications_dedupe_key_unique unique (dedupe_key),
  constraint concierge_task_notifications_inbound_message_unique unique (inbound_message_id)
);

create index if not exists concierge_task_notifications_user_unread_idx
  on public.concierge_task_notifications(user_id, created_at desc)
  where delivery_status = 'ready' and read_at is null;

create index if not exists concierge_task_notifications_pending_idx
  on public.concierge_task_notifications(pending_id);
