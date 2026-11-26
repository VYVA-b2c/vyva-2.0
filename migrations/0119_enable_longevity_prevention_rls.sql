-- The application accesses PostgreSQL through its backend role. Keep the
-- PostgREST-facing surface closed by enabling RLS without public policies.
alter table public.longevity_prevention_plans enable row level security;
