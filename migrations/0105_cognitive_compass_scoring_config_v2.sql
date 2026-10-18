-- Cognitive Compass: align scoring_config with shared/cognitiveAssessmentScoring.ts
-- (scoring version cc_scoring_v2). Data-only and repeatable; no schema change.
--
-- * Story recall: the stories are original content, not Wechsler material, so the
--   lineage label becomes narrative_recall_idea_units. max_score is per story
--   (number of idea units), not a fixed 25.
-- * Orientation: max_score is the number of items that can be checked for this
--   member (city/region need profile data), so the fixed 5 is removed.
-- * Clock: the wizard step sets hands to a target time and is scored 0-2 on hour
--   and minute. No Sunderland scoring is implemented; voice descriptions stay
--   unscored until a validated method exists.
-- * PHQ-2: the >=3 cut-off now carries its source. Only sourced thresholds flag.
-- * IADL subset: the threshold of 6 had no source and is no longer used.

update public.cc_task_definitions
set scoring_config = (scoring_config - 'max_score' - 'reference')
  || '{"reference": "narrative_recall_idea_units", "scoring_version": "cc_scoring_v2"}'::jsonb
where id in ('story_recall_immediate', 'story_recall_delayed');

update public.cc_task_definitions
set scoring_config = (scoring_config - 'max_score')
  || '{"max_score_rule": "scorable_items", "scoring_version": "cc_scoring_v2"}'::jsonb
where id = 'orientation';

update public.cc_task_definitions
set scoring_config = (scoring_config - 'voice_scoring' - 'wizard_scoring' - 'max_score')
  || '{"wizard_scoring": "clock_setting_v1", "voice_scoring": "unscored_no_validated_method", "max_score": 2, "scoring_version": "cc_scoring_v2"}'::jsonb
where id = 'clock_drawing';

update public.cc_task_definitions
set scoring_config = scoring_config
  || '{"threshold_source": "Kroenke K, Spitzer RL, Williams JBW. The Patient Health Questionnaire-2: validity of a two-item depression screener. Med Care. 2003;41(11):1284-1292.", "scoring_version": "cc_scoring_v2"}'::jsonb
where id = 'mood_screen';

update public.cc_task_definitions
set scoring_config = (scoring_config - 'threshold_flag')
  || '{"threshold_retired": "unsourced cut-off of 6 from migration 0050; not used", "scoring_version": "cc_scoring_v2"}'::jsonb
where id = 'function_iadl';

update public.cc_task_definitions
set scoring_config = scoring_config || '{"scoring_version": "cc_scoring_v2"}'::jsonb
where id in ('fluency_semantic', 'fluency_phonemic', 'digit_span', 'similarities', 'sleep_energy', 'subjective_concern');
