import {
  PROFILE_ONBOARDING_AGENT_SECTION_IDS,
  type ProfileOnboardingAgentSectionId,
} from "@/components/onboarding/profileOnboardingAgentSections";
import type {
  OnboardingAgentDraftStatus,
  OnboardingAgentSectionConfig,
  OnboardingAgentVoiceStatus,
} from "@/components/onboarding/useOnboardingAgent";
import type {
  ProfileVoiceCommandKind,
  ProfileVoiceDraftKind,
  ProfileVoiceDraftRow,
} from "@/lib/profileVoiceCompletion";

export type OnboardingElevenLabsEventType =
  | "draft"
  | "command"
  | "clarification"
  | "status";

export type OnboardingElevenLabsAgentWritableLifecycle =
  | "listening"
  | "parsed-draft"
  | "needs-clarification"
  | "corrected-draft"
  | "confirmed-locally";

export type OnboardingElevenLabsAppOnlyLifecycle = "saved";

export type OnboardingElevenLabsLifecycle =
  | OnboardingElevenLabsAgentWritableLifecycle
  | OnboardingElevenLabsAppOnlyLifecycle;

export interface OnboardingElevenLabsSectionField {
  id: string;
  label: string;
  required?: boolean;
  pii?: boolean;
  valueType: "text" | "phone" | "email" | "date" | "choice" | "list" | "address";
}

export interface OnboardingElevenLabsSectionSchema {
  sectionId: ProfileOnboardingAgentSectionId;
  sectionLabel: string;
  voicePrompt: string;
  expectedFields: readonly string[];
  draftKind: ProfileVoiceDraftKind;
  fields: readonly OnboardingElevenLabsSectionField[];
  examples: readonly string[];
  reviewRequired: true;
  explicitSaveRequired: true;
}

export interface OnboardingElevenLabsAgentContract {
  id: "vyva_onboarding_profile";
  name: "VYVA Onboarding Profile Agent";
  provider: "elevenlabs";
  agentSlug: "onboarding-profile";
  conversationPlanId: "onboarding_profile_collection_v1";
  supportedSections: readonly ProfileOnboardingAgentSectionId[];
  lifecycle: {
    allStatuses: readonly OnboardingElevenLabsLifecycle[];
    agentWritableStatuses: readonly OnboardingElevenLabsAgentWritableLifecycle[];
    appOnlyStatuses: readonly OnboardingElevenLabsAppOnlyLifecycle[];
  };
  requiredContextKeys: readonly string[];
  optionalContextKeys: readonly string[];
  allowedOutputEvents: readonly OnboardingElevenLabsEventType[];
  correctionCommands: readonly ProfileVoiceCommandKind[];
  safetyRules: readonly string[];
  outputSchema: Record<string, unknown>;
}

export interface OnboardingElevenLabsSessionContextInput {
  sectionConfig: OnboardingAgentSectionConfig<ProfileOnboardingAgentSectionId>;
  language: string;
  mode: "voice" | "tactile";
  existingProfileSummary?: string;
  activeDraftId?: string;
}

export interface OnboardingElevenLabsSessionContext {
  agent_contract_id: OnboardingElevenLabsAgentContract["id"];
  conversation_plan_id: OnboardingElevenLabsAgentContract["conversationPlanId"];
  active_section_id: ProfileOnboardingAgentSectionId;
  active_section_label: string;
  active_section_prompt: string;
  active_section_expected_fields: string;
  active_section_review_required: true;
  active_section_explicit_save_required: true;
  profile_summary: string;
  language: string;
  onboarding_mode: "voice" | "tactile";
  active_draft_id?: string;
}

export interface OnboardingElevenLabsOutputSafety {
  localOnly: true;
  requiresReview: true;
  requiresExplicitSave: true;
  mayTriggerExternalAction: false;
}

