create table if not exists public.cc_program_enrollments (
  user_id                  uuid primary key,
  status                   text not null default 'active' check (status in ('active','paused','cancelled')),
  start_date               date not null,
  frequency                text not null default 'monthly' check (frequency in ('weekly','every_2_weeks','monthly')),
  reminder_time            time not null default '10:00',
  timezone                 text not null default 'Europe/Madrid',
  scheduled_interaction_id uuid references public.scheduled_interactions(id) on delete set null,
  joined_at                timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_cc_program_enrollments_status
  on public.cc_program_enrollments (status, updated_at desc);

alter table public.cc_program_enrollments enable row level security;

drop policy if exists cc_program_enrollments_user_all on public.cc_program_enrollments;
create policy cc_program_enrollments_user_all on public.cc_program_enrollments
  for all using (true)
  with check (true);
