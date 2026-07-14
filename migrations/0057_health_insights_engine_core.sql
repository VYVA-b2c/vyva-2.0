create extension if not exists pgcrypto;

create table if not exists public.condition_intelligence_profiles (
  id                         uuid primary key default gen_random_uuid(),
  condition_name             text not null unique,
  weighted_domains           jsonb not null default '{}',
  priority_correlation_rules text[] not null default '{}',
  framing_note               text not null,
  escalation_sensitivity     numeric(3,2) not null default 1.00,
  is_active                  boolean not null default true,
  created_at                 timestamptz default now()
);

create table if not exists public.health_insight_reports (
  id                                      uuid primary key default gen_random_uuid(),
  user_id                                 uuid not null,
  report_type                             text not null default 'weekly' check (report_type in ('weekly','monthly')),
  generated_at                            timestamptz not null default now(),
  period_start                            timestamptz not null,
  period_end                              timestamptz not null,
  severity_tier                           integer not null check (severity_tier between 1 and 5),
  confidence                              numeric(3,2) not null,
  source_signals                          jsonb not null default '{}',
  vitals_summary                          jsonb,
  medication_summary                      jsonb,
  cognitive_summary                       jsonb,
  mood_summary                            jsonb,
  symptom_summary                         jsonb,
  concierge_summary                       jsonb,
  correlation_flags                       jsonb not null default '[]',
  synthesized_recommendation_caregiver    text,
  synthesized_recommendation_senior       text,
  focus_domain                            text,
  recommend_clinician                     boolean not null default false,
  status                                  text not null default 'active' check (status in ('active','superseded','archived')),
  created_at                              timestamptz default now()
);

create index if not exists idx_health_insight_reports_user_generated
  on public.health_insight_reports (user_id, generated_at desc);

create index if not exists idx_health_insight_reports_user_type_generated
  on public.health_insight_reports (user_id, report_type, generated_at desc);

alter table public.health_insight_reports enable row level security;

drop policy if exists user_own_reports on public.health_insight_reports;
create policy user_own_reports on public.health_insight_reports
  for all
  using (true)
  with check (true);

insert into public.condition_intelligence_profiles
  (condition_name, weighted_domains, priority_correlation_rules, framing_note, escalation_sensitivity)
values
('heart',
 '{"vitals": 1.8, "medication": 1.5, "move": 1.3, "mood": 1.0, "cognitive": 0.8}'::jsonb,
 array['adherence_mood_correlation', 'cognitive_vitals_correlation'],
 'This user has a heart condition. Weight vitals deviation and medication adherence most heavily. Prioritise movement and salt/food actions. Use calm, reassuring language, never alarming. Flag any vitals spike or missed cardiac medication immediately.',
 1.20),
('diabetes',
 '{"medication": 1.8, "vitals": 1.5, "eat": 1.5, "mood": 1.0, "cognitive": 0.8}'::jsonb,
 array['adherence_mood_correlation', 'symptom_medication_correlation'],
 'This user has diabetes. Weight medication adherence and any glucose-adjacent vitals signals most heavily. Prioritise regular meals, hydration, and post-meal movement actions. Note missed doses alongside mood trends.',
 1.15),
('alzheimers',
 '{"cognitive": 2.0, "mood": 1.5, "medication": 1.3, "vitals": 1.0}'::jsonb,
 array['withdrawal_pattern', 'cognitive_vitals_correlation'],
 'This user has Alzheimer''s or dementia. Weight cognitive trend and routine consistency most heavily. Any withdrawal pattern should raise the tier immediately. Framing must be gentle, routine-affirming, and never confusing. Flag cognitive decline trend to caregiver promptly.',
 1.30),
('anxiety',
 '{"mood": 2.0, "calm": 1.5, "sleep": 1.3, "medication": 1.0, "vitals": 0.9}'::jsonb,
 array['adherence_mood_correlation'],
 'This user has anxiety. Weight mood trend most heavily. Use gentler, warmer phrasing and do not raise alarm thresholds. The goal is to avoid amplifying anxiety. Calm and sleep actions should always be included. Avoid clinical language entirely for this profile.',
 0.80),
('falls',
 '{"vitals": 1.2, "move": 1.8, "home": 2.0, "medication": 1.0, "mood": 1.0}'::jsonb,
 array['withdrawal_pattern'],
 'This user has a falls risk or mobility limitation. Weight home safety and movement actions most heavily. Always include at least one home-safety action. Chair mobility and balance exercises are preferred over outdoor walking. Flag any withdrawal pattern.',
 1.20),
('asthma',
 '{"vitals": 1.5, "symptom": 1.8, "medication": 1.5, "home": 1.2, "move": 0.9}'::jsonb,
 array['symptom_medication_correlation'],
 'This user has asthma. Weight symptom frequency and medication adherence most heavily. Home environment actions such as ventilation and avoiding triggers are high priority. Prefer indoor movement over outdoor when symptoms are present.',
 1.15),
('oncology',
 '{"symptom": 1.8, "mood": 1.5, "medication": 1.5, "cognitive": 1.2, "vitals": 1.0}'::jsonb,
 array['adherence_mood_correlation', 'withdrawal_pattern'],
 'This user is managing an oncology condition. Weight symptom frequency, mood, and medication adherence most heavily. Fatigue signals should be treated as meaningful even when vitals look stable. Use warm, supportive language and never use alarming clinical terms.',
 1.25),
('default',
 '{"vitals": 1.0, "medication": 1.0, "cognitive": 1.0, "mood": 1.0, "symptom": 1.0}'::jsonb,
 array[]::text[],
 'No specific condition profile. Apply equal domain weighting. Use standard wellness framing.',
 1.00)
on conflict (condition_name) do update set
  weighted_domains = excluded.weighted_domains,
  priority_correlation_rules = excluded.priority_correlation_rules,
  framing_note = excluded.framing_note,
  escalation_sensitivity = excluded.escalation_sensitivity,
  is_active = true;
