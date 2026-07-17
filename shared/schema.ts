// ============================================================
// VYVA — Complete Schema (schema.ts)
// ============================================================
// EXISTING TABLES: preserved exactly as-is (profiles,
// session_state, session_exchanges, agent_difficulty,
// caregiver_alerts, medication_adherence, user_medications)
//
// NEW ADDITIONS:
//   - profiles: onboarding fields added
//   - session_state: channel + context_snapshot added
//   - onboarding_state: feature flags, stage tracking, nudges
//   - consent_log: append-only GDPR audit trail
//   - team_invitations: care team invite lifecycle
//   - user_channel_identity: multi-channel identity map
//   - user_channel_preferences: per-user channel settings
//   - inbound_number_routing: local number → deployment map
//
// NOTE: profiles.id is TEXT (external auth provider ID).
// All foreign keys use TEXT to match. No UUIDs for user references.
// ============================================================

import {
  pgTable, pgEnum, unique, uniqueIndex, primaryKey, index, foreignKey,
  text, integer, boolean, real, timestamp, uuid, jsonb, date, time, numeric, customType
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { TriageScanResult } from "./triageScans.js";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

// ============================================================
// ENUMS
// ============================================================

export const onboardingStageEnum = pgEnum("onboarding_stage", [
  "stage_1_identity",
  "stage_2_preferences",
  "stage_3_health",
  "stage_4_care_team",
  "stage_5_consent",
  "complete",
]);

export const onboardingChannelEnum = pgEnum("onboarding_channel", [
  "voice",
  "web_form",
  "whatsapp",
  "proxy_web",
  "admin_template",
]);

export const channelTypeEnum = pgEnum("channel_type", [
  "voice_app",
  "voice_inbound",
  "voice_outbound",
  "whatsapp_text",
  "whatsapp_voice",
  "whatsapp_outbound",
  "web_form",
  "admin_template",
]);

export const consentActionEnum = pgEnum("consent_action", [
  "granted",
  "denied",
  "revoked",
  "updated",
]);

export const consentScopeEnum = pgEnum("consent_scope", [
  "health_conditions",
  "medications",
  "allergies",
  "gp_details",
  "vital_signs",
  "mood_and_journal",
  "location",
  "conversation_summary",
  "caregiver_full_access",
  "caregiver_health_alerts",
  "caregiver_mood_alerts",
  "caregiver_medication_alerts",
  "caregiver_safety_alerts",
  "family_wellbeing_summary",
  "family_health_detail",
  "doctor_health_reports",
  "doctor_vital_summaries",
  "fall_detection",
  "emergency_location_share",
  "whatsapp_notifications",
  "daily_digest_to_caregiver",
]);

export const teamRoleEnum = pgEnum("team_role", [
  "caregiver",
  "family_member",
  "friend",
  "doctor",
  "gp",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
]);

export const profileMemberRoleEnum = pgEnum("profile_member_role", [
  "elder",
  "caregiver",
  "family",
  "doctor",
  "admin",
]);

export const profileMemberStatusEnum = pgEnum("profile_member_status", [
  "active",
  "pending_elder_consent",
  "revoked",
]);

export const lifecycleEntryPointEnum = pgEnum("lifecycle_entry_point", [
  "form",
  "phone",
  "whatsapp",
  "admin",
]);

export const lifecycleUserTypeEnum = pgEnum("lifecycle_user_type", [
  "elder",
  "family",
  "admin",
]);

export const lifecycleStatusEnum = pgEnum("lifecycle_status", [
  "created",
  "link_sent",
  "consent_pending",
  "active",
  "dropped",
]);

export const accessLinkTypeEnum = pgEnum("access_link_type", [
  "trial",
  "unlimited",
  "organization",
  "custom",
  "caregiver",
]);

export const consentAttemptStatusEnum = pgEnum("consent_attempt_status", [
  "pending",
  "approved",
  "rejected",
  "no_answer",
  "failed",
]);


// ============================================================
// AUTH TABLE: users — email/password accounts
// ============================================================

export const users = pgTable("users", {
  id:                    text("id").primaryKey().default(sql`gen_random_uuid()`),
  email:                 text("email").unique(),
  phone_number:          text("phone_number").unique(),
  password_hash:         text("password_hash").notNull(),
  active_profile_id:     text("active_profile_id"),
  onboarding_intent:     text("onboarding_intent"),
  reset_token:           text("reset_token"),
  reset_token_expires_at: timestamp("reset_token_expires_at", { withTimezone: true }),
  last_seen_at:          timestamp("last_seen_at", { withTimezone: true }),
  created_at:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;


// ============================================================
// AUTH TABLE: password_reset_tokens — one-time reset tokens
// ============================================================

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id:         text("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:      text("token").notNull().unique(),
  used:       boolean("used").notNull().default(false),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;


// ============================================================
// EXISTING TABLE: profiles — extended, all new columns nullable
// ============================================================

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),

  // Existing
  full_name:              text("full_name"),
  date_of_birth:          text("date_of_birth"),
  language:               text("language").notNull().default("es"),
  language_preference:    text("language_preference"),
  deployment:             text("deployment").notNull().default("standard"),
  mem0_user_id:           text("mem0_user_id"),
  stripe_customer_id:     text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  subscription_status:    text("subscription_status").notNull().default("trial"),
  subscription_tier:      text("subscription_tier").notNull().default("free"),
  trial_ends_at:          timestamp("trial_ends_at", { withTimezone: true }),
  account_status:         text("account_status").notNull().default("enabled"),
  role:                   text("role").notNull().default("user"),
  disabled_at:            timestamp("disabled_at", { withTimezone: true }),
  disabled_reason:        text("disabled_reason"),
  disabled_by:            text("disabled_by"),

  // New: identity
  preferred_name:         text("preferred_name"),
  avatar_url:             text("avatar_url"),
  phone_number:           text("phone_number"),
  email:                  text("email"),
  whatsapp_number:        text("whatsapp_number"),
  contact_method:         text("contact_method"),
  channel_reports:        text("channel_reports").default("email"),
  channel_chats:          text("channel_chats").default("in-app"),
  channel_notifications:  text("channel_notifications").default("whatsapp"),
  hybrid_channel_mode:    boolean("hybrid_channel_mode").default(false),
  facebook_url:           text("facebook_url"),
  instagram_url:          text("instagram_url"),
  country_code:           text("country_code").default("ES"),
  timezone:               text("timezone").default("Europe/Madrid"),

  // New: onboarding journey
  current_stage:          onboardingStageEnum("current_stage").default("stage_1_identity"),
  onboarding_channel:     onboardingChannelEnum("onboarding_channel"),
  proxy_initiator_id:     text("proxy_initiator_id"),
  proxy_initiated_at:     timestamp("proxy_initiated_at", { withTimezone: true }),
  elder_confirm_token:    text("elder_confirm_token").unique(),
  elder_confirmed_at:     timestamp("elder_confirmed_at", { withTimezone: true }),
  onboarding_complete:    boolean("onboarding_complete").notNull().default(false),
  stage_1_completed_at:   timestamp("stage_1_completed_at", { withTimezone: true }),
  stage_2_completed_at:   timestamp("stage_2_completed_at", { withTimezone: true }),
  stage_3_completed_at:   timestamp("stage_3_completed_at", { withTimezone: true }),
  stage_4_completed_at:   timestamp("stage_4_completed_at", { withTimezone: true }),
  stage_5_completed_at:   timestamp("stage_5_completed_at", { withTimezone: true }),

  // New: location
  address_line_1:         text("address_line_1"),
  city:                   text("city"),
  region:                 text("region"),
  postcode:               text("postcode"),

  // New: caregiver contact (from settings form)
  caregiver_name:         text("caregiver_name"),
  caregiver_contact:      text("caregiver_contact"),

  // New: health context
  gp_name:                text("gp_name"),
  gp_phone:               text("gp_phone"),
  gp_email:               text("gp_email"),
  gp_address:             text("gp_address"),
  gp_maps_url:            text("gp_maps_url"),
  gp_place_id:            text("gp_place_id"),
  known_allergies:        text("known_allergies").array(),

  // New: social activation
  social_enabled:         boolean("social_enabled").default(false),
  discoverable:           boolean("discoverable").default(false),
  match_opt_in:           boolean("match_opt_in").default(false),
  group_opt_in:           boolean("group_opt_in").default(false),

  // New: consent cache
  data_sharing_consent:   jsonb("data_sharing_consent").default({}),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ created_at: true, updated_at: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export const profileMemberships = pgTable("profile_memberships", {
  id:            uuid("id").primaryKey().defaultRandom(),
  user_id:       text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  profile_id:    text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role:          profileMemberRoleEnum("role").notNull(),
  status:        profileMemberStatusEnum("status").notNull().default("active"),
  relationship:  text("relationship"),
  display_name:  text("display_name"),
  permissions:   jsonb("permissions").notNull().default({}),
  is_primary:    boolean("is_primary").notNull().default(false),
  accepted_at:   timestamp("accepted_at", { withTimezone: true }),
  created_at:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("profile_memberships_user_profile_unique").on(t.user_id, t.profile_id),
]);

export const insertProfileMembershipSchema = createInsertSchema(profileMemberships).omit({ id: true, created_at: true, updated_at: true });
export type InsertProfileMembership = z.infer<typeof insertProfileMembershipSchema>;
export type ProfileMembership = typeof profileMemberships.$inferSelect;

export const caregiverDashboardNotes = pgTable("caregiver_dashboard_notes", {
  id:                uuid("id").primaryKey().defaultRandom(),
  profile_id:        text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  caregiver_user_id: text("caregiver_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  note:              text("note").notNull(),
  concern_tag:       text("concern_tag"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("caregiver_dashboard_notes_profile_created_idx").on(t.profile_id, t.created_at.desc()),
  index("caregiver_dashboard_notes_caregiver_created_idx").on(t.caregiver_user_id, t.created_at.desc()),
]);

export const insertCaregiverDashboardNoteSchema = createInsertSchema(caregiverDashboardNotes).omit({ id: true, created_at: true, updated_at: true });
export type InsertCaregiverDashboardNote = z.infer<typeof insertCaregiverDashboardNoteSchema>;
export type CaregiverDashboardNote = typeof caregiverDashboardNotes.$inferSelect;


// ============================================================
// EXISTING TABLE: session_state — extended with channel fields
// ============================================================

export const sessionState = pgTable("session_state", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  user_id:              text("user_id").notNull(),
  session_id:           text("session_id").notNull().unique(),

  // Existing
  current_agent:        text("current_agent").notNull().default("companion"),
  last_agent:           text("last_agent"),
  last_intent:          text("last_intent"),
  last_activity_at:     timestamp("last_activity_at", { withTimezone: true }),
  turn_count:           integer("turn_count").notNull().default(0),
  next_agent_override:  text("next_agent_override"),

  // New: channel tracking
  channel:              channelTypeEnum("channel").default("voice_app"),
  previous_channel:     channelTypeEnum("previous_channel"),
  channel_switched:     boolean("channel_switched").default(false),

  // New: context handoff snapshot
  // Written at end of session, read at start of next (any channel)
  context_snapshot:     jsonb("context_snapshot").default({}),

  // New: identity resolution
  resolved_by:          text("resolved_by"),
  was_unregistered:     boolean("was_unregistered").default(false),
  onboarding_triggered: boolean("onboarding_triggered").default(false),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionStateSchema = createInsertSchema(sessionState).omit({ id: true, created_at: true, updated_at: true });
export type InsertSessionState = z.infer<typeof insertSessionStateSchema>;
export type SessionState = typeof sessionState.$inferSelect;


// ============================================================
// EXISTING TABLES — unchanged
// ============================================================

export const sessionExchanges = pgTable("session_exchanges", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  session_id:           text("session_id").notNull(),
  user_id:              text("user_id").notNull(),
  speaker:              text("speaker").notNull(),
  message:              text("message").notNull(),
  agent_used:           text("agent_used"),
  intent_classified:    text("intent_classified"),
  intent_confidence:    real("intent_confidence"),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionExchangeSchema = createInsertSchema(sessionExchanges).omit({ id: true, created_at: true });
export type InsertSessionExchange = z.infer<typeof insertSessionExchangeSchema>;
export type SessionExchange = typeof sessionExchanges.$inferSelect;

export const agentDifficulty = pgTable("agent_difficulty", {
  id:                uuid("id").primaryKey().defaultRandom(),
  user_id:           text("user_id").notNull(),
  agent_name:        text("agent_name").notNull(),
  difficulty_level:  integer("difficulty_level").notNull().default(1),
  sessions_at_level: integer("sessions_at_level").notNull().default(0),
  last_score:        real("last_score"),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentDifficultySchema = createInsertSchema(agentDifficulty).omit({ id: true, updated_at: true });
export type InsertAgentDifficulty = z.infer<typeof insertAgentDifficultySchema>;
export type AgentDifficulty = typeof agentDifficulty.$inferSelect;

export const caregiverAlerts = pgTable("caregiver_alerts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  user_id:     text("user_id").notNull(),
  alert_type:  text("alert_type").notNull(),
  severity:    text("severity").notNull(),
  message:     text("message").notNull(),
  sent_to:     text("sent_to").array(),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  resolved_by: text("resolved_by"),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCaregiverAlertSchema = createInsertSchema(caregiverAlerts).omit({ id: true, created_at: true });
export type InsertCaregiverAlert = z.infer<typeof insertCaregiverAlertSchema>;
export type CaregiverAlert = typeof caregiverAlerts.$inferSelect;

export const medicationAdherence = pgTable("medication_adherence", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  user_id:            text("user_id").notNull(),
  medication_name:    text("medication_name").notNull(),
  scheduled_time:     text("scheduled_time").notNull(),
  status:             text("status").notNull(),
  confirmed_by:       text("confirmed_by").notNull().default("user"),
  confirmed_taken_at: timestamp("confirmed_taken_at", { withTimezone: true }),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationAdherenceSchema = createInsertSchema(medicationAdherence).omit({ id: true, created_at: true });
export type InsertMedicationAdherence = z.infer<typeof insertMedicationAdherenceSchema>;
export type MedicationAdherence = typeof medicationAdherence.$inferSelect;

export const checkinSessions = pgTable("checkin_sessions", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull(),
  energy_level:     integer("energy_level"),
  mood:             text("mood"),
  body_areas:       text("body_areas").array().notNull().default([]),
  sleep_quality:    text("sleep_quality"),
  symptoms:         text("symptoms").array().notNull().default([]),
  symptom_details:  text("symptom_details").array().notNull().default([]),
  safety_flags:     text("safety_flags").array().notNull().default([]),
  social_contact:   text("social_contact"),
  feeling_label:    text("feeling_label"),
  overall_state:    text("overall_state"),
  vyva_reading:     text("vyva_reading"),
  right_now:        jsonb("right_now").notNull().default([]),
  today_actions:    jsonb("today_actions").notNull().default([]),
  highlight:        text("highlight"),
  flag_caregiver:   boolean("flag_caregiver").notNull().default(false),
  watch_for:        text("watch_for"),
  language:         text("language").notNull().default("es"),
  completed:        boolean("completed").notNull().default(false),
  abandoned:        boolean("abandoned").notNull().default(false),
  duration_seconds: integer("duration_seconds"),
  started_at:       timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completed_at:     timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCheckinSessionSchema = createInsertSchema(checkinSessions).omit({ id: true, started_at: true, completed_at: true, created_at: true });
export type InsertCheckinSession = z.infer<typeof insertCheckinSessionSchema>;
export type CheckinSession = typeof checkinSessions.$inferSelect;

export const checkinTrendState = pgTable("checkin_trend_state", {
  user_id:                  text("user_id").primaryKey(),
  streak_days:              integer("streak_days").notNull().default(0),
  best_streak:              integer("best_streak").notNull().default(0),
  last_checkin_date:        date("last_checkin_date"),
  total_checkins:           integer("total_checkins").notNull().default(0),
  avg_energy_7d:            numeric("avg_energy_7d"),
  avg_mood_score_7d:        numeric("avg_mood_score_7d"),
  consecutive_low_energy:   integer("consecutive_low_energy").notNull().default(0),
  consecutive_poor_sleep:   integer("consecutive_poor_sleep").notNull().default(0),
  consecutive_no_social:    integer("consecutive_no_social").notNull().default(0),
  consecutive_low_mood:     integer("consecutive_low_mood").notNull().default(0),
  caregiver_flag_active:    boolean("caregiver_flag_active").notNull().default(false),
  flag_reason:              text("flag_reason"),
  flag_triggered_at:        timestamp("flag_triggered_at", { withTimezone: true }),
  updated_at:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCheckinTrendStateSchema = createInsertSchema(checkinTrendState);
export type InsertCheckinTrendState = z.infer<typeof insertCheckinTrendStateSchema>;
export type CheckinTrendState = typeof checkinTrendState.$inferSelect;

export const userMedications = pgTable("user_medications", {
  id:              uuid("id").primaryKey().defaultRandom(),
  user_id:         text("user_id").notNull(),
  medication_name: text("medication_name").notNull(),
  dosage:          text("dosage"),
  frequency:       text("frequency"),
  scheduled_times: text("scheduled_times").array(),
  active:          boolean("active").notNull().default(true),
  added_by:        text("added_by").notNull().default("user"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserMedicationSchema = createInsertSchema(userMedications).omit({ id: true, created_at: true });
export type InsertUserMedication = z.infer<typeof insertUserMedicationSchema>;
export type UserMedication = typeof userMedications.$inferSelect;

export const myMedicines = pgTable("my_medicines", {
  id:                uuid("id").primaryKey().defaultRandom(),
  user_id:           text("user_id").notNull(),
  display_name:      text("display_name").notNull(),
  common_name:       text("common_name"),
  dose_text:         text("dose_text"),
  purpose_text:      text("purpose_text"),
  item_type:         text("item_type").notNull().default("prescription"),
  drug_class_tag:    text("drug_class_tag"),
  photo_url:         text("photo_url"),
  prescriber_name:   text("prescriber_name"),
  refill_due_date:   date("refill_due_date"),
  schedule_times:    text("schedule_times").array(),
  status:            text("status").notNull().default("active"),
  status_changed_at: timestamp("status_changed_at", { withTimezone: true }),
  status_changed_by: text("status_changed_by"),
  added_via:         text("added_via").notNull().default("voice"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_mm_user_status").on(t.user_id, t.status),
  index("idx_mm_refill_due").on(t.user_id, t.refill_due_date),
]);

export const insertMyMedicineSchema = createInsertSchema(myMedicines).omit({ id: true, created_at: true, updated_at: true });
export type InsertMyMedicine = z.infer<typeof insertMyMedicineSchema>;
export type MyMedicine = typeof myMedicines.$inferSelect;

export const myMedicinesChangeLog = pgTable("my_medicines_change_log", {
  id:             uuid("id").primaryKey().defaultRandom(),
  user_id:        text("user_id").notNull(),
  medicine_id:    uuid("medicine_id").references(() => myMedicines.id, { onDelete: "set null" }),
  change_type:    text("change_type").notNull(),
  previous_value: jsonb("previous_value"),
  new_value:      jsonb("new_value"),
  source:         text("source").notNull().default("voice_update"),
  changed_at:     timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_mcl_user_time").on(t.user_id, t.changed_at.desc()),
]);

export const insertMyMedicineChangeLogSchema = createInsertSchema(myMedicinesChangeLog).omit({ id: true, changed_at: true });
export type InsertMyMedicineChangeLog = z.infer<typeof insertMyMedicineChangeLogSchema>;
export type MyMedicineChangeLog = typeof myMedicinesChangeLog.$inferSelect;

export const interactionFlagRules = pgTable("interaction_flag_rules", {
  id:              uuid("id").primaryKey().defaultRandom(),
  class_a:         text("class_a").notNull(),
  class_b:         text("class_b").notNull(),
  flag_message_es: text("flag_message_es").notNull(),
  flag_message_de: text("flag_message_de").notNull(),
  flag_message_en: text("flag_message_en").notNull(),
  severity_tier:   text("severity_tier").notNull().default("worth_asking"),
  is_active:       boolean("is_active").notNull().default(false),
  reviewed_by:     text("reviewed_by"),
  reviewed_at:     timestamp("reviewed_at", { withTimezone: true }),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_ifr_classes").on(t.class_a, t.class_b),
]);

export const insertInteractionFlagRuleSchema = createInsertSchema(interactionFlagRules).omit({ id: true, created_at: true });
export type InsertInteractionFlagRule = z.infer<typeof insertInteractionFlagRuleSchema>;
export type InteractionFlagRule = typeof interactionFlagRules.$inferSelect;

export const interactionFlagDismissals = pgTable("interaction_flag_dismissals", {
  id:            uuid("id").primaryKey().defaultRandom(),
  user_id:       text("user_id").notNull(),
  rule_id:       uuid("rule_id").notNull().references(() => interactionFlagRules.id, { onDelete: "cascade" }),
  medicine_pair: jsonb("medicine_pair").notNull(),
  dismissed_at:  timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
  reason:        text("reason"),
}, (t) => [
  index("interaction_flag_dismissals_user_rule_idx").on(t.user_id, t.rule_id),
]);

export const insertInteractionFlagDismissalSchema = createInsertSchema(interactionFlagDismissals).omit({ id: true, dismissed_at: true });
export type InsertInteractionFlagDismissal = z.infer<typeof insertInteractionFlagDismissalSchema>;
export type InteractionFlagDismissal = typeof interactionFlagDismissals.$inferSelect;

export const medicationSafetySignals = pgTable("medication_safety_signals", {
  id:              uuid("id").primaryKey().defaultRandom(),
  user_id:         text("user_id").notNull(),
  signal_type:     text("signal_type").notNull(),
  severity:        text("severity").notNull().default("watch"),
  title:           text("title").notNull(),
  summary:         text("summary").notNull(),
  medication_name: text("medication_name"),
  source:          text("source").notNull().default("meds"),
  evidence:        jsonb("evidence").notNull().default([]),
  status:          text("status").notNull().default("open"),
  related_case_id: uuid("related_case_id"),
  detected_at:     timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("medication_safety_signals_user_time_idx").on(t.user_id, t.detected_at.desc()),
  index("medication_safety_signals_user_status_idx").on(t.user_id, t.status),
]);

export const insertMedicationSafetySignalSchema = createInsertSchema(medicationSafetySignals).omit({ id: true, created_at: true, detected_at: true });
export type InsertMedicationSafetySignal = z.infer<typeof insertMedicationSafetySignalSchema>;
export type MedicationSafetySignal = typeof medicationSafetySignals.$inferSelect;

export const medicationSafetyCases = pgTable("medication_safety_cases", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  user_id:              text("user_id").notNull(),
  status:               text("status").notNull().default("draft"),
  severity:             text("severity").notNull().default("watch"),
  signal_type:          text("signal_type").notNull().default("possible_side_effect"),
  suspected_medication: text("suspected_medication"),
  reaction:             text("reaction"),
  reaction_started_at:  timestamp("reaction_started_at", { withTimezone: true }),
  seriousness_flags:    text("seriousness_flags").array().notNull().default([]),
  outcome:              text("outcome"),
  action_taken:         text("action_taken"),
  reporter_name:        text("reporter_name"),
  reporter_contact:     text("reporter_contact"),
  reporter_role:        text("reporter_role").notNull().default("patient_or_caregiver"),
  narrative:            text("narrative"),
  evidence:             jsonb("evidence").notNull().default([]),
  missing_fields:       text("missing_fields").array().notNull().default([]),
  export_ready:         boolean("export_ready").notNull().default(false),
  latest_export_json:   jsonb("latest_export_json"),
  shared_at:            timestamp("shared_at", { withTimezone: true }),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("medication_safety_cases_user_status_idx").on(t.user_id, t.status),
  index("medication_safety_cases_user_type_idx").on(t.user_id, t.signal_type, t.created_at.desc()),
]);

export const insertMedicationSafetyCaseSchema = createInsertSchema(medicationSafetyCases).omit({ id: true, created_at: true, updated_at: true });
export type InsertMedicationSafetyCase = z.infer<typeof insertMedicationSafetyCaseSchema>;
export type MedicationSafetyCase = typeof medicationSafetyCases.$inferSelect;

export const medicationSafetyCaseEvents = pgTable("medication_safety_case_events", {
  id:         uuid("id").primaryKey().defaultRandom(),
  case_id:    uuid("case_id").notNull(),
  user_id:    text("user_id").notNull(),
  event_type: text("event_type").notNull(),
  actor_id:   text("actor_id"),
  payload:    jsonb("payload").notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("medication_safety_case_events_case_time_idx").on(t.case_id, t.created_at.desc()),
  index("medication_safety_case_events_user_time_idx").on(t.user_id, t.created_at.desc()),
]);

export const insertMedicationSafetyCaseEventSchema = createInsertSchema(medicationSafetyCaseEvents).omit({ id: true, created_at: true });
export type InsertMedicationSafetyCaseEvent = z.infer<typeof insertMedicationSafetyCaseEventSchema>;
export type MedicationSafetyCaseEvent = typeof medicationSafetyCaseEvents.$inferSelect;

export const userHealthConditions = pgTable("user_health_conditions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    uuid("user_id").notNull(),
  condition:  text("condition").notNull(),
  is_active:  boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserHealthConditionSchema = createInsertSchema(userHealthConditions).omit({ id: true, created_at: true });
export type InsertUserHealthCondition = z.infer<typeof insertUserHealthConditionSchema>;
export type UserHealthCondition = typeof userHealthConditions.$inferSelect;


// ============================================================
// NEW TABLE: activity_logs — persisted movement entries
// ============================================================

export const activityLogs = pgTable("activity_logs", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull(),
  activity_type:    text("activity_type").notNull(),
  duration_minutes: integer("duration_minutes").notNull(),
  calories:         integer("calories").notNull().default(0),
  logged_at:        timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, logged_at: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;


// ============================================================
// NEW TABLE: daily_step_logs — manually logged daily step counts
// ============================================================

export const dailyStepLogs = pgTable("daily_step_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull(),
  log_date:   text("log_date").notNull(),
  steps:      integer("steps").notNull().default(0),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("daily_step_logs_user_date_unique").on(t.user_id, t.log_date),
]);

export const insertDailyStepLogSchema = createInsertSchema(dailyStepLogs).omit({ id: true, updated_at: true });
export type InsertDailyStepLog = z.infer<typeof insertDailyStepLogSchema>;
export type DailyStepLog = typeof dailyStepLogs.$inferSelect;


// ============================================================
// NEW TABLE: onboarding_state
// ============================================================

export const onboardingState = pgTable("onboarding_state", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull().unique(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // Stage 1 — minimum to start
  has_preferred_name:     boolean("has_preferred_name").notNull().default(false),
  has_phone_number:       boolean("has_phone_number").notNull().default(false),
  has_language:           boolean("has_language").notNull().default(false),

  // Stage 2 — collected conversationally
  has_date_of_birth:      boolean("has_date_of_birth").notNull().default(false),
  has_emergency_address:  boolean("has_emergency_address").notNull().default(false),
  has_checkin_preference: boolean("has_checkin_preference").notNull().default(false),
  has_location:           boolean("has_location").notNull().default(false),

  // Stage 3 — health profile, elder-led
  has_health_conditions:  boolean("has_health_conditions").notNull().default(false),
  has_medications:        boolean("has_medications").notNull().default(false),
  has_allergies:          boolean("has_allergies").notNull().default(false),
  has_gp_details:         boolean("has_gp_details").notNull().default(false),

  // Stage 4 — care team
  has_caregiver:          boolean("has_caregiver").notNull().default(false),
  has_family_member:      boolean("has_family_member").notNull().default(false),
  has_doctor:             boolean("has_doctor").notNull().default(false),

  // Features unlocked — updated by API when flags change
  feature_companionship:    boolean("feature_companionship").notNull().default(true),
  feature_brain_training:   boolean("feature_brain_training").notNull().default(true),
  feature_daily_checkin:    boolean("feature_daily_checkin").notNull().default(true),
  feature_medication_mgmt:  boolean("feature_medication_mgmt").notNull().default(false),
  feature_vital_scan:       boolean("feature_vital_scan").notNull().default(false),
  feature_health_research:  boolean("feature_health_research").notNull().default(false),
  feature_nutrition_coach:  boolean("feature_nutrition_coach").notNull().default(false),
  feature_safety_agent:     boolean("feature_safety_agent").notNull().default(false),
  feature_fall_detection:   boolean("feature_fall_detection").notNull().default(false),
  feature_concierge:        boolean("feature_concierge").notNull().default(false),
  feature_caregiver_alerts: boolean("feature_caregiver_alerts").notNull().default(false),

  // Nudge cooldowns — prevent repeating the same suggestion
  nudge_dob_sent_at:         timestamp("nudge_dob_sent_at", { withTimezone: true }),
  nudge_address_sent_at:     timestamp("nudge_address_sent_at", { withTimezone: true }),
  nudge_medications_sent_at: timestamp("nudge_medications_sent_at", { withTimezone: true }),
  nudge_health_sent_at:      timestamp("nudge_health_sent_at", { withTimezone: true }),
  nudge_caregiver_sent_at:   timestamp("nudge_caregiver_sent_at", { withTimezone: true }),

  // How each stage was completed
  stage_1_channel: onboardingChannelEnum("stage_1_channel"),
  stage_2_channel: onboardingChannelEnum("stage_2_channel"),
  stage_3_channel: onboardingChannelEnum("stage_3_channel"),
  stage_4_channel: onboardingChannelEnum("stage_4_channel"),
  stage_5_channel: onboardingChannelEnum("stage_5_channel"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOnboardingStateSchema = createInsertSchema(onboardingState).omit({ id: true, created_at: true, updated_at: true });
export type InsertOnboardingState = z.infer<typeof insertOnboardingStateSchema>;
export type OnboardingState = typeof onboardingState.$inferSelect;


// ============================================================
// NEW TABLE: consent_log — append-only GDPR audit trail
// ============================================================

export const consentLog = pgTable("consent_log", {
  id:         uuid("id").primaryKey().defaultRandom(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  user_id:        text("user_id").notNull(),
  scope:          consentScopeEnum("scope").notNull(),
  action:         consentActionEnum("action").notNull(),
  target_user_id: text("target_user_id"),
  target_name:    text("target_name"),
  target_role:    teamRoleEnum("target_role"),

  channel:             onboardingChannelEnum("channel").notNull(),
  confirmed_by_elder:  boolean("confirmed_by_elder").notNull().default(true),
  confirmation_method: text("confirmation_method"),
});

export const insertConsentLogSchema = createInsertSchema(consentLog).omit({ id: true, created_at: true });
export type InsertConsentLog = z.infer<typeof insertConsentLogSchema>;
export type ConsentLog = typeof consentLog.$inferSelect;


// ============================================================
// NEW TABLE: team_invitations
// ============================================================

export const teamInvitations = pgTable("team_invitations", {
  id:         uuid("id").primaryKey().defaultRandom(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  senior_id:         text("senior_id").notNull(),
  invitee_name:      text("invitee_name").notNull(),
  invitee_phone:     text("invitee_phone"),
  invitee_email:     text("invitee_email"),
  invitee_whatsapp:  text("invitee_whatsapp"),
  role:              teamRoleEnum("role").notNull(),
  relationship:      text("relationship"),

  invite_token:   text("invite_token").notNull().unique(),
  invite_channel: channelTypeEnum("invite_channel").notNull().default("whatsapp_outbound"),
  status:         invitationStatusEnum("status").notNull().default("pending"),
  expires_at:     timestamp("expires_at", { withTimezone: true }).notNull(),

  accepted_at:      timestamp("accepted_at", { withTimezone: true }),
  accepted_user_id: text("accepted_user_id"),
  revoked_at:       timestamp("revoked_at", { withTimezone: true }),
  revoked_reason:   text("revoked_reason"),

  can_receive_daily_digest:      boolean("can_receive_daily_digest").notNull().default(true),
  can_receive_safety_alerts:     boolean("can_receive_safety_alerts").notNull().default(true),
  can_receive_health_alerts:     boolean("can_receive_health_alerts").notNull().default(false),
  can_receive_mood_alerts:       boolean("can_receive_mood_alerts").notNull().default(false),
  can_receive_medication_alerts: boolean("can_receive_medication_alerts").notNull().default(false),
  can_view_dashboard:            boolean("can_view_dashboard").notNull().default(false),
  can_view_health_reports:       boolean("can_view_health_reports").notNull().default(false),
  can_view_vital_signs:          boolean("can_view_vital_signs").notNull().default(false),
  can_view_journal_summaries:    boolean("can_view_journal_summaries").notNull().default(false),
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({ id: true, created_at: true, updated_at: true });
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type TeamInvitation = typeof teamInvitations.$inferSelect;


// ============================================================
// NEW TABLE: user_channel_identity
// ============================================================

export const userChannelIdentity = pgTable("user_channel_identity", {
  id:         uuid("id").primaryKey().defaultRandom(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  user_id:     text("user_id").notNull(),
  channel:     channelTypeEnum("channel").notNull(),
  identifier:  text("identifier").notNull(),
  label:       text("label"),

  is_primary:          boolean("is_primary").notNull().default(false),
  is_verified:         boolean("is_verified").notNull().default(false),
  verified_at:         timestamp("verified_at", { withTimezone: true }),
  verification_method: text("verification_method"),

  is_proxy:       boolean("is_proxy").notNull().default(false),
  proxy_owner_id: text("proxy_owner_id"),
});

export const insertUserChannelIdentitySchema = createInsertSchema(userChannelIdentity).omit({ id: true, created_at: true });
export type InsertUserChannelIdentity = z.infer<typeof insertUserChannelIdentitySchema>;
export type UserChannelIdentity = typeof userChannelIdentity.$inferSelect;


// ============================================================
// NEW TABLE: user_channel_preferences
// ============================================================

export const userChannelPreferences = pgTable("user_channel_preferences", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull().unique(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  preferred_checkin_channel:      channelTypeEnum("preferred_checkin_channel").default("voice_outbound"),
  preferred_conversation_channel: channelTypeEnum("preferred_conversation_channel").default("voice_app"),
  preferred_reminder_channel:     channelTypeEnum("preferred_reminder_channel").default("whatsapp_outbound"),
  preferred_alert_channel:        channelTypeEnum("preferred_alert_channel").default("whatsapp_outbound"),

  voice_available_from:     text("voice_available_from").default("08:00"),
  voice_available_until:    text("voice_available_until").default("21:00"),
  whatsapp_available_from:  text("whatsapp_available_from").default("07:00"),
  whatsapp_available_until: text("whatsapp_available_until").default("22:00"),

  fallback_chain:                text("fallback_chain").array().default(["whatsapp_outbound", "voice_outbound"]),
  max_outbound_calls_per_day:    integer("max_outbound_calls_per_day").default(1),
  max_whatsapp_messages_per_day: integer("max_whatsapp_messages_per_day").default(5),
});

export const insertUserChannelPreferencesSchema = createInsertSchema(userChannelPreferences).omit({ id: true, updated_at: true });
export type InsertUserChannelPreferences = z.infer<typeof insertUserChannelPreferencesSchema>;
export type UserChannelPreferences = typeof userChannelPreferences.$inferSelect;


// ============================================================
// NEW TABLE: inbound_number_routing
// ============================================================

export const inboundNumberRouting = pgTable("inbound_number_routing", {
  id:           uuid("id").primaryKey().defaultRandom(),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  number:               text("number").notNull().unique(),
  number_label:         text("number_label"),
  channel:              channelTypeEnum("channel").notNull(),
  deployment_id:        text("deployment_id").notNull(),
  language:             text("language").notNull(),
  elevenlabs_agent_id:  text("elevenlabs_agent_id"),
  unregistered_flow:    text("unregistered_flow").notNull().default("onboard"),
  warm_hold_message:    text("warm_hold_message"),
  onboarding_link:      text("onboarding_link"),
  is_active:            boolean("is_active").notNull().default(true),
});

export const insertInboundNumberRoutingSchema = createInsertSchema(inboundNumberRouting).omit({ id: true, created_at: true });
export type InsertInboundNumberRouting = z.infer<typeof insertInboundNumberRoutingSchema>;
export type InboundNumberRouting = typeof inboundNumberRouting.$inferSelect;


// ============================================================
// NEW TABLE: subscription_plans
// ============================================================

export const subscriptionPlans = pgTable("subscription_plans", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  plan_id:             text("plan_id").notNull().unique(),
  name:                text("name").notNull(),
  description:         text("description"),
  price_eur:           integer("price_eur").notNull().default(0),
  price_gbp:           integer("price_gbp").notNull().default(0),
  billing_interval:    text("billing_interval").default("month"),
  trial_days:          integer("trial_days").default(14),
  stripe_price_id_eur: text("stripe_price_id_eur"),
  stripe_price_id_gbp: text("stripe_price_id_gbp"),
  features:            text("features").array(),
  is_active:           boolean("is_active").notNull().default(true),
  is_public:           boolean("is_public").notNull().default(true),
  sort_order:          integer("sort_order").default(0),
});
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, created_at: true, updated_at: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;


// ============================================================
// NEW TABLE: billing_events
// ============================================================

export const billingEvents = pgTable("billing_events", {
  id:                uuid("id").primaryKey().defaultRandom(),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  user_id:           text("user_id").notNull(),
  stripe_event_id:   text("stripe_event_id").unique(),
  stripe_invoice_id: text("stripe_invoice_id"),
  stripe_charge_id:  text("stripe_charge_id"),
  event_type:        text("event_type").notNull(),
  amount_cents:      integer("amount_cents"),
  currency:          text("currency"),
  plan_id:           text("plan_id"),
  status:            text("status").notNull(),
  failure_reason:    text("failure_reason"),
  stripe_payload:    jsonb("stripe_payload").default({}),
});
export const insertBillingEventSchema = createInsertSchema(billingEvents).omit({ id: true, created_at: true });
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;


// ============================================================
// NEW TABLE: stripe_webhooks
// ============================================================

export const stripeWebhooks = pgTable("stripe_webhooks", {
  id:              uuid("id").primaryKey().defaultRandom(),
  received_at:     timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processed_at:    timestamp("processed_at", { withTimezone: true }),
  stripe_event_id: text("stripe_event_id").notNull().unique(),
  event_type:      text("event_type").notNull(),
  status:          text("status").notNull().default("pending"),
  error:           text("error"),
  payload:         jsonb("payload").notNull().default({}),
});
export const insertStripeWebhookSchema = createInsertSchema(stripeWebhooks).omit({ id: true, received_at: true });
export type InsertStripeWebhook = z.infer<typeof insertStripeWebhookSchema>;
export type StripeWebhook = typeof stripeWebhooks.$inferSelect;


// ============================================================
// NEW TABLE: scam_checks — AI scam document/photo analysis
// ============================================================

export const scamChecks = pgTable("scam_checks", {
  id:           uuid("id").primaryKey().defaultRandom(),
  user_id:      text("user_id").notNull(),
  file_type:    text("file_type").notNull().default("image"),
  risk_level:   text("risk_level").notNull(),
  result_title: text("result_title").notNull(),
  explanation:  text("explanation").notNull(),
  steps:        text("steps").array().notNull().default([]),
  image_data:   text("image_data"),
  checked_at:   timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScamCheckSchema = createInsertSchema(scamChecks).omit({ id: true, checked_at: true });
export type InsertScamCheck = z.infer<typeof insertScamCheckSchema>;
export type ScamCheck = typeof scamChecks.$inferSelect;


// ============================================================
// NEW TABLE: home_scans — AI safety hazard analysis of rooms
// ============================================================

export const homeScans = pgTable("home_scans", {
  id:           uuid("id").primaryKey().defaultRandom(),
  user_id:      text("user_id").notNull(),
  risk_level:   text("risk_level").notNull(),
  result_title: text("result_title").notNull(),
  hazards:      text("hazards").array().notNull().default([]),
  advice:       text("advice").notNull(),
  image_data:   text("image_data"),
  scanned_at:   timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHomeScanSchema = createInsertSchema(homeScans).omit({ id: true, scanned_at: true });
export type InsertHomeScan = z.infer<typeof insertHomeScanSchema>;
export type HomeScan = typeof homeScans.$inferSelect;


// ============================================================
// NEW TABLE: wound_scans
// ============================================================

export const woundScans = pgTable("wound_scans", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull(),
  severity:   text("severity").notNull(),
  result_title: text("result_title").notNull(),
  advice:     text("advice").notNull(),
  image_data: text("image_data"),
  scanned_at: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWoundScanSchema = createInsertSchema(woundScans).omit({ id: true, scanned_at: true });
export type InsertWoundScan = z.infer<typeof insertWoundScanSchema>;
export type WoundScan = typeof woundScans.$inferSelect;


// companion_profiles — selectable interests, hobbies, values, preferred activities for matching
export const companionProfiles = pgTable("companion_profiles", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  user_id:             text("user_id").notNull().unique().references(() => profiles.id, { onDelete: "cascade" }),
  interests:           text("interests").array().notNull().default([]),
  hobbies:             text("hobbies").array().notNull().default([]),
  values:              text("values").array().notNull().default([]),
  preferred_activities: text("preferred_activities").array().notNull().default([]),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanionProfileSchema = createInsertSchema(companionProfiles).omit({ id: true, created_at: true, updated_at: true });
export type InsertCompanionProfile = z.infer<typeof insertCompanionProfileSchema>;
export type CompanionProfile = typeof companionProfiles.$inferSelect;


// ============================================================
// NEW TABLE: companion_connections — connection requests
// ============================================================

export const companionConnections = pgTable("companion_connections", {
  id:                uuid("id").primaryKey().defaultRandom(),
  requester_id:      text("requester_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  recipient_id:      text("recipient_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status:            text("status").notNull().default("pending"),
  suggested_activity: text("suggested_activity").notNull().default(""),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanionConnectionSchema = createInsertSchema(companionConnections).omit({ id: true, created_at: true, updated_at: true });
export type InsertCompanionConnection = z.infer<typeof insertCompanionConnectionSchema>;
export type CompanionConnection = typeof companionConnections.$inferSelect;


// ============================================================
// NEW TABLES: social_rooms, sessions, visits, interests, connections
// ============================================================

export const socialRooms = pgTable("social_rooms", {
  id:              uuid("id").primaryKey().defaultRandom(),
  slug:            text("slug").notNull().unique(),
  name_es:         text("name_es").notNull(),
  name_de:         text("name_de").notNull(),
  name_en:         text("name_en").notNull(),
  category:        text("category").notNull(),
  agent_slug:      text("agent_slug").notNull(),
  agent_full_name: text("agent_full_name").notNull(),
  agent_colour:    text("agent_colour").notNull(),
  agent_cred_es:   text("agent_cred_es").notNull(),
  agent_cred_de:   text("agent_cred_de").notNull(),
  agent_cred_en:   text("agent_cred_en").notNull(),
  cta_label_es:    text("cta_label_es").notNull(),
  cta_label_de:    text("cta_label_de").notNull(),
  cta_label_en:    text("cta_label_en").notNull(),
  topic_tags:      text("topic_tags").array().notNull().default([]),
  time_slots:      text("time_slots").array().notNull().default([]),
  is_active:       boolean("is_active").notNull().default(true),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialRoomSchema = createInsertSchema(socialRooms).omit({ id: true, created_at: true });
export type InsertSocialRoom = z.infer<typeof insertSocialRoomSchema>;
export type SocialRoom = typeof socialRooms.$inferSelect;

export const socialRoomSessions = pgTable("social_room_sessions", {
  id:                uuid("id").primaryKey().defaultRandom(),
  room_id:           uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  session_date:      text("session_date").notNull(),
  topic_es:          text("topic_es").notNull(),
  topic_de:          text("topic_de").notNull(),
  topic_en:          text("topic_en").notNull(),
  opener_es:         text("opener_es").notNull(),
  opener_de:         text("opener_de").notNull(),
  opener_en:         text("opener_en").notNull(),
  activity_type:     text("activity_type").notNull(),
  participant_count: integer("participant_count").notNull().default(0),
  is_live:           boolean("is_live").notNull().default(true),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_sessions_room_date_unique").on(t.room_id, t.session_date),
]);

export const insertSocialRoomSessionSchema = createInsertSchema(socialRoomSessions).omit({ id: true, created_at: true });
export type InsertSocialRoomSession = z.infer<typeof insertSocialRoomSessionSchema>;
export type SocialRoomSession = typeof socialRoomSessions.$inferSelect;

export const socialRoomVisits = pgTable("social_room_visits", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  room_id:          uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  session_id:       uuid("session_id").notNull().references(() => socialRoomSessions.id, { onDelete: "cascade" }),
  entered_at:       timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  last_active_at:   timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  messages_sent:    integer("messages_sent").notNull().default(0),
  duration_seconds: integer("duration_seconds"),
  completed:        boolean("completed").notNull().default(false),
});

export const insertSocialRoomVisitSchema = createInsertSchema(socialRoomVisits).omit({ id: true, entered_at: true, last_active_at: true });
export type InsertSocialRoomVisit = z.infer<typeof insertSocialRoomVisitSchema>;
export type SocialRoomVisit = typeof socialRoomVisits.$inferSelect;

export const socialUserInterests = pgTable("social_user_interests", {
  user_id:          text("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  interest_tags:    text("interest_tags").array().notNull().default([]),
  preferred_times:  text("preferred_times").array().notNull().default([]),
  activity_level:   text("activity_level").notNull().default("moderate"),
  room_visit_counts: jsonb("room_visit_counts").notNull().default({}),
  last_rooms:       text("last_rooms").array().notNull().default([]),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialUserInterestsSchema = createInsertSchema(socialUserInterests).omit({ updated_at: true });
export type InsertSocialUserInterests = z.infer<typeof insertSocialUserInterestsSchema>;
export type SocialUserInterests = typeof socialUserInterests.$inferSelect;

export const advisorAgents = pgTable("advisor_agents", {
  slug:         text("slug").primaryKey(),
  icon_key:     text("icon_key").notNull(),
  chip_bg:      text("chip_bg").notNull(),
  icon_color:   text("icon_color").notNull(),
  sort_order:   integer("sort_order").notNull().default(0),
  is_enabled:   boolean("is_enabled").notNull().default(true),
  agent_config: jsonb("agent_config").$type<Record<string, unknown>>().notNull().default({}),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("advisor_agents_enabled_order_idx").on(t.is_enabled, t.sort_order),
]);

export const insertAdvisorAgentSchema = createInsertSchema(advisorAgents).omit({ created_at: true, updated_at: true });
export type InsertAdvisorAgent = z.infer<typeof insertAdvisorAgentSchema>;
export type AdvisorAgentRow = typeof advisorAgents.$inferSelect;

export const advisorSessions = pgTable("advisor_sessions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  user_id:         text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  agent_slug:      text("agent_slug").notNull().references(() => advisorAgents.slug, { onDelete: "restrict" }),
  status:          text("status").notNull().default("active"),
  started_at:      timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  last_message_at: timestamp("last_message_at", { withTimezone: true }),
  ended_at:        timestamp("ended_at", { withTimezone: true }),
  message_count:   integer("message_count").notNull().default(0),
}, (t) => [
  index("advisor_sessions_user_agent_last_idx").on(t.user_id, t.agent_slug, t.last_message_at.desc()),
  index("advisor_sessions_user_status_idx").on(t.user_id, t.status),
]);

export const insertAdvisorSessionSchema = createInsertSchema(advisorSessions).omit({ id: true, started_at: true });
export type InsertAdvisorSession = z.infer<typeof insertAdvisorSessionSchema>;
export type AdvisorSessionRow = typeof advisorSessions.$inferSelect;

export const advisorMessages = pgTable("advisor_messages", {
  id:         uuid("id").primaryKey().defaultRandom(),
  session_id: uuid("session_id").notNull().references(() => advisorSessions.id, { onDelete: "cascade" }),
  user_id:    text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  agent_slug: text("agent_slug").notNull().references(() => advisorAgents.slug, { onDelete: "restrict" }),
  role:       text("role").notNull(),
  source:     text("source").notNull().default("text"),
  text:       text("text").notNull(),
  metadata:   jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("advisor_messages_session_created_idx").on(t.session_id, t.created_at),
  index("advisor_messages_user_agent_created_idx").on(t.user_id, t.agent_slug, t.created_at.desc()),
]);

export const insertAdvisorMessageSchema = createInsertSchema(advisorMessages).omit({ id: true, created_at: true });
export type InsertAdvisorMessage = z.infer<typeof insertAdvisorMessageSchema>;
export type AdvisorMessageRow = typeof advisorMessages.$inferSelect;

export const advisorUserAgentState = pgTable("advisor_user_agent_state", {
  user_id:          text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  agent_slug:       text("agent_slug").notNull().references(() => advisorAgents.slug, { onDelete: "restrict" }),
  session_count:    integer("session_count").notNull().default(0),
  first_started_at: timestamp("first_started_at", { withTimezone: true }),
  last_session_id:  uuid("last_session_id"),
  last_message_at:  timestamp("last_message_at", { withTimezone: true }),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.user_id, t.agent_slug], name: "advisor_user_agent_state_pk" }),
  index("advisor_user_agent_state_user_last_idx").on(t.user_id, t.last_message_at.desc()),
]);

export const insertAdvisorUserAgentStateSchema = createInsertSchema(advisorUserAgentState).omit({ updated_at: true });
export type InsertAdvisorUserAgentState = z.infer<typeof insertAdvisorUserAgentStateSchema>;
export type AdvisorUserAgentStateRow = typeof advisorUserAgentState.$inferSelect;

export const socialConnections = pgTable("social_connections", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id_a:        text("user_id_a").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  user_id_b:        text("user_id_b").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  matched_via_room: text("matched_via_room").notNull(),
  matched_at:       timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
  status:           text("status").notNull().default("pending"),
}, (t) => [
  unique("social_connections_pair_unique").on(t.user_id_a, t.user_id_b),
]);

export const insertSocialConnectionSchema = createInsertSchema(socialConnections).omit({ id: true, matched_at: true });
export type InsertSocialConnection = z.infer<typeof insertSocialConnectionSchema>;
export type SocialConnection = typeof socialConnections.$inferSelect;

export const socialRoomMusicThreads = pgTable("social_room_music_threads", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  room_id:             uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  creator_id:          text("creator_id").notNull(),
  matched_member_id:   text("matched_member_id").notNull(),
  matched_member_name: text("matched_member_name").notNull(),
  song_text:           text("song_text").notNull(),
  matched_topic:       text("matched_topic").notNull().default(""),
  status:              text("status").notNull().default("active"),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("social_room_music_threads_active_unique")
    .on(t.room_id, t.creator_id, t.matched_member_id)
    .where(sql`${t.status} = 'active'`),
  index("social_room_music_threads_room_status_idx").on(t.room_id, t.status, t.updated_at),
]);

export const insertSocialRoomMusicThreadSchema = createInsertSchema(socialRoomMusicThreads).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomMusicThread = z.infer<typeof insertSocialRoomMusicThreadSchema>;
export type SocialRoomMusicThread = typeof socialRoomMusicThreads.$inferSelect;

export const socialRoomMusicThreadEntries = pgTable("social_room_music_thread_entries", {
  id:          uuid("id").primaryKey().defaultRandom(),
  thread_id:   uuid("thread_id").notNull().references(() => socialRoomMusicThreads.id, { onDelete: "cascade" }),
  author_id:   text("author_id").notNull(),
  author_name: text("author_name").notNull(),
  kind:        text("kind").notNull().default("memory"),
  body:        text("body").notNull().default(""),
  status:      text("status").notNull().default("active"),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("social_room_music_thread_entries_thread_status_idx").on(t.thread_id, t.status, t.created_at),
]);

export const insertSocialRoomMusicThreadEntrySchema = createInsertSchema(socialRoomMusicThreadEntries).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomMusicThreadEntry = z.infer<typeof insertSocialRoomMusicThreadEntrySchema>;
export type SocialRoomMusicThreadEntry = typeof socialRoomMusicThreadEntries.$inferSelect;

export const socialRoomMusicCircleItems = pgTable("social_room_music_circle_items", {
  id:          uuid("id").primaryKey().defaultRandom(),
  room_id:     uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  day_key:     text("day_key").notNull(),
  author_id:   text("author_id").notNull(),
  author_name: text("author_name").notNull(),
  song_text:   text("song_text").notNull(),
  cause_id:    text("cause_id").notNull().default("bridge"),
  memory_text: text("memory_text").notNull().default(""),
  status:      text("status").notNull().default("active"),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("social_room_music_circle_items_room_day_status_idx").on(t.room_id, t.day_key, t.status, t.updated_at),
]);

export const insertSocialRoomMusicCircleItemSchema = createInsertSchema(socialRoomMusicCircleItems).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomMusicCircleItem = z.infer<typeof insertSocialRoomMusicCircleItemSchema>;
export type SocialRoomMusicCircleItem = typeof socialRoomMusicCircleItems.$inferSelect;

export const socialRoomMusicItemReactions = pgTable("social_room_music_item_reactions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  item_id:    uuid("item_id").notNull().references(() => socialRoomMusicCircleItems.id, { onDelete: "cascade" }),
  user_id:    text("user_id").notNull(),
  kind:       text("kind").notNull().default("heart"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_music_item_reactions_item_user_kind_unique").on(t.item_id, t.user_id, t.kind),
  index("social_room_music_item_reactions_item_kind_idx").on(t.item_id, t.kind),
]);

export const insertSocialRoomMusicItemReactionSchema = createInsertSchema(socialRoomMusicItemReactions).omit({ id: true, created_at: true });
export type InsertSocialRoomMusicItemReaction = z.infer<typeof insertSocialRoomMusicItemReactionSchema>;
export type SocialRoomMusicItemReaction = typeof socialRoomMusicItemReactions.$inferSelect;

export const socialRoomPlans = pgTable("social_room_plans", {
  id:              uuid("id").primaryKey().defaultRandom(),
  room_id:         uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  plan_key:        text("plan_key").notNull(),
  kind:            text("kind").notNull().default("plan"),
  title_es:        text("title_es").notNull(),
  title_de:        text("title_de").notNull(),
  title_en:        text("title_en").notNull(),
  body_es:         text("body_es").notNull().default(""),
  body_de:         text("body_de").notNull().default(""),
  body_en:         text("body_en").notNull().default(""),
  location_label:  text("location_label").notNull().default(""),
  comfort_needs:   text("comfort_needs").array().notNull().default([]),
  experience_category: text("experience_category").notNull().default("other"),
  preferred_time:      text("preferred_time").notNull().default("flexible"),
  cost_range:          text("cost_range").notNull().default("discuss"),
  group_size:          text("group_size").notNull().default("one_to_one"),
  safety_flags:        text("safety_flags").array().notNull().default([]),
  needs_review:        boolean("needs_review").notNull().default(false),
  starts_at:       timestamp("starts_at", { withTimezone: true }),
  status:          text("status").notNull().default("active"),
  source:          text("source").notNull().default("seed"),
  created_by:      text("created_by").references(() => profiles.id, { onDelete: "set null" }),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_plans_room_key_unique").on(t.room_id, t.plan_key),
]);

export const insertSocialRoomPlanSchema = createInsertSchema(socialRoomPlans).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomPlan = z.infer<typeof insertSocialRoomPlanSchema>;
export type SocialRoomPlan = typeof socialRoomPlans.$inferSelect;

export const socialRoomPlanResponses = pgTable("social_room_plan_responses", {
  id:          uuid("id").primaryKey().defaultRandom(),
  plan_id:     uuid("plan_id").notNull().references(() => socialRoomPlans.id, { onDelete: "cascade" }),
  user_id:     text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  response:    text("response").notNull(),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_plan_responses_plan_user_unique").on(t.plan_id, t.user_id),
]);

export const insertSocialRoomPlanResponseSchema = createInsertSchema(socialRoomPlanResponses).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomPlanResponse = z.infer<typeof insertSocialRoomPlanResponseSchema>;
export type SocialRoomPlanResponse = typeof socialRoomPlanResponses.$inferSelect;

export const socialRoomReplies = pgTable("social_room_replies", {
  id:          uuid("id").primaryKey().defaultRandom(),
  plan_id:     uuid("plan_id").notNull().references(() => socialRoomPlans.id, { onDelete: "cascade" }),
  user_id:     text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  body:        text("body").notNull(),
  tone:        text("tone").notNull().default("support"),
  status:      text("status").notNull().default("active"),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialRoomReplySchema = createInsertSchema(socialRoomReplies).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomReply = z.infer<typeof insertSocialRoomReplySchema>;
export type SocialRoomReply = typeof socialRoomReplies.$inferSelect;

export const socialRoomPolls = pgTable("social_room_polls", {
  id:          uuid("id").primaryKey().defaultRandom(),
  room_id:     uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  poll_key:    text("poll_key").notNull(),
  question_es: text("question_es").notNull(),
  question_de: text("question_de").notNull(),
  question_en: text("question_en").notNull(),
  options:     jsonb("options").$type<Array<{ id: string; label_es: string; label_de: string; label_en: string }>>().notNull().default([]),
  status:      text("status").notNull().default("active"),
  closes_at:   timestamp("closes_at", { withTimezone: true }),
  created_by:  text("created_by").references(() => profiles.id, { onDelete: "set null" }),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_polls_room_key_unique").on(t.room_id, t.poll_key),
]);

export const insertSocialRoomPollSchema = createInsertSchema(socialRoomPolls).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomPoll = z.infer<typeof insertSocialRoomPollSchema>;
export type SocialRoomPoll = typeof socialRoomPolls.$inferSelect;

export const socialRoomVotes = pgTable("social_room_votes", {
  id:          uuid("id").primaryKey().defaultRandom(),
  poll_id:     uuid("poll_id").notNull().references(() => socialRoomPolls.id, { onDelete: "cascade" }),
  user_id:     text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  option_id:   text("option_id").notNull(),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_votes_poll_user_unique").on(t.poll_id, t.user_id),
]);

export const insertSocialRoomVoteSchema = createInsertSchema(socialRoomVotes).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomVote = z.infer<typeof insertSocialRoomVoteSchema>;
export type SocialRoomVote = typeof socialRoomVotes.$inferSelect;

export const socialRoomSafetyReports = pgTable("social_room_safety_reports", {
  id:           uuid("id").primaryKey().defaultRandom(),
  room_id:      uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  reporter_id:  text("reporter_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  target_type:  text("target_type").notNull().default("room"),
  target_id:    text("target_id"),
  reason:       text("reason").notNull(),
  details:      text("details").notNull().default(""),
  status:       text("status").notNull().default("open"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewed_at:  timestamp("reviewed_at", { withTimezone: true }),
  reviewed_by:  text("reviewed_by").references(() => profiles.id, { onDelete: "set null" }),
});

export const insertSocialRoomSafetyReportSchema = createInsertSchema(socialRoomSafetyReports).omit({ id: true, created_at: true, reviewed_at: true });
export type InsertSocialRoomSafetyReport = z.infer<typeof insertSocialRoomSafetyReportSchema>;
export type SocialRoomSafetyReport = typeof socialRoomSafetyReports.$inferSelect;

export const socialRoomModerationActions = pgTable("social_room_moderation_actions", {
  id:            uuid("id").primaryKey().defaultRandom(),
  room_id:       uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  admin_user_id: text("admin_user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  action_type:   text("action_type").notNull(),
  target_type:   text("target_type").notNull(),
  target_id:     text("target_id").notNull(),
  notes:         text("notes").notNull().default(""),
  created_at:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialRoomModerationActionSchema = createInsertSchema(socialRoomModerationActions).omit({ id: true, created_at: true });
export type InsertSocialRoomModerationAction = z.infer<typeof insertSocialRoomModerationActionSchema>;
export type SocialRoomModerationAction = typeof socialRoomModerationActions.$inferSelect;

export const socialRoomMemberRoles = pgTable("social_room_member_roles", {
  id:                          uuid("id").primaryKey().defaultRandom(),
  room_id:                     uuid("room_id").notNull().references(() => socialRooms.id, { onDelete: "cascade" }),
  user_id:                     text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role:                        text("role").notNull().default("member"),
  status:                      text("status").notNull().default("active"),
  comfort_needs:               text("comfort_needs").array().notNull().default([]),
  agreement_acknowledged_at:   timestamp("agreement_acknowledged_at", { withTimezone: true }),
  quiet_paused_at:             timestamp("quiet_paused_at", { withTimezone: true }),
  created_at:                  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:                  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("social_room_member_roles_room_user_unique").on(t.room_id, t.user_id),
]);

export const insertSocialRoomMemberRoleSchema = createInsertSchema(socialRoomMemberRoles).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialRoomMemberRole = z.infer<typeof insertSocialRoomMemberRoleSchema>;
export type SocialRoomMemberRole = typeof socialRoomMemberRoles.$inferSelect;

export const socialRoomNotifications = pgTable("social_room_notifications", {
  id:          uuid("id").primaryKey().defaultRandom(),
  user_id:     text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  room_id:     uuid("room_id").references(() => socialRooms.id, { onDelete: "cascade" }),
  type:        text("type").notNull(),
  title:       text("title").notNull(),
  body:        text("body").notNull().default(""),
  metadata:    jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  read_at:     timestamp("read_at", { withTimezone: true }),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialRoomNotificationSchema = createInsertSchema(socialRoomNotifications).omit({ id: true, created_at: true });
export type InsertSocialRoomNotification = z.infer<typeof insertSocialRoomNotificationSchema>;
export type SocialRoomNotification = typeof socialRoomNotifications.$inferSelect;

export const socialShareDropboxNotes = pgTable("social_share_dropbox_notes", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  user_id:             text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  note_type:           text("note_type").notNull(),
  source:              text("source").notNull().default("voice"),
  transcript:          text("transcript").notNull().default(""),
  edited_text:         text("edited_text").notNull().default(""),
  suggested_room_slug: text("suggested_room_slug").notNull(),
  prompt_id:           text("prompt_id"),
  prompt_text:         text("prompt_text"),
  prompt_kind:         text("prompt_kind"),
  connection_goal:     text("connection_goal"),
  status:              text("status").notNull().default("ready"),
  safety_flags:        text("safety_flags").array().notNull().default([]),
  placement_kind:      text("placement_kind"),
  placement_target_id: text("placement_target_id"),
  published_at:        timestamp("published_at", { withTimezone: true }),
  deleted_at:          timestamp("deleted_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("social_share_dropbox_notes_user_status_created_idx").on(t.user_id, t.status, t.created_at),
  index("social_share_dropbox_notes_user_created_idx").on(t.user_id, t.created_at),
]);

export const insertSocialShareDropboxNoteSchema = createInsertSchema(socialShareDropboxNotes).omit({ id: true, created_at: true, updated_at: true });
export type InsertSocialShareDropboxNote = z.infer<typeof insertSocialShareDropboxNoteSchema>;
export type SocialShareDropboxNote = typeof socialShareDropboxNotes.$inferSelect;

export const socialShareDropboxAudio = pgTable("social_share_dropbox_audio", {
  id:          uuid("id").primaryKey().defaultRandom(),
  note_id:     uuid("note_id").notNull().references(() => socialShareDropboxNotes.id, { onDelete: "cascade" }),
  user_id:     text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  mime_type:   text("mime_type").notNull(),
  byte_size:   integer("byte_size").notNull(),
  duration_ms: integer("duration_ms"),
  audio_data:  bytea("audio_data").notNull(),
  expires_at:  timestamp("expires_at", { withTimezone: true }).notNull(),
  deleted_at:  timestamp("deleted_at", { withTimezone: true }),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("social_share_dropbox_audio_note_idx").on(t.note_id),
  index("social_share_dropbox_audio_user_expires_idx").on(t.user_id, t.expires_at),
]);

export const insertSocialShareDropboxAudioSchema = createInsertSchema(socialShareDropboxAudio).omit({ id: true, created_at: true });
export type InsertSocialShareDropboxAudio = z.infer<typeof insertSocialShareDropboxAudioSchema>;
export type SocialShareDropboxAudio = typeof socialShareDropboxAudio.$inferSelect;

export const participationEvents = pgTable("participation_events", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  event_key:          text("event_key").notNull().unique(),
  title_es:           text("title_es").notNull(),
  title_de:           text("title_de").notNull(),
  title_en:           text("title_en").notNull(),
  summary_es:         text("summary_es").notNull().default(""),
  summary_de:         text("summary_de").notNull().default(""),
  summary_en:         text("summary_en").notNull().default(""),
  description_es:     text("description_es").notNull().default(""),
  description_de:     text("description_de").notNull().default(""),
  description_en:     text("description_en").notNull().default(""),
  format:             text("format").notNull().default("nearby"),
  location_label:     text("location_label").notNull().default("nearby"),
  city:               text("city"),
  country_code:       text("country_code"),
  time_label_es:      text("time_label_es").notNull().default(""),
  time_label_de:      text("time_label_de").notNull().default(""),
  time_label_en:      text("time_label_en").notNull().default(""),
  starts_at:          timestamp("starts_at", { withTimezone: true }),
  ends_at:            timestamp("ends_at", { withTimezone: true }),
  cost_label_es:      text("cost_label_es").notNull().default(""),
  cost_label_de:      text("cost_label_de").notNull().default(""),
  cost_label_en:      text("cost_label_en").notNull().default(""),
  language_codes:     text("language_codes").array().notNull().default([]),
  tags:               text("tags").array().notNull().default([]),
  interest_tags:      text("interest_tags").array().notNull().default([]),
  accessibility_tags: text("accessibility_tags").array().notNull().default([]),
  helper_actions:     text("helper_actions").array().notNull().default([]),
  source:             text("source").notNull().default("curated"),
  source_url:         text("source_url"),
  status:             text("status").notNull().default("active"),
  is_curated:         boolean("is_curated").notNull().default(true),
  needs_live_check:   boolean("needs_live_check").notNull().default(true),
  safety_status:      text("safety_status").notNull().default("approved"),
  metadata:           jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  created_by:         text("created_by"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("participation_events_status_idx").on(t.status, t.safety_status),
  index("participation_events_country_city_idx").on(t.country_code, t.city),
]);

export const insertParticipationEventSchema = createInsertSchema(participationEvents).omit({ id: true, created_at: true, updated_at: true });
export type InsertParticipationEvent = z.infer<typeof insertParticipationEventSchema>;
export type ParticipationEventRow = typeof participationEvents.$inferSelect;

export const participationEventResponses = pgTable("participation_event_responses", {
  id:         uuid("id").primaryKey().defaultRandom(),
  event_id:   uuid("event_id").notNull().references(() => participationEvents.id, { onDelete: "cascade" }),
  user_id:    text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  response:   text("response").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("participation_event_responses_event_user_unique").on(t.event_id, t.user_id),
  index("participation_event_responses_user_idx").on(t.user_id, t.updated_at.desc()),
]);

export const insertParticipationEventResponseSchema = createInsertSchema(participationEventResponses).omit({ id: true, created_at: true, updated_at: true });
export type InsertParticipationEventResponse = z.infer<typeof insertParticipationEventResponseSchema>;
export type ParticipationEventResponseRow = typeof participationEventResponses.$inferSelect;

export const participationEventChecks = pgTable("participation_event_checks", {
  id:                uuid("id").primaryKey().defaultRandom(),
  event_id:          uuid("event_id").notNull().references(() => participationEvents.id, { onDelete: "cascade" }),
  user_id:           text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status:            text("status").notNull().default("requested"),
  request_note:      text("request_note").notNull().default(""),
  helper_actions:    text("helper_actions").array().notNull().default([]),
  concierge_prefill: jsonb("concierge_prefill").$type<Record<string, unknown>>().notNull().default({}),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolved_at:       timestamp("resolved_at", { withTimezone: true }),
}, (t) => [
  index("participation_event_checks_user_idx").on(t.user_id, t.created_at.desc()),
  index("participation_event_checks_event_idx").on(t.event_id, t.created_at.desc()),
]);

export const insertParticipationEventCheckSchema = createInsertSchema(participationEventChecks).omit({ id: true, created_at: true, updated_at: true });
export type InsertParticipationEventCheck = z.infer<typeof insertParticipationEventCheckSchema>;
export type ParticipationEventCheckRow = typeof participationEventChecks.$inferSelect;

export const participationNotifications = pgTable("participation_notifications", {
  id:         uuid("id").primaryKey().defaultRandom(),
  user_id:    text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  event_id:   uuid("event_id").references(() => participationEvents.id, { onDelete: "set null" }),
  type:       text("type").notNull(),
  title:      text("title").notNull(),
  body:       text("body").notNull().default(""),
  metadata:   jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  read_at:    timestamp("read_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("participation_notifications_user_idx").on(t.user_id, t.created_at.desc()),
]);

export const insertParticipationNotificationSchema = createInsertSchema(participationNotifications).omit({ id: true, created_at: true });
export type InsertParticipationNotification = z.infer<typeof insertParticipationNotificationSchema>;
export type ParticipationNotificationRow = typeof participationNotifications.$inferSelect;

// ============================================================
// NEW TABLE: triage_reports — persisted completed TriageSummary + vitals
// ============================================================

export const triageReports = pgTable("triage_reports", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull(),
  chief_complaint:  text("chief_complaint").notNull(),
  symptoms:         text("symptoms").array().notNull().default([]),
  urgency:          text("urgency").notNull(),
  recommendations:  text("recommendations").array().notNull().default([]),
  disclaimer:       text("disclaimer").notNull().default(""),
  ai_summary:        text("ai_summary"),
  next_step_label:   text("next_step_label"),
  next_step_level:   text("next_step_level"),
  triage_reasons:    text("triage_reasons").array().notNull().default([]),
  watch_signs:       text("watch_signs").array().notNull().default([]),
  profile_considerations: text("profile_considerations").array().notNull().default([]),
  vitals_notes:      text("vitals_notes").array().notNull().default([]),
  scan_results:      jsonb("scan_results").$type<TriageScanResult[]>().notNull().default(sql`'[]'::jsonb`),
  scan_notes:        text("scan_notes").array().notNull().default([]),
  bpm:               integer("bpm"),
  respiratory_rate:  integer("respiratory_rate"),
  duration_seconds:  integer("duration_seconds"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTriageReportSchema = createInsertSchema(triageReports).omit({ id: true, created_at: true });
export type InsertTriageReport = z.infer<typeof insertTriageReportSchema>;
export type TriageReport = typeof triageReports.$inferSelect;

export const insightOutcomes = pgTable("insight_outcomes", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  user_id:            text("user_id").notNull(),
  triage_report_id:   uuid("triage_report_id"),
  delivered_surface:  text("delivered_surface").notNull(),
  action_taken:       text("action_taken").notNull().default("none"),
  tier_at_generation: integer("tier_at_generation").notNull().default(4),
  outcome_payload:    jsonb("outcome_payload").notNull().default({}),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("insight_outcomes_user_time_idx").on(t.user_id, t.created_at.desc()),
  index("insight_outcomes_triage_report_idx").on(t.triage_report_id),
]);

export const insertInsightOutcomeSchema = createInsertSchema(insightOutcomes).omit({ id: true, created_at: true });
export type InsertInsightOutcome = z.infer<typeof insertInsightOutcomeSchema>;
export type InsightOutcome = typeof insightOutcomes.$inferSelect;


// ============================================================
// NEW TABLE: vitals_readings — persisted heart rate readings per user
// ============================================================

export const vitalsReadings = pgTable("vitals_readings", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull(),
  bpm:              integer("bpm"),
  respiratory_rate: integer("respiratory_rate"),
  metric_type:      text("metric_type"),
  value:            text("value"),
  recorded_at:      timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVitalsReadingSchema = createInsertSchema(vitalsReadings).omit({ id: true, recorded_at: true });
export type InsertVitalsReading = z.infer<typeof insertVitalsReadingSchema>;
export type VitalsReading = typeof vitalsReadings.$inferSelect;

// ============================================================
// VITALS ENGINE: signal readings, baselines, analysis windows, devices
// ============================================================

export const vyvaSignalReadings = pgTable("vyva_signal_readings", {
  id:              uuid("id").primaryKey().defaultRandom(),
  user_id:         uuid("user_id").notNull(),
  signal_type:     text("signal_type").notNull(),
  value:           numeric("value", { precision: 8, scale: 2 }).notNull(),
  recorded_at:     timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  source:          text("source").notNull().default("manual"),
  capture_method:  text("capture_method"),
  unit:            text("unit"),
  source_ref:      jsonb("source_ref"),
  context_tag:     text("context_tag").default("general"),
  baseline_ref:    numeric("baseline_ref", { precision: 8, scale: 2 }),
  deviation_pct:   numeric("deviation_pct", { precision: 6, scale: 2 }),
  quality_flag:    text("quality_flag").notNull().default("clean"),
  condition_tags:  text("condition_tags").array().default([]),
  created_at:      timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_vsr_user_signal_time").on(t.user_id, t.signal_type, t.recorded_at.desc()),
]);

export const vyvaUserBaselines = pgTable("vyva_user_baselines", {
  user_id:          uuid("user_id").notNull(),
  signal_type:      text("signal_type").notNull(),
  context_tag:      text("context_tag").notNull().default("general"),
  baseline_mean:    numeric("baseline_mean", { precision: 8, scale: 2 }).notNull(),
  baseline_stddev:  numeric("baseline_stddev", { precision: 8, scale: 2 }),
  baseline_p25:     numeric("baseline_p25", { precision: 8, scale: 2 }),
  baseline_p75:     numeric("baseline_p75", { precision: 8, scale: 2 }),
  sample_count:     integer("sample_count").default(0),
  window_days:      integer("window_days").default(14),
  is_established:   boolean("is_established").default(false),
  computed_at:      timestamp("computed_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.user_id, t.signal_type, t.context_tag] }),
]);

export const vyvaPatternWindows = pgTable("vyva_pattern_windows", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  user_id:               uuid("user_id"),
  analysed_at:           timestamp("analysed_at", { withTimezone: true }).defaultNow(),
  safety_status:         text("safety_status").notNull().default("steady"),
  risk_score:            integer("risk_score"),
  risk_tier:             text("risk_tier").notNull().default("none"),
  contributing_signals:  jsonb("contributing_signals").default({}),
  pattern_labels:        text("pattern_labels").array().default([]),
  senior_message:        text("senior_message"),
  caregiver_note:        text("caregiver_note"),
  recommended_action:    text("recommended_action"),
  alert_fired:           boolean("alert_fired").default(false),
  alert_channel:         text("alert_channel"),
  model_version:         text("model_version").default("v1"),
  rule_version:          text("rule_version").notNull().default("daily-safety-v1"),
  acknowledged_action:   text("acknowledged_action"),
  acknowledged_at:       timestamp("acknowledged_at", { withTimezone: true }),
  resolved_at:           timestamp("resolved_at", { withTimezone: true }),
}, (t) => [
  index("idx_vpw_user_time").on(t.user_id, t.analysed_at.desc()),
]);

export const userDeviceConnections = pgTable("user_device_connections", {
  id:              uuid("id").primaryKey().defaultRandom(),
  user_id:         uuid("user_id"),
  provider:        text("provider").notNull(),
  is_active:       boolean("is_active").default(true),
  provider_user_id: text("provider_user_id"),
  device_label:    text("device_label"),
  metadata:        jsonb("metadata").default({}),
  connected_at:    timestamp("connected_at", { withTimezone: true }).defaultNow(),
  last_synced_at:  timestamp("last_synced_at", { withTimezone: true }),
}, (t) => [
  unique("user_device_connections_user_provider_unique").on(t.user_id, t.provider),
]);

export const insertVyvaSignalReadingSchema = createInsertSchema(vyvaSignalReadings).omit({ id: true, created_at: true });
export type InsertVyvaSignalReading = z.infer<typeof insertVyvaSignalReadingSchema>;
export type VyvaSignalReading = typeof vyvaSignalReadings.$inferSelect;

// ============================================================
// CURIOUS MINDS - divergent thinking game content + sessions
// ============================================================

export const curiousMindsHooks = pgTable("curious_minds_hooks", {
  id:          uuid("id").primaryKey().defaultRandom(),
  factPrompt:  text("fact_prompt").notNull(),
  factAnswer:  text("fact_answer").notNull(),
  category:    text("category").notNull(),
  language:    text("language").notNull().default("es"),
  source:      text("source").notNull().default("ai_generated"),
  reviewedAt:  timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy:  text("reviewed_by"),
  isActive:    boolean("is_active").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("curious_minds_hooks_language_active_idx").on(t.language, t.isActive),
]);

export const curiousMindsPrompts = pgTable("curious_minds_prompts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  promptType:  text("prompt_type").notNull(),
  promptText:  text("prompt_text").notNull(),
  topic:       text("topic").notNull(),
  language:    text("language").notNull().default("es"),
  source:      text("source").notNull().default("ai_generated"),
  reviewedAt:  timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy:  text("reviewed_by"),
  isActive:    boolean("is_active").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("curious_minds_prompts_language_active_idx").on(t.language, t.isActive),
]);

export const curiousMindsSessions = pgTable("curious_minds_sessions", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  userId:               text("user_id").notNull(),
  playedAt:             timestamp("played_at", { withTimezone: true }).defaultNow(),
  hookId:               uuid("hook_id").references(() => curiousMindsHooks.id),
  hookGuessText:        text("hook_guess_text"),
  hookGuessInputMethod: text("hook_guess_input_method"),
  promptId:             uuid("prompt_id").references(() => curiousMindsPrompts.id),
  ideasGenerated:       jsonb("ideas_generated").notNull().default([]),
  ideasCount:           integer("ideas_count").notNull().default(0),
  callbackAttempted:    boolean("callback_attempted").notNull().default(false),
  callbackResponseText: text("callback_response_text"),
  callbackInputMethod:  text("callback_input_method"),
  completed:            boolean("completed").notNull().default(false),
  abandoned:            boolean("abandoned").notNull().default(false),
  durationSeconds:      integer("duration_seconds"),
}, (t) => [
  index("curious_minds_sessions_user_played_idx").on(t.userId, t.playedAt.desc()),
  index("curious_minds_sessions_user_hook_played_idx").on(t.userId, t.hookId, t.playedAt.desc()),
  index("curious_minds_sessions_user_prompt_played_idx").on(t.userId, t.promptId, t.playedAt.desc()),
]);

export const curiousMindsUserState = pgTable("curious_minds_user_state", {
  userId:         text("user_id").primaryKey(),
  totalSessions:  integer("total_sessions").notNull().default(0),
  lastPlayedAt:   timestamp("last_played_at", { withTimezone: true }),
  streakDays:     integer("streak_days").notNull().default(0),
  lastStreakDate: date("last_streak_date"),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// SCENT MEMORY - imagined sensory recall content + sessions
// ============================================================

export const scentMemoryPrompts = pgTable("scent_memory_prompts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  scentName:         text("scent_name").notNull(),
  scentDescription:  text("scent_description").notNull(),
  guidingQuestion:   text("guiding_question").notNull(),
  category:          text("category").notNull(),
  language:          text("language").notNull().default("es"),
  source:            text("source").notNull().default("ai_generated"),
  reviewedAt:        timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy:        text("reviewed_by"),
  rejected:          boolean("rejected").notNull().default(false),
  isActive:          boolean("is_active").notNull().default(false),
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("scent_memory_prompts_language_active_idx").on(t.language, t.isActive),
]);

export const scentMemorySessions = pgTable("scent_memory_sessions", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  userId:              uuid("user_id").notNull(),
  playedAt:            timestamp("played_at", { withTimezone: true }).defaultNow(),
  promptId:            uuid("prompt_id").references(() => scentMemoryPrompts.id),
  responseText:        text("response_text"),
  responseInputMethod: text("response_input_method"),
  completed:           boolean("completed").notNull().default(false),
  abandoned:           boolean("abandoned").notNull().default(false),
  durationSeconds:     integer("duration_seconds"),
}, (t) => [
  index("scent_memory_sessions_user_played_idx").on(t.userId, t.playedAt.desc()),
  index("scent_memory_sessions_user_prompt_played_idx").on(t.userId, t.promptId, t.playedAt.desc()),
]);

export const scentMemoryUserState = pgTable("scent_memory_user_state", {
  userId:         uuid("user_id").primaryKey(),
  totalSessions:  integer("total_sessions").notNull().default(0),
  lastPlayedAt:   timestamp("last_played_at", { withTimezone: true }),
  streakDays:     integer("streak_days").notNull().default(0),
  lastStreakDate: date("last_streak_date"),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// LISTEN CLOSELY - sound attention sessions
// ============================================================

export const listenCloselySoundscapes = pgTable("listen_closely_soundscapes", {
  id:                         uuid("id").primaryKey().defaultRandom(),
  mode:                       text("mode").notNull(),
  difficultyTier:             integer("difficulty_tier").notNull(),
  durationSeconds:            integer("duration_seconds").notNull(),
  ambientLayer:               jsonb("ambient_layer").notNull().default({}),
  targetSoundCharacter:       text("target_sound_character").notNull(),
  targetEventTimes:           jsonb("target_event_times").notNull(),
  distractorEvents:           jsonb("distractor_events").notNull().default([]),
  oddballIntroTimeMs:         integer("oddball_intro_time_ms"),
  secondTargetSoundCharacter: text("second_target_sound_character"),
  secondTargetEventTimes:     jsonb("second_target_event_times"),
  responseWindowMs:           integer("response_window_ms").notNull(),
  isActive:                   boolean("is_active").notNull().default(true),
  createdAt:                  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("listen_closely_soundscapes_tier_active_idx").on(t.difficultyTier, t.isActive),
]);

export const listenCloselySessions = pgTable("listen_closely_sessions", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  userId:               uuid("user_id").notNull(),
  playedAt:             timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  soundscapeId:         uuid("soundscape_id").references(() => listenCloselySoundscapes.id),
  difficultyTier:       integer("difficulty_tier").notNull(),
  mode:                 text("mode").notNull(),
  targetTotal:          integer("target_total").notNull().default(0),
  hits:                 integer("hits").notNull().default(0),
  misses:               integer("misses").notNull().default(0),
  falsePositives:       integer("false_positives").notNull().default(0),
  avgReactionTimeMs:    integer("avg_reaction_time_ms"),
  accuracyPct:          numeric("accuracy_pct", { precision: 5, scale: 2 }),
  userComparisonChoice: text("user_comparison_choice"),
  comparisonCorrect:    boolean("comparison_correct"),
  score:                integer("score").notNull().default(0),
  completed:            boolean("completed").notNull().default(false),
  abandoned:            boolean("abandoned").notNull().default(false),
  durationSeconds:      integer("duration_seconds"),
}, (t) => [
  index("listen_closely_sessions_user_played_idx").on(t.userId, t.playedAt.desc()),
  index("listen_closely_sessions_user_soundscape_played_idx").on(t.userId, t.soundscapeId, t.playedAt.desc()),
]);

export const listenCloselyUserState = pgTable("listen_closely_user_state", {
  userId:            uuid("user_id").primaryKey(),
  currentTier:       integer("current_tier").notNull().default(1),
  sessionsAtTier:    integer("sessions_at_tier").notNull().default(0),
  consecutiveWins:   integer("consecutive_wins").notNull().default(0),
  consecutiveLosses: integer("consecutive_losses").notNull().default(0),
  totalSessions:     integer("total_sessions").notNull().default(0),
  bestScore:         integer("best_score").notNull().default(0),
  lastPlayedAt:      timestamp("last_played_at", { withTimezone: true }),
  streakDays:        integer("streak_days").notNull().default(0),
  lastStreakDate:    date("last_streak_date"),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// BREATH GARDEN - arousal regulation sessions
// ============================================================

export const breathGardenSessions = pgTable("breath_garden_sessions", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  userId:                   uuid("user_id").notNull(),
  playedAt:                 timestamp("played_at", { withTimezone: true }).defaultNow(),
  breathTaps:               jsonb("breath_taps").notNull().default([]),
  sessionDurationSeconds:   integer("session_duration_seconds").notNull(),
  breathCycleCount:         integer("breath_cycle_count").notNull().default(0),
  avgBreathCycleSeconds:    numeric("avg_breath_cycle_seconds", { precision: 5, scale: 2 }),
  breathConsistencyIndex:   numeric("breath_consistency_index", { precision: 5, scale: 2 }),
  finalPaceBreathsPerMin:   numeric("final_pace_breaths_per_min", { precision: 4, scale: 1 }),
  gardenTheme:              text("garden_theme").notNull().default("garden"),
  bloomLevelReached:        integer("bloom_level_reached").notNull().default(1),
  completed:                boolean("completed").notNull().default(false),
  abandoned:                boolean("abandoned").notNull().default(false),
}, (t) => [
  index("breath_garden_sessions_user_played_idx").on(t.userId, t.playedAt.desc()),
]);

export const breathGardenUserState = pgTable("breath_garden_user_state", {
  userId:         uuid("user_id").primaryKey(),
  totalSessions:  integer("total_sessions").notNull().default(0),
  lastPlayedAt:   timestamp("last_played_at", { withTimezone: true }),
  streakDays:     integer("streak_days").notNull().default(0),
  lastStreakDate: date("last_streak_date"),
  preferredTheme: text("preferred_theme").default("garden"),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// NEW TABLE: cognitive_session_index - unified Brain Coach history
// ============================================================

export const cognitiveSessionIndex = pgTable("cognitive_session_index", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          text("user_id").notNull(),
  activityType:    text("activity_type").notNull(),
  domain:          text("domain").notNull(),
  secondaryDomain: text("secondary_domain"),
  difficulty:      integer("difficulty").notNull().default(1),
  difficultyScale: text("difficulty_scale").notNull().default("level"),
  completed:       boolean("completed").notNull().default(false),
  abandoned:       boolean("abandoned").notNull().default(false),
  score:           integer("score").notNull().default(0),
  accuracyPct:     numeric("accuracy_pct", { precision: 5, scale: 2 }),
  speedPct:        numeric("speed_pct", { precision: 5, scale: 2 }),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  playedAt:        timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  language:        text("language").notNull().default("es"),
  source:          text("source").notNull().default("app"),
  sourceTable:     text("source_table"),
  sourceSessionId: text("source_session_id"),
  clientResultId:  text("client_result_id"),
  metadata:        jsonb("metadata").notNull().default({}),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("cognitive_session_index_user_client_result_unique").on(t.userId, t.clientResultId),
  index("idx_cognitive_session_index_user_played").on(t.userId, t.playedAt.desc()),
  index("idx_cognitive_session_index_user_activity").on(t.userId, t.activityType, t.playedAt.desc()),
  index("idx_cognitive_session_index_user_domain").on(t.userId, t.domain, t.playedAt.desc()),
  index("idx_cognitive_session_index_user_completed").on(t.userId, t.completed, t.playedAt.desc()),
]);

export const insertCognitiveSessionIndexSchema = createInsertSchema(cognitiveSessionIndex).omit({ id: true, createdAt: true });
export type InsertCognitiveSessionIndex = z.infer<typeof insertCognitiveSessionIndexSchema>;
export type CognitiveSessionIndexRow = typeof cognitiveSessionIndex.$inferSelect;

export const cognitiveDailyPlans = pgTable("cognitive_daily_plans", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  userId:                   text("user_id").notNull(),
  planDate:                 date("plan_date").notNull(),
  status:                   text("status").notNull().default("active"),
  estimatedDurationMinutes: integer("estimated_duration_minutes").notNull().default(0),
  recommendedDomains:       text("recommended_domains").array().notNull().default([]),
  rationale:                text("rationale").array().notNull().default([]),
  generatedContext:         jsonb("generated_context").notNull().default({}),
  generationVersion:        text("generation_version").notNull().default("brain_coach_plan_v2"),
  completedAt:              timestamp("completed_at", { withTimezone: true }),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("cognitive_daily_plans_user_date_unique").on(t.userId, t.planDate),
  index("idx_cognitive_daily_plans_user_date").on(t.userId, t.planDate),
  index("idx_cognitive_daily_plans_user_status").on(t.userId, t.status, t.planDate),
]);

export const cognitiveDailyPlanItems = pgTable("cognitive_daily_plan_items", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  planId:                   uuid("plan_id").notNull().references(() => cognitiveDailyPlans.id, { onDelete: "cascade" }),
  userId:                   text("user_id").notNull(),
  planDate:                 date("plan_date").notNull(),
  activityType:             text("activity_type").notNull(),
  title:                    text("title").notNull(),
  domain:                   text("domain").notNull(),
  secondaryDomain:          text("secondary_domain"),
  route:                    text("route").notNull(),
  estimatedDurationMinutes: integer("estimated_duration_minutes").notNull().default(0),
  rationale:                text("rationale").notNull().default(""),
  status:                   text("status").notNull().default("recommended"),
  sortOrder:                integer("sort_order").notNull().default(0),
  acceptedAt:               timestamp("accepted_at", { withTimezone: true }),
  startedAt:                timestamp("started_at", { withTimezone: true }),
  skippedAt:                timestamp("skipped_at", { withTimezone: true }),
  completedAt:              timestamp("completed_at", { withTimezone: true }),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("cognitive_daily_plan_items_plan_activity_unique").on(t.planId, t.activityType),
  index("idx_cognitive_daily_plan_items_plan_order").on(t.planId, t.sortOrder),
  index("idx_cognitive_daily_plan_items_user_date").on(t.userId, t.planDate),
  index("idx_cognitive_daily_plan_items_user_activity").on(t.userId, t.activityType, t.planDate),
]);

export const cognitiveDailyPlanEvents = pgTable("cognitive_daily_plan_events", {
  id:           uuid("id").primaryKey().defaultRandom(),
  planId:       uuid("plan_id").notNull().references(() => cognitiveDailyPlans.id, { onDelete: "cascade" }),
  planItemId:   uuid("plan_item_id").references(() => cognitiveDailyPlanItems.id, { onDelete: "set null" }),
  userId:       text("user_id").notNull(),
  activityType: text("activity_type"),
  eventType:    text("event_type").notNull(),
  source:       text("source").notNull().default("app"),
  metadata:     jsonb("metadata").notNull().default({}),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_cognitive_daily_plan_events_plan").on(t.planId, t.createdAt.desc()),
  index("idx_cognitive_daily_plan_events_user").on(t.userId, t.createdAt.desc()),
  index("idx_cognitive_daily_plan_events_item").on(t.planItemId, t.createdAt.desc()),
]);

export const cognitiveCaregiverSettings = pgTable("cognitive_caregiver_settings", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  userId:                text("user_id").notNull().unique(),
  preferredDomains:      text("preferred_domains").array().notNull().default([]),
  excludedActivityTypes: text("excluded_activity_types").array().notNull().default([]),
  preferredTrainingTimes: text("preferred_training_times").array().notNull().default([]),
  weeklyTargetDays:      integer("weekly_target_days").notNull().default(3),
  sessionLengthMinutes:  integer("session_length_minutes").notNull().default(7),
  paused:                boolean("paused").notNull().default(false),
  updatedBy:             text("updated_by"),
  createdAt:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_cognitive_caregiver_settings_user").on(t.userId),
]);

export const insertCognitiveDailyPlanSchema = createInsertSchema(cognitiveDailyPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCognitiveDailyPlan = z.infer<typeof insertCognitiveDailyPlanSchema>;
export type CognitiveDailyPlanRow = typeof cognitiveDailyPlans.$inferSelect;

export const insertCognitiveDailyPlanItemSchema = createInsertSchema(cognitiveDailyPlanItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCognitiveDailyPlanItem = z.infer<typeof insertCognitiveDailyPlanItemSchema>;
export type CognitiveDailyPlanItemRow = typeof cognitiveDailyPlanItems.$inferSelect;

export const insertCognitiveDailyPlanEventSchema = createInsertSchema(cognitiveDailyPlanEvents).omit({ id: true, createdAt: true });
export type InsertCognitiveDailyPlanEvent = z.infer<typeof insertCognitiveDailyPlanEventSchema>;
export type CognitiveDailyPlanEventRow = typeof cognitiveDailyPlanEvents.$inferSelect;

export const insertCognitiveCaregiverSettingsSchema = createInsertSchema(cognitiveCaregiverSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCognitiveCaregiverSettings = z.infer<typeof insertCognitiveCaregiverSettingsSchema>;
export type CognitiveCaregiverSettingsRow = typeof cognitiveCaregiverSettings.$inferSelect;

// ============================================================
// LEARNING PROGRAM - curated daily learning snippets
// ============================================================

export const learningCategories = pgTable("learning_categories", {
  id:          uuid("id").primaryKey().defaultRandom(),
  slug:        text("slug").notNull().unique(),
  label:       text("label").notNull(),
  description: text("description").notNull().default(""),
  color:       text("color").notNull().default("#7C3AED"),
  icon:        text("icon").notNull().default("book-open"),
  sortOrder:   integer("sort_order").notNull().default(0),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_learning_categories_active_sort").on(t.isActive, t.sortOrder),
]);

export const learningLessons = pgTable("learning_lessons", {
  id:               uuid("id").primaryKey().defaultRandom(),
  externalId:       text("external_id"),
  categorySlug:     text("category_slug").notNull(),
  language:         text("language").notNull().default("en"),
  title:            text("title").notNull(),
  hook:             text("hook").notNull(),
  body:             text("body").notNull(),
  reflectionPrompt: text("reflection_prompt").notNull(),
  sourceNotes:      text("source_notes"),
  imageUrl:         text("image_url"),
  imageAlt:         text("image_alt"),
  imagePrompt:      text("image_prompt"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(3),
  difficulty:       text("difficulty").notNull().default("easy"),
  tags:             text("tags").array().notNull().default([]),
  status:           text("status").notNull().default("draft"),
  isActive:         boolean("is_active").notNull().default(true),
  reviewedAt:       timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy:       text("reviewed_by"),
  publishedAt:      timestamp("published_at", { withTimezone: true }),
  publishedBy:      text("published_by"),
  archivedAt:       timestamp("archived_at", { withTimezone: true }),
  archivedBy:       text("archived_by"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idx_learning_lessons_external_id_unique").on(t.externalId),
  index("idx_learning_lessons_status_language_category").on(t.status, t.language, t.categorySlug),
  index("idx_learning_lessons_active_status").on(t.isActive, t.status),
]);

export const learningLessonImages = pgTable("learning_lesson_images", {
  id:         uuid("id").primaryKey().defaultRandom(),
  lessonId:   uuid("lesson_id").notNull().references(() => learningLessons.id, { onDelete: "cascade" }),
  mimeType:   text("mime_type").notNull().default("image/jpeg"),
  imageBytes: bytea("image_bytes").notNull(),
  prompt:     text("prompt"),
  model:      text("model"),
  createdBy:  text("created_by"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_learning_lesson_images_lesson").on(t.lessonId),
]);

export const learningPrograms = pgTable("learning_programs", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  userId:              text("user_id").notNull(),
  status:              text("status").notNull().default("active"),
  interests:           text("interests").array().notNull().default([]),
  pace:                text("pace").notNull().default("gentle"),
  dailyTime:           text("daily_time").notNull().default("09:00"),
  lessonLengthMinutes: integer("lesson_length_minutes").notNull().default(3),
  language:            text("language").notNull().default("en"),
  startDate:           date("start_date").notNull(),
  endDate:             date("end_date").notNull(),
  completedAt:         timestamp("completed_at", { withTimezone: true }),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_learning_programs_user_status").on(t.userId, t.status, t.startDate),
]);

export const learningProgramItems = pgTable("learning_program_items", {
  id:            uuid("id").primaryKey().defaultRandom(),
  programId:     uuid("program_id").notNull().references(() => learningPrograms.id, { onDelete: "cascade" }),
  userId:        text("user_id").notNull(),
  lessonId:      uuid("lesson_id").notNull().references(() => learningLessons.id, { onDelete: "cascade" }),
  programDay:    integer("program_day").notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  status:        text("status").notNull().default("recommended"),
  completedAt:   timestamp("completed_at", { withTimezone: true }),
  savedAt:       timestamp("saved_at", { withTimezone: true }),
  skippedAt:     timestamp("skipped_at", { withTimezone: true }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("learning_program_items_program_day_unique").on(t.programId, t.programDay),
  index("idx_learning_program_items_user_date").on(t.userId, t.scheduledDate),
  index("idx_learning_program_items_program_day").on(t.programId, t.programDay),
]);

export const learningProgramEvents = pgTable("learning_program_events", {
  id:            uuid("id").primaryKey().defaultRandom(),
  programId:     uuid("program_id").notNull().references(() => learningPrograms.id, { onDelete: "cascade" }),
  programItemId: uuid("program_item_id").references(() => learningProgramItems.id, { onDelete: "set null" }),
  lessonId:      uuid("lesson_id").references(() => learningLessons.id, { onDelete: "set null" }),
  userId:        text("user_id").notNull(),
  eventType:     text("event_type").notNull(),
  source:        text("source").notNull().default("app"),
  metadata:      jsonb("metadata").notNull().default({}),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_learning_program_events_program").on(t.programId, t.createdAt.desc()),
  index("idx_learning_program_events_user").on(t.userId, t.createdAt.desc()),
  index("idx_learning_program_events_item").on(t.programItemId, t.createdAt.desc()),
]);

export const insertLearningCategorySchema = createInsertSchema(learningCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLearningCategory = z.infer<typeof insertLearningCategorySchema>;
export type LearningCategoryRow = typeof learningCategories.$inferSelect;

export const insertLearningLessonSchema = createInsertSchema(learningLessons).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLearningLesson = z.infer<typeof insertLearningLessonSchema>;
export type LearningLessonRow = typeof learningLessons.$inferSelect;

export const insertLearningProgramSchema = createInsertSchema(learningPrograms).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLearningProgram = z.infer<typeof insertLearningProgramSchema>;
export type LearningProgramRow = typeof learningPrograms.$inferSelect;

export const insertLearningProgramItemSchema = createInsertSchema(learningProgramItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLearningProgramItem = z.infer<typeof insertLearningProgramItemSchema>;
export type LearningProgramItemRow = typeof learningProgramItems.$inferSelect;

export const insertLearningProgramEventSchema = createInsertSchema(learningProgramEvents).omit({ id: true, createdAt: true });
export type InsertLearningProgramEvent = z.infer<typeof insertLearningProgramEventSchema>;
export type LearningProgramEventRow = typeof learningProgramEvents.$inferSelect;


// ============================================================
// NEW TABLE: utility_review_runs — evidence log for bill reviews
// ============================================================

// ============================================================
// NEW TABLE: organizations - invite and entitlement grouping
// ============================================================

export const organizations = pgTable("organizations", {
  id:            uuid("id").primaryKey().defaultRandom(),
  name:          text("name").notNull(),
  slug:          text("slug").notNull().unique(),
  contact_name:  text("contact_name"),
  contact_email: text("contact_email"),
  contact_phone: text("contact_phone"),
  default_tier:  text("default_tier").notNull().default("free"),
  is_active:     boolean("is_active").notNull().default(true),
  metadata:      jsonb("metadata").notNull().default({}),
  created_at:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, created_at: true, updated_at: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const tierEntitlements = pgTable("tier_entitlements", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  tier:                text("tier").notNull().unique(),
  display_name:        text("display_name").notNull(),
  description:         text("description"),
  voice_assistant:     boolean("voice_assistant").notNull().default(false),
  medication_tracking: boolean("medication_tracking").notNull().default(false),
  symptom_check:       boolean("symptom_check").notNull().default(false),
  concierge:           boolean("concierge").notNull().default(false),
  caregiver_dashboard: boolean("caregiver_dashboard").notNull().default(false),
  custom_features:     jsonb("custom_features").notNull().default({}),
  is_active:           boolean("is_active").notNull().default(true),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTierEntitlementSchema = createInsertSchema(tierEntitlements).omit({ id: true, created_at: true, updated_at: true });
export type InsertTierEntitlement = z.infer<typeof insertTierEntitlementSchema>;
export type TierEntitlement = typeof tierEntitlements.$inferSelect;

export const userIntakes = pgTable("user_intakes", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id"),
  elder_user_id:    text("elder_user_id"),
  family_user_id:   text("family_user_id"),
  name:             text("name").notNull(),
  phone:            text("phone").notNull(),
  email:            text("email"),
  user_type:        lifecycleUserTypeEnum("user_type").notNull().default("elder"),
  entry_point:      lifecycleEntryPointEnum("entry_point").notNull().default("form"),
  organization_id:  uuid("organization_id"),
  tier:             text("tier").notNull().default("free"),
  status:           lifecycleStatusEnum("status").notNull().default("created"),
  journey_step:     text("journey_step").notNull().default("created"),
  consent_status:   text("consent_status").notNull().default("not_required"),
  source_payload:   jsonb("source_payload").notNull().default({}),
  metadata:         jsonb("metadata").notNull().default({}),
  link_sent_at:     timestamp("link_sent_at", { withTimezone: true }),
  activated_at:     timestamp("activated_at", { withTimezone: true }),
  dropped_at:       timestamp("dropped_at", { withTimezone: true }),
  last_activity_at: timestamp("last_activity_at", { withTimezone: true }),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserIntakeSchema = createInsertSchema(userIntakes).omit({ id: true, created_at: true, updated_at: true });
export type InsertUserIntake = z.infer<typeof insertUserIntakeSchema>;
export type UserIntake = typeof userIntakes.$inferSelect;

export const accessLinks = pgTable("access_links", {
  id:              uuid("id").primaryKey().defaultRandom(),
  token:           text("token").notNull().unique(),
  user_id:         text("user_id"),
  intake_id:       uuid("intake_id"),
  organization_id: uuid("organization_id"),
  link_type:       accessLinkTypeEnum("link_type").notNull().default("trial"),
  tier:            text("tier").notNull().default("free"),
  destination:     text("destination").notNull().default("/onboarding"),
  target_role:     text("target_role").notNull().default("elder"),
  max_uses:        integer("max_uses").notNull().default(1),
  use_count:       integer("use_count").notNull().default(0),
  clicked_at:      timestamp("clicked_at", { withTimezone: true }),
  converted_at:    timestamp("converted_at", { withTimezone: true }),
  expires_at:      timestamp("expires_at", { withTimezone: true }).notNull(),
  revoked_at:      timestamp("revoked_at", { withTimezone: true }),
  metadata:        jsonb("metadata").notNull().default({}),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccessLinkSchema = createInsertSchema(accessLinks).omit({ id: true, created_at: true });
export type InsertAccessLink = z.infer<typeof insertAccessLinkSchema>;
export type AccessLink = typeof accessLinks.$inferSelect;

export const lifecycleEvents = pgTable("lifecycle_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  intake_id:   uuid("intake_id"),
  user_id:     text("user_id"),
  event_type:  text("event_type").notNull(),
  from_status: text("from_status"),
  to_status:   text("to_status"),
  channel:     text("channel"),
  metadata:    jsonb("metadata").notNull().default({}),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLifecycleEventSchema = createInsertSchema(lifecycleEvents).omit({ id: true, created_at: true });
export type InsertLifecycleEvent = z.infer<typeof insertLifecycleEventSchema>;
export type LifecycleEvent = typeof lifecycleEvents.$inferSelect;

export const consentAttempts = pgTable("consent_attempts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  intake_id:         uuid("intake_id"),
  elder_user_id:     text("elder_user_id"),
  family_user_id:    text("family_user_id"),
  attempt_number:    integer("attempt_number").notNull().default(1),
  status:            consentAttemptStatusEnum("status").notNull().default("pending"),
  channel:           text("channel").notNull().default("voice"),
  scheduled_at:      timestamp("scheduled_at", { withTimezone: true }),
  completed_at:      timestamp("completed_at", { withTimezone: true }),
  source_session_id: text("source_session_id"),
  result_payload:    jsonb("result_payload").notNull().default({}),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConsentAttemptSchema = createInsertSchema(consentAttempts).omit({ id: true, created_at: true });
export type InsertConsentAttempt = z.infer<typeof insertConsentAttemptSchema>;
export type ConsentAttempt = typeof consentAttempts.$inferSelect;

export const communicationsLog = pgTable("communications_log", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  intake_id:           uuid("intake_id"),
  user_id:             text("user_id"),
  channel:             text("channel").notNull(),
  recipient:           text("recipient").notNull(),
  purpose:             text("purpose").notNull(),
  status:              text("status").notNull().default("queued"),
  provider_message_id: text("provider_message_id"),
  body:                text("body"),
  metadata:            jsonb("metadata").notNull().default({}),
  sent_at:             timestamp("sent_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunicationLogSchema = createInsertSchema(communicationsLog).omit({ id: true, created_at: true });
export type InsertCommunicationLog = z.infer<typeof insertCommunicationLogSchema>;
export type CommunicationLog = typeof communicationsLog.$inferSelect;

export const scheduledEvents = pgTable("scheduled_events", {
  id:                uuid("id").primaryKey().defaultRandom(),
  user_id:           text("user_id").notNull(),
  event_type:        text("event_type").notNull(),
  title:             text("title").notNull(),
  description:       text("description"),
  channel:           text("channel").notNull().default("app"),
  agent_id:          text("agent_id"),
  agent_slug:        text("agent_slug"),
  room_slug:         text("room_slug"),
  scheduled_for:     timestamp("scheduled_for", { withTimezone: true }).notNull(),
  timezone:          text("timezone").notNull().default("Europe/Madrid"),
  recurrence:        text("recurrence").notNull().default("none"),
  status:            text("status").notNull().default("upcoming"),
  source:            text("source").notNull().default("app"),
  source_session_id: text("source_session_id"),
  metadata:          jsonb("metadata").notNull().default({}),
  created_by:        text("created_by"),
  updated_by:        text("updated_by"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduledEventSchema = createInsertSchema(scheduledEvents).omit({ id: true, created_at: true, updated_at: true });
export type InsertScheduledEvent = z.infer<typeof insertScheduledEventSchema>;
export type ScheduledEvent = typeof scheduledEvents.$inferSelect;

export const scheduledEventLogs = pgTable("scheduled_event_logs", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  scheduled_event_id: uuid("scheduled_event_id"),
  user_id:            text("user_id").notNull(),
  action:             text("action").notNull(),
  status:             text("status"),
  metadata:           jsonb("metadata").notNull().default({}),
  created_by:         text("created_by"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduledEventLogSchema = createInsertSchema(scheduledEventLogs).omit({ id: true, created_at: true });
export type InsertScheduledEventLog = z.infer<typeof insertScheduledEventLogSchema>;
export type ScheduledEventLog = typeof scheduledEventLogs.$inferSelect;

export const scheduledInteractions = pgTable("scheduled_interactions", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  user_id:              text("user_id").notNull(),
  interaction_type:     text("interaction_type").notNull(),
  friendly_label:       text("friendly_label"),
  user_description:     text("user_description"),
  source_ref_id:        text("source_ref_id"),
  status:               text("status").notNull().default("ACTIVE"),
  frequency_type:       text("frequency_type").notNull().default("DAILY"),
  frequency_value:      jsonb("frequency_value").notNull().default({}),
  days_of_week:         text("days_of_week").array().notNull().default([]),
  times_of_day:         text("times_of_day").array().notNull().default([]),
  timezone:             text("timezone").notNull().default("Europe/Madrid"),
  preferred_language:   text("preferred_language").notNull().default("es"),
  quiet_hours_start:    text("quiet_hours_start").notNull().default("21:00"),
  quiet_hours_end:      text("quiet_hours_end").notNull().default("08:00"),
  escalation_contacts:  jsonb("escalation_contacts").notNull().default([]),
  next_run_at:          timestamp("next_run_at", { withTimezone: true }),
  last_completed_at:    timestamp("last_completed_at", { withTimezone: true }),
  last_result:          text("last_result"),
  is_paused:            boolean("is_paused").notNull().default(false),
  pause_until:          timestamp("pause_until", { withTimezone: true }),
  pause_reason:         text("pause_reason"),
  consent_required:     boolean("consent_required").notNull().default(false),
  consent_status:       text("consent_status").notNull().default("not_required"),
  admin_edit_allowed:   boolean("admin_edit_allowed").notNull().default(false),
  created_by:           text("created_by"),
  updated_by:           text("updated_by"),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduledInteractionSchema = createInsertSchema(scheduledInteractions).omit({ id: true, created_at: true, updated_at: true });
export type InsertScheduledInteraction = z.infer<typeof insertScheduledInteractionSchema>;
export type ScheduledInteraction = typeof scheduledInteractions.$inferSelect;

export const interactionLogs = pgTable("interaction_logs", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  user_id:                  text("user_id").notNull(),
  scheduled_interaction_id: uuid("scheduled_interaction_id"),
  interaction_type:         text("interaction_type").notNull(),
  scheduled_for:            timestamp("scheduled_for", { withTimezone: true }),
  started_at:               timestamp("started_at", { withTimezone: true }),
  completed_at:             timestamp("completed_at", { withTimezone: true }),
  outcome:                  text("outcome").notNull(),
  summary:                  text("summary"),
  sentiment:                text("sentiment"),
  risk_flags:               jsonb("risk_flags").notNull().default([]),
  created_at:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInteractionLogSchema = createInsertSchema(interactionLogs).omit({ id: true, created_at: true });
export type InsertInteractionLog = z.infer<typeof insertInteractionLogSchema>;
export type InteractionLog = typeof interactionLogs.$inferSelect;

export const consentAuditLogs = pgTable("consent_audit_logs", {
  id:              uuid("id").primaryKey().defaultRandom(),
  user_id:         text("user_id").notNull(),
  schedule_id:     uuid("schedule_id"),
  changed_by:      text("changed_by").notNull(),
  changed_by_role: text("changed_by_role").notNull(),
  previous_value:  jsonb("previous_value").notNull().default({}),
  new_value:       jsonb("new_value").notNull().default({}),
  consent_source:  text("consent_source").notNull().default("app"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConsentAuditLogSchema = createInsertSchema(consentAuditLogs).omit({ id: true, created_at: true });
export type InsertConsentAuditLog = z.infer<typeof insertConsentAuditLogSchema>;
export type ConsentAuditLog = typeof consentAuditLogs.$inferSelect;

export const userProviders = pgTable("user_providers", {
  id:           uuid("id").primaryKey().defaultRandom(),
  user_id:      text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  category:     text("category").notNull(),
  name:         text("name").notNull(),
  phone:        text("phone"),
  address:      text("address"),
  place_id:     text("place_id"),
  maps_url:     text("maps_url"),
  website_url:  text("website_url"),
  booking_url:  text("booking_url"),
  email:        text("email"),
  whatsapp:     text("whatsapp"),
  contact_name: text("contact_name"),
  contact_role: text("contact_role"),
  notes:        text("notes"),
  metadata:     jsonb("metadata").notNull().default({}),
  is_primary:   boolean("is_primary").notNull().default(true),
  is_active:    boolean("is_active").notNull().default(true),
  last_used_at: timestamp("last_used_at", { withTimezone: true }),
  use_count:    integer("use_count").notNull().default(0),
  language:     text("language").notNull().default("es"),
  created_at:   timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at:   timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertUserProviderSchema = createInsertSchema(userProviders).omit({ id: true, created_at: true, updated_at: true });
export type InsertUserProvider = z.infer<typeof insertUserProviderSchema>;
export type UserProvider = typeof userProviders.$inferSelect;

export const conciergePending = pgTable("concierge_pending", {
  id:               uuid("id").primaryKey().defaultRandom(),
  user_id:          text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  use_case:         text("use_case").notNull(),
  provider_id:      uuid("provider_id").references(() => userProviders.id, { onDelete: "set null" }),
  provider_name:    text("provider_name"),
  provider_phone:   text("provider_phone"),
  found_externally: boolean("found_externally").notNull().default(false),
  action_summary:   text("action_summary").notNull(),
  action_payload:   jsonb("action_payload").notNull().default({}),
  status:           text("status").notNull().default("pending"),
  language:         text("language").notNull().default("es"),
  confirmed_at:     timestamp("confirmed_at", { withTimezone: true }).defaultNow(),
  expires_at:       timestamp("expires_at", { withTimezone: true }).default(sql`now() + interval '30 minutes'`),
  updated_at:       timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertConciergePendingSchema = createInsertSchema(conciergePending).omit({ id: true, confirmed_at: true, expires_at: true, updated_at: true });
export type InsertConciergePending = z.infer<typeof insertConciergePendingSchema>;
export type ConciergePending = typeof conciergePending.$inferSelect;

export const conciergeChannelReadinessSettings = pgTable("concierge_channel_readiness_settings", {
  channel:            text("channel").primaryKey(),
  admin_enabled:      boolean("admin_enabled").notNull().default(false),
  verified:           boolean("verified").notNull().default(false),
  notes:              text("notes"),
  last_probe_status:  text("last_probe_status"),
  last_probe_at:      timestamp("last_probe_at", { withTimezone: true }),
  last_probe_blocker: text("last_probe_blocker"),
  last_probe_by:      text("last_probe_by"),
  adapter_live_endpoint_url: text("adapter_live_endpoint_url"),
  adapter_credential_reference: text("adapter_credential_reference"),
  adapter_qa_target: text("adapter_qa_target"),
  adapter_configured_by: text("adapter_configured_by"),
  adapter_configured_at: timestamp("adapter_configured_at", { withTimezone: true }),
  updated_by:         text("updated_by"),
  updated_at:         timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertConciergeChannelReadinessSettingsSchema = createInsertSchema(conciergeChannelReadinessSettings).omit({ updated_at: true });
export type InsertConciergeChannelReadinessSettings = z.infer<typeof insertConciergeChannelReadinessSettingsSchema>;
export type ConciergeChannelReadinessSettings = typeof conciergeChannelReadinessSettings.$inferSelect;

export const conciergeSessions = pgTable("concierge_sessions", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  user_id:               text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  pending_id:            uuid("pending_id").references(() => conciergePending.id, { onDelete: "set null" }),
  use_case:              text("use_case").notNull(),
  provider_id:           uuid("provider_id").references(() => userProviders.id, { onDelete: "set null" }),
  provider_name:         text("provider_name"),
  provider_phone:        text("provider_phone"),
  found_externally:      boolean("found_externally").notNull().default(false),
  action_summary:        text("action_summary"),
  action_payload:        jsonb("action_payload").default({}),
  outcome:               text("outcome").notNull().default("pending"),
  outcome_payload:       jsonb("outcome_payload").default({}),
  outcome_summary:       text("outcome_summary"),
  family_notified:       boolean("family_notified").notNull().default(false),
  call_duration_seconds: integer("call_duration_seconds"),
  location_type:         text("location_type"),
  started_at:            timestamp("started_at", { withTimezone: true }).defaultNow(),
  completed_at:          timestamp("completed_at", { withTimezone: true }),
});

export const insertConciergeSessionSchema = createInsertSchema(conciergeSessions).omit({ id: true, started_at: true });
export type InsertConciergeSession = z.infer<typeof insertConciergeSessionSchema>;
export type ConciergeSession = typeof conciergeSessions.$inferSelect;

export const appointmentRequests = pgTable("appointment_requests", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  user_id:                  text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  appointment_type:         text("appointment_type").notNull(),
  reason_detail:            text("reason_detail"),
  preferences:              jsonb("preferences").notNull().default({}),
  status:                   text("status").notNull().default("draft"),
  selected_provider_id:     uuid("selected_provider_id").references(() => userProviders.id, { onDelete: "set null" }),
  selected_provider_option_id: uuid("selected_provider_option_id"),
  selected_channel:         text("selected_channel"),
  linked_pending_id:        uuid("linked_pending_id").references(() => conciergePending.id, { onDelete: "set null" }),
  linked_scheduled_event_id: uuid("linked_scheduled_event_id").references(() => scheduledEvents.id, { onDelete: "set null" }),
  route_prefill_source:     text("route_prefill_source"),
  language:                 text("language").notNull().default("es"),
  created_at:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentRequestSchema = createInsertSchema(appointmentRequests).omit({ id: true, created_at: true, updated_at: true });
export type InsertAppointmentRequest = z.infer<typeof insertAppointmentRequestSchema>;
export type AppointmentRequest = typeof appointmentRequests.$inferSelect;

export const appointmentProviderOptions = pgTable("appointment_provider_options", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  request_id:         uuid("request_id").notNull().references(() => appointmentRequests.id, { onDelete: "cascade" }),
  user_id:            text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  provider_id:        uuid("provider_id").references(() => userProviders.id, { onDelete: "set null" }),
  provider_source:    text("provider_source").notNull().default("saved"),
  provider_snapshot:  jsonb("provider_snapshot").notNull().default({}),
  match_reason:       text("match_reason"),
  available_channels: text("available_channels").array().notNull().default([]),
  rank:               integer("rank").notNull().default(0),
  status:             text("status").notNull().default("suggested"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentProviderOptionSchema = createInsertSchema(appointmentProviderOptions).omit({ id: true, created_at: true, updated_at: true });
export type InsertAppointmentProviderOption = z.infer<typeof insertAppointmentProviderOptionSchema>;
export type AppointmentProviderOption = typeof appointmentProviderOptions.$inferSelect;

export const appointmentAttempts = pgTable("appointment_attempts", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  request_id:         uuid("request_id").notNull().references(() => appointmentRequests.id, { onDelete: "cascade" }),
  user_id:            text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  provider_option_id: uuid("provider_option_id").references(() => appointmentProviderOptions.id, { onDelete: "set null" }),
  provider_id:        uuid("provider_id").references(() => userProviders.id, { onDelete: "set null" }),
  channel:            text("channel").notNull(),
  status:             text("status").notNull().default("pending"),
  pending_id:         uuid("pending_id").references(() => conciergePending.id, { onDelete: "set null" }),
  result_notes:       text("result_notes"),
  metadata:           jsonb("metadata").notNull().default({}),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentAttemptSchema = createInsertSchema(appointmentAttempts).omit({ id: true, created_at: true, updated_at: true });
export type InsertAppointmentAttempt = z.infer<typeof insertAppointmentAttemptSchema>;
export type AppointmentAttempt = typeof appointmentAttempts.$inferSelect;

export const conciergeReminders = pgTable("concierge_reminders", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  user_id:             text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  reminder_type:       text("reminder_type").notNull(),
  title:               text("title").notNull(),
  description:         text("description"),
  reminder_date:       date("reminder_date").notNull(),
  reminder_time:       time("reminder_time"),
  advance_notice_days: integer("advance_notice_days").notNull().default(1),
  source_session_id:   uuid("source_session_id").references(() => conciergeSessions.id, { onDelete: "set null" }),
  source_use_case:     text("source_use_case"),
  language:            text("language").notNull().default("es"),
  is_active:           boolean("is_active").notNull().default(true),
  triggered:           boolean("triggered").notNull().default(false),
  triggered_at:        timestamp("triggered_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertConciergeReminderSchema = createInsertSchema(conciergeReminders).omit({ id: true, created_at: true, updated_at: true });
export type InsertConciergeReminder = z.infer<typeof insertConciergeReminderSchema>;
export type ConciergeReminder = typeof conciergeReminders.$inferSelect;

export const utilityReviewRuns = pgTable("utility_review_runs", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  user_id:               text("user_id").notNull(),
  country:               text("country").notNull().default("ES"),
  utility_type:          text("utility_type").notNull().default("electricity"),
  input_method:          text("input_method").notNull().default("manual"),
  extracted_data_json:   jsonb("extracted_data_json").notNull().default({}),
  normalized_input_json: jsonb("normalized_input_json").notNull().default({}),
  source_used:           text("source_used").notNull().default("CNMC"),
  source_status:         text("source_status").notNull().default("pending"),
  results_json:          jsonb("results_json").notNull().default([]),
  confidence:            text("confidence").notNull().default("medium"),

  // Legacy columns kept so drizzle-kit push does not delete production data.
  use_case:              text("use_case"),
  provider_id:           text("provider_id"),
  provider_name:         text("provider_name"),
  provider_phone:        text("provider_phone"),
  found_externally:      boolean("found_externally"),
  action_summary:        text("action_summary"),
  action_payload:        jsonb("action_payload"),
  status:                text("status"),
  language:              text("language"),
  confirmed_at:          timestamp("confirmed_at", { withTimezone: true }),
  expires_at:            timestamp("expires_at", { withTimezone: true }),
  updated_at:            timestamp("updated_at", { withTimezone: true }),

  created_at:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUtilityReviewRunSchema = createInsertSchema(utilityReviewRuns).omit({ id: true, created_at: true });
export type InsertUtilityReviewRun = z.infer<typeof insertUtilityReviewRunSchema>;
export type UtilityReviewRun = typeof utilityReviewRuns.$inferSelect;

export const conciergeRecommendationFeedback = pgTable("concierge_recommendation_feedback", {
  id:                uuid("id").primaryKey().defaultRandom(),
  user_id:           text("user_id").notNull(),
  recommendation_id: text("recommendation_id").notNull(),
  action:            text("action").notNull(),
  category:          text("category"),
  title:             text("title"),
  reasons:           jsonb("reasons").notNull().default([]),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConciergeRecommendationFeedbackSchema = createInsertSchema(conciergeRecommendationFeedback).omit({ id: true, created_at: true });
export type InsertConciergeRecommendationFeedback = z.infer<typeof insertConciergeRecommendationFeedbackSchema>;
export type ConciergeRecommendationFeedback = typeof conciergeRecommendationFeedback.$inferSelect;

export const voiceRecommendationFeedback = pgTable("voice_recommendation_feedback", {
  id:                uuid("id").primaryKey().defaultRandom(),
  user_id:           text("user_id").notNull(),
  session_id:        text("session_id"),
  recommendation_id: text("recommendation_id").notNull(),
  action:            text("action").notNull(),
  domain:            text("domain"),
  title:             text("title"),
  reason:            text("reason"),
  source:            text("source").notNull().default("voice"),
  metadata:          jsonb("metadata").notNull().default({}),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVoiceRecommendationFeedbackSchema = createInsertSchema(voiceRecommendationFeedback).omit({ id: true, created_at: true });
export type InsertVoiceRecommendationFeedback = z.infer<typeof insertVoiceRecommendationFeedbackSchema>;
export type VoiceRecommendationFeedback = typeof voiceRecommendationFeedback.$inferSelect;

export const voiceTimelineEvents = pgTable("voice_timeline_events", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  user_id:              text("user_id").notNull(),
  client_event_id:      text("client_event_id").notNull(),
  session_id:           text("session_id"),
  kind:                 text("kind").notNull(),
  title:                text("title").notNull(),
  detail:               text("detail"),
  severity:             text("severity").notNull().default("info"),
  domain:               text("domain"),
  agent_id:             text("agent_id"),
  agent_slug:           text("agent_slug"),
  conversation_plan_id: text("conversation_plan_id"),
  route:                text("route"),
  action_id:            text("action_id"),
  action_type:          text("action_type"),
  source:               text("source").notNull().default("app"),
  payload:              jsonb("payload").notNull().default({}),
  client_at:            timestamp("client_at", { withTimezone: true }),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("voice_timeline_events_user_client_event_unique").on(t.user_id, t.client_event_id),
]);

export const insertVoiceTimelineEventSchema = createInsertSchema(voiceTimelineEvents).omit({ id: true, created_at: true });
export type InsertVoiceTimelineEvent = z.infer<typeof insertVoiceTimelineEventSchema>;
export type VoiceTimelineEventRow = typeof voiceTimelineEvents.$inferSelect;

export const voiceQaSessionReviews = pgTable("voice_qa_session_reviews", {
  id:         uuid("id").primaryKey().defaultRandom(),
  session_id: text("session_id").notNull().unique(),
  status:     text("status").notNull().default("unreviewed"),
  note:       text("note"),
  reviewed_by: text("reviewed_by"),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVoiceQaSessionReviewSchema = createInsertSchema(voiceQaSessionReviews).omit({ id: true, created_at: true, updated_at: true });
export type InsertVoiceQaSessionReview = z.infer<typeof insertVoiceQaSessionReviewSchema>;
export type VoiceQaSessionReviewRow = typeof voiceQaSessionReviews.$inferSelect;

export const voiceTriageSessions = pgTable("voice_triage_sessions", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  user_id:               text("user_id").notNull(),
  conversation_id:       text("conversation_id").notNull().unique(),
  channel:               text("channel").notNull().default("voice_app"),
  status:                text("status").notNull().default("active"),
  locale:                text("locale").notNull().default("en"),
  messages_json:         jsonb("messages_json").notNull().default(sql`'[]'::jsonb`),
  wizard_json:           jsonb("wizard_json").notNull().default(sql`'{}'::jsonb`),
  health_memory_json:    jsonb("health_memory_json").notNull().default(sql`'{}'::jsonb`),
  latest_response_json:  jsonb("latest_response_json").notNull().default(sql`'{}'::jsonb`),
  triage_report_id:      uuid("triage_report_id"),
  started_at:            timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completed_at:          timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("voice_triage_sessions_user_updated_idx").on(t.user_id, t.updated_at),
  index("voice_triage_sessions_status_updated_idx").on(t.status, t.updated_at),
]);

export const insertVoiceTriageSessionSchema = createInsertSchema(voiceTriageSessions).omit({ id: true, started_at: true, updated_at: true });
export type InsertVoiceTriageSession = z.infer<typeof insertVoiceTriageSessionSchema>;
export type VoiceTriageSessionRow = typeof voiceTriageSessions.$inferSelect;

export const homePlanCards = pgTable("home_plan_cards", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  card_id:                  text("card_id").notNull().unique(),
  is_enabled:               boolean("is_enabled").notNull().default(true),
  emoji:                    text("emoji").notNull().default("*"),
  bg:                       text("bg").notNull().default("#F4F0FF"),
  badge_bg:                 text("badge_bg").notNull().default("#EDE9FE"),
  badge_text:               text("badge_text").notNull().default("#6D28D9"),
  route:                    text("route").notNull().default("/"),
  base_priority:            integer("base_priority").notNull().default(50),
  condition_keywords:       text("condition_keywords").array().notNull().default([]),
  hobby_keywords:           text("hobby_keywords").array().notNull().default([]),
  avoid_condition_keywords: text("avoid_condition_keywords").array().notNull().default([]),
  admin_notes:              text("admin_notes"),
  created_at:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHomePlanCardSchema = createInsertSchema(homePlanCards).omit({ id: true, created_at: true, updated_at: true });
export type InsertHomePlanCard = z.infer<typeof insertHomePlanCardSchema>;
export type HomePlanCardRow = typeof homePlanCards.$inferSelect;

export const homeFastHelpImpressions = pgTable("home_fast_help_impressions", {
  id:              uuid("id").primaryKey(),
  user_id:         uuid("user_id").notNull(),
  action_ids:      text("action_ids").array().notNull(),
  ranking_version: text("ranking_version").notNull(),
  shown_at:        timestamp("shown_at", { withTimezone: true }).notNull(),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("home_fast_help_impressions_id_user_unique").on(t.id, t.user_id),
  index("home_fast_help_impressions_user_shown_idx").on(t.user_id, t.shown_at),
  index("home_fast_help_impressions_version_shown_idx").on(t.ranking_version, t.shown_at),
]);

export const homeFastHelpJourneys = pgTable("home_fast_help_journeys", {
  id:           uuid("id").primaryKey(),
  user_id:      uuid("user_id").notNull(),
  impression_id: uuid("impression_id"),
  action_id:    text("action_id").notNull(),
  status:       text("status").notNull(),
  started_at:   timestamp("started_at", { withTimezone: true }).notNull(),
  updated_at:   timestamp("updated_at", { withTimezone: true }).notNull(),
  reference_id: text("reference_id"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  synced_at:    timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("home_fast_help_journeys_user_updated_idx").on(t.user_id, t.updated_at),
  index("home_fast_help_journeys_user_action_updated_idx").on(t.user_id, t.action_id, t.updated_at),
  index("home_fast_help_journeys_impression_idx").on(t.impression_id),
  foreignKey({
    columns: [t.impression_id, t.user_id],
    foreignColumns: [homeFastHelpImpressions.id, homeFastHelpImpressions.user_id],
    name: "home_fast_help_journeys_impression_id_fkey",
  }),
]);

export const homeFastHelpJourneyEvents = pgTable("home_fast_help_journey_events", {
  id:           uuid("id").primaryKey(),
  journey_id:   uuid("journey_id").notNull().references(() => homeFastHelpJourneys.id, { onDelete: "cascade" }),
  user_id:      uuid("user_id").notNull(),
  status:       text("status").notNull(),
  occurred_at:  timestamp("occurred_at", { withTimezone: true }).notNull(),
  reference_id: text("reference_id"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("home_fast_help_journey_events_user_occurred_idx").on(t.user_id, t.occurred_at),
  index("home_fast_help_journey_events_journey_occurred_idx").on(t.journey_id, t.occurred_at),
]);

export const insertHomeFastHelpJourneySchema = createInsertSchema(homeFastHelpJourneys).omit({ created_at: true, synced_at: true });
export const insertHomeFastHelpJourneyEventSchema = createInsertSchema(homeFastHelpJourneyEvents).omit({ created_at: true });
export const insertHomeFastHelpImpressionSchema = createInsertSchema(homeFastHelpImpressions).omit({ created_at: true });
export type HomeFastHelpImpressionRow = typeof homeFastHelpImpressions.$inferSelect;
export type HomeFastHelpJourneyRow = typeof homeFastHelpJourneys.$inferSelect;
export type HomeFastHelpJourneyEventRow = typeof homeFastHelpJourneyEvents.$inferSelect;

export const heroMessages = pgTable("hero_messages", {
  id:             uuid("id").primaryKey().defaultRandom(),
  message_id:     text("message_id").notNull().unique(),
  surface:        text("surface").notNull(),
  reason:         text("reason").notNull().default("evergreen"),
  priority:       integer("priority").notNull().default(10),
  cooldown_hours: integer("cooldown_hours").notNull().default(8),
  periods:        text("periods").array().notNull().default([]),
  safety_levels:  text("safety_levels").array().notNull().default([]),
  event_types:    text("event_types").array().notNull().default([]),
  activity_types: text("activity_types").array().notNull().default([]),
  copy:           jsonb("copy").notNull().default({}),
  is_enabled:     boolean("is_enabled").notNull().default(true),
  admin_notes:    text("admin_notes"),
  created_at:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHeroMessageSchema = createInsertSchema(heroMessages).omit({ id: true, created_at: true, updated_at: true });
export type InsertHeroMessage = z.infer<typeof insertHeroMessageSchema>;
export type HeroMessageRow = typeof heroMessages.$inferSelect;

export const heroMessageEvents = pgTable("hero_message_events", {
  id:         uuid("id").primaryKey().defaultRandom(),
  message_id: text("message_id").notNull(),
  surface:    text("surface").notNull(),
  language:   text("language").notNull(),
  event_type: text("event_type").notNull(),
  reason:     text("reason").notNull(),
  source:     text("source").notNull(),
  route:      text("route").notNull().default(""),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("hero_message_events_created_at_idx").on(t.created_at),
  index("hero_message_events_surface_idx").on(t.surface),
  index("hero_message_events_message_idx").on(t.message_id),
  index("hero_message_events_type_idx").on(t.event_type),
]);

export const insertHeroMessageEventSchema = createInsertSchema(heroMessageEvents).omit({ id: true, created_at: true });
export type InsertHeroMessageEvent = z.infer<typeof insertHeroMessageEventSchema>;
export type HeroMessageEventRow = typeof heroMessageEvents.$inferSelect;

export const marketingContentAssets = pgTable("marketing_content_assets", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  title:                text("title").notNull(),
  channel:              text("channel").notNull(),
  language:             text("language").notNull().default("en"),
  status:               text("status").notNull().default("draft"),
  subject:              text("subject"),
  body:                 text("body").notNull().default(""),
  html_body:            text("html_body"),
  cta_label:            text("cta_label"),
  cta_url:              text("cta_url"),
  design_json:          jsonb("design_json").notNull().default({}),
  media_assets:         jsonb("media_assets").notNull().default([]),
  source:               text("source").notNull().default("vyva"),
  lovable_external_id:  text("lovable_external_id").unique(),
  metadata:             jsonb("metadata").notNull().default({}),
  created_by:           text("created_by"),
  updated_by:           text("updated_by"),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_content_assets_channel_idx").on(t.channel),
  index("marketing_content_assets_status_idx").on(t.status),
  index("marketing_content_assets_source_idx").on(t.source),
]);

export const insertMarketingContentAssetSchema = createInsertSchema(marketingContentAssets).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingContentAsset = z.infer<typeof insertMarketingContentAssetSchema>;
export type MarketingContentAssetRow = typeof marketingContentAssets.$inferSelect;

export const marketingMediaAssets = pgTable("marketing_media_assets", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  content_asset_id:    uuid("content_asset_id").references(() => marketingContentAssets.id, { onDelete: "cascade" }),
  source:              text("source").notNull().default("lovable"),
  asset_type:          text("asset_type").notNull().default("unknown"),
  original_url:        text("original_url").notNull(),
  local_url:           text("local_url"),
  status:              text("status").notNull().default("referenced"),
  lovable_external_id: text("lovable_external_id").unique(),
  metadata:            jsonb("metadata").notNull().default({}),
  last_synced_at:      timestamp("last_synced_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_media_assets_content_idx").on(t.content_asset_id),
  index("marketing_media_assets_source_idx").on(t.source),
  index("marketing_media_assets_status_idx").on(t.status),
  index("marketing_media_assets_type_idx").on(t.asset_type),
]);

export const insertMarketingMediaAssetSchema = createInsertSchema(marketingMediaAssets).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingMediaAsset = z.infer<typeof insertMarketingMediaAssetSchema>;
export type MarketingMediaAssetRow = typeof marketingMediaAssets.$inferSelect;

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  name:                text("name").notNull(),
  status:              text("status").notNull().default("draft"),
  audience_type:       text("audience_type").notNull().default("b2c"),
  objective:           text("objective").notNull().default(""),
  schedule_starts_at:  timestamp("schedule_starts_at", { withTimezone: true }),
  schedule_ends_at:    timestamp("schedule_ends_at", { withTimezone: true }),
  timezone:            text("timezone").notNull().default("Europe/Madrid"),
  source:              text("source").notNull().default("vyva"),
  lovable_external_id: text("lovable_external_id").unique(),
  metadata:            jsonb("metadata").notNull().default({}),
  created_by:          text("created_by"),
  updated_by:          text("updated_by"),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_campaigns_status_idx").on(t.status),
  index("marketing_campaigns_audience_idx").on(t.audience_type),
  index("marketing_campaigns_schedule_idx").on(t.schedule_starts_at),
  index("marketing_campaigns_source_idx").on(t.source),
]);

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type MarketingCampaignRow = typeof marketingCampaigns.$inferSelect;

export const marketingCampaignChannels = pgTable("marketing_campaign_channels", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  campaign_id:        uuid("campaign_id").notNull().references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  channel:            text("channel").notNull(),
  content_asset_id:   uuid("content_asset_id").references(() => marketingContentAssets.id, { onDelete: "set null" }),
  scheduled_at:       timestamp("scheduled_at", { withTimezone: true }),
  status:             text("status").notNull().default("draft"),
  send_capability:    text("send_capability").notNull().default("locked"),
  metadata:           jsonb("metadata").notNull().default({}),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_campaign_channels_campaign_idx").on(t.campaign_id),
  index("marketing_campaign_channels_channel_idx").on(t.channel),
  index("marketing_campaign_channels_status_idx").on(t.status),
  index("marketing_campaign_channels_scheduled_idx").on(t.scheduled_at),
]);

export const insertMarketingCampaignChannelSchema = createInsertSchema(marketingCampaignChannels).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingCampaignChannel = z.infer<typeof insertMarketingCampaignChannelSchema>;
export type MarketingCampaignChannelRow = typeof marketingCampaignChannels.$inferSelect;

export const marketingCampaignMetrics = pgTable("marketing_campaign_metrics", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  campaign_id:         uuid("campaign_id").references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  channel:             text("channel").notNull().default("all"),
  metric_date:         timestamp("metric_date", { withTimezone: true }),
  sent:                integer("sent").notNull().default(0),
  delivered:           integer("delivered").notNull().default(0),
  opened:              integer("opened").notNull().default(0),
  clicked:             integer("clicked").notNull().default(0),
  bounced:             integer("bounced").notNull().default(0),
  unsubscribed:        integer("unsubscribed").notNull().default(0),
  replied:             integer("replied").notNull().default(0),
  social_engagement:   integer("social_engagement").notNull().default(0),
  source:              text("source").notNull().default("lovable"),
  lovable_external_id: text("lovable_external_id").unique(),
  metadata:            jsonb("metadata").notNull().default({}),
  last_synced_at:      timestamp("last_synced_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_campaign_metrics_campaign_idx").on(t.campaign_id),
  index("marketing_campaign_metrics_channel_idx").on(t.channel),
  index("marketing_campaign_metrics_date_idx").on(t.metric_date),
  index("marketing_campaign_metrics_source_idx").on(t.source),
]);

export const insertMarketingCampaignMetricSchema = createInsertSchema(marketingCampaignMetrics).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingCampaignMetric = z.infer<typeof insertMarketingCampaignMetricSchema>;
export type MarketingCampaignMetricRow = typeof marketingCampaignMetrics.$inferSelect;

export const marketingJourneys = pgTable("marketing_journeys", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  name:                text("name").notNull(),
  status:              text("status").notNull().default("draft"),
  audience_type:       text("audience_type").notNull().default("b2c"),
  objective:           text("objective").notNull().default(""),
  trigger_type:        text("trigger_type"),
  trigger_config:      jsonb("trigger_config").notNull().default({}),
  goal_type:           text("goal_type"),
  goal_config:         jsonb("goal_config").notNull().default({}),
  exit_on_goal:        boolean("exit_on_goal").notNull().default(true),
  source:              text("source").notNull().default("vyva"),
  lovable_external_id: text("lovable_external_id").unique(),
  metadata:            jsonb("metadata").notNull().default({}),
  created_by:          text("created_by"),
  updated_by:          text("updated_by"),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_journeys_status_idx").on(t.status),
  index("marketing_journeys_audience_idx").on(t.audience_type),
  index("marketing_journeys_source_idx").on(t.source),
  index("marketing_journeys_trigger_idx").on(t.trigger_type),
  index("marketing_journeys_goal_idx").on(t.goal_type),
]);

export const insertMarketingJourneySchema = createInsertSchema(marketingJourneys).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingJourney = z.infer<typeof insertMarketingJourneySchema>;
export type MarketingJourneyRow = typeof marketingJourneys.$inferSelect;

export const marketingJourneySteps = pgTable("marketing_journey_steps", {
  id:                uuid("id").primaryKey().defaultRandom(),
  journey_id:        uuid("journey_id").notNull().references(() => marketingJourneys.id, { onDelete: "cascade" }),
  step_order:        integer("step_order").notNull().default(0),
  channel:           text("channel").notNull(),
  content_asset_id:  uuid("content_asset_id").references(() => marketingContentAssets.id, { onDelete: "set null" }),
  delay_hours:       integer("delay_hours").notNull().default(0),
  kind:              text("kind").notNull().default("message"),
  day_offset:        integer("day_offset").notNull().default(0),
  template_kind:     text("template_kind"),
  template_ref:      text("template_ref"),
  config:            jsonb("config").notNull().default({}),
  status:            text("status").notNull().default("draft"),
  metadata:          jsonb("metadata").notNull().default({}),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("marketing_journey_steps_order_unique").on(t.journey_id, t.step_order),
  index("marketing_journey_steps_journey_idx").on(t.journey_id),
  index("marketing_journey_steps_channel_idx").on(t.channel),
  index("marketing_journey_steps_kind_idx").on(t.kind),
  index("marketing_journey_steps_day_offset_idx").on(t.day_offset),
]);

export const insertMarketingJourneyStepSchema = createInsertSchema(marketingJourneySteps).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingJourneyStep = z.infer<typeof insertMarketingJourneyStepSchema>;
export type MarketingJourneyStepRow = typeof marketingJourneySteps.$inferSelect;

export const marketingContacts = pgTable("marketing_contacts", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  audience_type:        text("audience_type").notNull().default("b2b"),
  profile_id:           text("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  organization_id:      uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  full_name:            text("full_name").notNull().default(""),
  email:                text("email"),
  phone_number:         text("phone_number"),
  whatsapp_number:      text("whatsapp_number"),
  role_label:           text("role_label"),
  company_name:         text("company_name"),
  language:             text("language"),
  category:             text("category"),
  vertical:             text("vertical"),
  market:               text("market"),
  consent_status:       text("consent_status").notNull().default("unknown"),
  source:               text("source").notNull().default("vyva"),
  channel_availability: jsonb("channel_availability").notNull().default({}),
  tags:                 text("tags").array().notNull().default([]),
  lovable_external_id:  text("lovable_external_id").unique(),
  last_synced_at:       timestamp("last_synced_at", { withTimezone: true }),
  metadata:             jsonb("metadata").notNull().default({}),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_contacts_audience_idx").on(t.audience_type),
  index("marketing_contacts_profile_idx").on(t.profile_id),
  index("marketing_contacts_organization_idx").on(t.organization_id),
  index("marketing_contacts_email_idx").on(t.email),
  index("marketing_contacts_source_idx").on(t.source),
  index("marketing_contacts_language_idx").on(t.language),
  index("marketing_contacts_category_idx").on(t.category),
  index("marketing_contacts_vertical_idx").on(t.vertical),
  index("marketing_contacts_market_idx").on(t.market),
]);

export const insertMarketingContactSchema = createInsertSchema(marketingContacts).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingContact = z.infer<typeof insertMarketingContactSchema>;
export type MarketingContactRow = typeof marketingContacts.$inferSelect;

export const marketingJourneyEnrollments = pgTable("marketing_journey_enrollments", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  journey_id:          uuid("journey_id").notNull().references(() => marketingJourneys.id, { onDelete: "cascade" }),
  contact_id:          uuid("contact_id").references(() => marketingContacts.id, { onDelete: "set null" }),
  contact_external_id: text("contact_external_id"),
  status:              text("status").notNull().default("active"),
  current_step_order:  integer("current_step_order").notNull().default(0),
  entered_at:          timestamp("entered_at", { withTimezone: true }),
  exited_at:           timestamp("exited_at", { withTimezone: true }),
  last_activity_at:    timestamp("last_activity_at", { withTimezone: true }),
  source:              text("source").notNull().default("lovable"),
  lovable_external_id: text("lovable_external_id").unique(),
  metadata:            jsonb("metadata").notNull().default({}),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_journey_enrollments_journey_idx").on(t.journey_id),
  index("marketing_journey_enrollments_contact_idx").on(t.contact_id),
  index("marketing_journey_enrollments_external_contact_idx").on(t.contact_external_id),
  index("marketing_journey_enrollments_status_idx").on(t.status),
]);

export const insertMarketingJourneyEnrollmentSchema = createInsertSchema(marketingJourneyEnrollments).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingJourneyEnrollment = z.infer<typeof insertMarketingJourneyEnrollmentSchema>;
export type MarketingJourneyEnrollmentRow = typeof marketingJourneyEnrollments.$inferSelect;

export const marketingJourneyStepEvents = pgTable("marketing_journey_step_events", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  enrollment_id:       uuid("enrollment_id").notNull().references(() => marketingJourneyEnrollments.id, { onDelete: "cascade" }),
  journey_id:          uuid("journey_id").notNull().references(() => marketingJourneys.id, { onDelete: "cascade" }),
  step_id:             uuid("step_id").references(() => marketingJourneySteps.id, { onDelete: "set null" }),
  step_order:          integer("step_order").notNull().default(0),
  event_type:          text("event_type").notNull().default("planned"),
  event_at:            timestamp("event_at", { withTimezone: true }),
  channel:             text("channel"),
  source:              text("source").notNull().default("lovable"),
  lovable_external_id: text("lovable_external_id").unique(),
  metadata:            jsonb("metadata").notNull().default({}),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_journey_step_events_enrollment_idx").on(t.enrollment_id),
  index("marketing_journey_step_events_journey_idx").on(t.journey_id),
  index("marketing_journey_step_events_step_idx").on(t.step_id),
  index("marketing_journey_step_events_type_idx").on(t.event_type),
  index("marketing_journey_step_events_at_idx").on(t.event_at),
]);

export const insertMarketingJourneyStepEventSchema = createInsertSchema(marketingJourneyStepEvents).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingJourneyStepEvent = z.infer<typeof insertMarketingJourneyStepEventSchema>;
export type MarketingJourneyStepEventRow = typeof marketingJourneyStepEvents.$inferSelect;

export const marketingAudiences = pgTable("marketing_audiences", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  name:                text("name").notNull(),
  description:         text("description"),
  list_type:           text("list_type").notNull().default("static"),
  rules:               jsonb("rules").notNull().default({}),
  source:              text("source").notNull().default("vyva"),
  lovable_external_id: text("lovable_external_id").unique(),
  metadata:            jsonb("metadata").notNull().default({}),
  created_by:          text("created_by"),
  updated_by:          text("updated_by"),
  last_synced_at:      timestamp("last_synced_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_audiences_source_idx").on(t.source),
  index("marketing_audiences_list_type_idx").on(t.list_type),
  index("marketing_audiences_updated_idx").on(t.updated_at),
]);

export const insertMarketingAudienceSchema = createInsertSchema(marketingAudiences).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingAudience = z.infer<typeof insertMarketingAudienceSchema>;
export type MarketingAudienceRow = typeof marketingAudiences.$inferSelect;

export const marketingAudienceMembers = pgTable("marketing_audience_members", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  audience_id:         uuid("audience_id").notNull().references(() => marketingAudiences.id, { onDelete: "cascade" }),
  contact_id:          uuid("contact_id").references(() => marketingContacts.id, { onDelete: "cascade" }),
  contact_external_id: text("contact_external_id").notNull(),
  source:              text("source").notNull().default("lovable"),
  metadata:            jsonb("metadata").notNull().default({}),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("marketing_audience_members_external_unique").on(t.audience_id, t.contact_external_id),
  index("marketing_audience_members_audience_idx").on(t.audience_id),
  index("marketing_audience_members_contact_idx").on(t.contact_id),
  index("marketing_audience_members_external_idx").on(t.contact_external_id),
]);

export const insertMarketingAudienceMemberSchema = createInsertSchema(marketingAudienceMembers).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingAudienceMember = z.infer<typeof insertMarketingAudienceMemberSchema>;
export type MarketingAudienceMemberRow = typeof marketingAudienceMembers.$inferSelect;

export const marketingCampaignRecipients = pgTable("marketing_campaign_recipients", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  campaign_id:          uuid("campaign_id").notNull().references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  contact_id:           uuid("contact_id").references(() => marketingContacts.id, { onDelete: "set null" }),
  profile_id:           text("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  channel:              text("channel").notNull(),
  recipient:            text("recipient").notNull(),
  status:               text("status").notNull().default("planned"),
  scheduled_at:         timestamp("scheduled_at", { withTimezone: true }),
  snapshot:             jsonb("snapshot").notNull().default({}),
  communication_log_id: uuid("communication_log_id").references(() => communicationsLog.id, { onDelete: "set null" }),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_campaign_recipients_campaign_idx").on(t.campaign_id),
  index("marketing_campaign_recipients_contact_idx").on(t.contact_id),
  index("marketing_campaign_recipients_profile_idx").on(t.profile_id),
  index("marketing_campaign_recipients_status_idx").on(t.status),
  index("marketing_campaign_recipients_communication_idx").on(t.communication_log_id),
]);

export const insertMarketingCampaignRecipientSchema = createInsertSchema(marketingCampaignRecipients).omit({ id: true, created_at: true, updated_at: true });
export type InsertMarketingCampaignRecipient = z.infer<typeof insertMarketingCampaignRecipientSchema>;
export type MarketingCampaignRecipientRow = typeof marketingCampaignRecipients.$inferSelect;

export const marketingSyncRuns = pgTable("marketing_sync_runs", {
  id:           uuid("id").primaryKey().defaultRandom(),
  provider:     text("provider").notNull().default("lovable"),
  status:       text("status").notNull().default("queued"),
  started_at:   timestamp("started_at", { withTimezone: true }),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  cursor:       text("cursor"),
  summary:      jsonb("summary").notNull().default({}),
  error:        text("error"),
  created_by:   text("created_by"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("marketing_sync_runs_provider_idx").on(t.provider),
  index("marketing_sync_runs_status_idx").on(t.status),
  index("marketing_sync_runs_created_idx").on(t.created_at),
]);

export const insertMarketingSyncRunSchema = createInsertSchema(marketingSyncRuns).omit({ id: true, created_at: true });
export type InsertMarketingSyncRun = z.infer<typeof insertMarketingSyncRunSchema>;
export type MarketingSyncRunRow = typeof marketingSyncRuns.$inferSelect;

export const conciergeShoppingProducts = pgTable("concierge_shopping_products", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  product_id:          text("product_id").notNull().unique(),
  category:            text("category").notNull(),
  name:                jsonb("name").notNull().default({}),
  price_label:         jsonb("price_label").notNull().default({}),
  description:         jsonb("description").notNull().default({}),
  benefits:            jsonb("benefits").notNull().default({}),
  tags:                text("tags").array().notNull().default([]),
  suitability:         jsonb("suitability").notNull().default({}),
  cautions:            jsonb("cautions").notNull().default({}),
  accessibility_notes: jsonb("accessibility_notes").notNull().default({}),
  availability_label:  jsonb("availability_label").notNull().default({}),
  price_tier:          text("price_tier").notNull().default("medium"),
  is_enabled:          boolean("is_enabled").notNull().default(true),
  priority:            integer("priority").notNull().default(50),
  admin_notes:         text("admin_notes"),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conciergeShoppingPackages = pgTable("concierge_shopping_packages", {
  id:              uuid("id").primaryKey().defaultRandom(),
  package_id:      text("package_id").notNull().unique(),
  label:           jsonb("label").notNull().default({}),
  description:     jsonb("description").notNull().default({}),
  need_text:       jsonb("need_text").notNull().default({}),
  category:        text("category").notNull().default("safe_home"),
  priorities:      text("priorities").array().notNull().default([]),
  constraints:     jsonb("constraints").notNull().default({}),
  cta_label:       jsonb("cta_label").notNull().default({}),
  service_request: boolean("service_request").notNull().default(false),
  is_enabled:      boolean("is_enabled").notNull().default(true),
  priority:        integer("priority").notNull().default(50),
  admin_notes:     text("admin_notes"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conciergeShoppingPackageItems = pgTable("concierge_shopping_package_items", {
  id:         uuid("id").primaryKey().defaultRandom(),
  package_id: text("package_id").notNull().references(() => conciergeShoppingPackages.package_id, { onDelete: "cascade" }),
  product_id: text("product_id").notNull().references(() => conciergeShoppingProducts.product_id, { onDelete: "cascade" }),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("concierge_shopping_package_items_unique").on(t.package_id, t.product_id),
  index("concierge_shopping_package_items_package_idx").on(t.package_id),
]);

export const insertConciergeShoppingProductSchema = createInsertSchema(conciergeShoppingProducts).omit({ id: true, created_at: true, updated_at: true });
export type InsertConciergeShoppingProduct = z.infer<typeof insertConciergeShoppingProductSchema>;
export type ConciergeShoppingProductRow = typeof conciergeShoppingProducts.$inferSelect;

export const insertConciergeShoppingPackageSchema = createInsertSchema(conciergeShoppingPackages).omit({ id: true, created_at: true, updated_at: true });
export type InsertConciergeShoppingPackage = z.infer<typeof insertConciergeShoppingPackageSchema>;
export type ConciergeShoppingPackageRow = typeof conciergeShoppingPackages.$inferSelect;

export const insertConciergeShoppingPackageItemSchema = createInsertSchema(conciergeShoppingPackageItems).omit({ id: true, created_at: true });
export type InsertConciergeShoppingPackageItem = z.infer<typeof insertConciergeShoppingPackageItemSchema>;
export type ConciergeShoppingPackageItemRow = typeof conciergeShoppingPackageItems.$inferSelect;


// ============================================================
// SCHEMA EXPORT
// ============================================================

export const schema = {
  users,
  profiles,
  sessionState,
  sessionExchanges,
  agentDifficulty,
  caregiverAlerts,
  caregiverDashboardNotes,
  medicationAdherence,
  checkinSessions,
  checkinTrendState,
  userMedications,
  myMedicines,
  myMedicinesChangeLog,
  interactionFlagRules,
  interactionFlagDismissals,
  medicationSafetySignals,
  medicationSafetyCases,
  medicationSafetyCaseEvents,
  userHealthConditions,
  onboardingState,
  consentLog,
  teamInvitations,
  userChannelIdentity,
  userChannelPreferences,
  inboundNumberRouting,
  subscriptionPlans,
  billingEvents,
  stripeWebhooks,
  scamChecks,
  homeScans,
  woundScans,
  companionProfiles,
  companionConnections,
  socialRooms,
  socialRoomSessions,
  socialRoomVisits,
  socialUserInterests,
  advisorAgents,
  advisorSessions,
  advisorMessages,
  advisorUserAgentState,
  socialConnections,
  socialRoomMusicThreads,
  socialRoomMusicThreadEntries,
  socialRoomMusicCircleItems,
  socialRoomMusicItemReactions,
  socialRoomPlans,
  socialRoomPlanResponses,
  socialRoomReplies,
  socialRoomPolls,
  socialRoomVotes,
  socialRoomSafetyReports,
  socialRoomModerationActions,
  socialRoomMemberRoles,
  socialRoomNotifications,
  participationEvents,
  participationEventResponses,
  participationEventChecks,
  participationNotifications,
  triageReports,
  insightOutcomes,
  vitalsReadings,
  vyvaSignalReadings,
  vyvaUserBaselines,
  vyvaPatternWindows,
  userDeviceConnections,
  cognitiveSessionIndex,
  cognitiveDailyPlans,
  cognitiveDailyPlanItems,
  cognitiveDailyPlanEvents,
  cognitiveCaregiverSettings,
  learningCategories,
  learningLessons,
  learningPrograms,
  learningProgramItems,
  learningProgramEvents,
  organizations,
  tierEntitlements,
  userIntakes,
  accessLinks,
  lifecycleEvents,
  consentAttempts,
  communicationsLog,
  scheduledEvents,
  scheduledEventLogs,
  scheduledInteractions,
  interactionLogs,
  consentAuditLogs,
  userProviders,
  conciergePending,
  conciergeSessions,
  appointmentRequests,
  appointmentProviderOptions,
  appointmentAttempts,
  conciergeReminders,
  utilityReviewRuns,
  conciergeRecommendationFeedback,
  voiceRecommendationFeedback,
  voiceTriageSessions,
  homePlanCards,
  homeFastHelpJourneys,
  homeFastHelpJourneyEvents,
  heroMessages,
  heroMessageEvents,
  marketingAudiences,
  marketingAudienceMembers,
  marketingContentAssets,
  marketingMediaAssets,
  marketingCampaigns,
  marketingCampaignChannels,
  marketingCampaignMetrics,
  marketingJourneys,
  marketingJourneySteps,
  marketingJourneyEnrollments,
  marketingJourneyStepEvents,
  marketingContacts,
  marketingCampaignRecipients,
  marketingSyncRuns,
  conciergeShoppingProducts,
  conciergeShoppingPackages,
  conciergeShoppingPackageItems,
};
