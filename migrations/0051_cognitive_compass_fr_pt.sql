insert into public.cc_rotation_forms
  (task_definition_id, form_number, content, language, is_active)
values
  ('orientation', 1, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_country","expected":"fr"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'fr', true),
  ('orientation', 2, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_season","expected":"current_season_dynamic"},{"prompt_key":"what_date","expected":"current_date_dynamic"},{"prompt_key":"what_country","expected":"fr"},{"prompt_key":"what_departement","expected":"user_profile_departement"}]}'::jsonb, 'fr', true),
  ('orientation', 3, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"morning_or_afternoon","expected":"current_ampm_dynamic"},{"prompt_key":"what_country","expected":"fr"},{"prompt_key":"what_home_type","expected":"user_profile_home_type"}]}'::jsonb, 'fr', true),
  ('orientation', 4, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_time_hour","expected":"current_hour_dynamic"},{"prompt_key":"what_country","expected":"fr"},{"prompt_key":"what_region","expected":"user_profile_region"}]}'::jsonb, 'fr', true),
  ('orientation', 1, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_country","expected":"pt"},{"prompt_key":"what_city","expected":"user_profile_city"}]}'::jsonb, 'pt', true),
  ('orientation', 2, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_season","expected":"current_season_dynamic"},{"prompt_key":"what_date","expected":"current_date_dynamic"},{"prompt_key":"what_country","expected":"pt"},{"prompt_key":"what_distrito","expected":"user_profile_distrito"}]}'::jsonb, 'pt', true),
  ('orientation', 3, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_month","expected":"current_month_dynamic"},{"prompt_key":"morning_or_afternoon","expected":"current_ampm_dynamic"},{"prompt_key":"what_country","expected":"pt"},{"prompt_key":"what_home_type","expected":"user_profile_home_type"}]}'::jsonb, 'pt', true),
  ('orientation', 4, '{"items":[{"prompt_key":"what_year","expected":"current_year_dynamic"},{"prompt_key":"what_day_of_week","expected":"current_day_of_week_dynamic"},{"prompt_key":"what_time_hour","expected":"current_hour_dynamic"},{"prompt_key":"what_country","expected":"pt"},{"prompt_key":"what_concelho","expected":"user_profile_concelho"}]}'::jsonb, 'pt', true)
on conflict (task_definition_id, form_number, language) do update
set content = excluded.content,
    is_active = excluded.is_active;

with seed_items (task_definition_id, content, language, difficulty_tier, source, is_active, reviewed_at, reviewed_by) as (
  values
    ('fluency_semantic', '{"category": "animaux", "acceptable_responses_reference": "fr_animals_v1"}'::jsonb, 'fr', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_semantic', '{"category": "nourriture", "acceptable_responses_reference": "fr_food_v1"}'::jsonb, 'fr', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_semantic', '{"category": "vêtements", "acceptable_responses_reference": "fr_clothing_v1"}'::jsonb, 'fr', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_semantic', '{"category": "parties du corps", "acceptable_responses_reference": "fr_body_parts_v1"}'::jsonb, 'fr', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_semantic', '{"category": "animais", "acceptable_responses_reference": "pt_animals_v1"}'::jsonb, 'pt', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_semantic', '{"category": "comida", "acceptable_responses_reference": "pt_food_v1"}'::jsonb, 'pt', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_semantic', '{"category": "roupa", "acceptable_responses_reference": "pt_clothing_v1"}'::jsonb, 'pt', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_semantic', '{"category": "partes do corpo", "acceptable_responses_reference": "pt_body_parts_v1"}'::jsonb, 'pt', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_phonemic', '{"letter": "F"}'::jsonb, 'fr', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_phonemic', '{"letter": "A"}'::jsonb, 'fr', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_phonemic', '{"letter": "S"}'::jsonb, 'fr', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_phonemic', '{"letter": "F"}'::jsonb, 'pt', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_phonemic', '{"letter": "A"}'::jsonb, 'pt', 1, 'clinical_adapted', true, now(), 'seed'),
    ('fluency_phonemic', '{"letter": "S"}'::jsonb, 'pt', 1, 'clinical_adapted', true, now(), 'seed')
)
insert into public.cc_item_bank
  (task_definition_id, content, language, difficulty_tier, source, is_active, reviewed_at, reviewed_by)
select task_definition_id, content, language, difficulty_tier, source, is_active, reviewed_at, reviewed_by
from seed_items
where not exists (
  select 1
  from public.cc_item_bank existing
  where existing.task_definition_id = seed_items.task_definition_id
    and existing.language = seed_items.language
    and existing.content = seed_items.content
);

update public.cc_task_definitions
set scoring_config = scoring_config || '{"letter_examples_fr":["F","A","S"],"letter_examples_pt":["F","A","S"]}'::jsonb
where id = 'fluency_phonemic';

update public.cc_task_definitions
set content_static = jsonb_set(
  jsonb_set(
    content_static,
    '{languages,fr}',
    '{"forward_prompt":"Je vais dire quelques chiffres. Quand j''aurai terminé, répétez-les dans le même ordre.","backward_prompt":"Maintenant, répétez les chiffres dans l''ordre inverse.","practice_note":"Écoutez tranquillement. Il n''est pas nécessaire d''aller vite."}'::jsonb,
    true
  ),
  '{languages,pt}',
  '{"forward_prompt":"Vou dizer alguns números. Quando eu terminar, repita-os na mesma ordem.","backward_prompt":"Agora repita os números pela ordem inversa.","practice_note":"Escute com calma. Não é preciso ter pressa."}'::jsonb,
  true
)
where id = 'digit_span';

update public.cc_task_definitions
set content_static = jsonb_set(
  jsonb_set(
    content_static,
    '{languages,fr}',
    '{"voice_prompt":"Imaginez une horloge ronde. Décrivez où vous placeriez les chiffres et les aiguilles pour indiquer {time}.","wizard_prompt":"Dessinez une horloge ronde et placez les aiguilles pour indiquer {time}.","reassurance":"Faites de votre mieux; cela n''a pas besoin d''être parfait."}'::jsonb,
    true
  ),
  '{languages,pt}',
  '{"voice_prompt":"Imagine um relógio redondo. Descreva onde colocaria os números e os ponteiros para marcar {time}.","wizard_prompt":"Desenhe um relógio redondo e coloque os ponteiros a marcar {time}.","reassurance":"Faça o melhor que conseguir; não tem de ficar perfeito."}'::jsonb,
  true
)
where id = 'clock_drawing';

update public.cc_task_definitions
set content_static = jsonb_set(
  jsonb_set(
    content_static,
    '{languages,fr}',
    $json$
    {
      "intro": "Au cours des deux dernières semaines, à quelle fréquence avez-vous été gêné(e) par les situations suivantes?",
      "items": [
        {"id": "phq2_1", "text": "Peu d'intérêt ou de plaisir à faire les choses"},
        {"id": "phq2_2", "text": "Se sentir triste, déprimé(e) ou sans espoir"}
      ],
      "scale": [
        {"value": 0, "label": "Pas du tout"},
        {"value": 1, "label": "Plusieurs jours"},
        {"value": 2, "label": "Plus de la moitié des jours"},
        {"value": 3, "label": "Presque tous les jours"}
      ]
    }
    $json$::jsonb,
    true
  ),
  '{languages,pt}',
  $json$
  {
    "intro": "Nas últimas duas semanas, com que frequência se sentiu incomodado(a) pelas seguintes situações?",
    "items": [
      {"id": "phq2_1", "text": "Pouco interesse ou prazer em fazer coisas"},
      {"id": "phq2_2", "text": "Sentir-se em baixo, deprimido(a) ou sem esperança"}
    ],
    "scale": [
      {"value": 0, "label": "Nunca"},
      {"value": 1, "label": "Vários dias"},
      {"value": 2, "label": "Mais de metade dos dias"},
      {"value": 3, "label": "Quase todos os dias"}
    ]
  }
  $json$::jsonb,
  true
)
where id = 'mood_screen';

update public.cc_task_definitions
set content_static = jsonb_set(
  jsonb_set(
    content_static,
    '{languages,fr}',
    $json$
    {
      "intro": "En pensant à la dernière semaine, choisissez la réponse qui convient le mieux.",
      "items": [
        {"id": "sleep_1", "text": "Comment avez-vous dormi dans l'ensemble?"},
        {"id": "sleep_2", "text": "Quelle énergie avez-vous eue pendant la journée?"}
      ],
      "scale": [
        {"value": 0, "label": "Très mal / aucune"},
        {"value": 1, "label": "Mal / peu"},
        {"value": 2, "label": "Moyen"},
        {"value": 3, "label": "Bien / assez"},
        {"value": 4, "label": "Très bien / beaucoup"}
      ]
    }
    $json$::jsonb,
    true
  ),
  '{languages,pt}',
  $json$
  {
    "intro": "Pensando na última semana, escolha a resposta que melhor se aplica.",
    "items": [
      {"id": "sleep_1", "text": "Como dormiu no geral?"},
      {"id": "sleep_2", "text": "Quanta energia teve durante o dia?"}
    ],
    "scale": [
      {"value": 0, "label": "Muito mal / nenhuma"},
      {"value": 1, "label": "Mal / pouca"},
      {"value": 2, "label": "Razoável"},
      {"value": 3, "label": "Bem / bastante"},
      {"value": 4, "label": "Muito bem / muita"}
    ]
  }
  $json$::jsonb,
  true
)
where id = 'sleep_energy';

update public.cc_task_definitions
set content_static = jsonb_set(
  jsonb_set(
    content_static,
    '{languages,fr}',
    $json$
    {
      "intro": "Dans une semaine habituelle, de quelle aide avez-vous besoin pour ces activités?",
      "items": [
        {"id": "iadl_meds", "text": "Organiser ou prendre vos médicaments"},
        {"id": "iadl_meals", "text": "Préparer un repas simple"},
        {"id": "iadl_appointments", "text": "Vous souvenir de rendez-vous ou de courses importantes"},
        {"id": "iadl_money", "text": "Gérer des paiements ou de petites démarches d'argent"}
      ],
      "scale": [
        {"value": 2, "label": "Je le fais sans aide"},
        {"value": 1, "label": "J'ai besoin d'un peu d'aide"},
        {"value": 0, "label": "Je ne peux pas le faire pour le moment"}
      ]
    }
    $json$::jsonb,
    true
  ),
  '{languages,pt}',
  $json$
  {
    "intro": "Numa semana normal, de quanta ajuda precisa para estas atividades?",
    "items": [
      {"id": "iadl_meds", "text": "Organizar ou tomar os seus medicamentos"},
      {"id": "iadl_meals", "text": "Preparar uma refeição simples"},
      {"id": "iadl_appointments", "text": "Lembrar-se de consultas ou recados importantes"},
      {"id": "iadl_money", "text": "Gerir pagamentos ou pequenas tarefas de dinheiro"}
    ],
    "scale": [
      {"value": 2, "label": "Faço isto sem ajuda"},
      {"value": 1, "label": "Preciso de alguma ajuda"},
      {"value": 0, "label": "Não consigo fazer isto agora"}
    ]
  }
  $json$::jsonb,
  true
)
where id = 'function_iadl';

update public.cc_task_definitions
set content_static = jsonb_set(
  jsonb_set(
    content_static,
    '{languages,fr}',
    $json$
    {
      "intro": "Ces questions concernent votre propre perception de votre mémoire et de votre réflexion.",
      "items": [
        {"id": "scd_1", "text": "À quelle fréquence remarquez-vous des inquiétudes concernant votre mémoire?"},
        {"id": "scd_2", "text": "À quelle fréquence avez-vous du mal à trouver vos mots dans une conversation?"},
        {"id": "scd_3", "text": "À quelle fréquence sentez-vous que vous avez besoin de plus d'aide pour vous souvenir de projets ou de tâches?"}
      ],
      "scale": [
        {"value": 0, "label": "Pas du tout"},
        {"value": 1, "label": "Parfois"},
        {"value": 2, "label": "Souvent"},
        {"value": 3, "label": "Très souvent"}
      ]
    }
    $json$::jsonb,
    true
  ),
  '{languages,pt}',
  $json$
  {
    "intro": "Estas perguntas são sobre a sua própria perceção da memória e do pensamento.",
    "items": [
      {"id": "scd_1", "text": "Com que frequência nota preocupações com a sua memória?"},
      {"id": "scd_2", "text": "Com que frequência tem dificuldade em encontrar palavras numa conversa?"},
      {"id": "scd_3", "text": "Com que frequência sente que precisa de mais ajuda para se lembrar de planos ou tarefas?"}
    ],
    "scale": [
      {"value": 0, "label": "Nada"},
      {"value": 1, "label": "Às vezes"},
      {"value": 2, "label": "Muitas vezes"},
      {"value": 3, "label": "Muito frequentemente"}
    ]
  }
  $json$::jsonb,
  true
)
where id = 'subjective_concern';

do $$
declare
  expected_languages text[] := array['es','de','en','fr','pt'];
  static_task_ids text[] := array[
    'digit_span',
    'clock_drawing',
    'mood_screen',
    'sleep_energy',
    'function_iadl',
    'subjective_concern'
  ];
  missing_static integer;
  rotation_count integer;
  phonemic_count integer;
  semantic_count integer;
begin
  select count(*) into rotation_count
  from public.cc_rotation_forms
  where task_definition_id = 'orientation'
    and language = any(expected_languages)
    and is_active = true;

  if rotation_count <> 20 then
    raise exception 'cc_rotation_forms active 5-language orientation coverage has % rows, expected 20', rotation_count;
  end if;

  select count(*) into phonemic_count
  from public.cc_item_bank
  where task_definition_id = 'fluency_phonemic'
    and language in ('fr','pt')
    and source = 'clinical_adapted'
    and is_active = true;

  if phonemic_count <> 6 then
    raise exception 'cc_item_bank fr/pt phonemic seed has % rows, expected 6', phonemic_count;
  end if;

  select count(*) into semantic_count
  from public.cc_item_bank
  where task_definition_id = 'fluency_semantic'
    and language in ('fr','pt')
    and source = 'clinical_adapted'
    and is_active = true;

  if semantic_count <> 8 then
    raise exception 'cc_item_bank fr/pt semantic seed has % rows, expected 8', semantic_count;
  end if;

  if not exists (
    select 1
    from public.cc_task_definitions
    where id = 'fluency_phonemic'
      and scoring_config ? 'letter_examples_fr'
      and scoring_config ? 'letter_examples_pt'
  ) then
    raise exception 'fluency_phonemic scoring_config is missing fr/pt letter examples';
  end if;

  select count(*) into missing_static
  from unnest(static_task_ids) as task(task_id)
  cross join unnest(expected_languages) as lang(language_code)
  where not exists (
    select 1
    from public.cc_task_definitions
    where id = task.task_id
      and content_static #> array['languages', lang.language_code] is not null
  );

  if missing_static <> 0 then
    raise exception 'cc_task_definitions static content has % missing language entries', missing_static;
  end if;
end $$;
