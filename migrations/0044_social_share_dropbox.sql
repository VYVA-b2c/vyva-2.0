create extension if not exists pgcrypto;

create table if not exists social_share_dropbox_notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  note_type text not null,
  source text not null default 'voice',
  transcript text not null default '',
  edited_text text not null default '',
  suggested_room_slug text not null,
  prompt_id text,
  prompt_text text,
  prompt_kind text,
  connection_goal text,
  status text not null default 'ready',
  safety_flags text[] not null default '{}',
  placement_kind text,
  placement_target_id text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_share_dropbox_notes_type_check
    check (note_type in ('memory', 'song', 'recipe', 'reading', 'hello')),
  constraint social_share_dropbox_notes_source_check
    check (source in ('voice', 'typed')),
  constraint social_share_dropbox_notes_status_check
    check (status in ('ready', 'blocked', 'placed', 'deleted'))
);

create index if not exists social_share_dropbox_notes_user_status_created_idx
  on social_share_dropbox_notes (user_id, status, created_at desc);

create index if not exists social_share_dropbox_notes_user_created_idx
  on social_share_dropbox_notes (user_id, created_at desc);

alter table social_share_dropbox_notes
  add column if not exists prompt_id text,
  add column if not exists prompt_text text,
  add column if not exists prompt_kind text,
  add column if not exists connection_goal text;

create index if not exists social_share_dropbox_notes_user_prompt_idx
  on social_share_dropbox_notes (user_id, prompt_id)
  where prompt_id is not null;

create table if not exists social_share_dropbox_audio (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references social_share_dropbox_notes(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  mime_type text not null,
  byte_size integer not null,
  duration_ms integer,
  audio_data bytea not null,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint social_share_dropbox_audio_size_check
    check (byte_size > 0 and byte_size <= 8388608),
  constraint social_share_dropbox_audio_duration_check
    check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 30000))
);

create index if not exists social_share_dropbox_audio_note_idx
  on social_share_dropbox_audio (note_id);

create index if not exists social_share_dropbox_audio_user_expires_idx
  on social_share_dropbox_audio (user_id, expires_at);
