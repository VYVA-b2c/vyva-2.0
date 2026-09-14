CREATE TABLE IF NOT EXISTS "marketing_audiences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "list_type" text NOT NULL DEFAULT 'static',
  "rules" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "source" text NOT NULL DEFAULT 'vyva',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text,
  "updated_by" text,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketing_audience_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "audience_id" uuid NOT NULL REFERENCES "marketing_audiences"("id") ON DELETE CASCADE,
  "contact_id" uuid REFERENCES "marketing_contacts"("id") ON DELETE CASCADE,
  "contact_external_id" text NOT NULL,
  "source" text NOT NULL DEFAULT 'lovable',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "marketing_audience_members_external_unique" UNIQUE ("audience_id", "contact_external_id")
);

CREATE INDEX IF NOT EXISTS "marketing_audiences_source_idx" ON "marketing_audiences" ("source");
CREATE INDEX IF NOT EXISTS "marketing_audiences_list_type_idx" ON "marketing_audiences" ("list_type");
CREATE INDEX IF NOT EXISTS "marketing_audiences_updated_idx" ON "marketing_audiences" ("updated_at");

CREATE INDEX IF NOT EXISTS "marketing_audience_members_audience_idx" ON "marketing_audience_members" ("audience_id");
CREATE INDEX IF NOT EXISTS "marketing_audience_members_contact_idx" ON "marketing_audience_members" ("contact_id");
CREATE INDEX IF NOT EXISTS "marketing_audience_members_external_idx" ON "marketing_audience_members" ("contact_external_id");
