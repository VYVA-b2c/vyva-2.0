create table if not exists cognitive_caregiver_nudges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  caregiver_user_id text not null,
  message_type text not null default 'general',
  message text not null,
  status text not null default 'unread',
  metadata jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_cognitive_caregiver_nudges_user_status
  on cognitive_caregiver_nudges(user_id, status, created_at desc);

create index if not exists idx_cognitive_caregiver_nudges_caregiver
  on cognitive_caregiver_nudges(caregiver_user_id, created_at desc);

alter table cognitive_caregiver_nudges enable row level security;

drop policy if exists cognitive_caregiver_nudges_isolation on cognitive_caregiver_nudges;
create policy cognitive_caregiver_nudges_isolation
  on cognitive_caregiver_nudges
  using (auth.uid()::text = user_id or auth.uid()::text = caregiver_user_id)
  with check (auth.uid()::text = user_id or auth.uid()::text = caregiver_user_id);
