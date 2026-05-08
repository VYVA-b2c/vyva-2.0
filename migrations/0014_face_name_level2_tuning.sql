-- Face-Name Match: make every level's timing distinct.
-- Extra recall choices are computed in the app from difficulty_tier.

UPDATE public.face_name_sets
SET study_seconds = CASE difficulty_tier
  WHEN 1 THEN 45
  WHEN 2 THEN 40
  WHEN 3 THEN 40
  WHEN 4 THEN 35
  WHEN 5 THEN 35
  WHEN 6 THEN 30
  WHEN 7 THEN 30
  WHEN 8 THEN 25
  WHEN 9 THEN 25
  WHEN 10 THEN 20
  ELSE study_seconds
END
WHERE difficulty_tier BETWEEN 1 AND 10;
