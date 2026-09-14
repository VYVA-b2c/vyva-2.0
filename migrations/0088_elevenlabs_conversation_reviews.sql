begin;

create table if not exists public.elevenlabs_conversations (
  id uuid primary key default gen_random_uuid(),
  provider_conversation_id text not null unique,
  vyva_session_id text,
  user_id text,
  agent_id text,
  agent_name text,
  branch_id text,
  version_id text,
  status text not null default 'done',
  locale text,
  call_successful text,
  has_audio boolean not null default false,
  has_transcript boolean not null default false,
  consent_status text not null default 'not_captured',
  consent_version text,
  consent_recorded_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  retention_delete_at timestamptz not null,
  provider_deleted_at timestamptz,
  review_status text not null default 'unreviewed',
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  last_provider_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists elevenlabs_conversations_user_completed_idx
  on public.elevenlabs_conversations (user_id, completed_at desc);
create index if not exists elevenlabs_conversations_review_completed_idx
  on public.elevenlabs_conversations (review_status, completed_at desc);
create index if not exists elevenlabs_conversations_retention_idx
  on public.elevenlabs_conversations (retention_delete_at);

create table if not exists public.elevenlabs_conversation_access_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.elevenlabs_conversations(id) on delete cascade,
  provider_conversation_id text not null,
  actor_user_id text not null,
  action text not null,
  reason text not null,
  succeeded boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists elevenlabs_access_events_conversation_created_idx
  on public.elevenlabs_conversation_access_events (conversation_id, created_at desc);
create index if not exists elevenlabs_access_events_actor_created_idx
  on public.elevenlabs_conversation_access_events (actor_user_id, created_at desc);

comment on table public.elevenlabs_conversations is
  'Minimal ElevenLabs conversation metadata for audited, on-demand admin review. Audio and transcripts remain at ElevenLabs.';
comment on table public.elevenlabs_conversation_access_events is
  'Append-only audit log for every VYVA admin access to ElevenLabs conversation content.';

commit;
