-- Extend interaction log outcomes for Cognitive Assessment reminder lifecycle events.
-- Safe to run once through the raw SQL migration runner.

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.interaction_logs') is null then
    return;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.interaction_logs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%outcome%'
  loop
    execute format(
      'alter table public.interaction_logs drop constraint %I',
      constraint_name
    );
  end loop;

  alter table public.interaction_logs
    add constraint interaction_logs_outcome_check check (
      outcome in (
        'COMPLETED',
        'MISSED',
        'NO_RESPONSE',
        'CANCELLED',
        'ESCALATED',
        'REMINDER_QUEUED',
        'REMINDER_SKIPPED',
        'TEST_REMINDER_QUEUED'
      )
    );
end $$;
