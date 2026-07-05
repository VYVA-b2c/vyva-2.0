CREATE TABLE IF NOT EXISTS learning_lesson_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  image_bytes bytea NOT NULL,
  prompt text,
  model text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_lesson_images_lesson
  ON learning_lesson_images(lesson_id);
