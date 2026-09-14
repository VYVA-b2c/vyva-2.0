export const TASK18_NOW = "2026-08-10T10:00:00.000Z";
export const TASK18_USER_ID = "user-task18";
export const TASK18_SESSION_ID = "session-task18";

export const task18FlagEnabledEnv = {
  VYVA_CONCIERGE_SPECIALIST_MODE: "specialist_preview",
  VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS: TASK18_USER_ID,
} as const;

export const task18FlagDisabledEnv = {
  VYVA_CONCIERGE_SPECIALIST_MODE: "legacy_only",
} as const;

export const task18SpecialistInput = {
  requestId: "request.concierge.specialist.fixture",
  correlationId: "correlation.concierge.specialist.fixture",
  userId: TASK18_USER_ID,
  sessionId: TASK18_SESSION_ID,
  flowInstanceId: "flow_instance.concierge.fixture",
  currentState: "active" as const,
  inputModality: "voice" as const,
  locale: "en",
  timezone: "UTC",
  requestedAt: TASK18_NOW,
  utterance: "Open Concierge.",
  confidence: 1,
};

export const task18ConciergeParityFixtures = [
  {
    label: "request intake",
    utterance: "Open Concierge.",
    expectedActionType: "concierge.task",
    expectedRoute: "/concierge",
    expectedCapability: "concierge_request_intake",
    expectedRequestCategory: "request_intake",
    expectedPresentationId: "presentation.concierge.request_intake",
  },
  {
    label: "Trusted Help setup context",
    utterance: "Open Trusted Help.",
    expectedActionType: "concierge.task",
    expectedRoute: "/concierge",
    expectedCapability: "concierge_trusted_help_context",
    expectedRequestCategory: "trusted_help_setup",
    expectedPresentationId: "presentation.concierge.trusted_help_setup",
  },
  {
    label: "shopping context",
    utterance: "Open shopping helper.",
    expectedActionType: "concierge.shopping",
    expectedRoute: "/concierge/shopping",
    expectedCapability: "concierge_shopping_context",
    expectedRequestCategory: "shopping_context",
    expectedPresentationId: "presentation.concierge.shopping_context",
  },
] as const;

export const task18ValidNavigationFixtures = [
  "Open Concierge.",
  "Show my Concierge page.",
  "I need Concierge help.",
  "Open Trusted Help.",
  "Show Trusted Help setup.",
  "Open shopping helper.",
] as const;

export const task18ExternalExecutionFixtures = [
  { utterance: "Book me a taxi.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Get me a ride to my doctor.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Call a plumber.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Order groceries for me.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Call my trusted person.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Book an appointment.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Cancel my booking.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Pay for it.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Use my card.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Send my address to the driver.", expectedReasonCode: "concierge_external_execution_legacy" },
  { utterance: "Contact the pharmacy.", expectedReasonCode: "concierge_external_execution_legacy" },
] as const;

export const task18SafetyPrecedenceFixtures = [
  "I need a ride to the emergency room.",
  "Call someone, I can't breathe.",
  "Book me transport, I think I overdosed.",
  "I've fallen and need a taxi.",
  "I'm in danger, call my trusted person.",
  "I want to die, get me a ride.",
] as const;

export const task18CrossDomainFixtures = [
  { utterance: "I need a ride to pick up my medication.", expectedDomain: "meds", expectedAgent: "agent-meds-review" },
  { utterance: "I'm anxious and need someone to drive me.", expectedDomain: "companion", expectedAgent: "agent-companion-review" },
  { utterance: "Can Brain Coach arrange transport?", expectedDomain: "brain_coach", expectedAgent: "agent-brain-coach-review" },
  { utterance: "I need help getting to my doctor.", expectedDomain: "health", expectedAgent: "agent-health-review" },
  { utterance: "I need someone to collect my prescription.", expectedDomain: "meds", expectedAgent: "agent-meds-review" },
  { utterance: "I want a caregiver to help me book transport.", expectedDomain: "companion", expectedAgent: "agent-companion-review" },
  { utterance: "Can someone call the pharmacy for me?", expectedDomain: "companion", expectedAgent: "agent-companion-review" },
] as const;

export const task18UnsupportedFixtures = [
  { utterance: "What time is sunset?", expectedReasonCode: "concierge_not_recognized" },
  { utterance: "Yes, do it.", expectedReasonCode: "concierge_not_recognized" },
] as const;
