create table if not exists medication_refill_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  medicine_id uuid not null references my_medicines(id) on delete cascade,
  status text not null,
  cycle_key text not null,
  title text not null,
  message text not null,
  days_remaining integer,
  projected_run_out_date date,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_reason text,
  constraint medication_refill_alerts_status_chk check (status in ('refill_soon', 'refill_now', 'uncertain'))
);

create unique index if not exists medication_refill_alerts_cycle_status_unique
  on medication_refill_alerts (user_id, medicine_id, cycle_key, status);

create index if not exists medication_refill_alerts_user_open_idx
  on medication_refill_alerts (user_id, resolved_at, created_at desc);
