create extension if not exists pgcrypto;

create table if not exists public.cognitive_daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_date date not null,
  status text not null default 'active',
  estimated_duration_minutes integer not null default 0,
  recommended_domains text[] not null default array[]::text[],
  rationale text[] not null default array[]::text[],
  generated_context jsonb not null default '{}'::jsonb,
  generation_version text not null default 'brain_coach_plan_v1',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cognitive_daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.cognitive_daily_plans(id) on delete cascade,
  user_id text not null,
  plan_date date not null,
  activity_type text not null,
  title text not null,
  domain text not null,
  secondary_domain text,
  route text not null,
  estimated_duration_minutes integer not null default 0,
  rationale text not null default '',
  status text not null default 'recommended',
  sort_order integer not null default 0,
  accepted_at timestamptz,
  started_at timestamptz,
  skipped_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cognitive_daily_plan_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.cognitive_daily_plans(id) on delete cascade,
  plan_item_id uuid references public.cognitive_daily_plan_items(id) on delete set null,
  user_id text not null,
  activity_type text,
  event_type text not null,
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cognitive_daily_plans enable row level security;
alter table public.cognitive_daily_plan_items enable row level security;
alter table public.cognitive_daily_plan_events enable row level security;

drop policy if exists cognitive_daily_plans_user_select on public.cognitive_daily_plans;
create policy cognitive_daily_plans_user_select on public.cognitive_daily_plans
  for select using (auth.uid()::text = user_id);

drop policy if exists cognitive_daily_plans_user_insert on public.cognitive_daily_plans;
create policy cognitive_daily_plans_user_insert on public.cognitive_daily_plans
  for insert with check (auth.uid()::text = user_id);

drop policy if exists cognitive_daily_plans_user_update on public.cognitive_daily_plans;
create policy cognitive_daily_plans_user_update on public.cognitive_daily_plans
  for update using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists cognitive_daily_plan_items_user_select on public.cognitive_daily_plan_items;
create policy cognitive_daily_plan_items_user_select on public.cognitive_daily_plan_items
  for select using (auth.uid()::text = user_id);

drop policy if exists cognitive_daily_plan_items_user_insert on public.cognitive_daily_plan_items;
create policy cognitive_daily_plan_items_user_insert on public.cognitive_daily_plan_items
  for insert with check (auth.uid()::text = user_id);

drop policy if exists cognitive_daily_plan_items_user_update on public.cognitive_daily_plan_items;
create policy cognitive_daily_plan_items_user_update on public.cognitive_daily_plan_items
  for update using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists cognitive_daily_plan_events_user_select on public.cognitive_daily_plan_events;
create policy cognitive_daily_plan_events_user_select on public.cognitive_daily_plan_events
  for select using (auth.uid()::text = user_id);

drop policy if exists cognitive_daily_plan_events_user_insert on public.cognitive_daily_plan_events;
create policy cognitive_daily_plan_events_user_insert on public.cognitive_daily_plan_events
  for insert with check (auth.uid()::text = user_id);

create unique index if not exists cognitive_daily_plans_user_date_unique
  on public.cognitive_daily_plans (user_id, plan_date);

create unique index if not exists cognitive_daily_plan_items_plan_activity_unique
  on public.cognitive_daily_plan_items (plan_id, activity_type);

create index if not exists idx_cognitive_daily_plans_user_date
  on public.cognitive_daily_plans (user_id, plan_date);

create index if not exists idx_cognitive_daily_plans_user_status
  on public.cognitive_daily_plans (user_id, status, plan_date);

create index if not exists idx_cognitive_daily_plan_items_plan_order
  on public.cognitive_daily_plan_items (plan_id, sort_order);

create index if not exists idx_cognitive_daily_plan_items_user_date
  on public.cognitive_daily_plan_items (user_id, plan_date);

create index if not exists idx_cognitive_daily_plan_items_user_activity
  on public.cognitive_daily_plan_items (user_id, activity_type, plan_date);

create index if not exists idx_cognitive_daily_plan_events_plan
  on public.cognitive_daily_plan_events (plan_id, created_at desc);

create index if not exists idx_cognitive_daily_plan_events_user
  on public.cognitive_daily_plan_events (user_id, created_at desc);

create index if not exists idx_cognitive_daily_plan_events_item
  on public.cognitive_daily_plan_events (plan_item_id, created_at desc);
