ALTER TABLE "marketing_journeys"
  ADD COLUMN IF NOT EXISTS "trigger_type" text,
  ADD COLUMN IF NOT EXISTS "trigger_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "goal_type" text,
  ADD COLUMN IF NOT EXISTS "goal_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "exit_on_goal" boolean NOT NULL DEFAULT true;

ALTER TABLE "marketing_journey_steps"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'message',
  ADD COLUMN IF NOT EXISTS "day_offset" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "template_kind" text,
  ADD COLUMN IF NOT EXISTS "template_ref" text,
  ADD COLUMN IF NOT EXISTS "config" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS "marketing_journeys_trigger_idx" ON "marketing_journeys" ("trigger_type");
CREATE INDEX IF NOT EXISTS "marketing_journeys_goal_idx" ON "marketing_journeys" ("goal_type");
CREATE INDEX IF NOT EXISTS "marketing_journey_steps_kind_idx" ON "marketing_journey_steps" ("kind");
CREATE INDEX IF NOT EXISTS "marketing_journey_steps_day_offset_idx" ON "marketing_journey_steps" ("day_offset");
