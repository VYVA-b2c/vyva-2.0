ALTER TABLE "vyva_signal_readings"
  ADD COLUMN IF NOT EXISTS "capture_method" text,
  ADD COLUMN IF NOT EXISTS "unit" text,
  ADD COLUMN IF NOT EXISTS "source_ref" jsonb;

ALTER TABLE "user_device_connections"
  ADD COLUMN IF NOT EXISTS "provider_user_id" text,
  ADD COLUMN IF NOT EXISTS "device_label" text,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}';
