-- My Medicines anchor list and conservative interaction flags.
-- This deployment is backend-owned auth, so user_id follows the app's existing
-- text profile/user id convention rather than Supabase auth.users FKs.

create table if not exists my_medicines (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  display_name text not null,
  common_name text,
  dose_text text,
  purpose_text text,
  item_type text not null default 'prescription'
    check (item_type in ('prescription', 'otc', 'supplement')),
  drug_class_tag text
    check (drug_class_tag is null or drug_class_tag in (
      'blood_pressure_lowering',
      'blood_thinner',
      'nsaid_pain_reliever',
      'opioid_pain_reliever',
      'sedative_sleep_aid',
      'diabetes_blood_sugar',
      'diuretic_water_pill',
      'antidepressant',
      'statin_cholesterol',
      'supplement_herbal',
      'antihistamine_allergy',
      'other_uncategorized'
    )),
  photo_url text,
  prescriber_name text,
  refill_due_date date,
  schedule_times text[],
  status text not null default 'active'
    check (status in ('active', 'discontinued', 'paused')),
  status_changed_at timestamptz,
  status_changed_by text
    check (status_changed_by is null or status_changed_by in ('user', 'caregiver')),
  added_via text not null default 'voice'
    check (added_via in ('voice', 'manual', 'photo', 'discharge_flow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists my_medicines_change_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  medicine_id uuid references my_medicines(id) on delete set null,
  change_type text not null
    check (change_type in ('added', 'dose_changed', 'discontinued', 'paused', 'resumed')),
  previous_value jsonb,
  new_value jsonb,
  source text not null default 'voice_update'
    check (source in ('voice_update', 'manual_edit', 'discharge_flow', 'caregiver_edit')),
  changed_at timestamptz not null default now()
);

create table if not exists interaction_flag_rules (
  id uuid primary key default gen_random_uuid(),
  class_a text not null,
  class_b text not null,
  flag_message_es text not null,
  flag_message_de text not null,
  flag_message_en text not null,
  severity_tier text not null default 'worth_asking'
    check (severity_tier in ('worth_asking')),
  is_active boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint interaction_flag_rules_review_gate
    check (is_active = false or (reviewed_by is not null and reviewed_at is not null))
);

create table if not exists interaction_flag_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  rule_id uuid not null references interaction_flag_rules(id) on delete cascade,
  medicine_pair jsonb not null,
  dismissed_at timestamptz not null default now(),
  reason text check (reason in ('asked_pharmacist', 'not_now', 'already_knew'))
);

create index if not exists idx_mm_user_status on my_medicines (user_id, status);
create index if not exists idx_mm_refill_due on my_medicines (user_id, refill_due_date) where status = 'active';
create index if not exists idx_mcl_user_time on my_medicines_change_log (user_id, changed_at desc);
create index if not exists idx_ifr_classes on interaction_flag_rules (class_a, class_b) where is_active = true;
create unique index if not exists interaction_flag_rules_class_pair_unique on interaction_flag_rules (class_a, class_b);
create index if not exists interaction_flag_dismissals_user_rule_idx on interaction_flag_dismissals (user_id, rule_id);

insert into interaction_flag_rules
  (class_a, class_b, flag_message_es, flag_message_de, flag_message_en, is_active)
values
  ('blood_pressure_lowering', 'nsaid_pain_reliever',
   'Tienes un medicamento para la tensión y un antiinflamatorio en tu lista; vale la pena preguntarle a tu farmacéutico si van bien juntos.',
   'Du hast ein Blutdruckmedikament und ein Schmerzmittel auf deiner Liste; es lohnt sich, deinen Apotheker zu fragen, ob das zusammenpasst.',
   'You have a blood pressure medicine and a pain reliever on your list; worth asking your pharmacist if they go well together.',
   false),
  ('blood_thinner', 'nsaid_pain_reliever',
   'Tienes un anticoagulante y un antiinflamatorio en tu lista; vale la pena comentarlo con tu farmacéutico.',
   'Du hast ein Blutverdünnungsmittel und ein Schmerzmittel auf deiner Liste; sprich am besten mit deinem Apotheker darüber.',
   'You have a blood thinner and a pain reliever on your list; worth mentioning to your pharmacist.',
   false),
  ('sedative_sleep_aid', 'opioid_pain_reliever',
   'Tienes una pastilla para dormir y un analgésico fuerte en tu lista; tu farmacéutico puede confirmarte si está bien combinarlos.',
   'Du hast ein Schlafmittel und ein starkes Schmerzmittel auf deiner Liste; dein Apotheker kann dir sagen, ob das zusammenpasst.',
   'You have a sleep aid and a strong pain reliever on your list; your pharmacist can confirm if that combination is fine.',
   false),
  ('diuretic_water_pill', 'blood_pressure_lowering',
   'Tienes una pastilla de agua y un medicamento para la tensión; es buena idea que tu farmacéutico revise cómo trabajan juntos.',
   'Du hast eine Wassertablette und ein Blutdruckmedikament; es ist gut, wenn dein Apotheker sich das gemeinsam ansieht.',
   'You have a water pill and a blood pressure medicine; good idea to have your pharmacist review how they work together.',
   false),
  ('antidepressant', 'sedative_sleep_aid',
   'Tienes un medicamento para el ánimo y una pastilla para dormir; vale la pena preguntarle a tu médico o farmacéutico si van bien juntos.',
   'Du hast ein Medikament für die Stimmung und ein Schlafmittel; frag am besten deinen Arzt oder Apotheker, ob das zusammenpasst.',
   'You have a mood medicine and a sleep aid; worth asking your doctor or pharmacist if they go well together.',
   false),
  ('statin_cholesterol', 'supplement_herbal',
   'Tienes un medicamento para el colesterol y un suplemento en tu lista; coméntaselo a tu farmacéutico para estar tranquilo.',
   'Du hast ein Cholesterinmedikament und ein Nahrungsergänzungsmittel auf deiner Liste; sprich das bei deinem Apotheker an.',
   'You have a cholesterol medicine and a supplement on your list; mention it to your pharmacist just to be safe.',
   false)
on conflict (class_a, class_b) do nothing;

insert into my_medicines (
  user_id,
  display_name,
  common_name,
  dose_text,
  item_type,
  schedule_times,
  status,
  added_via,
  created_at,
  updated_at
)
select
  user_id,
  medication_name,
  medication_name,
  trim(both ' ' from concat_ws(' ', dosage, replace(coalesce(frequency, ''), '_', ' '))),
  'prescription',
  scheduled_times,
  case when active = true then 'active' else 'discontinued' end,
  'manual',
  created_at,
  now()
from user_medications um
where not exists (
  select 1
  from my_medicines mm
  where mm.user_id = um.user_id
    and lower(mm.display_name) = lower(um.medication_name)
);
