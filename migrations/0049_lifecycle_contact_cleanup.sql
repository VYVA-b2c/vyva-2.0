with email_phone_intakes as (
  select
    ui.id,
    ui.phone as previous_phone,
    lower(btrim(ui.phone)) as previous_email,
    linked_phone.phone as linked_phone
  from public.user_intakes ui
  left join public.profiles profile_user on profile_user.id = ui.user_id
  left join public.profiles profile_elder on profile_elder.id = ui.elder_user_id
  left join public.profiles profile_family on profile_family.id = ui.family_user_id
  left join public.users account_user on account_user.id = ui.user_id
  left join public.users account_elder on account_elder.id = ui.elder_user_id
  left join public.users account_family on account_family.id = ui.family_user_id
  left join lateral (
    select btrim(candidate.value) as phone
    from (
      values
        (profile_user.phone_number),
        (profile_elder.phone_number),
        (profile_family.phone_number),
        (profile_user.whatsapp_number),
        (profile_elder.whatsapp_number),
        (profile_family.whatsapp_number),
        (account_user.phone_number),
        (account_elder.phone_number),
        (account_family.phone_number),
        (ui.metadata->>'invited_phone'),
        (ui.metadata->>'whatsapp_number'),
        (ui.metadata->>'phone_number')
    ) as candidate(value)
    where btrim(coalesce(candidate.value, '')) <> ''
      and btrim(candidate.value) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and btrim(candidate.value) !~ '^[[:alpha:]]+:'
      and length(regexp_replace(candidate.value, '[^0-9]', '', 'g')) >= 6
    limit 1
  ) linked_phone on true
  where btrim(ui.phone) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
),
resolved_contact as (
  select
    id,
    previous_phone,
    previous_email,
    coalesce(linked_phone, 'intake:' || id::text) as next_phone
  from email_phone_intakes
)
update public.user_intakes ui
set
  email = coalesce(nullif(btrim(ui.email), ''), resolved_contact.previous_email),
  phone = resolved_contact.next_phone,
  metadata = jsonb_set(
    coalesce(ui.metadata, '{}'::jsonb),
    '{cleanup_email_phone_fallback}',
    jsonb_build_object(
      'previous_phone', resolved_contact.previous_phone,
      'cleaned_at', now()::text
    ),
    true
  ),
  updated_at = now()
from resolved_contact
where ui.id = resolved_contact.id
  and ui.phone is distinct from resolved_contact.next_phone;
