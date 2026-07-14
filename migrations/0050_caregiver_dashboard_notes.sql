create table if not exists caregiver_dashboard_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references profiles(id) on delete cascade,
  caregiver_user_id text not null references users(id) on delete cascade,
  note text not null,
  concern_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists caregiver_dashboard_notes_profile_created_idx
  on caregiver_dashboard_notes (profile_id, created_at desc);

create index if not exists caregiver_dashboard_notes_caregiver_created_idx
  on caregiver_dashboard_notes (caregiver_user_id, created_at desc);
