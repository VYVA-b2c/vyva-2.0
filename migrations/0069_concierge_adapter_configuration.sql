alter table concierge_channel_readiness_settings
  add column if not exists adapter_live_endpoint_url text,
  add column if not exists adapter_credential_reference text,
  add column if not exists adapter_qa_target text,
  add column if not exists adapter_configured_by text,
  add column if not exists adapter_configured_at timestamptz;

create index if not exists idx_concierge_channel_readiness_settings_adapter_configured_at
  on concierge_channel_readiness_settings(adapter_configured_at desc);
