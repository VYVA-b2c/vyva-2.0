alter table profiles
  add column if not exists gp_name text,
  add column if not exists gp_phone text,
  add column if not exists gp_email text,
  add column if not exists gp_address text,
  add column if not exists gp_maps_url text,
  add column if not exists gp_place_id text;
