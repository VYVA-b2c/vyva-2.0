-- VYVA authenticates and authorizes requests in the Express backend rather
-- than through PostgREST. Remove historical permissive policies while keeping
-- RLS enabled so anon/authenticated Supabase roles cannot read application
-- data directly.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end
$$;

do $$
declare table_row record;
begin
  for table_row in
    select tablename
      from pg_tables
     where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_row.tablename);
  end loop;
end
$$;
