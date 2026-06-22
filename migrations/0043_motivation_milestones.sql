create table if not exists user_milestone_acknowledgements (
  user_id text not null,
  domain text not null,
  metric text not null,
  threshold integer not null,
  achieved_value integer not null,
  acknowledged_at timestamptz not null default now(),
  source_ref jsonb not null default '{}'::jsonb,
  primary key (user_id, domain, metric, threshold)
);

create index if not exists user_milestone_acknowledgements_user_idx
  on user_milestone_acknowledgements (user_id, acknowledged_at desc);
