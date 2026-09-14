create table if not exists concierge_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  provider_event_id text not null,
  webhook_event_id text,
  sender_email text not null,
  recipient_emails text[] not null default '{}',
  subject text not null default '',
  body_text text not null default '',
  received_at timestamptz not null,
  matched_pending_id uuid references concierge_pending(id) on delete set null,
  match_status text not null default 'processing',
  match_method text,
  match_reason text,
  action_needed boolean not null default false,
  review_status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concierge_inbound_messages_match_status_check
    check (match_status in ('processing', 'matched', 'unmatched', 'ignored', 'failed')),
  constraint concierge_inbound_messages_review_status_check
    check (review_status in ('pending', 'resolved', 'ignored')),
  constraint concierge_inbound_messages_channel_event_unique unique (channel, provider_event_id),
  constraint concierge_inbound_messages_webhook_event_unique unique (webhook_event_id)
);

create index if not exists concierge_inbound_messages_review_idx
  on concierge_inbound_messages(review_status, received_at desc);

create index if not exists concierge_inbound_messages_pending_idx
  on concierge_inbound_messages(matched_pending_id);
