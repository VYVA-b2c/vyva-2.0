-- Replit deploy databases do not expose Supabase auth schema helpers.
-- Keep the health insights tables backend-owned, matching the existing
-- backend-owned auth cleanup pattern in migration 0056.

do $$
begin
  if to_regclass('public.health_insight_reports') is not null then
    execute 'alter table public.health_insight_reports drop constraint if exists health_insight_reports_user_id_fkey';
    execute 'drop policy if exists user_own_reports on public.health_insight_reports';
    execute 'create policy user_own_reports on public.health_insight_reports for all using (true) with check (true)';
  end if;

  if to_regclass('public.insight_outcomes') is not null then
    execute 'alter table public.insight_outcomes drop constraint if exists insight_outcomes_user_id_fkey';
    execute 'drop policy if exists user_own_outcomes on public.insight_outcomes';
    execute 'create policy user_own_outcomes on public.insight_outcomes for all using (true) with check (true)';
  end if;

  if to_regclass('public.agewell_action_library') is not null then
    execute 'drop policy if exists actions_read_authenticated on public.agewell_action_library';
    execute 'drop policy if exists actions_read_all_admin on public.agewell_action_library';
    execute 'create policy actions_read_authenticated on public.agewell_action_library for select using (is_active = true)';
    execute 'create policy actions_read_all_admin on public.agewell_action_library for all using (true) with check (true)';
  end if;
end $$;
