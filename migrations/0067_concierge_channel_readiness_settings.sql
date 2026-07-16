create table if not exists concierge_channel_readiness_settings (
  channel text primary key,
  admin_enabled boolean not null default false,
  verified boolean not null default false,
  notes text,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint concierge_channel_readiness_settings_channel_check
    check (channel in ('phone_call', 'email', 'whatsapp', 'form_application', 'document_upload'))
);

create index if not exists idx_concierge_channel_readiness_settings_updated_at
  on concierge_channel_readiness_settings(updated_at desc);
