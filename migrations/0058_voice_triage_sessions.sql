CREATE TABLE IF NOT EXISTS "voice_triage_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "channel" text NOT NULL DEFAULT 'voice_app',
  "status" text NOT NULL DEFAULT 'active',
  "locale" text NOT NULL DEFAULT 'en',
  "messages_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "wizard_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "health_memory_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "latest_response_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "triage_report_id" uuid,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  CONSTRAINT "voice_triage_sessions_conversation_id_unique" UNIQUE ("conversation_id")
);

CREATE INDEX IF NOT EXISTS "voice_triage_sessions_user_updated_idx"
  ON "voice_triage_sessions" ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "voice_triage_sessions_status_updated_idx"
  ON "voice_triage_sessions" ("status", "updated_at");
