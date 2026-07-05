create extension if not exists pgcrypto;

create table if not exists public.cc_task_definitions (
  id                    text primary key,
  display_order         integer not null unique,
  domain                text not null,
  task_type             text not null,
  content_source        text not null check (content_source in ('item_bank','rotation','static')),
  expected_duration_sec integer not null,
  content_static        jsonb,
  supports_voice        boolean not null default true,
  supports_wizard       boolean not null default true,
  scoring_config        jsonb not null,
  is_active             boolean not null default true,
  created_at            timestamptz default now()
);

create table if not exists public.cc_item_bank (
  id                    uuid primary key default gen_random_uuid(),
  task_definition_id    text not null references public.cc_task_definitions(id),
  content               jsonb not null,
  language              text not null default 'es',
  difficulty_tier       integer not null default 1 check (difficulty_tier between 1 and 5),
  source                text not null default 'ai_generated' check (source in ('ai_generated','human_written','clinical_adapted')),
  reviewed_at           timestamptz,
  reviewed_by           text,
  rejected              boolean not null default false,
  is_active             boolean not null default false,
  created_at            timestamptz default now()
);

create table if not exists public.cc_rotation_forms (
  id                    uuid primary key default gen_random_uuid(),
  task_definition_id    text not null references public.cc_task_definitions(id),
  form_number           integer not null check (form_number between 1 and 4),
  content               jsonb not null,
  language              text not null default 'es',
  is_active             boolean not null default true,
  created_at            timestamptz default now(),
  unique (task_definition_id, form_number, language)
);

create table if not exists public.cc_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null,
  started_at            timestamptz default now(),
  completed_at          timestamptz,
  input_mode            text not null check (input_mode in ('voice','wizard','mixed')),
  language              text not null,
  week_of_year          integer not null,
  year                  integer not null,
  abandoned             boolean not null default false,
  abandon_task_id       text references public.cc_task_definitions(id),
  unique (user_id, year, week_of_year, id)
);

create table if not exists public.cc_task_responses (
  id                     uuid primary key default gen_random_uuid(),
  session_id             uuid not null references public.cc_sessions(id) on delete cascade,
  task_definition_id     text not null references public.cc_task_definitions(id),
  item_bank_id           uuid references public.cc_item_bank(id),
  rotation_form_id       uuid references public.cc_rotation_forms(id),
  started_at             timestamptz not null,
  completed_at           timestamptz,
  input_mode             text not null check (input_mode in ('voice','wizard')),
  response_data          jsonb not null,
  audio_features         jsonb,
  constraint cc_task_responses_one_content_ref
    check (not (item_bank_id is not null and rotation_form_id is not null))
);

create table if not exists public.cc_user_consents (
  user_id                       uuid primary key,
  voice_features_capture        boolean not null default false,
  voice_features_capture_at     timestamptz,
  clinical_report_sharing       boolean not null default false,
  clinical_report_sharing_at    timestamptz,
  updated_at                    timestamptz default now()
);

insert into public.cc_task_definitions
  (id, display_order, domain, task_type, content_source,
   expected_duration_sec, content_static, supports_voice, supports_wizard, scoring_config)
values
('orientation', 1, 'awareness', 'orientation', 'rotation', 45,
 null,
 true, true,
 '{"items_per_session": 5, "scoring": "count_correct", "max_score": 5}'::jsonb),

('story_recall_immediate', 2, 'episodic_memory', 'story_recall', 'item_bank', 120,
 null,
 true, true,
 '{"scoring": "idea_units_recalled", "max_score": 25, "reference": "wechsler_logical_memory_adapted"}'::jsonb),

('fluency_semantic', 3, 'language_executive', 'verbal_fluency', 'item_bank', 60,
 null,
 true, true,
 '{"category_examples": ["animals","food","clothing","body_parts"], "duration_seconds": 60, "scoring": "unique_valid_responses", "penalise_repetitions": true, "penalise_intrusions": true}'::jsonb),

('fluency_phonemic', 4, 'executive_language', 'verbal_fluency', 'item_bank', 60,
 null,
 true, true,
 '{"letter_examples_es": ["F","P","S"], "letter_examples_de": ["F","P","S"], "letter_examples_en": ["F","A","S"], "duration_seconds": 60, "scoring": "unique_valid_responses", "penalise_proper_nouns": true, "penalise_repetitions": true}'::jsonb),

