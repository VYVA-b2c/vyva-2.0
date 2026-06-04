create extension if not exists pgcrypto;

create table if not exists social_room_music_circle_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references social_rooms(id) on delete cascade,
  day_key text not null,
  author_id text not null,
  author_name text not null,
  song_text text not null,
  cause_id text not null default 'bridge',
  memory_text text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_room_music_circle_items_room_day_status_idx
  on social_room_music_circle_items (room_id, day_key, status, updated_at desc);

create table if not exists social_room_music_item_reactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references social_room_music_circle_items(id) on delete cascade,
  user_id text not null,
  kind text not null default 'heart',
  created_at timestamptz not null default now()
);

create unique index if not exists social_room_music_item_reactions_item_user_kind_unique
  on social_room_music_item_reactions (item_id, user_id, kind);

create index if not exists social_room_music_item_reactions_item_kind_idx
  on social_room_music_item_reactions (item_id, kind);
