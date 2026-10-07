-- Regional health maps: which basic health zone (zona básica de salud) and
-- health centre serve each municipality. Lets Care Finder name a person's
-- own public health centre from their address. Imported by
-- scripts/import-care-register.ts from open data (Castilla y León first,
-- CC BY 4.0). Public data; holds no member data.
--
-- A municipality split between several zones (a city) has several rows;
-- Care Finder then falls back to the nearest centre.
create table if not exists public.care_health_zone_municipalities (
  -- INE municipality code, 5 digits (no check digit).
  municipality_code text not null check (municipality_code ~ '^[0-9]{5}$'),
  municipality_name text,
  region_code text not null,
  zone_name text not null,
  centre_name text not null,
  -- Who publishes the map, shown to members ("Junta de Castilla y León").
  source text not null,
  source_updated_on date,
  imported_at timestamptz not null default now(),
  primary key (municipality_code, zone_name, centre_name)
);
