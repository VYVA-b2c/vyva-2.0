-- Medicine Check data contract. Run from Replit Shell; this file is not auto-applied.
alter table public.interaction_flag_rules add column if not exists messages jsonb not null default '{}'::jsonb;
alter table public.interaction_flag_rules add column if not exists approved_locales text[] not null default '{}';

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interaction_flag_rules' and column_name = 'flag_message_en'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interaction_flag_rules' and column_name = 'flag_message_es'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interaction_flag_rules' and column_name = 'flag_message_de'
  ) then
    update public.interaction_flag_rules
    set messages = jsonb_build_object(
      'en', jsonb_build_object('why', coalesce(flag_message_en, '')),
      'es', jsonb_build_object('why', coalesce(flag_message_es, '')),
      'de', jsonb_build_object('why', coalesce(flag_message_de, '')),
      'fr', jsonb_build_object('why', ''),
      'pt', jsonb_build_object('why', ''),
      'it', jsonb_build_object('why', '')
    )
    where messages = '{}'::jsonb;
  end if;
end $$;

update public.interaction_flag_rules set approved_locales = '{}', is_active = false;

alter table public.interaction_flag_rules drop constraint if exists interaction_flag_rules_review_gate;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.interaction_flag_rules'::regclass
      and conname = 'interaction_flag_rules_locale_review_gate'
  ) then
    alter table public.interaction_flag_rules add constraint interaction_flag_rules_locale_review_gate check (
      cardinality(approved_locales) = 0 or (
        reviewed_by is not null and reviewed_at is not null and
        approved_locales <@ array['en','es','de','fr','pt','it']::text[] and
        (not ('en' = any(approved_locales)) or coalesce(messages #>> '{en,why}', '') <> '') and
        (not ('es' = any(approved_locales)) or coalesce(messages #>> '{es,why}', '') <> '') and
        (not ('de' = any(approved_locales)) or coalesce(messages #>> '{de,why}', '') <> '') and
        (not ('fr' = any(approved_locales)) or coalesce(messages #>> '{fr,why}', '') <> '') and
        (not ('pt' = any(approved_locales)) or coalesce(messages #>> '{pt,why}', '') <> '') and
        (not ('it' = any(approved_locales)) or coalesce(messages #>> '{it,why}', '') <> '')
      )
    );
  end if;
end $$;
-- Keep the legacy message columns and dismissals table until a later verified cleanup.
-- The new contract is populated alongside them so the migration is non-destructive.
create table if not exists public.interaction_flag_states (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  rule_id uuid references public.interaction_flag_rules(id) on delete cascade,
  medicine_pair jsonb not null,
  flag_key text not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  asked_at timestamptz,
  snooze_until timestamptz,
  snooze_count integer not null default 0
);
alter table public.interaction_flag_states add column if not exists flag_key text;
alter table public.interaction_flag_states alter column rule_id drop not null;
alter table public.interaction_flag_states add column if not exists status text not null default 'open';
alter table public.interaction_flag_states add column if not exists opened_at timestamptz not null default now();
alter table public.interaction_flag_states add column if not exists asked_at timestamptz;
alter table public.interaction_flag_states add column if not exists snooze_until timestamptz;
alter table public.interaction_flag_states add column if not exists snooze_count integer not null default 0;
alter table public.interaction_flag_states alter column flag_key set not null;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.interaction_flag_states'::regclass
      and conname = 'interaction_flag_states_status_check'
  ) then
    alter table public.interaction_flag_states add constraint interaction_flag_states_status_check check (status in ('open','snoozed','asked','resolved_fine','resolved_changed','unsure'));
  end if;
end $$;
create unique index if not exists interaction_flag_states_user_key_unique on public.interaction_flag_states(user_id, flag_key);

do $$ begin
  if to_regclass('public.interaction_flag_dismissals') is not null then
    insert into public.interaction_flag_states (
      id, user_id, rule_id, medicine_pair, flag_key, status, opened_at, asked_at, snooze_count
    )
    select
      id,
      user_id,
      rule_id,
      medicine_pair,
      rule_id::text || ':' || array_to_string(array(select jsonb_array_elements_text(medicine_pair) order by 1), ':'),
      case reason when 'asked_pharmacist' then 'asked' when 'not_now' then 'snoozed' else 'open' end,
      dismissed_at,
      case when reason = 'asked_pharmacist' then dismissed_at end,
      case when reason = 'not_now' then 1 else 0 end
    from public.interaction_flag_dismissals
    on conflict (user_id, flag_key) do nothing;
  end if;
end $$;

create table if not exists public.profile_med_safety_state (
  user_id text primary key references public.profiles(id) on delete cascade,
  last_extras_sweep_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.my_medicines drop constraint if exists my_medicines_user_id_profiles_fk;
alter table public.my_medicines add constraint my_medicines_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.my_medicines_change_log drop constraint if exists my_medicines_change_log_user_id_profiles_fk;
alter table public.my_medicines_change_log add constraint my_medicines_change_log_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.interaction_flag_states'::regclass
      and conname = 'interaction_flag_states_user_id_profiles_fk'
  ) then
    alter table public.interaction_flag_states add constraint interaction_flag_states_user_id_profiles_fk
      foreign key (user_id) references public.profiles(id) on delete cascade not valid;
  end if;
end $$;

-- Medication-owned profile identifiers use the same text key as public.profiles.
alter table public.user_medications drop constraint if exists user_medications_user_id_profiles_fk;
alter table public.user_medications add constraint user_medications_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_adherence drop constraint if exists medication_adherence_user_id_profiles_fk;
alter table public.medication_adherence add constraint medication_adherence_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_inventory_events drop constraint if exists medication_inventory_events_user_id_profiles_fk;
alter table public.medication_inventory_events add constraint medication_inventory_events_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_inventory_events drop constraint if exists medication_inventory_events_actor_profiles_fk;
alter table public.medication_inventory_events add constraint medication_inventory_events_actor_profiles_fk foreign key (actor_user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_refill_alerts drop constraint if exists medication_refill_alerts_user_id_profiles_fk;
alter table public.medication_refill_alerts add constraint medication_refill_alerts_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_refill_push_deliveries drop constraint if exists medication_refill_push_deliveries_profile_profiles_fk;
alter table public.medication_refill_push_deliveries add constraint medication_refill_push_deliveries_profile_profiles_fk foreign key (profile_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_refill_push_deliveries drop constraint if exists medication_refill_push_deliveries_recipient_profiles_fk;
alter table public.medication_refill_push_deliveries add constraint medication_refill_push_deliveries_recipient_profiles_fk foreign key (recipient_user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_safety_signals drop constraint if exists medication_safety_signals_user_id_profiles_fk;
alter table public.medication_safety_signals add constraint medication_safety_signals_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_safety_cases drop constraint if exists medication_safety_cases_user_id_profiles_fk;
alter table public.medication_safety_cases add constraint medication_safety_cases_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.medication_safety_case_events drop constraint if exists medication_safety_case_events_user_id_profiles_fk;
alter table public.medication_safety_case_events add constraint medication_safety_case_events_user_id_profiles_fk foreign key (user_id) references public.profiles(id) on delete cascade not valid;

alter table public.my_medicines drop constraint if exists my_medicines_item_type_check;
alter table public.my_medicines add constraint my_medicines_item_type_check check (item_type in ('prescription','otc','supplement'));
alter table public.my_medicines drop constraint if exists my_medicines_drug_class_tag_check;
alter table public.my_medicines add constraint my_medicines_drug_class_tag_check check (drug_class_tag is null or drug_class_tag in (
  'blood_pressure_lowering','blood_thinner','nsaid_pain_reliever','opioid_pain_reliever','sedative_sleep_aid',
  'diabetes_blood_sugar','diuretic_water_pill','antidepressant','statin_cholesterol','supplement_herbal',
  'antihistamine_allergy','cold_flu_combination','antacid_stomach','other_uncategorized'
));
alter table public.my_medicines drop constraint if exists my_medicines_added_via_check;
alter table public.my_medicines add constraint my_medicines_added_via_check check (added_via in ('voice','manual','photo','discharge_flow','extras_sweep'));

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interaction_flag_rules' and column_name = 'flag_message_en'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interaction_flag_rules' and column_name = 'flag_message_es'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'interaction_flag_rules' and column_name = 'flag_message_de'
  ) then
    insert into public.interaction_flag_rules (
      class_a, class_b, flag_message_en, flag_message_es, flag_message_de,
      messages, approved_locales, severity_tier, is_active
    ) values (
      'cold_flu_combination', 'blood_pressure_lowering', '', '', '',
      '{"en":{"why":""},"es":{"why":""},"de":{"why":""},"fr":{"why":""},"pt":{"why":""},"it":{"why":""}}'::jsonb,
      '{}', 'worth_asking', false
    ) on conflict (class_a, class_b) do nothing;
  else
    insert into public.interaction_flag_rules (class_a, class_b, messages, approved_locales, severity_tier, is_active)
    values ('cold_flu_combination', 'blood_pressure_lowering',
      '{"en":{"why":""},"es":{"why":""},"de":{"why":""},"fr":{"why":""},"pt":{"why":""},"it":{"why":""}}'::jsonb,
      '{}', 'worth_asking', false)
    on conflict (class_a, class_b) do nothing;
  end if;
end $$;
