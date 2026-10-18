-- Germany in Care Finder's register (scripts/import-care-register-de.ts):
-- health providers mapped on OpenStreetMap, stored in care_register_places
-- with country = 'DE'. Community-mapped public data under ODbL 1.0: shown as
-- "reported" with the OpenStreetMap credit. Holds no member data.
--
-- Widens two checks so OSM rows fit; Spanish and French values are kept:
--   listing        'OSM'
--   geocode_source 'osm' (the position mapped on OpenStreetMap)
alter table public.care_register_places drop constraint if exists care_register_places_listing_check;
alter table public.care_register_places add constraint care_register_places_listing_check
  check (listing in ('C1', 'C2', 'C3', 'E', 'RPPS', 'FINESS', 'OSM'));

alter table public.care_register_places drop constraint if exists care_register_places_geocode_source_check;
alter table public.care_register_places add constraint care_register_places_geocode_source_check
  check (geocode_source in ('regional_register', 'cartociudad', 'register', 'ban', 'osm'));