('digit_span', 5, 'working_memory', 'digit_span', 'static', 90,
 $json$
 {
   "languages": {
     "es": {
       "forward_prompt": "Voy a decir unos numeros. Cuando termine, repitelos en el mismo orden.",
       "backward_prompt": "Ahora repite los numeros en orden inverso.",
       "practice_note": "Escucha con calma. No hace falta ir deprisa."
     },
     "de": {
       "forward_prompt": "Ich sage einige Zahlen. Wenn ich fertig bin, wiederholen Sie sie bitte in derselben Reihenfolge.",
       "backward_prompt": "Jetzt wiederholen Sie die Zahlen bitte in umgekehrter Reihenfolge.",
       "practice_note": "Hoeren Sie in Ruhe zu. Es geht nicht um Schnelligkeit."
     },
     "en": {
       "forward_prompt": "I will say some numbers. When I finish, repeat them in the same order.",
       "backward_prompt": "Now repeat the numbers in reverse order.",
       "practice_note": "Listen calmly. There is no need to rush."
     }
   },
   "forward_trials": [
     {"length": 3, "sequences": ["4-8-2", "6-1-9"]},
     {"length": 4, "sequences": ["3-7-5-1", "8-2-9-4"]},
     {"length": 5, "sequences": ["1-5-2-8-6", "6-9-4-7-3"]},
     {"length": 6, "sequences": ["5-3-9-4-1-8", "7-2-8-1-9-6"]},
     {"length": 7, "sequences": ["8-1-2-9-3-6-5", "4-7-3-9-1-2-8"]},
     {"length": 8, "sequences": ["9-4-3-7-6-2-5-8", "7-2-8-1-9-6-5-3"]},
     {"length": 9, "sequences": ["7-2-9-4-6-8-1-5-3", "3-8-2-9-5-1-7-4-6"]}
   ],
   "backward_trials": [
     {"length": 2, "sequences": ["2-4", "5-8"]},
     {"length": 3, "sequences": ["6-2-9", "4-1-7"]},
     {"length": 4, "sequences": ["3-2-7-9", "7-5-2-8"]},
     {"length": 5, "sequences": ["1-5-2-8-6", "6-1-8-4-3"]},
     {"length": 6, "sequences": ["5-3-9-4-1-8", "7-2-4-8-5-6"]},
     {"length": 7, "sequences": ["8-1-2-9-3-6-5", "4-7-3-9-1-2-8"]},
     {"length": 8, "sequences": ["9-4-3-7-6-2-5-8", "7-2-8-1-9-6-5-3"]}
   ]
 }
 $json$::jsonb,
 true, true,
 '{"forward_start_length": 3, "forward_max_length": 9, "backward_start_length": 2, "backward_max_length": 8, "trials_per_length": 2, "stop_after_consecutive_failures": 2, "scoring": "longest_span_forward + longest_span_backward"}'::jsonb),

('similarities', 6, 'abstract_reasoning', 'similarities', 'item_bank', 120,
 null,
 true, true,
 '{"items_per_session": 4, "scoring": "abstract_2 / concrete_1 / no_answer_0", "max_score_per_item": 2, "max_score": 8}'::jsonb),

('clock_drawing', 7, 'visuospatial_executive', 'clock_drawing', 'static', 90,
 $json$
 {
   "target_times": ["10:11", "11:10", "2:45", "3:40"],
   "languages": {
     "es": {
       "voice_prompt": "Imagina un reloj redondo. Describe donde pondrias los numeros y las agujas para marcar {time}.",
       "wizard_prompt": "Dibuja un reloj redondo y coloca las agujas para marcar {time}.",
       "reassurance": "Hazlo lo mejor que puedas; no tiene que ser perfecto."
     },
     "de": {
       "voice_prompt": "Stellen Sie sich eine runde Uhr vor. Beschreiben Sie, wo die Zahlen und Zeiger fuer {time} stehen.",
       "wizard_prompt": "Zeichnen Sie eine runde Uhr und stellen Sie die Zeiger auf {time}.",
       "reassurance": "Machen Sie es so gut Sie koennen; es muss nicht perfekt sein."
     },
     "en": {
       "voice_prompt": "Imagine a round clock. Describe where you would place the numbers and hands to show {time}.",
       "wizard_prompt": "Draw a round clock and set the hands to {time}.",
       "reassurance": "Do your best; it does not need to be perfect."
     }
   }
 }
 $json$::jsonb,
 true, true,
 '{"target_time_options": ["10:11","11:10","2:45","3:40"], "voice_scoring": "sunderland_method_adapted_verbal", "wizard_scoring": "sunderland_method_geometric", "max_score": 10}'::jsonb),

