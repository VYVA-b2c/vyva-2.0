alter table social_room_plans
  add column if not exists experience_category text not null default 'other',
  add column if not exists preferred_time text not null default 'flexible',
  add column if not exists cost_range text not null default 'discuss',
  add column if not exists group_size text not null default 'one_to_one',
  add column if not exists safety_flags text[] not null default '{}',
  add column if not exists needs_review boolean not null default false;

create index if not exists social_room_plans_experience_fit_idx
  on social_room_plans (room_id, experience_category, location_label, preferred_time, status);

create index if not exists social_room_plans_review_queue_idx
  on social_room_plans (room_id, created_at desc)
  where needs_review = true;
