-- Structured storage for Concierge sub-flows that previously had no
-- dedicated table and lived only as loose jsonb on concierge_pending /
-- concierge_task_drafts (see the Concierge Data Audit).

create table if not exists transport_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  pickup_address text,
  pickup_place_id text,
  pickup_lat real,
  pickup_lng real,
  destination_address text,
  destination_place_id text,
  destination_lat real,
  destination_lng real,
  requested_time text,
  scheduled_for timestamptz,
  purpose text,
  mobility_needs text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'options_ready', 'prepared', 'confirmed', 'completed', 'cancelled')),
  selected_provider_id uuid references user_providers(id) on delete set null,
  selected_option_snapshot jsonb not null default '{}',
  selected_channel text,
  price_estimate text,
  booking_reference text,
  linked_pending_id uuid references concierge_pending(id) on delete set null,
  linked_scheduled_event_id uuid references scheduled_events(id) on delete set null,
  language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transport_requests_user_status_idx
  on transport_requests (user_id, status, created_at desc);

create table if not exists transport_provider_options (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references transport_requests(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  provider_id uuid references user_providers(id) on delete set null,
  provider_source text not null default 'saved',
  provider_snapshot jsonb not null default '{}',
  match_reason text,
  price_estimate text,
  rank integer not null default 0,
  status text not null default 'suggested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transport_provider_options_request_rank_idx
  on transport_provider_options (request_id, rank);

create table if not exists provider_search_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  search_mode text not null
    check (search_mode in (
      'specialist', 'care', 'residence', 'personal-care',
      'transport', 'pharmacy', 'home-service', 'shopping-seller'
    )),
  query text,
  criteria text[] not null default '{}',
  location_used text,
  result_count integer not null default 0,
  status text not null default 'searching'
    check (status in ('searching', 'results', 'shortlisted', 'contacted', 'abandoned')),
  linked_task_draft_id uuid references concierge_task_drafts(id) on delete set null,
  linked_pending_id uuid references concierge_pending(id) on delete set null,
  language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists provider_search_requests_user_status_idx
  on provider_search_requests (user_id, status, created_at desc);

create table if not exists provider_shortlist_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references provider_search_requests(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  provider_id uuid references user_providers(id) on delete set null,
  name text not null,
  category text,
  phone text,
  email text,
  whatsapp text,
  booking_url text,
  maps_url text,
  provider_snapshot jsonb not null default '{}',
  rank integer not null default 0,
  status text not null default 'suggested'
    check (status in ('suggested', 'shortlisted', 'preferred', 'contacted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists provider_shortlist_items_request_rank_idx
  on provider_shortlist_items (request_id, rank);

create table if not exists concierge_shopping_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles(id) on delete cascade,
  need_text text,
  category text,
  priorities text[] not null default '{}',
  constraints text[] not null default '{}',
  profile_needs text[] not null default '{}',
  package_id text references concierge_shopping_packages(package_id) on delete set null,
  source text,
  source_recommendation text,
  status text not null default 'draft'
    check (status in ('draft', 'recommended', 'shortlisted', 'prepared', 'ordered', 'cancelled')),
  linked_pending_id uuid references concierge_pending(id) on delete set null,
  recommendation_snapshot jsonb not null default '{}',
  language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists concierge_shopping_requests_user_status_idx
  on concierge_shopping_requests (user_id, status, created_at desc);

create table if not exists concierge_shopping_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references concierge_shopping_requests(id) on delete cascade,
  product_id text references concierge_shopping_products(product_id) on delete set null,
  quantity integer not null default 1,
  shortlisted boolean not null default false,
  chosen boolean not null default false,
  rank integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists concierge_shopping_request_items_unique
  on concierge_shopping_request_items (request_id, product_id);

-- Structured scheduling fields on the generic pending-action table, so the
-- reminders/notifications pipeline can read a real timestamp instead of an
-- unstructured jsonb key that nothing currently writes.
alter table concierge_pending
  add column if not exists scheduled_for timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists location text;

create index if not exists concierge_pending_user_status_idx
  on concierge_pending (user_id, status);

create index if not exists concierge_task_drafts_user_status_updated_idx
  on concierge_task_drafts (user_id, status, updated_at desc);

-- Let a home safety scan or scam check be traced back to the Concierge
-- task/pending action that started it (e.g. "Discover > Safe Home").
alter table home_scans
  add column if not exists linked_pending_id uuid references concierge_pending(id) on delete set null,
  add column if not exists source text,
  add column if not exists flow_reference text;

alter table scam_checks
  add column if not exists linked_pending_id uuid references concierge_pending(id) on delete set null,
  add column if not exists source text;
