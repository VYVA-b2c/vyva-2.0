begin;

create table if not exists public.voice_consultation_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id text not null unique,
  triage_report_id uuid references public.triage_reports(id) on delete set null,
  channel text not null default 'voice_app',
  locale text not null default 'en',
  status text not null check (status in ('complete', 'emergency')),
  canonical_symptom_id text not null,
  concern text not null,
  normalized_answers jsonb not null default '[]'::jsonb,
  reported_vitals jsonb not null default '{}'::jsonb,
  urgency text not null,
  guidance_outcome text not null,
  next_step text,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_consultation_summaries_answers_array_chk
    check (jsonb_typeof(normalized_answers) = 'array'),
  constraint voice_consultation_summaries_vitals_object_chk
    check (jsonb_typeof(reported_vitals) = 'object')
);

insert into public.voice_consultation_summaries (
  user_id,
  conversation_id,
  triage_report_id,
  channel,
  locale,
  status,
  canonical_symptom_id,
  concern,
  normalized_answers,
  reported_vitals,
  urgency,
  guidance_outcome,
  next_step,
  started_at,
  completed_at
)
select
  session.user_id,
  session.conversation_id,
  report.id,
  session.channel,
  session.locale,
  'complete',
  coalesce(nullif(session.latest_response_json ->> 'wizardSymptomId', ''), 'unknown'),
  report.chief_complaint,
  coalesce(session.latest_response_json -> 'review_answers', '[]'::jsonb),
  jsonb_strip_nulls(jsonb_build_object(
    'bpm', report.bpm,
    'respiratoryRate', report.respiratory_rate
  )),
  report.urgency,
  coalesce(nullif(session.latest_response_json ->> 'spoken_text', ''), report.ai_summary, ''),
  coalesce(report.next_step_label, report.recommendations[1]),
  session.started_at,
  coalesce(session.completed_at, report.created_at)
from public.voice_triage_sessions session
join public.triage_reports report on report.id = session.triage_report_id
where session.status = 'complete'
on conflict (conversation_id) do nothing;

create index if not exists voice_consultation_summaries_user_completed_idx
  on public.voice_consultation_summaries (user_id, completed_at desc);

create index if not exists voice_consultation_summaries_user_symptom_completed_idx
  on public.voice_consultation_summaries (user_id, canonical_symptom_id, completed_at desc);

comment on table public.voice_consultation_summaries is
  'Structured Dr. AI consultation continuity. Contains canonical answers and outcomes only; never raw audio or transcripts.';

commit;
