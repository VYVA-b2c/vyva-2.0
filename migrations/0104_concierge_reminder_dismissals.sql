-- Reminder visibility belongs to the existing task notification subsystem.
create table if not exists public.concierge_reminder_dismissals (
  user_id text not null references public.profiles(id) on delete cascade,
  task_key text not null,
  revision text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, task_key)
);
