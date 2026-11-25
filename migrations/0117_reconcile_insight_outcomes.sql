-- Two historical feature migrations created different additive versions of
-- insight_outcomes. Preserve both API contracts while making the canonical
-- health-insights columns available.
alter table public.insight_outcomes
  add column if not exists report_id uuid references public.health_insight_reports(id) on delete set null,
  add column if not exists action_id uuid references public.agewell_action_library(id) on delete set null,
  add column if not exists delivered_at timestamptz not null default now(),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by text,
  add column if not exists follow_up_check_at timestamptz,
  add column if not exists outcome_metric_delta jsonb,
  add column if not exists resolved boolean not null default false,
  add column if not exists triage_report_id uuid,
  add column if not exists outcome_payload jsonb not null default '{}'::jsonb;

alter table public.insight_outcomes
  alter column user_id type uuid using user_id::uuid;

create index if not exists idx_insight_outcomes_user_report_delivered
  on public.insight_outcomes (user_id, report_id, delivered_at desc);

create index if not exists idx_insight_outcomes_followup_pending
  on public.insight_outcomes (follow_up_check_at)
  where resolved = false;

create index if not exists insight_outcomes_user_time_idx
  on public.insight_outcomes (user_id, created_at desc);

create index if not exists insight_outcomes_triage_report_idx
  on public.insight_outcomes (triage_report_id);
