alter table if exists my_medicines
  add column if not exists dose_unit text,
  add column if not exists units_per_dose numeric(10,2),
  add column if not exists daily_frequency numeric(6,2),
  add column if not exists inventory_tracking_enabled boolean not null default false,
  add column if not exists refill_alert_days integer not null default 7;

create table if not exists medication_inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  medicine_id uuid not null references my_medicines(id) on delete cascade,
  event_type text not null check (event_type in ('purchase', 'stock_count', 'correction')),
  quantity numeric(12,2) not null,
  unit text not null,
  occurred_on date not null,
  source text not null default 'manual' check (source in ('manual', 'photo', 'caregiver')),
  actor_user_id text not null,
  actor_role text not null default 'user',
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists medication_inventory_events_user_medicine_date_idx
  on medication_inventory_events (user_id, medicine_id, occurred_on desc);

alter table if exists my_medicines
  drop constraint if exists my_medicines_refill_alert_days_check;

alter table if exists my_medicines
  add constraint my_medicines_refill_alert_days_check
  check (refill_alert_days between 1 and 90);
