alter table if exists user_channel_preferences
  add column if not exists medication_refill_push_enabled boolean not null default false;

create table if not exists medication_refill_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  alert_id uuid not null references medication_refill_alerts(id) on delete cascade,
  profile_id text not null,
  medicine_id uuid not null references my_medicines(id) on delete cascade,
  cycle_key text not null,
  recipient_user_id text not null,
  recipient_role text not null,
  subscription_id uuid not null,
  status text not null default 'sending',
  provider_status integer,
  failure_reason text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  opened_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medication_refill_push_deliveries_status_chk
    check (status in ('sending', 'sent', 'failed_retryable', 'failed_permanent')),
  constraint medication_refill_push_deliveries_role_chk
    check (recipient_role in ('elder', 'caregiver', 'family'))
);

create index if not exists medication_refill_push_deliveries_recipient_idx
  on medication_refill_push_deliveries (recipient_user_id, created_at desc);

create index if not exists medication_refill_push_deliveries_alert_idx
  on medication_refill_push_deliveries (alert_id);
