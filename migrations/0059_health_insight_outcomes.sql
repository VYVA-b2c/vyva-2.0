create table if not exists public.insight_outcomes (
  id                   uuid primary key default gen_random_uuid(),
  report_id             uuid references public.health_insight_reports(id) on delete set null,
  action_id             uuid references public.agewell_action_library(id) on delete set null,
  user_id               uuid not null references auth.users(id) on delete cascade,
  tier_at_generation    integer not null check (tier_at_generation between 1 and 5),
  delivered_at          timestamptz not null default now(),
  delivered_surface     text not null check (delivered_surface in ('caregiver_dashboard','senior_card','smart_nudge','agewell_plan')),
  acknowledged_at       timestamptz,
  acknowledged_by       text check (acknowledged_by in ('senior','caregiver','family')),
  action_taken          text not null default 'none' check (action_taken in ('none','dismissed','done','hard','skip','contacted_doctor','contacted_caregiver','other')),
  follow_up_check_at    timestamptz,
  outcome_metric_delta  jsonb,
  resolved              boolean not null default false,
  created_at            timestamptz default now()
);

create index if not exists idx_insight_outcomes_user_report_delivered
  on public.insight_outcomes (user_id, report_id, delivered_at desc);

create index if not exists idx_insight_outcomes_followup_pending
  on public.insight_outcomes (follow_up_check_at)
  where resolved = false;

alter table public.insight_outcomes enable row level security;

drop policy if exists user_own_outcomes on public.insight_outcomes;
create policy user_own_outcomes on public.insight_outcomes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
