create extension if not exists pgcrypto;

create table if not exists trusted_help_partners (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null unique,
  name text not null,
  service text not null,
  label text not null,
  method text not null,
  payment text not null,
  coverage text[] not null default '{}'::text[],
  logo jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  priority integer not null default 50,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trusted_help_partners_service_enabled_idx on trusted_help_partners(service, is_enabled, priority);
create index if not exists trusted_help_partners_priority_idx on trusted_help_partners(priority);

insert into trusted_help_partners (partner_id, name, service, label, method, payment, coverage, logo, is_enabled, priority, admin_notes) values
  ('partner-aquaservice', 'Aquaservice', 'groceries', 'Water delivery', 'Scheduled delivery', 'Invoice or saved payment', array['Water']::text[], '{"text":"Aqua","bg":"#E0F2FE","fg":"#0369A1","border":"#BAE6FD"}'::jsonb, true, 100, 'Seeded default partner'),
  ('partner-mercadona', 'Mercadona', 'groceries', 'Groceries', 'Online delivery', 'Saved payment', array['Food','Household']::text[], '{"text":"M","bg":"#ECFDF5","fg":"#047857","border":"#BBF7D0"}'::jsonb, true, 95, 'Seeded default partner'),
  ('partner-glovo-groceries', 'Glovo', 'groceries', 'Groceries and essentials', 'Delivery app', 'Saved payment', array['Food','Household','Meals']::text[], '{"text":"G","bg":"#FFF7ED","fg":"#B45309","border":"#FED7AA"}'::jsonb, true, 90, 'Seeded default partner'),
  ('partner-ubereats-meals', 'Uber Eats', 'groceries', 'Prepared meals', 'Delivery app', 'Saved payment', array['Meals']::text[], '{"text":"Uber","bg":"#F8FAFC","fg":"#111827","border":"#CBD5E1"}'::jsonb, true, 85, 'Seeded default partner'),
  ('partner-taskrabbit', 'Taskrabbit', 'home-care', 'Home tasks', 'Partner app', 'Quote before payment', '{}'::text[], '{"text":"Task","bg":"#F0FDFA","fg":"#0F766E","border":"#99F6E4"}'::jsonb, true, 90, 'Seeded default partner'),
  ('partner-cronoshare', 'Cronoshare', 'home-care', 'Home professionals', 'Quote request', 'Quote before payment', '{}'::text[], '{"text":"Crono","bg":"#F5F3FF","fg":"#6B21A8","border":"#DDD6FE"}'::jsonb, true, 85, 'Seeded default partner'),
  ('partner-uber', 'Uber', 'transport', 'Taxi and rides', 'Ride app', 'Saved payment', '{}'::text[], '{"text":"Uber","bg":"#F8FAFC","fg":"#111827","border":"#CBD5E1"}'::jsonb, true, 90, 'Seeded default partner'),
  ('partner-cabify', 'Cabify', 'transport', 'Taxi and rides', 'Ride app', 'Saved payment', '{}'::text[], '{"text":"C","bg":"#EEF2FF","fg":"#4338CA","border":"#C7D2FE"}'::jsonb, true, 85, 'Seeded default partner'),
  ('partner-treatwell', 'Treatwell', 'wellness', 'Wellness booking', 'Booking platform', 'Saved payment', '{}'::text[], '{"text":"T","bg":"#FDF2F8","fg":"#BE185D","border":"#FBCFE8"}'::jsonb, true, 90, 'Seeded default partner')
on conflict (partner_id) do update set
  name = excluded.name,
  service = excluded.service,
  label = excluded.label,
  method = excluded.method,
  payment = excluded.payment,
  coverage = excluded.coverage,
  logo = excluded.logo,
  priority = excluded.priority,
  admin_notes = coalesce(trusted_help_partners.admin_notes, excluded.admin_notes),
  updated_at = now();
