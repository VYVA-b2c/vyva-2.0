-- Partner organisations (a Red Cross branch, a council, a telco, a housing
-- association: any country) and the local providers they have vetted.
-- Holds no member data. Members see a provider only inside its coverage area
-- and, when the organisation lists deployments, only if their profile's
-- deployment is one of them. Providers start inactive and need admin review.
create extension if not exists pgcrypto;

create table if not exists public.vetted_partner_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Empty: visible to every member in coverage. Otherwise: profiles.deployment values.
  deployment_keys text[] not null default '{}'::text[],
  website text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vetted_partner_providers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.vetted_partner_organisations(id) on delete cascade,
  name text not null,
  trades text[] not null check (cardinality(trades) > 0),
  phone text,
  email text,
  website text,
  address text,
  languages text[] not null default '{}'::text[],
  notes text,
  -- Coverage: a country (ISO 3166-1 alpha-2), optionally narrowed to a region
  -- named in the member's address, or a radius around a point.
  coverage_country text not null check (coverage_country ~ '^[A-Z]{2}$'),
  coverage_region text,
  coverage_lat double precision check (coverage_lat between -90 and 90),
  coverage_lng double precision check (coverage_lng between -180 and 180),
  coverage_radius_km numeric check (coverage_radius_km > 0 and coverage_radius_km <= 500),
  is_active boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((coverage_lat is null) = (coverage_lng is null) and (coverage_lat is null) = (coverage_radius_km is null)),
  check (phone is not null or email is not null or website is not null),
  check (not is_active or reviewed_at is not null)
);

create index if not exists vetted_partner_providers_lookup_idx
  on public.vetted_partner_providers (coverage_country)
  where is_active;