export interface OnboardingElevenLabsDraftOutput {
  eventType: "draft";
  sectionId: ProfileOnboardingAgentSectionId;
  lifecycle: "parsed-draft" | "corrected-draft";
  voiceStatus?: OnboardingAgentVoiceStatus;
  draft: {
    kind: ProfileVoiceDraftKind;
    title?: string;
    helper?: string;
    rows: ProfileVoiceDraftRow[];
    values?: string[];
    metadata?: Record<string, string>;
  };
  safety: OnboardingElevenLabsOutputSafety;
}

export interface OnboardingElevenLabsCommandOutput {
  eventType: "command";
  sectionId: ProfileOnboardingAgentSectionId;
  lifecycle: "listening" | "corrected-draft" | "confirmed-locally";
  command: {
    kind: ProfileVoiceCommandKind | "confirm-locally";
    target?: string;
  };
  safety: OnboardingElevenLabsOutputSafety;
}

export interface OnboardingElevenLabsClarificationOutput {
  eventType: "clarification";
  sectionId: ProfileOnboardingAgentSectionId;
  lifecycle: "needs-clarification";
  question: string;
  missingFields?: string[];
  safety: OnboardingElevenLabsOutputSafety;
}

export interface OnboardingElevenLabsStatusOutput {
  eventType: "status";
  sectionId: ProfileOnboardingAgentSectionId;
  lifecycle: "listening" | "needs-clarification";
  voiceStatus: "listening" | "thinking" | "error";
  message?: string;
  safety: OnboardingElevenLabsOutputSafety;
}

export type OnboardingElevenLabsAgentOutput =
  | OnboardingElevenLabsDraftOutput
  | OnboardingElevenLabsCommandOutput
  | OnboardingElevenLabsClarificationOutput
  | OnboardingElevenLabsStatusOutput;

export type OnboardingElevenLabsOutputValidation =
  | { ok: true; output: OnboardingElevenLabsAgentOutput }
  | { ok: false; reason: string };

export type OnboardingAgentEffectPolicyInput =
  | {
      source: "elevenlabs-agent";
      output: OnboardingElevenLabsAgentOutput;
    }
  | {
      source: "app-section-save";
      sectionId: ProfileOnboardingAgentSectionId;
      explicitUserSave: boolean;
      draftStatus: OnboardingAgentDraftStatus;
    };

export interface OnboardingAgentEffectPolicy {
  mayPersistProfileData: boolean;
  mayTriggerExternalAction: false;
  reason: string;
}

