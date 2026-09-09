alter table whatsapp_private_checkins
  drop constraint if exists whatsapp_private_checkins_status_check;

alter table whatsapp_private_checkins
  add constraint whatsapp_private_checkins_status_check
  check (status in ('queued', 'sent', 'in_progress', 'completed', 'cancelled', 'expired', 'failed'));

create index if not exists whatsapp_private_checkins_recipient_active_idx
  on whatsapp_private_checkins (recipient, language, step_id, created_at desc)
  where status in ('sent', 'in_progress');
