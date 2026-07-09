CREATE TABLE IF NOT EXISTS "marketing_media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_asset_id" uuid REFERENCES "marketing_content_assets"("id") ON DELETE CASCADE,
  "source" text NOT NULL DEFAULT 'lovable',
  "asset_type" text NOT NULL DEFAULT 'unknown',
  "original_url" text NOT NULL,
  "local_url" text,
  "status" text NOT NULL DEFAULT 'referenced',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "marketing_media_assets_content_idx" ON "marketing_media_assets" ("content_asset_id");
CREATE INDEX IF NOT EXISTS "marketing_media_assets_source_idx" ON "marketing_media_assets" ("source");
CREATE INDEX IF NOT EXISTS "marketing_media_assets_status_idx" ON "marketing_media_assets" ("status");
CREATE INDEX IF NOT EXISTS "marketing_media_assets_type_idx" ON "marketing_media_assets" ("asset_type");

CREATE TABLE IF NOT EXISTS "marketing_campaign_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
  "channel" text NOT NULL DEFAULT 'all',
  "metric_date" timestamp with time zone,
  "sent" integer NOT NULL DEFAULT 0,
  "delivered" integer NOT NULL DEFAULT 0,
  "opened" integer NOT NULL DEFAULT 0,
  "clicked" integer NOT NULL DEFAULT 0,
  "bounced" integer NOT NULL DEFAULT 0,
  "unsubscribed" integer NOT NULL DEFAULT 0,
  "replied" integer NOT NULL DEFAULT 0,
  "social_engagement" integer NOT NULL DEFAULT 0,
  "source" text NOT NULL DEFAULT 'lovable',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "marketing_campaign_metrics_campaign_idx" ON "marketing_campaign_metrics" ("campaign_id");
CREATE INDEX IF NOT EXISTS "marketing_campaign_metrics_channel_idx" ON "marketing_campaign_metrics" ("channel");
CREATE INDEX IF NOT EXISTS "marketing_campaign_metrics_date_idx" ON "marketing_campaign_metrics" ("metric_date");
CREATE INDEX IF NOT EXISTS "marketing_campaign_metrics_source_idx" ON "marketing_campaign_metrics" ("source");

CREATE TABLE IF NOT EXISTS "marketing_journey_enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid NOT NULL REFERENCES "marketing_journeys"("id") ON DELETE CASCADE,
  "contact_id" uuid REFERENCES "marketing_contacts"("id") ON DELETE SET NULL,
  "contact_external_id" text,
  "status" text NOT NULL DEFAULT 'active',
  "current_step_order" integer NOT NULL DEFAULT 0,
  "entered_at" timestamp with time zone,
  "exited_at" timestamp with time zone,
  "last_activity_at" timestamp with time zone,
  "source" text NOT NULL DEFAULT 'lovable',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "marketing_journey_enrollments_journey_idx" ON "marketing_journey_enrollments" ("journey_id");
CREATE INDEX IF NOT EXISTS "marketing_journey_enrollments_contact_idx" ON "marketing_journey_enrollments" ("contact_id");
CREATE INDEX IF NOT EXISTS "marketing_journey_enrollments_external_contact_idx" ON "marketing_journey_enrollments" ("contact_external_id");
CREATE INDEX IF NOT EXISTS "marketing_journey_enrollments_status_idx" ON "marketing_journey_enrollments" ("status");

CREATE TABLE IF NOT EXISTS "marketing_journey_step_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enrollment_id" uuid NOT NULL REFERENCES "marketing_journey_enrollments"("id") ON DELETE CASCADE,
  "journey_id" uuid NOT NULL REFERENCES "marketing_journeys"("id") ON DELETE CASCADE,
  "step_id" uuid REFERENCES "marketing_journey_steps"("id") ON DELETE SET NULL,
  "step_order" integer NOT NULL DEFAULT 0,
  "event_type" text NOT NULL DEFAULT 'planned',
  "event_at" timestamp with time zone,
  "channel" text,
  "source" text NOT NULL DEFAULT 'lovable',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "marketing_journey_step_events_enrollment_idx" ON "marketing_journey_step_events" ("enrollment_id");
CREATE INDEX IF NOT EXISTS "marketing_journey_step_events_journey_idx" ON "marketing_journey_step_events" ("journey_id");
CREATE INDEX IF NOT EXISTS "marketing_journey_step_events_step_idx" ON "marketing_journey_step_events" ("step_id");
CREATE INDEX IF NOT EXISTS "marketing_journey_step_events_type_idx" ON "marketing_journey_step_events" ("event_type");
CREATE INDEX IF NOT EXISTS "marketing_journey_step_events_at_idx" ON "marketing_journey_step_events" ("event_at");
