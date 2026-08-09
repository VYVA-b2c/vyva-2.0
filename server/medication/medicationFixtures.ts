import type { MedicationSpecialistFlagInput } from "./medicationFeatureFlag.js";
import type { MedicationSpecialistInput } from "./medicationSpecialistAdapter.js";

export const TASK17_NOW = "2026-08-03T12:00:00.000Z";
export const TASK17_USER_ID = "task17-user";
export const TASK17_SESSION_ID = "task17-session";

export const task17MedicationEnabledEnv: MedicationSpecialistFlagInput["env"] = {
  NODE_ENV: "test",
  VYVA_MEDICATION_SPECIALIST_MODE: "specialist_preview",
  VYVA_MEDICATION_SPECIALIST_ALLOW_USERS: TASK17_USER_ID,
};

export const task17MedicationDisabledEnv: MedicationSpecialistFlagInput["env"] = {
  NODE_ENV: "test",
};

export const task17SpecialistInput: MedicationSpecialistInput = {
  requestId: "request.task17.medication.1",
  correlationId: "correlation.task17.medication.1",
  userId: TASK17_USER_ID,
  sessionId: TASK17_SESSION_ID,
  flowInstanceId: "flow_instance.task17.medication.1",
  currentState: "active",
  inputModality: "voice",
  locale: "en",
  timezone: "UTC",
  requestedAt: TASK17_NOW,
  utterance: "Can you help with my medication schedule?",
  confidence: 1,
};

export const task17MedicationParityFixtures = [{
  name: "medication management",
  utterance: "Can you help with my medication schedule?",
  actionType: "meds.management",
  route: "/meds",
  capability: "medication_management",
  presentationId: "presentation.medication.reminder",
  requiresConfirmation: false,
  riskLevel: "low",
}, {
  name: "inventory and adherence report",
  utterance: "Open my medication adherence report",
  actionType: "meds.inventory_report",
  route: "/meds/adherence-report",
  capability: "medication_inventory_report",
  presentationId: "presentation.medication.followup",
  requiresConfirmation: false,
  riskLevel: "low",
}, {
  name: "refill context",
  utterance: "I need a refill for my medicine",
  actionType: "meds.refill_request",
  route: "/meds/adherence-report",
  capability: "medication_refill_request",
  presentationId: "presentation.medication.human_help_confirmation",
  requiresConfirmation: true,
  riskLevel: "medium",
}] as const;

export const task17ValidNavigationFixtures = [
  "Open my medications.",
  "Show my medication schedule.",
  "Show my adherence report.",
  "Show my medication inventory.",
  "I need to check my medication refill.",
] as const;

export const task17ClinicalDosingExclusionFixtures = [{
  utterance: "Should I double my dose?",
  reasonCode: "medication_dose_mutation_legacy",
}, {
  utterance: "Can I stop taking this medication?",
  reasonCode: "medication_dose_mutation_legacy",
}, {
  utterance: "Should I skip tonight's dose?",
  reasonCode: "medication_dose_mutation_legacy",
}, {
  utterance: "Can I take two because I missed one?",
  reasonCode: "medication_dose_mutation_legacy",
}, {
  utterance: "Should I take another one?",
  reasonCode: "medication_dose_mutation_legacy",
}, {
  utterance: "Should I reduce my dose?",
  reasonCode: "medication_dose_mutation_legacy",
}] as const;

export const task17InteractionExclusionFixtures = [{
  utterance: "I think these two medicines are interacting badly.",
  reasonCode: "medication_interaction_or_side_effect_legacy",
}, {
  utterance: "Could these medications interact?",
  reasonCode: "medication_interaction_or_side_effect_legacy",
}, {
  utterance: "Are these drugs interacting?",
  reasonCode: "medication_interaction_or_side_effect_legacy",
}, {
  utterance: "Is there a drug interaction?",
  reasonCode: "medication_interaction_or_side_effect_legacy",
}] as const;

export const task17SafetyPrecedenceFixtures = [
  "I took too many pills.",
  "I overdosed.",
  "I took an extra dose by mistake.",
  "I can't breathe after taking my medication.",
  "I want to die and I took all my tablets.",
] as const;

export const task17CrossDomainFixtures = [{
  utterance: "I'm anxious about my medication.",
  expectedDomain: "meds",
  expectedAgent: "agent-meds-review",
}, {
  utterance: "I feel low after taking my medicine.",
  expectedDomain: "meds",
  expectedAgent: "agent-meds-review",
}, {
  utterance: "I need a ride to pick up my medication.",
  expectedDomain: "meds",
  expectedAgent: "agent-meds-review",
}, {
  utterance: "Can Brain Coach remind me about my medication?",
  expectedDomain: "meds",
  expectedAgent: "agent-meds-review",
}, {
  utterance: "I'm lonely and forgot my pill.",
  expectedDomain: "meds",
  expectedAgent: "agent-meds-review",
}] as const;

export const task17UnsupportedMedicationFixtures = [{
  name: "dose mutation remains legacy",
  utterance: "I took my medication",
  reasonCode: "medication_dose_mutation_legacy",
}, {
  name: "interaction review remains legacy",
  utterance: "Can you check a drug interaction for my medication?",
  reasonCode: "medication_interaction_or_side_effect_legacy",
}, {
  name: "unrecognized request",
  utterance: "tell me a story",
  reasonCode: "medication_not_recognized",
}] as const;