('story_recall_delayed', 8, 'episodic_memory', 'story_recall', 'item_bank', 90,
 null,
 true, true,
 '{"references_immediate_story": true, "scoring": "idea_units_recalled", "max_score": 25, "reference": "wechsler_logical_memory_delayed"}'::jsonb),

('mood_screen', 9, 'mood', 'likert_scale', 'static', 30,
 $json$
 {
   "instrument": "PHQ-2",
   "recall_window_days": 14,
   "languages": {
     "es": {
       "intro": "Durante las ultimas dos semanas, con que frecuencia le han molestado estas situaciones?",
       "items": [
         {"id": "phq2_1", "text": "Poco interes o placer en hacer cosas"},
         {"id": "phq2_2", "text": "Sentirse bajo de animo, deprimido o sin esperanza"}
       ],
       "scale": [
         {"value": 0, "label": "Nunca"},
         {"value": 1, "label": "Varios dias"},
         {"value": 2, "label": "Mas de la mitad de los dias"},
         {"value": 3, "label": "Casi todos los dias"}
       ]
     },
     "de": {
       "intro": "Wie oft fuehlten Sie sich in den letzten zwei Wochen durch Folgendes beeintraechtigt?",
       "items": [
         {"id": "phq2_1", "text": "Wenig Interesse oder Freude an Taetigkeiten"},
         {"id": "phq2_2", "text": "Niedergeschlagen, deprimiert oder hoffnungslos sein"}
       ],
       "scale": [
         {"value": 0, "label": "Ueberhaupt nicht"},
         {"value": 1, "label": "An einzelnen Tagen"},
         {"value": 2, "label": "An mehr als der Haelfte der Tage"},
         {"value": 3, "label": "Beinahe jeden Tag"}
       ]
     },
     "en": {
       "intro": "Over the last two weeks, how often have you been bothered by the following?",
       "items": [
         {"id": "phq2_1", "text": "Little interest or pleasure in doing things"},
         {"id": "phq2_2", "text": "Feeling down, depressed, or hopeless"}
       ],
       "scale": [
         {"value": 0, "label": "Not at all"},
         {"value": 1, "label": "Several days"},
         {"value": 2, "label": "More than half the days"},
         {"value": 3, "label": "Nearly every day"}
       ]
     }
   }
 }
 $json$::jsonb,
 true, true,
 '{"instrument": "PHQ-2", "items": 2, "scale": "0-3", "threshold_flag": 3, "scoring": "sum"}'::jsonb),

('sleep_energy', 10, 'sleep', 'likert_scale', 'static', 30,
 $json$
 {
   "instrument": "custom_2_item",
   "recall_window_days": 7,
   "languages": {
     "es": {
       "intro": "Pensando en la ultima semana, elija la respuesta que mejor encaje.",
       "items": [
         {"id": "sleep_1", "text": "Que tal ha dormido en general?"},
         {"id": "sleep_2", "text": "Cuanta energia ha tenido durante el dia?"}
       ],
       "scale": [
         {"value": 0, "label": "Muy mal / nada"},
         {"value": 1, "label": "Mal / poca"},
         {"value": 2, "label": "Regular"},
         {"value": 3, "label": "Bien / bastante"},
         {"value": 4, "label": "Muy bien / mucha"}
       ]
     },
     "de": {
       "intro": "Denken Sie an die letzte Woche und waehlen Sie die passendste Antwort.",
       "items": [
         {"id": "sleep_1", "text": "Wie gut haben Sie insgesamt geschlafen?"},
         {"id": "sleep_2", "text": "Wie viel Energie hatten Sie tagsueber?"}
       ],
       "scale": [
         {"value": 0, "label": "Sehr schlecht / gar nicht"},
         {"value": 1, "label": "Schlecht / wenig"},
         {"value": 2, "label": "Mittel"},
         {"value": 3, "label": "Gut / ziemlich viel"},
         {"value": 4, "label": "Sehr gut / sehr viel"}
       ]
     },
     "en": {
       "intro": "Thinking about the last week, choose the answer that fits best.",
       "items": [
         {"id": "sleep_1", "text": "How well have you slept overall?"},
         {"id": "sleep_2", "text": "How much daytime energy have you had?"}
       ],
       "scale": [
         {"value": 0, "label": "Very poor / none"},
         {"value": 1, "label": "Poor / low"},
         {"value": 2, "label": "Fair"},
         {"value": 3, "label": "Good / quite a lot"},
         {"value": 4, "label": "Very good / a lot"}
       ]
     }
   }
 }
 $json$::jsonb,
 true, true,
 '{"instrument": "custom_2_item", "items": 2, "scale": "0-4", "scoring": "sum"}'::jsonb),

