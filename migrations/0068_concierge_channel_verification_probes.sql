alter table concierge_channel_readiness_settings
  add column if not exists last_probe_status text,
  add column if not exists last_probe_at timestamptz,
  add column if not exists last_probe_blocker text,
  add column if not exists last_probe_by text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'concierge_channel_readiness_settings_probe_status_check'
  ) then
    alter table concierge_channel_readiness_settings
      add constraint concierge_channel_readiness_settings_probe_status_check
      check (last_probe_status is null or last_probe_status in ('pass', 'fail'));
  end if;
end $$;

create index if not exists idx_concierge_channel_readiness_settings_probe_at
  on concierge_channel_readiness_settings(last_probe_at desc);
