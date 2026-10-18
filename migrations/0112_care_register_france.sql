-- France in Care Finder's register (scripts/import-care-register-fr.ts):
-- practitioners from RPPS / Annuaire Santé and health centres from FINESS,
-- stored in care_register_places with country = 'FR'. Public register data
-- under Licence Ouverte 2.0: holds no member data.
--
-- Widens two checks so French rows fit; Spanish rows are untouched:
--   listing        'RPPS' (a practitioner or shop site), 'FINESS' (a centre)
--   geocode_source 'register' (coordinates published by the register itself),
--                  'ban' (geocoded with France's national address base)
alter table public.care_register_places drop constraint if exists care_register_places_listing_check;
alter table public.care_register_places add constraint care_register_places_listing_check
  check (listing in ('C1', 'C2', 'C3', 'E', 'RPPS', 'FINESS'));

alter table public.care_register_places drop constraint if exists care_register_places_geocode_source_check;
alter table public.care_register_places add constraint care_register_places_geocode_source_check
  check (geocode_source in ('regional_register', 'cartociudad', 'register', 'ban'));

-- Same-town results: places without coordinates in the member's town.
create index if not exists care_register_places_country_town_idx
  on public.care_register_places (country, left(municipality_code, 5))
  where withdrawn_at is null and lat is null;
