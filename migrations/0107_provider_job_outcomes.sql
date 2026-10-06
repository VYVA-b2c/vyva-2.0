-- One member answer per home-service request about how the job went.
-- Ownership follows the request: no separate user column, so deleting a
-- member (profiles -> appointment_requests cascade) deletes their answers.
-- place_id lets answers about the same public business be pooled for ranking;
-- it is null for saved private contacts, which are never pooled.
create table if not exists public.provider_job_outcomes (
  request_id uuid primary key references public.appointment_requests(id) on delete cascade,
  option_id uuid references public.appointment_provider_options(id) on delete set null,
  place_id text,
  service_type text,
  skipped boolean not null default false,
  arrived text check (arrived in ('yes', 'late', 'no')),
  price text check (price in ('as_quoted', 'above_quote', 'no_quote', 'not_sure')),
  would_use_again text check (would_use_again in ('yes', 'no', 'not_sure')),
  recorded_at timestamptz not null default now(),
  check (skipped or (arrived is not null and price is not null and would_use_again is not null))
);

create index if not exists provider_job_outcomes_place_idx
  on public.provider_job_outcomes (place_id, service_type)
  where place_id is not null and not skipped;
