-- Care Finder registers become per country. Spain's REGCESS register and
-- Castilla y León health map were the only rows so far, so existing rows
-- are Spanish. Other countries' official registers (France's FINESS+/RPPS
-- next) are imported alongside, with ids prefixed by their source so they
-- never collide with REGCESS codes. Public data; holds no member data.
alter table public.care_register_places
  add column if not exists country text not null default 'ES'
  check (country ~ '^[A-Z]{2}$');

alter table public.care_health_zone_municipalities
  add column if not exists country text not null default 'ES'
  check (country ~ '^[A-Z]{2}$');

create index if not exists care_register_places_country_position_idx
  on public.care_register_places (country, lat, lng)
  where withdrawn_at is null and lat is not null;
