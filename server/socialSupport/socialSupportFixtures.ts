import type { SocialSupportSpecialistInput } from "./socialSupportSpecialistAdapter";

export const TASK19_USER_ID = "user-social-support-task19" as const;
export const TASK19_SESSION_ID = "session-social-support-task19" as const;
export const TASK19_NOW = new Date("2026-08-03T09:30:00.000Z");

export const task19FlagEnabledEnv = {
  NODE_ENV: "test",
  VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: "specialist_preview",
  VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS: TASK19_USER_ID,
} as const;

export const task19FlagDisabledEnv = {
  NODE_ENV: "test",
  VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE: "legacy_only",
} as const;

export const task19SocialParityFixtures = [
  {
    label: "community hub entry",
    utterance: "Open community.",
    expectedActionType: "social.community",
    expectedRoute: "/social-rooms",
    expectedCapability: "social_community_navigation",
    expectedRequestCategory: "community_home",
    expectedPresentationId: "presentation.social.community_connection.summary",
  },
  {
    label: "social rooms context",
    utterance: "Show social rooms.",
    expectedActionType: "social.rooms",
    expectedRoute: "/social-rooms/join-in",
    expectedCapability: "social_rooms_context",
    expectedRequestCategory: "social_rooms",
    expectedPresentationId: "presentation.social.community_connection.rooms",
  },
  {
    label: "community activities context",
    utterance: "I want to do a social activity.",
    expectedActionType: "social.activities",
    expectedRoute: "/social-rooms/activities",
    expectedCapability: "community_activities_context",
    expectedRequestCategory: "community_activities",
    expectedPresentationId: "presentation.social.community_connection.activities",
  },
] as const;

export const task19ValidNavigationFixtures = [
  "Open community.",
  "Show the community page.",
  "Open social rooms.",
  "Join social rooms.",
  "Show community activities.",
  "I want to do a social activity.",
] as const;

export const task19MentalWellbeingOverlapFixtures = [
  "I'm lonely.",
  "I'm feeling low.",
  "I'm anxious.",
  "I'm stressed and need someone to talk to.",
  "I want some company.",
  "I feel isolated.",
  "Can I talk to someone?",
  "I feel isolated and want a social activity.",
] as const;

export const task19ConciergeOverlapFixtures = [
  "I need a ride.",
  "I need help getting to my doctor.",
  "I need someone to pick up groceries.",
  "Open Trusted Help.",
  "I need a helper.",
] as const;

export const task19CaregiverBoundaryFixtures = [
  "Open caregiver settings.",
  "Show who can see my health information.",
  "Give my daughter access to my medications.",
  "Tell my caregiver I took my medication.",
  "Call my daughter.",
  "Message my caregiver.",
  "Invite my caregiver.",
  "Share my health report with my family.",
] as const;

export const task19SafetyPrecedenceFixtures = [
  "I'm in danger, call my caregiver.",
  "I fell and need someone.",
  "I can't breathe, call my daughter.",
  "I want to die, tell my family.",
  "Someone is hurting me.",
  "I overdosed, call my caregiver.",
  "I need help right now.",
] as const;

export const task19UnsupportedFixtures = [
  {
    utterance: "yes",
    expectedReasonCode: "social_support_not_recognized",
  },
  {
    utterance: "confirm",
    expectedReasonCode: "social_support_not_recognized",
  },
  {
    utterance: "Call someone to help me.",
    expectedReasonCode: "social_support_external_execution_legacy",
  },
  {
    utterance: "Create a support task for my family",
    expectedReasonCode: "social_support_caregiver_authority_legacy",
  },
  {
    utterance: "Find a local community provider and book it",
    expectedReasonCode: "social_support_concierge_legacy",
  },
] as const;

export const task19SpecialistInput: SocialSupportSpecialistInput = {
  requestId: "request.social_support.test",
  correlationId: "correlation.social_support.test",
  userId: TASK19_USER_ID,
  sessionId: TASK19_SESSION_ID,
  flowInstanceId: "flow_instance.social_support.test",
  currentState: "active",
  inputModality: "voice",
  locale: "en",
  timezone: "UTC",
  requestedAt: TASK19_NOW.toISOString(),
  utterance: "Open social rooms.",
  confidence: 0.95,
  currentRoute: "/",
};
