-- Deployment-level contact policy. Run from Replit Shell (Development). Additive only.
create table if not exists public.deployment_contact_policies (
  deployment                      text primary key,             -- matches profiles.deployment
  quiet_hours_start               text not null default '21:00',
  quiet_hours_end                 text not null default '08:00',
  max_outbound_calls_per_day      integer not null default 3,
  over_limit_fallback             text not null default 'whatsapp_outbound',
  checkin_no_answer_retries       integer not null default 3,
  checkin_retry_interval_minutes  integer not null default 15,
  updated_by                      text,
  updated_at                      timestamptz not null default now(),
  constraint dcp_quiet_start_fmt check (quiet_hours_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint dcp_quiet_end_fmt   check (quiet_hours_end   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint dcp_max_calls       check (max_outbound_calls_per_day between 1 and 6),
  constraint dcp_fallback        check (over_limit_fallback in ('whatsapp_outbound','skip')),
  constraint dcp_retries         check (checkin_no_answer_retries between 0 and 5),
  constraint dcp_interval        check (checkin_retry_interval_minutes in (10,15,20,30))
);

-- One row per existing deployment, all on the agreed defaults.
insert into public.deployment_contact_policies (deployment)
select distinct deployment from public.profiles
on conflict (deployment) do nothing;
insert into public.deployment_contact_policies (deployment) values ('standard')
on conflict (deployment) do nothing;

-- The per-resident value becomes an optional *lower* override. The old default (1) was never
-- enforced and there are no live users, so reset it to "inherit".
alter table public.user_channel_preferences alter column max_outbound_calls_per_day drop default;
update public.user_channel_preferences set max_outbound_calls_per_day = null
where max_outbound_calls_per_day = 1;

-- Outbound contact ledger: every outbound call/WhatsApp decision, from any purpose.
create table if not exists public.outbound_contact_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references public.profiles(id) on delete cascade,
  purpose       text not null,      -- 'checkin' | 'checkin_retry' | 'medication' | 'brain_coach' | 'preventive' | 'other'
  requested_channel text not null,  -- 'voice_outbound' | 'whatsapp_outbound'
  decided_channel   text not null,  -- 'voice_outbound' | 'whatsapp_outbound' | 'skip'
  reason        text not null,      -- 'allowed' | 'over_daily_limit' | 'quiet_hours' | 'retry_exempt' | 'urgent'
  local_date    date not null,      -- resident's local date (profile timezone)
  source_ref    text,               -- schedule id / call key from the caller
  decided_at    timestamptz not null default now()
);
create index if not exists outbound_contact_ledger_user_day_idx
  on public.outbound_contact_ledger (user_id, local_date);
