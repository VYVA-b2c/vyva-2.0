create extension if not exists pgcrypto;

create table if not exists social_room_music_threads (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references social_rooms(id) on delete cascade,
  creator_id text not null,
  matched_member_id text not null,
  matched_member_name text not null,
  song_text text not null,
  matched_topic text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_room_music_threads_active_unique
  on social_room_music_threads (room_id, creator_id, matched_member_id)
  where status = 'active';

create table if not exists social_room_music_thread_entries (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references social_room_music_threads(id) on delete cascade,
  author_id text not null,
  author_name text not null,
  kind text not null default 'memory',
  body text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_room_music_threads_room_status_idx
  on social_room_music_threads (room_id, status, updated_at desc);

create index if not exists social_room_music_thread_entries_thread_status_idx
  on social_room_music_thread_entries (thread_id, status, created_at);
