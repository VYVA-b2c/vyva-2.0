CREATE TABLE IF NOT EXISTS "marketing_content_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "channel" text NOT NULL,
  "language" text NOT NULL DEFAULT 'en',
  "status" text NOT NULL DEFAULT 'draft',
  "subject" text,
  "body" text NOT NULL DEFAULT '',
  "cta_label" text,
  "cta_url" text,
  "source" text NOT NULL DEFAULT 'vyva',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "audience_type" text NOT NULL DEFAULT 'b2c',
  "objective" text NOT NULL DEFAULT '',
  "schedule_starts_at" timestamp with time zone,
  "schedule_ends_at" timestamp with time zone,
  "timezone" text NOT NULL DEFAULT 'Europe/Madrid',
  "source" text NOT NULL DEFAULT 'vyva',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketing_campaign_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "content_asset_id" uuid REFERENCES "marketing_content_assets"("id") ON DELETE SET NULL,
  "scheduled_at" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'draft',
  "send_capability" text NOT NULL DEFAULT 'locked',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketing_journeys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "audience_type" text NOT NULL DEFAULT 'b2c',
  "objective" text NOT NULL DEFAULT '',
  "source" text NOT NULL DEFAULT 'vyva',
  "lovable_external_id" text UNIQUE,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketing_journey_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "journey_id" uuid NOT NULL REFERENCES "marketing_journeys"("id") ON DELETE CASCADE,
  "step_order" integer NOT NULL DEFAULT 0,
  "channel" text NOT NULL,
  "content_asset_id" uuid REFERENCES "marketing_content_assets"("id") ON DELETE SET NULL,
  "delay_hours" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'draft',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "marketing_journey_steps_order_unique" UNIQUE ("journey_id", "step_order")
);

CREATE TABLE IF NOT EXISTS "marketing_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "audience_type" text NOT NULL DEFAULT 'b2b',
  "profile_id" text REFERENCES "profiles"("id") ON DELETE SET NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "full_name" text NOT NULL DEFAULT '',
  "email" text,
  "phone_number" text,
  "whatsapp_number" text,
  "role_label" text,
  "company_name" text,
  "consent_status" text NOT NULL DEFAULT 'unknown',
  "source" text NOT NULL DEFAULT 'vyva',
  "channel_availability" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "tags" text[] NOT NULL DEFAULT '{}',
  "lovable_external_id" text UNIQUE,
  "last_synced_at" timestamp with time zone,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketing_campaign_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" uuid NOT NULL REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE,
  "contact_id" uuid REFERENCES "marketing_contacts"("id") ON DELETE SET NULL,
  "profile_id" text REFERENCES "profiles"("id") ON DELETE SET NULL,
  "channel" text NOT NULL,
  "recipient" text NOT NULL,
  "status" text NOT NULL DEFAULT 'planned',
  "scheduled_at" timestamp with time zone,
  "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "communication_log_id" uuid REFERENCES "communications_log"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "marketing_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL DEFAULT 'lovable',
  "status" text NOT NULL DEFAULT 'queued',
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cursor" text,
  "summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error" text,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "marketing_content_assets_channel_idx" ON "marketing_content_assets" ("channel");
CREATE INDEX IF NOT EXISTS "marketing_content_assets_status_idx" ON "marketing_content_assets" ("status");
CREATE INDEX IF NOT EXISTS "marketing_content_assets_source_idx" ON "marketing_content_assets" ("source");

CREATE INDEX IF NOT EXISTS "marketing_campaigns_status_idx" ON "marketing_campaigns" ("status");
CREATE INDEX IF NOT EXISTS "marketing_campaigns_audience_idx" ON "marketing_campaigns" ("audience_type");
CREATE INDEX IF NOT EXISTS "marketing_campaigns_schedule_idx" ON "marketing_campaigns" ("schedule_starts_at");
CREATE INDEX IF NOT EXISTS "marketing_campaigns_source_idx" ON "marketing_campaigns" ("source");

CREATE INDEX IF NOT EXISTS "marketing_campaign_channels_campaign_idx" ON "marketing_campaign_channels" ("campaign_id");
CREATE INDEX IF NOT EXISTS "marketing_campaign_channels_channel_idx" ON "marketing_campaign_channels" ("channel");
CREATE INDEX IF NOT EXISTS "marketing_campaign_channels_status_idx" ON "marketing_campaign_channels" ("status");
CREATE INDEX IF NOT EXISTS "marketing_campaign_channels_scheduled_idx" ON "marketing_campaign_channels" ("scheduled_at");

CREATE INDEX IF NOT EXISTS "marketing_journeys_status_idx" ON "marketing_journeys" ("status");
CREATE INDEX IF NOT EXISTS "marketing_journeys_audience_idx" ON "marketing_journeys" ("audience_type");
CREATE INDEX IF NOT EXISTS "marketing_journeys_source_idx" ON "marketing_journeys" ("source");

CREATE INDEX IF NOT EXISTS "marketing_journey_steps_journey_idx" ON "marketing_journey_steps" ("journey_id");
CREATE INDEX IF NOT EXISTS "marketing_journey_steps_channel_idx" ON "marketing_journey_steps" ("channel");

CREATE INDEX IF NOT EXISTS "marketing_contacts_audience_idx" ON "marketing_contacts" ("audience_type");
CREATE INDEX IF NOT EXISTS "marketing_contacts_profile_idx" ON "marketing_contacts" ("profile_id");
CREATE INDEX IF NOT EXISTS "marketing_contacts_organization_idx" ON "marketing_contacts" ("organization_id");
CREATE INDEX IF NOT EXISTS "marketing_contacts_email_idx" ON "marketing_contacts" ("email");
CREATE INDEX IF NOT EXISTS "marketing_contacts_source_idx" ON "marketing_contacts" ("source");

CREATE INDEX IF NOT EXISTS "marketing_campaign_recipients_campaign_idx" ON "marketing_campaign_recipients" ("campaign_id");
CREATE INDEX IF NOT EXISTS "marketing_campaign_recipients_contact_idx" ON "marketing_campaign_recipients" ("contact_id");
CREATE INDEX IF NOT EXISTS "marketing_campaign_recipients_profile_idx" ON "marketing_campaign_recipients" ("profile_id");
CREATE INDEX IF NOT EXISTS "marketing_campaign_recipients_status_idx" ON "marketing_campaign_recipients" ("status");
CREATE INDEX IF NOT EXISTS "marketing_campaign_recipients_communication_idx" ON "marketing_campaign_recipients" ("communication_log_id");

CREATE INDEX IF NOT EXISTS "marketing_sync_runs_provider_idx" ON "marketing_sync_runs" ("provider");
CREATE INDEX IF NOT EXISTS "marketing_sync_runs_status_idx" ON "marketing_sync_runs" ("status");
CREATE INDEX IF NOT EXISTS "marketing_sync_runs_created_idx" ON "marketing_sync_runs" ("created_at");
