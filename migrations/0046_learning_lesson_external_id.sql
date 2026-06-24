alter table public.learning_lessons
  add column if not exists external_id text;

create unique index if not exists idx_learning_lessons_external_id_unique
  on public.learning_lessons (external_id);
