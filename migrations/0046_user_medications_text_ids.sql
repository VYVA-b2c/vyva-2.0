create extension if not exists pgcrypto;

create table if not exists user_medications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  medication_name text not null,
  dosage text,
  frequency text,
  scheduled_times text[],
  active boolean not null default true,
  added_by text not null default 'user',
  created_at timestamp with time zone not null default now()
);

alter table if exists user_medications
  alter column user_id type text using user_id::text;

alter table if exists user_medications
  add column if not exists dosage text,
  add column if not exists frequency text,
  add column if not exists scheduled_times text[],
  add column if not exists active boolean not null default true,
  add column if not exists added_by text not null default 'user',
  add column if not exists created_at timestamp with time zone not null default now();

update user_medications set active = true where active is null;
update user_medications set added_by = 'user' where added_by is null;
update user_medications set created_at = now() where created_at is null;

alter table if exists user_medications
  alter column active set default true,
  alter column active set not null,
  alter column added_by set default 'user',
  alter column added_by set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists user_medications_user_active_idx
  on user_medications (user_id, active);
