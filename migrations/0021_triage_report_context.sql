ALTER TABLE "triage_reports"
  ADD COLUMN IF NOT EXISTS "next_step_label" text,
  ADD COLUMN IF NOT EXISTS "next_step_level" text,
  ADD COLUMN IF NOT EXISTS "triage_reasons" text[] DEFAULT '{}' NOT NULL,
  ADD COLUMN IF NOT EXISTS "watch_signs" text[] DEFAULT '{}' NOT NULL,
  ADD COLUMN IF NOT EXISTS "profile_considerations" text[] DEFAULT '{}' NOT NULL,
  ADD COLUMN IF NOT EXISTS "vitals_notes" text[] DEFAULT '{}' NOT NULL;
