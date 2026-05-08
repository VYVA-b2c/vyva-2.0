-- Face-Name Match: make Level 2 distinct from Level 1.
-- Level 2 keeps four people, but reduces study time from 45s to 40s.
-- The extra recall choice is computed in the app from difficulty_tier.

UPDATE public.face_name_sets
SET study_seconds = 40
WHERE difficulty_tier = 2
  AND study_seconds = 45;