('function_iadl', 11, 'function', 'multiple_choice', 'static', 60,
 $json$
 {
   "instrument": "IADL_subset",
   "languages": {
     "es": {
       "intro": "En una semana normal, cuanta ayuda necesita para estas actividades?",
       "items": [
         {"id": "iadl_meds", "text": "Organizar o tomar sus medicamentos"},
         {"id": "iadl_meals", "text": "Preparar una comida sencilla"},
         {"id": "iadl_appointments", "text": "Recordar citas o recados importantes"},
         {"id": "iadl_money", "text": "Manejar pagos o pequenas gestiones de dinero"}
       ],
       "scale": [
         {"value": 2, "label": "Lo hago sin ayuda"},
         {"value": 1, "label": "Necesito algo de ayuda"},
         {"value": 0, "label": "No puedo hacerlo ahora"}
       ]
     },
     "de": {
       "intro": "Wie viel Hilfe brauchen Sie in einer normalen Woche bei diesen Dingen?",
       "items": [
         {"id": "iadl_meds", "text": "Medikamente ordnen oder einnehmen"},
         {"id": "iadl_meals", "text": "Eine einfache Mahlzeit zubereiten"},
         {"id": "iadl_appointments", "text": "Termine oder wichtige Besorgungen behalten"},
         {"id": "iadl_money", "text": "Zahlungen oder kleine Geldangelegenheiten erledigen"}
       ],
       "scale": [
         {"value": 2, "label": "Ich mache es ohne Hilfe"},
         {"value": 1, "label": "Ich brauche etwas Hilfe"},
         {"value": 0, "label": "Ich kann es im Moment nicht"}
       ]
     },
     "en": {
       "intro": "In a usual week, how much help do you need with these activities?",
       "items": [
         {"id": "iadl_meds", "text": "Organising or taking your medicines"},
         {"id": "iadl_meals", "text": "Preparing a simple meal"},
         {"id": "iadl_appointments", "text": "Remembering appointments or important errands"},
         {"id": "iadl_money", "text": "Managing payments or small money tasks"}
       ],
       "scale": [
         {"value": 2, "label": "I do this without help"},
         {"value": 1, "label": "I need some help"},
         {"value": 0, "label": "I cannot do this now"}
       ]
     }
   }
 }
 $json$::jsonb,
 true, true,
 '{"instrument": "IADL_subset", "items": 4, "scale": "independent_2 / needs_help_1 / cannot_0", "threshold_flag": 6, "scoring": "sum"}'::jsonb),

