export {
  TRIAGE_PROTOCOLS,
  evaluateTriage,
  evaluateTriageRules,
} from "./engine/evaluateTriage.js";

export {
  CRITICAL_RED_FLAG_IDS,
  applyTriageSafetyFloor,
  buildFallbackTriageReport,
  buildFallbackTriageReportWithTelemetry,
  evaluateTriageSafetyFloor,
  fallbackReportContent,
  firstAnswerKind,
  hasAnswer,
  nextAdaptiveStage,
  nextStepFor,
  primaryEscalationSource,
  profileConsiderationsFor,
  profileRiskFlags,
  scanNotesFor,
  selectedAnswers,
  selectedSafetyAnswer,
  selectedSymptomId,
  shouldCompleteFromRules,
  symptomLabel,
  uniqueStrings,
  vitalsNotesFor,
  watchSignsFor,
  type TriageOutcomeTelemetry,
} from "./engine/routeOutcome.js";

export {
  resetTriageTelemetrySink,
  setTriageTelemetrySink,
  trackTriageEvent,
} from "./telemetry/trackTriageEvent.js";

export type {
  ProfileRiskFlags,
  LocalizeTriageText,
  ProtocolProfileModifier,
  ProtocolRule,
  RaiseTriageLevel,
  TriageEscalationSource,
  TriageChatMessage,
  TriageHealthMemory,
  TriageProtocol,
  TriageRuleDecision,
  TriageRuleInput,
  TriageRuleTelemetry,
  TriageRuleLevel,
  TriageRuleRiskFlags,
  TriageSummary,
  TriageUrgency,
  TriageVitals,
  TriageWizardAnswer,
  TriageWizardContext,
  WizardStage,
} from "./types.js";

export type {
  TriageCompletionStatus,
  TriageTelemetryEvent,
  TriageTelemetryEventName,
  TriageTelemetryPayload,
  TriageTelemetrySink,
} from "./telemetry/types.js";
