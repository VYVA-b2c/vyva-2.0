-- Shared background-check results for public businesses found through Places.
-- Keyed by business, service and summary language so one member's check is
-- reused by the next instead of repeating a paid web audit. Holds no member
-- data: no user_id, no request linkage. Stores source URLs and short concern
-- summaries only, never copied review text. Rows older than 30 days are
-- ignored on read and overwritten on the next check.
create table if not exists public.provider_reputation (
  place_id text not null,
  service_type text not null,
  language text not null,
  status text not null check (status in ('verified', 'incomplete', 'concerns')),
  concern_level text not null default 'none' check (concern_level in ('none', 'isolated', 'pattern', 'serious')),
  verification jsonb not null,
  checked_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (place_id, service_type, language)
);

create index if not exists provider_reputation_checked_at_idx
  on public.provider_reputation (checked_at);