('subjective_concern', 12, 'insight', 'likert_scale', 'static', 30,
 $json$
 {
   "instrument": "custom_scd",
   "languages": {
     "es": {
       "intro": "Estas preguntas tratan sobre su propia percepcion de memoria y pensamiento.",
       "items": [
         {"id": "scd_1", "text": "Con que frecuencia nota que su memoria le preocupa?"},
         {"id": "scd_2", "text": "Con que frecuencia le cuesta encontrar palabras en conversacion?"},
         {"id": "scd_3", "text": "Con que frecuencia siente que necesita mas ayuda para recordar planes o tareas?"}
       ],
       "scale": [
         {"value": 0, "label": "Nada"},
         {"value": 1, "label": "A veces"},
         {"value": 2, "label": "A menudo"},
         {"value": 3, "label": "Muy a menudo"}
       ]
     },
     "de": {
       "intro": "Diese Fragen betreffen Ihre eigene Wahrnehmung von Gedaechtnis und Denken.",
       "items": [
         {"id": "scd_1", "text": "Wie oft machen Sie sich wegen Ihres Gedaechtnisses Sorgen?"},
         {"id": "scd_2", "text": "Wie oft faellt es Ihnen schwer, im Gespraech Worte zu finden?"},
         {"id": "scd_3", "text": "Wie oft haben Sie das Gefuehl, mehr Hilfe beim Erinnern an Plaene oder Aufgaben zu brauchen?"}
       ],
       "scale": [
         {"value": 0, "label": "Ueberhaupt nicht"},
         {"value": 1, "label": "Manchmal"},
         {"value": 2, "label": "Oft"},
         {"value": 3, "label": "Sehr oft"}
       ]
     },
     "en": {
       "intro": "These questions are about your own sense of memory and thinking.",
       "items": [
         {"id": "scd_1", "text": "How often do you notice concerns about your memory?"},
         {"id": "scd_2", "text": "How often is it hard to find words in conversation?"},
         {"id": "scd_3", "text": "How often do you feel you need more help remembering plans or tasks?"}
       ],
       "scale": [
         {"value": 0, "label": "Not at all"},
         {"value": 1, "label": "Sometimes"},
         {"value": 2, "label": "Often"},
         {"value": 3, "label": "Very often"}
       ]
     }
   }
 }
 $json$::jsonb,
 true, true,
 '{"instrument": "custom_scd", "items": 3, "scale": "not_at_all_0 / sometimes_1 / often_2 / very_often_3", "scoring": "sum"}'::jsonb)
on conflict (id) do nothing;

do $$
declare
  expected_count integer := 12;
  actual_count integer;
begin
  select count(*) into actual_count from public.cc_task_definitions;
  if actual_count <> expected_count then
    raise exception 'cc_task_definitions has % rows, expected %',
                    actual_count, expected_count;
  end if;

  if (select count(distinct display_order) from public.cc_task_definitions) <> expected_count then
    raise exception 'cc_task_definitions display_order values are not unique';
  end if;
end $$;

insert into public.cc_item_bank
  (task_definition_id, content, language, difficulty_tier, source, is_active, reviewed_at, reviewed_by)
values
  ('fluency_semantic', '{"category": "animales", "acceptable_responses_reference": "es_animals_v1"}'::jsonb, 'es', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "comida", "acceptable_responses_reference": "es_food_v1"}'::jsonb, 'es', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "ropa", "acceptable_responses_reference": "es_clothing_v1"}'::jsonb, 'es', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "partes del cuerpo", "acceptable_responses_reference": "es_body_parts_v1"}'::jsonb, 'es', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "Tiere", "acceptable_responses_reference": "de_animals_v1"}'::jsonb, 'de', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "Lebensmittel", "acceptable_responses_reference": "de_food_v1"}'::jsonb, 'de', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "Kleidung", "acceptable_responses_reference": "de_clothing_v1"}'::jsonb, 'de', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "Koerperteile", "acceptable_responses_reference": "de_body_parts_v1"}'::jsonb, 'de', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "animals", "acceptable_responses_reference": "en_animals_v1"}'::jsonb, 'en', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "food", "acceptable_responses_reference": "en_food_v1"}'::jsonb, 'en', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "clothing", "acceptable_responses_reference": "en_clothing_v1"}'::jsonb, 'en', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_semantic', '{"category": "body parts", "acceptable_responses_reference": "en_body_parts_v1"}'::jsonb, 'en', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "F"}'::jsonb, 'es', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "P"}'::jsonb, 'es', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "S"}'::jsonb, 'es', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "F"}'::jsonb, 'de', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "P"}'::jsonb, 'de', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "S"}'::jsonb, 'de', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "F"}'::jsonb, 'en', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "A"}'::jsonb, 'en', 1, 'clinical_adapted', true, now(), 'seed'),
  ('fluency_phonemic', '{"letter": "S"}'::jsonb, 'en', 1, 'clinical_adapted', true, now(), 'seed');

insert into public.cc_rotation_forms
  (task_definition_id, form_number, content, language, is_active)
