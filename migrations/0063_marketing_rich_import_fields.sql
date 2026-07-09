ALTER TABLE "marketing_content_assets"
  ADD COLUMN IF NOT EXISTS "html_body" text,
  ADD COLUMN IF NOT EXISTS "design_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "media_assets" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "marketing_contacts"
  ADD COLUMN IF NOT EXISTS "language" text,
  ADD COLUMN IF NOT EXISTS "category" text,
  ADD COLUMN IF NOT EXISTS "vertical" text,
  ADD COLUMN IF NOT EXISTS "market" text;

CREATE INDEX IF NOT EXISTS "marketing_contacts_language_idx" ON "marketing_contacts" ("language");
CREATE INDEX IF NOT EXISTS "marketing_contacts_category_idx" ON "marketing_contacts" ("category");
CREATE INDEX IF NOT EXISTS "marketing_contacts_vertical_idx" ON "marketing_contacts" ("vertical");
CREATE INDEX IF NOT EXISTS "marketing_contacts_market_idx" ON "marketing_contacts" ("market");
