alter table social_room_member_roles
  add column if not exists quiet_paused_at timestamptz;