values
  ('orientation', 1, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_country","expected":"es"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'es', true),
  ('orientation', 2, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_season","expected":"current_season_dynamic"},{"prompt_key":"what_date","expected":"current_date_dynamic"},{"prompt_key":"what_country","expected":"es"},{"prompt_key":"what_region","expected":"user_profile_region"}]}'::jsonb, 'es', true),
  ('orientation', 3, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"morning_or_afternoon","expected":"current_ampm_dynamic"},{"prompt_key":"what_country","expected":"es"},{"prompt_key":"what_home_type","expected":"user_profile_home_type"}]}'::jsonb, 'es', true),
  ('orientation', 4, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_time_hour","expected":"current_hour_dynamic"},{"prompt_key":"what_country","expected":"es"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'es', true),
  ('orientation', 1, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_country","expected":"de"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'de', true),
  ('orientation', 2, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_season","expected":"current_season_dynamic"},{"prompt_key":"what_date","expected":"current_date_dynamic"},{"prompt_key":"what_country","expected":"de"},{"prompt_key":"what_bundesland","expected":"user_profile_bundesland"}]}'::jsonb, 'de', true),
  ('orientation', 3, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"morning_or_afternoon","expected":"current_ampm_dynamic"},{"prompt_key":"what_country","expected":"de"},{"prompt_key":"what_home_type","expected":"user_profile_home_type"}]}'::jsonb, 'de', true),
  ('orientation', 4, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_time_hour","expected":"current_hour_dynamic"},{"prompt_key":"what_country","expected":"de"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'de', true),
  ('orientation', 1, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_country","expected":"user_profile_country"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'en', true),
  ('orientation', 2, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_season","expected":"current_season_dynamic"},{"prompt_key":"what_date","expected":"current_date_dynamic"},{"prompt_key":"what_country","expected":"user_profile_country"},{"prompt_key":"what_region","expected":"user_profile_state_or_region"}]}'::jsonb, 'en', true),
  ('orientation', 3, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"morning_or_afternoon","expected":"current_ampm_dynamic"},{"prompt_key":"what_country","expected":"user_profile_country"},{"prompt_key":"what_home_type","expected":"user_profile_home_type"}]}'::jsonb, 'en', true),
  ('orientation', 4, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_time_hour","expected":"current_hour_dynamic"},{"prompt_key":"what_country","expected":"user_profile_country"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'en', true)
on conflict (task_definition_id, form_number, language) do nothing;

create index if not exists idx_cc_task_definitions_active
  on public.cc_task_definitions (is_active, display_order);

create index if not exists idx_cc_item_bank_active
  on public.cc_item_bank (task_definition_id, language, is_active);

create index if not exists idx_cc_item_bank_review_queue
  on public.cc_item_bank (task_definition_id, language, is_active, rejected, created_at);

create index if not exists idx_cc_rotation_forms_active
  on public.cc_rotation_forms (task_definition_id, language, is_active);

create index if not exists idx_cc_sessions_user_time
  on public.cc_sessions (user_id, started_at desc);

create index if not exists idx_cc_task_responses_session
  on public.cc_task_responses (session_id);

create index if not exists idx_cc_task_responses_task
  on public.cc_task_responses (task_definition_id);

create index if not exists idx_cc_task_responses_item_bank
  on public.cc_task_responses (item_bank_id);

create index if not exists idx_cc_task_responses_rotation_form
  on public.cc_task_responses (rotation_form_id);

alter table public.cc_task_definitions enable row level security;
alter table public.cc_item_bank enable row level security;
alter table public.cc_rotation_forms enable row level security;
alter table public.cc_sessions enable row level security;
alter table public.cc_task_responses enable row level security;
alter table public.cc_user_consents enable row level security;

drop policy if exists cc_task_definitions_read on public.cc_task_definitions;
create policy cc_task_definitions_read on public.cc_task_definitions
  for select using (true);

drop policy if exists cc_item_bank_read on public.cc_item_bank;
create policy cc_item_bank_read on public.cc_item_bank
  for select using (is_active = true);

drop policy if exists cc_item_bank_admin_all on public.cc_item_bank;
create policy cc_item_bank_admin_all on public.cc_item_bank
  for all using (true)
  with check (true);

drop policy if exists cc_rotation_forms_read on public.cc_rotation_forms;
create policy cc_rotation_forms_read on public.cc_rotation_forms
  for select using (is_active = true);

drop policy if exists cc_sessions_user_all on public.cc_sessions;
create policy cc_sessions_user_all on public.cc_sessions
  for all using (true)
  with check (true);

drop policy if exists cc_task_responses_user_all on public.cc_task_responses;
create policy cc_task_responses_user_all on public.cc_task_responses
  for all using (true)
  with check (true);

drop policy if exists cc_user_consents_user_all on public.cc_user_consents;
create policy cc_user_consents_user_all on public.cc_user_consents
  for all using (true)
  with check (true);
