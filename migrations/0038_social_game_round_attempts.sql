create table if not exists social_game_round_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  game_kind text not null,
  round_id text not null,
  language text not null default 'en',
  status text not null default 'started',
  started_count integer not null default 1,
  completed_count integer not null default 0,
  skipped_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint social_game_round_attempts_status_check check (status in ('started', 'completed', 'skipped')),
  constraint social_game_round_attempts_kind_check check (game_kind in ('chess', 'word', 'dominoes', 'bridge')),
  constraint social_game_round_attempts_user_kind_round_unique unique (user_id, game_kind, round_id)
);

create index if not exists social_game_round_attempts_user_kind_seen_idx
  on social_game_round_attempts (user_id, game_kind, last_seen_at);

create index if not exists social_game_round_attempts_user_seen_idx
  on social_game_round_attempts (user_id, last_seen_at);
