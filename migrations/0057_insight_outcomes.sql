CREATE TABLE IF NOT EXISTS "insight_outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "triage_report_id" uuid,
  "delivered_surface" text NOT NULL,
  "action_taken" text NOT NULL DEFAULT 'none',
  "tier_at_generation" integer NOT NULL DEFAULT 4,
  "outcome_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "insight_outcomes_user_time_idx"
  ON "insight_outcomes" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "insight_outcomes_triage_report_idx"
  ON "insight_outcomes" ("triage_report_id");
