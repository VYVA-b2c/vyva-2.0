begin;

-- Repair development databases that previously applied migration 0086 with a
-- Supabase auth.users UUID foreign key. Health data is owned by profiles in
-- this application, and authenticated Express routes enforce access.
drop policy if exists user_own_prevention_plans on public.longevity_prevention_plans;
alter table public.longevity_prevention_plans disable row level security;

alter table public.longevity_prevention_plans
  drop constraint if exists longevity_prevention_plans_user_id_fkey;

alter table public.longevity_prevention_plans
  alter column user_id type text using user_id::text;

alter table public.longevity_prevention_plans
  add constraint longevity_prevention_plans_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

comment on table public.longevity_prevention_plans is
  'Backend-owned monthly longevity plans keyed by the active health profile. Access is enforced by authenticated Express routes.';

commit;
