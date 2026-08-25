create extension if not exists pgcrypto;

create table if not exists public.longevity_prevention_plans (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    text not null references public.profiles(id) on delete cascade,
  generated_at               timestamptz not null default now(),
  period_start               timestamptz not null,
  period_end                 timestamptz not null,
  pillar_heart               text not null default 'steady' check (pillar_heart in ('thriving','steady','needs_attention','priority_focus')),
  pillar_brain               text not null default 'steady' check (pillar_brain in ('thriving','steady','needs_attention','priority_focus')),
  pillar_strength            text not null default 'steady' check (pillar_strength in ('thriving','steady','needs_attention','priority_focus')),
  pillar_nourishment         text not null default 'steady' check (pillar_nourishment in ('thriving','steady','needs_attention','priority_focus')),
  pillar_calm                text not null default 'steady' check (pillar_calm in ('thriving','steady','needs_attention','priority_focus')),
  pillar_heart_signals       jsonb,
  pillar_brain_signals       jsonb,
  pillar_strength_signals    jsonb,
  pillar_nourishment_signals jsonb,
  pillar_calm_signals        jsonb,
  cross_pillar_patterns      jsonb not null default '[]'::jsonb,
  recommendations            jsonb not null default '{}'::jsonb,
  priority_intervention      text,
  priority_why               text,
  plan_narrative_senior      text,
  plan_narrative_caregiver   text,
  plan_abstract_gp           text,
  trajectory                 text check (trajectory in ('improving','stable','declining','first')),
  source_signals             jsonb not null default '{}'::jsonb,
  confidence                 numeric(3,2),
  priority_pillar            text check (priority_pillar in ('heart','brain','strength','nourishment','calm')),
  status                     text not null default 'active' check (status in ('active','superseded','archived')),
  created_at                 timestamptz not null default now()
);

comment on table public.longevity_prevention_plans is
  'Backend-owned monthly longevity plans keyed by the active health profile. Access is enforced by authenticated Express routes.';

create index if not exists idx_lpp_user_generated
  on public.longevity_prevention_plans (user_id, generated_at desc);

create index if not exists idx_lpp_user_active
  on public.longevity_prevention_plans (user_id, status)
  where status = 'active';
