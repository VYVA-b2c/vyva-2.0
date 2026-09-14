CREATE TABLE IF NOT EXISTS "marketing_campaign_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "language" text DEFAULT 'en' NOT NULL,
  "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source" text DEFAULT 'lovable' NOT NULL,
  "lovable_external_id" text UNIQUE,
  "owner_external_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "marketing_campaign_templates_category_idx"
  ON "marketing_campaign_templates" ("category");
CREATE INDEX IF NOT EXISTS "marketing_campaign_templates_language_idx"
  ON "marketing_campaign_templates" ("language");
CREATE INDEX IF NOT EXISTS "marketing_campaign_templates_source_idx"
  ON "marketing_campaign_templates" ("source");

CREATE TABLE IF NOT EXISTS "marketing_contact_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "color" text,
  "source" text DEFAULT 'lovable' NOT NULL,
  "lovable_external_id" text UNIQUE,
  "owner_external_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "marketing_contact_tags_name_idx"
  ON "marketing_contact_tags" ("name");
CREATE INDEX IF NOT EXISTS "marketing_contact_tags_source_idx"
  ON "marketing_contact_tags" ("source");
