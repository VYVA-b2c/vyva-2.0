create table if not exists cognitive_caregiver_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  preferred_domains text[] not null default '{}',
  excluded_activity_types text[] not null default '{}',
  preferred_training_times text[] not null default '{}',
  weekly_target_days integer not null default 3,
  session_length_minutes integer not null default 7,
  paused boolean not null default false,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cognitive_caregiver_settings_user
  on cognitive_caregiver_settings(user_id);

alter table cognitive_caregiver_settings enable row level security;

drop policy if exists cognitive_caregiver_settings_isolation on cognitive_caregiver_settings;
create policy cognitive_caregiver_settings_isolation
  on cognitive_caregiver_settings
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
