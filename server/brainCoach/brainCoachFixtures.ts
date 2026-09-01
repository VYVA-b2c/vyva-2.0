import type { BrainCoachSpecialistFlagInput } from "./brainCoachFeatureFlag.js";
import type { BrainCoachSpecialistInput } from "./brainCoachSpecialistAdapter.js";

export const TASK15_NOW = "2026-08-03T12:00:00.000Z";
export const TASK15_USER_ID = "task15-user";
export const TASK15_SESSION_ID = "task15-session";

export const task15BrainCoachEnabledEnv: BrainCoachSpecialistFlagInput["env"] = {
  NODE_ENV: "test",
  VYVA_BRAIN_COACH_SPECIALIST_MODE: "specialist_preview",
  VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS: TASK15_USER_ID,
};

export const task15BrainCoachDisabledEnv: BrainCoachSpecialistFlagInput["env"] = {
  NODE_ENV: "test",
};

export const task15SpecialistInput: BrainCoachSpecialistInput = {
  requestId: "request.task15.brain_coach.1",
  correlationId: "correlation.task15.brain_coach.1",
  userId: TASK15_USER_ID,
  sessionId: TASK15_SESSION_ID,
  flowInstanceId: "flow_instance.task15.brain_coach.1",
  currentState: "active",
  inputModality: "voice",
  locale: "en",
  timezone: "UTC",
  requestedAt: TASK15_NOW,
  utterance: "Can we do a memory game?",
  confidence: 1,
};

export const task15BrainCoachParityFixtures = [{
  name: "activities hub entry",
  utterance: "open brain coach activities",
  actionType: "brain.activity",
  route: "/mind-memory",
  activityFamily: "hub",
}, {
  name: "supported memory activity",
  utterance: "Can we do a memory game?",
  actionType: "brain.memory_game",
  route: "/memory-games",
  activityFamily: "memory",
}, {
  name: "attention activity",
  utterance: "I want focus and attention practice",
  actionType: "brain.focus",
  route: "/attention-boosters",
  activityFamily: "attention",
}, {
  name: "executive activity from catalog",
  utterance: "start number trails",
  actionType: "brain.activity",
  route: "/executive-function/number-trails",
  activityFamily: "executive_function",
  activityType: "number_trails",
}, {
  name: "language activity from catalog",
  utterance: "start story recall",
  actionType: "brain.memory_game",
  route: "/memory-games/story_recall",
  activityFamily: "language",
  activityType: "story_recall",
}] as const;

export const task15UnsupportedFixture = {
  utterance: "let's play scrabble",
  reasonCode: "brain_coach_unsupported_activity",
} as const;
