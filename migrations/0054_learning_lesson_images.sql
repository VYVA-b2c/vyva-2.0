ALTER TABLE learning_lessons
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_alt text,
  ADD COLUMN IF NOT EXISTS image_prompt text;
