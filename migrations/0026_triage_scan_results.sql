ALTER TABLE "triage_reports"
  ADD COLUMN IF NOT EXISTS "scan_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "scan_notes" text[] DEFAULT '{}' NOT NULL;
