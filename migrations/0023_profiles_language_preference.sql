-- Fix profile loads when Drizzle selects profiles.language_preference.
-- Safe for dev and production: nullable column, no data rewrite required.
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "language_preference" text;
