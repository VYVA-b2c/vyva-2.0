DO $$
DECLARE
  duplicate_phone text;
BEGIN
  SELECT normalized_phone
  INTO duplicate_phone
  FROM (
    SELECT regexp_replace(coalesce("phone_number", ''), '[^0-9]', '', 'g') AS normalized_phone
    FROM "profiles"
    WHERE nullif(regexp_replace(coalesce("phone_number", ''), '[^0-9]', '', 'g'), '') IS NOT NULL
    GROUP BY 1
    HAVING count(*) > 1
    LIMIT 1
  ) duplicates;

  IF duplicate_phone IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot create profiles_phone_number_digits_unique; duplicate normalized profile phone exists: %', duplicate_phone;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "profiles_phone_number_digits_unique"
  ON "profiles" ((regexp_replace(coalesce("phone_number", ''), '[^0-9]', '', 'g')))
  WHERE nullif(regexp_replace(coalesce("phone_number", ''), '[^0-9]', '', 'g'), '') IS NOT NULL;
