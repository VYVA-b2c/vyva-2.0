create table if not exists public.expert_care_runtime_control (
  singleton boolean primary key default true check (singleton),
  force_disabled boolean not null default false,
  reason text,
  incident_event_id uuid,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into public.expert_care_runtime_control (singleton, force_disabled)
values (true, false)
on conflict (singleton) do nothing;

create table if not exists public.expert_care_safety_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.concierge_task_drafts(id) on delete set null,
  user_id text references public.profiles(id) on delete set null,
  metric_name text not null,
  severity text not null,
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint expert_care_safety_events_severity_check check (severity in ('info', 'warning', 'critical')),
  constraint expert_care_safety_events_metric_check check (metric_name in (
    'research_generated', 'unsupported_claim_detected', 'citation_coverage', 'source_freshness',
    'emergency_handoff', 'verification_failed', 'sharing_consent', 'consultation_ready',
    'specialist_response', 'user_comprehension', 'privacy_failure', 'security_incident'
  ))
);

create index if not exists expert_care_safety_events_metric_idx
  on public.expert_care_safety_events (metric_name, created_at desc);

create index if not exists expert_care_safety_events_case_idx
  on public.expert_care_safety_events (case_id, created_at desc)
  where case_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'expert_care_runtime_control_incident_fk') then
    alter table public.expert_care_runtime_control
      add constraint expert_care_runtime_control_incident_fk
      foreign key (incident_event_id) references public.expert_care_safety_events(id) on delete set null;
  end if;
end $$;

-- Operational recovery is deliberate: an administrator must review the incident and explicitly
-- clear force_disabled. Deleting an incident never re-enables Expert Care automatically.
