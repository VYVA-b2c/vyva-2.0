alter table public.concierge_task_drafts
  drop constraint if exists concierge_task_drafts_kind_check;

alter table public.concierge_task_drafts
  add constraint concierge_task_drafts_kind_check check (
    kind in ('document', 'appointment', 'home_service', 'provider_contact', 'scam_review', 'transport', 'otc_pharmacy', 'expert_care')
  );

create index if not exists concierge_task_drafts_expert_care_legacy_idx
  on public.concierge_task_drafts (user_id, ((progress_payload -> 'expertCare' ->> 'legacySourceTaskId')))
  where kind = 'expert_care' and status = 'active';
