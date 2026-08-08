import type { PreventiveHealthResult } from "../health/preventiveHealthOrchestrator.js";
import type { HealthMemoryEnvironmentMap } from "./healthMemoryPolicy.js";

export const TASK13_NOW = new Date("2026-08-08T09:30:00.000Z");
export const TASK13_USER_ID = "user-task13";
export const TASK13_PROFILE_ID = "profile-task13";
export const TASK13_FLOW_INSTANCE_ID = "session-task13";
export const TASK13_COMPLETION_REFERENCE = "completion.health.preventive_check.fixture";
export const TASK13_ANSWER_DIGEST =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export const task13PreventiveHealthResult: PreventiveHealthResult = {
  feeling_label: "Stable day",
  overall_state: "good",
  vyva_reading: "A preventive reading is ready.",
  why_today: "The structured answers are stable.",
  trend_note: null,
  personal_plan: "Keep the day simple.",
  app_suggestion: "Use the existing health plan.",
  suggested_app_action: "concierge",
  right_now: ["Drink water"],
  today_actions: ["Take a short pause"],
  highlight: "A steady preventive check.",
  flag_caregiver: false,
  watch_for: null,
};

export const task13PilotEnv: HealthMemoryEnvironmentMap = {
  VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_MODE: "pilot",
  VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_USERS: TASK13_USER_ID,
  VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_DENY_USERS: undefined,
  VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ROLLOUT_BPS: undefined,
  VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_PRODUCTION: "false",
  NODE_ENV: "staging",
};

export const task13DisabledEnv: HealthMemoryEnvironmentMap = {
  VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_MODE: "disabled",
  NODE_ENV: "staging",
};

export const task13SemanticMemoryConsent = {
  semantic_memory: {
    read_allowed: true,
    write_allowed: true,
    revision: 7,
    approval_reference: "consent.memory.task13",
  },
};

export const task13NoSemanticMemoryConsent = {
  conditions: {
    health_conditions: ["hypertension"],
  },
};

export const task13RevokedSemanticMemoryConsent = {
  semantic_memory: {
    read_allowed: true,
    write_allowed: true,
    revision: 8,
    revoked_at: "2026-08-08T09:00:00.000Z",
  },
};
