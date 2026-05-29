ALTER TABLE "vyva_pattern_windows"
  ADD COLUMN IF NOT EXISTS "safety_status" text NOT NULL DEFAULT 'steady',
  ADD COLUMN IF NOT EXISTS "rule_version" text NOT NULL DEFAULT 'daily-safety-v1',
  ADD COLUMN IF NOT EXISTS "acknowledged_action" text,
  ADD COLUMN IF NOT EXISTS "acknowledged_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "resolved_at" timestamptz;

CREATE INDEX IF NOT EXISTS "idx_vpw_user_ack"
  ON "vyva_pattern_windows" ("user_id", "acknowledged_at", "analysed_at" DESC);