const SECTION_SCHEMAS: Record<ProfileOnboardingAgentSectionId, OnboardingElevenLabsSectionSchema> = {
  basics: {
    sectionId: "basics",
    sectionLabel: "Basic details",
    voicePrompt: "Ask for one or two basic details, then return a draft for review.",
    expectedFields: ["fullName", "preferredName", "email", "phoneLocal", "birthDate"],
    draftKind: "basics",
    fields: [
      { id: "fullName", label: "Full name", valueType: "text", pii: true },
      { id: "preferredName", label: "Preferred name", valueType: "text", pii: true },
      { id: "email", label: "Email", valueType: "email", pii: true },
      { id: "phoneLocal", label: "Phone", valueType: "phone", pii: true },
      { id: "birthDate", label: "Date of birth", valueType: "date", pii: true },
    ],
    examples: ["My name is Rosa Martin and my phone is +34 600 111 222."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  address: {
    sectionId: "address",
    sectionLabel: "Home address",
    voicePrompt: "Ask for the home address and return address fields for review.",
    expectedFields: ["address_line_1", "address_line_2", "city", "region", "postcode", "country"],
    draftKind: "address",
    fields: [
      { id: "address_line_1", label: "Street address", valueType: "address", pii: true },
      { id: "address_line_2", label: "Floor / apartment", valueType: "text", pii: true },
      { id: "city", label: "City / Town", valueType: "text", pii: true },
      { id: "region", label: "Region / Province", valueType: "text", pii: true },
      { id: "postcode", label: "Postcode", valueType: "text", pii: true },
      { id: "country", label: "Country", valueType: "text", pii: true },
    ],
    examples: ["I live at 42 Calle Mayor, Zamora, 49001, Spain."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  health: {
    sectionId: "health",
    sectionLabel: "Health profile",
    voicePrompt: "Ask for known health conditions and return only the conditions mentioned.",
    expectedFields: ["conditions"],
    draftKind: "health-conditions",
    fields: [{ id: "conditions", label: "Condition", valueType: "list", pii: true }],
    examples: ["I have diabetes and high blood pressure."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  medications: {
    sectionId: "medications",
    sectionLabel: "Medications",
    voicePrompt: "Ask for medication name, strength, and routine. Do not advise dose changes.",
    expectedFields: ["name", "dosage", "routine"],
    draftKind: "medications",
    fields: [
      { id: "name", label: "Medication", valueType: "text", pii: true },
      { id: "dosage", label: "Strength", valueType: "text", pii: true },
      { id: "routine", label: "Routine", valueType: "text", pii: true },
    ],
    examples: ["I take Metformin 500mg morning and evening."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  allergies: {
    sectionId: "allergies",
    sectionLabel: "Allergies",
    voicePrompt: "Ask for allergies and return only possible allergies the user stated.",
    expectedFields: ["allergies"],
    draftKind: "allergies",
    fields: [{ id: "allergies", label: "Allergy", valueType: "list", pii: true }],
    examples: ["I am allergic to penicillin and latex."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  gp: {
    sectionId: "gp",
    sectionLabel: "GP details",
    voicePrompt: "Ask for the GP or practice name and contact details. Do not call, message, book, or navigate.",
    expectedFields: ["name", "address", "phone", "email"],
    draftKind: "provider",
    fields: [
      { id: "name", label: "Practice / Surgery name", valueType: "text", pii: true },
      { id: "address", label: "Address", valueType: "address", pii: true },
      { id: "phone", label: "Phone", valueType: "phone", pii: true },
      { id: "email", label: "Email", valueType: "email", pii: true },
    ],
    examples: ["My GP is Riverside Medical Centre, phone +44 1234 567890."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  providers: {
    sectionId: "providers",
    sectionLabel: "Providers / care team",
    voicePrompt: "Ask for provider name and contact details. Do not call, message, or book.",
    expectedFields: ["name", "providerType", "address", "phone", "email"],
    draftKind: "provider",
    fields: [
      { id: "name", label: "Provider", valueType: "text", pii: true },
      { id: "providerType", label: "Provider type", valueType: "choice" },
      { id: "address", label: "Address", valueType: "address", pii: true },
      { id: "phone", label: "Phone", valueType: "phone", pii: true },
      { id: "email", label: "Email", valueType: "email", pii: true },
    ],
    examples: ["My clinic is Zamora Clinic, phone +34 600 000 000."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  "care-team": {
    sectionId: "care-team",
    sectionLabel: "Care team",
    voicePrompt: "Ask for one care team member's name, relationship, role, and contact details. Do not send invitations.",
    expectedFields: ["name", "relationship", "role", "phone", "email"],
    draftKind: "provider",
    fields: [
      { id: "name", label: "Care team member", valueType: "text", pii: true },
      { id: "relationship", label: "Relationship", valueType: "text", pii: true },
      { id: "role", label: "Role", valueType: "choice" },
      { id: "phone", label: "Phone", valueType: "phone", pii: true },
      { id: "email", label: "Email", valueType: "email", pii: true },
    ],
    examples: ["Add my daughter Sara as family, phone +34 612 345 678."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  emergency: {
    sectionId: "emergency",
    sectionLabel: "Emergency contacts",
    voicePrompt: "Ask for one emergency contact and return contact details for review.",
    expectedFields: ["name", "relationship", "primary_phone", "address"],
    draftKind: "emergency-contact",
    fields: [
      { id: "name", label: "Full name", valueType: "text", pii: true },
      { id: "relationship", label: "Relationship", valueType: "text", pii: true },
      { id: "primary_phone", label: "Primary phone", valueType: "phone", pii: true },
      { id: "address", label: "Address", valueType: "address", pii: true },
    ],
    examples: ["My emergency contact is Sara, my daughter, phone +34 612 345 678."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  devices: {
    sectionId: "devices",
    sectionLabel: "Devices",
    voicePrompt: "Ask what devices the user uses. Return only selected devices for review.",
    expectedFields: ["devices"],
    draftKind: "devices",
    fields: [{ id: "devices", label: "Device", valueType: "list" }],
    examples: ["I use a Fitbit and a blood pressure monitor."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  diet: {
    sectionId: "diet",
    sectionLabel: "Diet",
    voicePrompt: "Ask for dietary preferences and return them for review.",
    expectedFields: ["diet", "dietary_notes"],
    draftKind: "diet",
    fields: [
      { id: "diet", label: "Diet preference", valueType: "list", pii: true },
      { id: "dietary_notes", label: "Notes", valueType: "text", pii: true },
    ],
    examples: ["I am gluten-free and prefer low salt."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  hobbies: {
    sectionId: "hobbies",
    sectionLabel: "Hobbies",
    voicePrompt: "Ask for hobbies and interests. Return only the interests the user mentioned.",
    expectedFields: ["hobbies", "interests"],
    draftKind: "hobbies",
    fields: [
      { id: "hobbies", label: "Hobby", valueType: "list", pii: true },
      { id: "interests", label: "Interest", valueType: "list", pii: true },
    ],
    examples: ["I like walking, reading, and cooking."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
  cognitive: {
    sectionId: "cognitive",
    sectionLabel: "Cognitive preferences",
    voicePrompt: "Ask for support preferences such as pace, session length, and language simplicity.",
    expectedFields: ["memory_support", "session_length", "pace", "simple_language"],
    draftKind: "cognitive",
    fields: [
      { id: "memory_support", label: "Memory support", valueType: "choice", pii: true },
      { id: "session_length", label: "Session length", valueType: "text" },
      { id: "pace", label: "Pace", valueType: "choice" },
      { id: "simple_language", label: "Simple language", valueType: "choice" },
    ],
    examples: ["I prefer short sessions, slower pace, and simple language."],
    reviewRequired: true,
    explicitSaveRequired: true,
  },
};

export const ONBOARDING_ELEVENLABS_AGENT_CONTRACT: OnboardingElevenLabsAgentContract = {
  id: "vyva_onboarding_profile",
  name: "VYVA Onboarding Profile Agent",
  provider: "elevenlabs",
  agentSlug: "onboarding-profile",
  conversationPlanId: "onboarding_profile_collection_v1",
  supportedSections: PROFILE_ONBOARDING_AGENT_SECTION_IDS,
  lifecycle: {
    allStatuses: [
      "listening",
      "parsed-draft",
      "needs-clarification",
      "corrected-draft",
      "confirmed-locally",
      "saved",
    ],
    agentWritableStatuses: [
      "listening",
      "parsed-draft",
      "needs-clarification",
      "corrected-draft",
      "confirmed-locally",
    ],
    appOnlyStatuses: ["saved"],
  },
  requiredContextKeys: [
    "agent_contract_id",
    "conversation_plan_id",
    "active_section_id",
    "active_section_label",
    "active_section_prompt",
    "active_section_expected_fields",
    "active_section_review_required",
    "active_section_explicit_save_required",
    "language",
    "onboarding_mode",
  ],
  optionalContextKeys: ["profile_summary", "active_draft_id"],
  allowedOutputEvents: ["draft", "command", "clarification", "status"],
  correctionCommands: ["remove", "try-again", "skip"],
  safetyRules: [
    "Return structured local drafts only; never save profile data.",
    "Never trigger calls, messages, bookings, navigation, payments, or external service actions.",
    "Every draft must be reviewed in the app before it can be applied locally.",
    "The app may persist a section only after the user presses the section Save control.",
    "The saved lifecycle state is app-only and must not be emitted by the ElevenLabs agent.",
    "Do not include spoken transcripts or raw personal details in analytics or logs.",
  ],
  outputSchema: {
    type: "object",
    required: ["eventType", "sectionId", "lifecycle", "safety"],
    additionalProperties: false,
    properties: {
      eventType: { enum: ["draft", "command", "clarification", "status"] },
      sectionId: { enum: PROFILE_ONBOARDING_AGENT_SECTION_IDS },
      lifecycle: {
        enum: [
          "listening",
          "parsed-draft",
          "needs-clarification",
          "corrected-draft",
          "confirmed-locally",
        ],
      },
      draft: { type: "object" },
      command: { type: "object" },
      question: { type: "string" },
      missingFields: { type: "array", items: { type: "string" } },
      voiceStatus: { enum: ["listening", "thinking", "error"] },
      message: { type: "string" },
      safety: {
        type: "object",
        required: [
          "localOnly",
          "requiresReview",
          "requiresExplicitSave",
          "mayTriggerExternalAction",
        ],
        properties: {
          localOnly: { const: true },
          requiresReview: { const: true },
          requiresExplicitSave: { const: true },
          mayTriggerExternalAction: { const: false },
        },
      },
    },
  },
};

const FORBIDDEN_OUTPUT_KEYS = new Set([
  "apiFetch",
  "apiEndpoint",
  "booking",
  "call",
  "externalAction",
  "messageToSend",
  "method",
  "navigation",
  "payment",
  "post",
  "save",
  "sendMessage",
  "toolCall",
  "url",
]);

export function onboardingElevenLabsSectionSchemas() {
  return SECTION_SCHEMAS;
}

export function onboardingElevenLabsSchemaForSection(sectionId: ProfileOnboardingAgentSectionId) {
  return SECTION_SCHEMAS[sectionId];
}

export function createOnboardingElevenLabsSessionContext({
  sectionConfig,
  language,
  mode,
  existingProfileSummary,
  activeDraftId,
}: OnboardingElevenLabsSessionContextInput): OnboardingElevenLabsSessionContext {
  const schema = onboardingElevenLabsSchemaForSection(sectionConfig.sectionId);
  return {
    agent_contract_id: ONBOARDING_ELEVENLABS_AGENT_CONTRACT.id,
    conversation_plan_id: ONBOARDING_ELEVENLABS_AGENT_CONTRACT.conversationPlanId,
    active_section_id: sectionConfig.sectionId,
    active_section_label: sectionConfig.sectionLabel || schema.sectionLabel,
    active_section_prompt: sectionConfig.voicePrompt || schema.voicePrompt,
    active_section_expected_fields: sectionConfig.expectedFields.join(", "),
    active_section_review_required: true,
    active_section_explicit_save_required: true,
    profile_summary: existingProfileSummary?.trim() || "No existing profile summary supplied.",
    language,
    onboarding_mode: mode,
    ...(activeDraftId ? { active_draft_id: activeDraftId } : {}),
  };
}

export function buildOnboardingElevenLabsSystemPrompt() {
  return [
    "You are the VYVA Onboarding Profile Agent.",
    "Help the user complete exactly one active onboarding profile section at a time.",
    "Use the active section context and ask only for missing details that belong to that section.",
    "Return only the structured JSON output schema supplied by the app.",
    "A draft is local-only. The app must show it for review before applying it locally.",
    "You may handle correction commands: remove, try-again, skip, and confirm-locally.",
    "You must never save profile data, call, message, book, navigate, pay, or trigger external actions.",
    "If urgent safety, medical, or emergency language appears, ask the app for safe escalation context instead of completing profile data.",
    "Keep language warm, concise, senior-friendly, and aligned with the active language context.",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasForbiddenOutputKey(value: unknown): string | null {
  if (!isRecord(value) && !Array.isArray(value)) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = hasForbiddenOutputKey(item);
      if (found) return found;
    }
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_OUTPUT_KEYS.has(key)) return key;
    const found = hasForbiddenOutputKey(nested);
    if (found) return found;
  }
  return null;
}

function hasRequiredSafety(value: unknown): value is OnboardingElevenLabsOutputSafety {
  return isRecord(value)
    && value.localOnly === true
    && value.requiresReview === true
    && value.requiresExplicitSave === true
    && value.mayTriggerExternalAction === false;
}

function isSupportedSection(value: unknown): value is ProfileOnboardingAgentSectionId {
  return typeof value === "string"
    && PROFILE_ONBOARDING_AGENT_SECTION_IDS.includes(value as ProfileOnboardingAgentSectionId);
}

function isAgentWritableLifecycle(value: unknown): value is OnboardingElevenLabsAgentWritableLifecycle {
  return typeof value === "string"
    && ONBOARDING_ELEVENLABS_AGENT_CONTRACT.lifecycle.agentWritableStatuses.includes(
      value as OnboardingElevenLabsAgentWritableLifecycle,
    );
}

function isOutputEvent(value: unknown): value is OnboardingElevenLabsEventType {
  return typeof value === "string"
    && ONBOARDING_ELEVENLABS_AGENT_CONTRACT.allowedOutputEvents.includes(
      value as OnboardingElevenLabsEventType,
    );
}

function isDraftRows(value: unknown): value is ProfileVoiceDraftRow[] {
  return Array.isArray(value)
    && value.every((row) =>
      isRecord(row)
      && typeof row.id === "string"
      && typeof row.label === "string"
      && typeof row.value === "string",
    );
}

export function validateOnboardingElevenLabsOutput(
  value: unknown,
): OnboardingElevenLabsOutputValidation {
  if (!isRecord(value)) return { ok: false, reason: "Output must be an object." };

  const forbiddenKey = hasForbiddenOutputKey(value);
  if (forbiddenKey) {
    return { ok: false, reason: `Output includes forbidden external action key: ${forbiddenKey}.` };
  }

  if (!isOutputEvent(value.eventType)) return { ok: false, reason: "Unsupported output event type." };
  if (!isSupportedSection(value.sectionId)) return { ok: false, reason: "Unsupported onboarding section." };
  if (!isAgentWritableLifecycle(value.lifecycle)) {
    return { ok: false, reason: "Lifecycle status is not writable by the ElevenLabs agent." };
  }
  if (!hasRequiredSafety(value.safety)) {
    return { ok: false, reason: "Output must be local-only, review-required, explicit-save-required, and non-external." };
  }

  if (value.eventType === "draft") {
    if (value.lifecycle !== "parsed-draft" && value.lifecycle !== "corrected-draft") {
      return { ok: false, reason: "Draft output must use parsed-draft or corrected-draft lifecycle." };
    }
    if (!isRecord(value.draft) || !isDraftRows(value.draft.rows)) {
      return { ok: false, reason: "Draft output must include review rows." };
    }
  }

  if (value.eventType === "command") {
    if (!isRecord(value.command) || typeof value.command.kind !== "string") {
      return { ok: false, reason: "Command output must include a command kind." };
    }
  }

  if (value.eventType === "clarification" && typeof value.question !== "string") {
    return { ok: false, reason: "Clarification output must include a question." };
  }

  if (value.eventType === "status" && typeof value.voiceStatus !== "string") {
    return { ok: false, reason: "Status output must include voiceStatus." };
  }

  return { ok: true, output: value as OnboardingElevenLabsAgentOutput };
}

export function classifyOnboardingAgentEffect(
  input: OnboardingAgentEffectPolicyInput,
): OnboardingAgentEffectPolicy {
  if (input.source === "elevenlabs-agent") {
    return {
      mayPersistProfileData: false,
      mayTriggerExternalAction: false,
      reason: "ElevenLabs onboarding outputs are local draft events only.",
    };
  }

  return {
    mayPersistProfileData: input.explicitUserSave === true && input.draftStatus === "confirmed-locally",
    mayTriggerExternalAction: false,
    reason: input.explicitUserSave === true && input.draftStatus === "confirmed-locally"
      ? "The app may save the active section after explicit user save."
      : "The app must wait for local confirmation and an explicit section save.",
  };
}
