import { index, pgTable, text, integer, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { profiles } from "./schema.js";

export const breathingExercises = pgTable("breathing_exercises", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  slug:                     text("slug").notNull().unique(),
  name:                     text("name").notNull(),
  description:              text("description").notNull().default(""),
  purposes:                 text("purposes").array().notNull().default([]),
  mood_tags:                text("mood_tags").array().notNull().default([]),
  difficulty:               integer("difficulty").notNull().default(1),
  duration_options:         integer("duration_options").array().notNull().default([3]),
  default_duration_minutes: integer("default_duration_minutes").notNull().default(3),
  pattern:                  jsonb("pattern").notNull().default({}),
  safety_notes:             text("safety_notes").array().notNull().default([]),
  contraindications:        text("contraindications").array().notNull().default([]),
  voice_style:              text("voice_style").notNull().default("gentle"),
  content:                  jsonb("content").notNull().default({}),
  progression:              jsonb("progression").notNull().default({}),
  language:                 text("language").notNull().default("en"),
  is_active:                boolean("is_active").notNull().default(true),
  created_at:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBreathingExerciseSchema = createInsertSchema(breathingExercises).omit({ id: true, created_at: true, updated_at: true });
export type InsertBreathingExercise = z.infer<typeof insertBreathingExerciseSchema>;
export type BreathingExerciseRow = typeof breathingExercises.$inferSelect;

export const breathingUserPreferences = pgTable("breathing_user_preferences", {
  user_id:                      text("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  preferred_difficulty:         integer("preferred_difficulty").notNull().default(1),
  preferred_duration_minutes:   integer("preferred_duration_minutes").notNull().default(3),
  preferred_voice_style:        text("preferred_voice_style").notNull().default("gentle"),
  preferred_mode:               text("preferred_mode").notNull().default("voice"),
  favorite_exercises:           text("favorite_exercises").array().notNull().default([]),
  disliked_exercises:           text("disliked_exercises").array().notNull().default([]),
  safety_flags:                 text("safety_flags").array().notNull().default([]),
  last_completed_exercise_slug: text("last_completed_exercise_slug"),
  last_mood:                    text("last_mood"),
  updated_at:                   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBreathingUserPreferenceSchema = createInsertSchema(breathingUserPreferences).omit({ updated_at: true });
export type InsertBreathingUserPreference = z.infer<typeof insertBreathingUserPreferenceSchema>;
export type BreathingUserPreferenceRow = typeof breathingUserPreferences.$inferSelect;

export const breathingSessions = pgTable("breathing_sessions", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  user_id:             text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  source:              text("source").notNull().default("app"),
  voice_session_id:    text("voice_session_id"),
  exercise_id:         uuid("exercise_id").references(() => breathingExercises.id, { onDelete: "set null" }),
  exercise_slug:       text("exercise_slug").notNull(),
  status:              text("status").notNull().default("planned"),
  purpose:             text("purpose"),
  mood_before:         text("mood_before"),
  mood_after:          text("mood_after"),
  intent:              jsonb("intent").notNull().default({}),
  plan:                jsonb("plan").notNull().default({}),
  preference_snapshot: jsonb("preference_snapshot").notNull().default({}),
  difficulty:          integer("difficulty").notNull().default(1),
  duration_minutes:    integer("duration_minutes").notNull().default(3),
  comfort_rating:      integer("comfort_rating"),
  stopped_reason:      text("stopped_reason"),
  started_at:          timestamp("started_at", { withTimezone: true }),
  completed_at:        timestamp("completed_at", { withTimezone: true }),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_breathing_sessions_user_created").on(t.user_id, t.created_at.desc()),
  index("idx_breathing_sessions_user_status").on(t.user_id, t.status, t.created_at.desc()),
  index("idx_breathing_sessions_exercise").on(t.exercise_slug, t.created_at.desc()),
]);

export const insertBreathingSessionSchema = createInsertSchema(breathingSessions).omit({ id: true, created_at: true, updated_at: true });
export type InsertBreathingSession = z.infer<typeof insertBreathingSessionSchema>;
export type BreathingSessionRow = typeof breathingSessions.$inferSelect;

export const breathingSessionEvents = pgTable("breathing_session_events", {
  id:         uuid("id").primaryKey().defaultRandom(),
  session_id: uuid("session_id").notNull().references(() => breathingSessions.id, { onDelete: "cascade" }),
  user_id:    text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  event_type: text("event_type").notNull(),
  payload:    jsonb("payload").notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_breathing_session_events_session").on(t.session_id, t.created_at.desc()),
  index("idx_breathing_session_events_user").on(t.user_id, t.created_at.desc()),
]);

export const insertBreathingSessionEventSchema = createInsertSchema(breathingSessionEvents).omit({ id: true, created_at: true });
export type InsertBreathingSessionEvent = z.infer<typeof insertBreathingSessionEventSchema>;
export type BreathingSessionEventRow = typeof breathingSessionEvents.$inferSelect;
