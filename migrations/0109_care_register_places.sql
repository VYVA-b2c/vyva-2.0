-- Authorised health places from Spain's national register of health centres,
-- services and establishments (REGCESS, Ministerio de Sanidad), imported
-- monthly by scripts/import-care-register.ts. Care Finder shows a place as a
-- health provider only if it is here. Public register data: holds no member
-- data. Pharmacies are not imported (many are listed under a person's name).
--
-- Reuse terms (Ministry legal notice): don't alter the content, cite the
-- source, and state the date of last update (source_updated_on).
create table if not exists public.care_register_places (
  -- REGCESS normalised code (CCN): permanent and unique per place.
  ccn text primary key,
  -- The region's own authorisation code; join key to regional registers.
  regional_code text,
  listing text not null check (listing in ('C1', 'C2', 'C3', 'E')),
  centre_class text,
  centre_class_name text,
  name text not null,
  region_code text,
  region_name text,
  province_code text,
  province_name text,
  municipality_code text,
  municipality_name text,
  street text,
  postcode text,
  phone text,
  email text,
  website text,
  ownership text check (ownership in ('public', 'private')),
  dependency text,
  -- Care-offered codes (oferta asistencial), e.g. U.59 physiotherapy.
  care_codes text[] not null default '{}'::text[],
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  geocode_source text check (geocode_source in ('regional_register', 'cartociudad')),
  -- The address that was geocoded; a changed address is geocoded again.
  geocoded_address text,
  geocoded_at timestamptz,
  -- Date of the REGCESS file this row last came from.
  source_updated_on date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Set when a place drops out of the monthly file (closed or deregistered).
  withdrawn_at timestamptz,
  check ((lat is null) = (lng is null)),
  check ((lat is null) = (geocode_source is null))
);

create index if not exists care_register_places_province_idx
  on public.care_register_places (province_code)
  where withdrawn_at is null;

create index if not exists care_register_places_care_codes_idx
  on public.care_register_places using gin (care_codes)
  where withdrawn_at is null;

create index if not exists care_register_places_position_idx
  on public.care_register_places (lat, lng)
  where withdrawn_at is null and lat is not null;
