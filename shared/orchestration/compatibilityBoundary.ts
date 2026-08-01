import { z } from "zod";
import {
  interactionEventSchema,
  parseInteractionEvent,
  type InteractionEvent,
} from "./events";
import {
  flowStateSchema,
  parseFlowState,
  type FlowState,
} from "./flowState";
import {
  parseFlowCatalogue,
  VYVA_FLOW_CATALOGUE,
  type FlowCatalogue,
} from "./flowCatalogue";
import {
  parsePresentationRegistry,
  VYVA_PRESENTATION_REGISTRY,
  type PresentationRegistry,
} from "./presentationRegistry";
import {
  ORCHESTRATOR_POLICY_PRECEDENCE,
  orchestratorPolicyDecisionSchema,
  orchestratorPolicyEvaluationRequestSchema,
  parseOrchestratorPolicyDecision,
  parseOrchestratorPolicyEvaluationRequest,
  validateOrchestratorPolicyDecision,
  type OrchestratorPolicyDecision,
  type OrchestratorPolicyEvaluationRequest,
  type OrchestratorPolicyValidationOptions,
} from "./orchestratorPolicy";
import {
  specialistRiskLevelSchema,
  type SpecialistRiskLevel,
} from "./specialist";
import {
  contractError,
  OrchestrationContractError,
  type OrchestrationContractErrorCode,
} from "./errors";

const MAX_ITEMS = 128;
const MAX_SEAMS = 32;
const MAX_METADATA_KEYS = 64;
const MAX_TEXT = 240;
const stableIdSchema = z.string().min(1).max(160)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const opaqueReferenceSchema = z.string().min(1).max(200)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/);
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const dateTimeSchema = z.string().datetime();
const legacySafeDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const JWT_SEGMENT_MIN_LENGTH = 8;
const JWT_SEGMENT_MAX_LENGTH = 128;
const JWT_TOTAL_MAX_LENGTH = 240;
const safeTextSchema = z.string().min(1).max(MAX_TEXT);
const unique = <T extends z.ZodTypeAny>(schema: T, maximum = MAX_ITEMS) =>
  z.array(schema).max(maximum).refine(
    (values) => new Set(values.map((value) => JSON.stringify(value))).size ===
      values.length,
    "duplicate value",
  );

const PROHIBITED_KEY_FRAGMENTS = [
  "transcript", "audio", "imagecontent", "documentcontent", "toolarguments",
  "providerpayload", "authorizationheader", "hiddenreasoning",
  "chainofthought", "runtimeobject", "financial", "accountnumber",
  "cardnumber",
] as const;
const PROHIBITED_SENSITIVE_KEY_TOKENS = new Set([
  "credential", "credentials", "password", "secret", "token",
  "authorization", "authorizationheader", "callback", "function",
]);
const PROHIBITED_EXECUTABLE_KEY_TOKENS = new Set([
  "endpoint", "endpointurl", "url", "uri", "executeurl", "invokeurl",
  "requesturl", "callbackurl", "webhook", "webhookurl", "client",
  "apiclient", "provider", "providerclient", "providerobject",
  "providerinstance", "runtimeclient", "sdkclient", "httpclient", "baseurl",
  "apiurl", "host", "hostname", "connection", "connectionstring", "socket",
  "transport", "executor", "execute", "invoke", "handler",
  "adapterinstance",
]);
const PROHIBITED_VALUE_PATTERNS = [
  /(?:https?|wss?|ftp|file):\/\/|javascript:|data:|mailto:/i,
  /^(?:\\\\|\/\/)[^/\\]+[/\\]/,
  /(?:^|[;\s])(?:server|data\s+source|host|hostname|endpoint|url)\s*=/i,
  /(?:^|\s)(?:localhost|(?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3}):\d{2,5}(?:\b|\/)/i,
  /^Bearer\s+/i,
  /^Basic\s+[A-Za-z0-9+/]{8,}={0,2}$/i,
  /^AIza[0-9A-Za-z_-]{35}$/,
  /^(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})$/,
  /^(?:sk|pk)-[A-Za-z0-9_-]{12,128}$/i,
  /\b(?:api_?key|access_?token|client_?secret|secret_?key|token)\s*=\s*[^\s;]{8,}/i,
  /-----BEGIN (?:[A-Z0-9][A-Z0-9 ]{0,30} )?PRIVATE KEY-----/i,
  /^[A-Za-z0-9+/]{160,}={0,2}$/,
] as const;

function isBoundedJwtLike(value: string): boolean {
  if (value.length > JWT_TOTAL_MAX_LENGTH) return false;
  const segments = value.split(".");
  return segments.length === 3 && segments.every((segment) =>
    segment.length >= JWT_SEGMENT_MIN_LENGTH &&
    segment.length <= JWT_SEGMENT_MAX_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(segment));
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isDedicatedSourcePath(path: readonly string[]): boolean {
  const normalizedPath = path.map(normalizedKey);
  if (normalizedPath.at(-1) !== "sourcepathreference") return false;
  return (
    normalizedPath.length === 2 &&
    normalizedPath[0] === "legacyseamsnapshot"
  ) || (
    normalizedPath.length === 3 &&
    normalizedPath[0] === "seams" &&
    /^\d+$/.test(normalizedPath[1])
  );
}

function isAuditSafe(
  value: unknown,
  key = "",
  depth = 0,
  path: readonly string[] = [],
): boolean {
  if (depth > 16) return false;
  const keyToken = normalizedKey(key);
  const opaqueKey = /(id|ids|reference|references|digest|digests)$/.test(keyToken);
  if (
    (keyToken === "sourcepathreference" && !isDedicatedSourcePath(path)) ||
    PROHIBITED_EXECUTABLE_KEY_TOKENS.has(keyToken) ||
    PROHIBITED_SENSITIVE_KEY_TOKENS.has(keyToken) ||
    (!opaqueKey &&
      PROHIBITED_KEY_FRAGMENTS.some((item) => keyToken.includes(item)))
  ) {
    return false;
  }
  if (value === undefined || value === null || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))) return true;
  if (typeof value === "string") {
    return value.length <= MAX_TEXT &&
      !isBoundedJwtLike(value) &&
      !PROHIBITED_VALUE_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.length <= MAX_ITEMS &&
      value.every((item, index) =>
        isAuditSafe(item, key, depth + 1, [...path, String(index)]));
  }
  if (typeof value === "object" && value) {
    const entries = Object.entries(value);
    return entries.length <= MAX_METADATA_KEYS &&
      entries.every(([childKey, child]) =>
        isAuditSafe(child, childKey, depth + 1, [...path, childKey]));
  }
  return false;
}

const safeMetadataSchema = z.record(z.unknown()).superRefine((value, context) => {
  if (!isAuditSafe(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "unsafe metadata" });
  }
});

function fail(code: OrchestrationContractErrorCode): never {
  contractError(code);
}

function parseWith<T>(
  schema: z.ZodType<T>,
  input: unknown,
  code: OrchestrationContractErrorCode,
): T {
  if (!isAuditSafe(input)) fail("COMPATIBILITY_AUDIT_INVALID");
  const parsed = schema.safeParse(input);
  if (!parsed.success) fail(code);
  return parsed.data;
}

function canonicalStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalStableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalStableValue(child)]));
  }
  return value;
}

function canonicalContractEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalStableValue(left)) ===
    JSON.stringify(canonicalStableValue(right));
}

export const COMPATIBILITY_SCHEMA_VERSION = "1.0.0" as const;
export const SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS = Object.freeze({
  interactionEvent: "1.0.0",
  flowState: "1.0.0",
  specialist: "1.0.0",
  flowCatalogue: VYVA_FLOW_CATALOGUE.catalogueVersion,
  presentationRegistry: VYVA_PRESENTATION_REGISTRY.registryVersion,
  orchestratorPolicy: "1.0.0",
  compatibilityBoundary: COMPATIBILITY_SCHEMA_VERSION,
});

export const SUPPORTED_FROZEN_VERSIONS = Object.freeze({
  ...SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS,
  legacySeamRegistry: "1.0.0",
  legacySeam: "1.0.0",
  comparatorRegistry: "1.0.0",
  comparisonPolicyRegistry: "1.0.0",
  policyDifferenceAuthorityMatrix: "1.0.0",
  goldenCatalogue: "1.0.0",
  goldenCase: "1.0.0",
});

export const LEGACY_SEAM_IDS = [
  "legacy.voice.agent_contract",
  "legacy.voice.session_bridge",
  "legacy.voice.session_state",
  "legacy.voice.engine",
  "legacy.triage.current_protocol",
  "legacy.triage.route_outcome",
] as const;
export const legacySeamIdSchema = z.enum(LEGACY_SEAM_IDS);
export const SUPPORTED_LEGACY_SEAM_VERSIONS = Object.freeze(
  Object.fromEntries(LEGACY_SEAM_IDS.map((id) => [id, "1.0.0"])) as
    Record<typeof LEGACY_SEAM_IDS[number], "1.0.0">,
);

export const LEGACY_EFFECT_KINDS = [
  "read_session_id", "write_session_id", "ensure_session_id",
  "clear_session_id", "session_changed_event", "triage_touch_answer_event",
  "session_phase_change", "response_delivery", "speech_playback",
  "route_outcome", "triage_fallback_report", "escalation_outcome",
] as const;

export const legacySeamDescriptorSchema = z.object({
  seamId: legacySeamIdSchema,
  seamVersion: semverSchema,
  domain: z.enum(["voice", "session", "triage", "social"]),
  responsibility: safeTextSchema,
  inputKinds: unique(stableIdSchema),
  outputKinds: unique(stableIdSchema),
  effectKinds: unique(z.enum(LEGACY_EFFECT_KINDS)),
  sessionSemantics: unique(stableIdSchema),
  knownLegacyIdentifiers: unique(stableIdSchema),
  compatibilityCriticality: z.enum(["low", "medium", "high", "critical"]),
  safetyCritical: z.boolean(),
  shadowComparable: z.boolean(),
  rollbackTarget: stableIdSchema,
  sourcePathReference: z.string().min(1).max(180)
    .regex(/^src\/[a-zA-Z0-9_./-]+\.ts$/)
    .refine((value) => !value.includes(".."), "invalid source path"),
  status: z.enum(["active", "pilot", "deprecated", "retired"]),
  notes: safeTextSchema,
}).strict();

export const legacySeamRegistrySchema = z.object({
  registryId: z.literal("vyva.legacy_compatibility_seams"),
  registryVersion: semverSchema,
  seams: z.array(legacySeamDescriptorSchema).min(1).max(MAX_SEAMS),
  nonExecutable: z.literal(true),
}).strict().superRefine((registry, context) => {
  const seamIds = registry.seams.map((seam) => seam.seamId);
  const pairs = registry.seams.map((seam) =>
    `${seam.seamId}@${seam.seamVersion}`);
  if (new Set(seamIds).size !== seamIds.length ||
    new Set(pairs).size !== pairs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate seam" });
  }
  if (
    registry.registryVersion !== SUPPORTED_FROZEN_VERSIONS.legacySeamRegistry ||
    seamIds.length !== LEGACY_SEAM_IDS.length ||
    LEGACY_SEAM_IDS.some((id) => !seamIds.includes(id)) ||
    registry.seams.some((seam) =>
      seam.seamVersion !== SUPPORTED_LEGACY_SEAM_VERSIONS[seam.seamId] ||
      seam.status === "retired" ||
      !seamIds.includes(seam.rollbackTarget as typeof LEGACY_SEAM_IDS[number]))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "incomplete or unsupported V1 seam registry",
    });
  }
});

export type LegacySeamDescriptor = z.infer<typeof legacySeamDescriptorSchema>;
export type LegacySeamRegistry = z.infer<typeof legacySeamRegistrySchema>;

export const VYVA_LEGACY_SEAM_REGISTRY: LegacySeamRegistry = {
  registryId: "vyva.legacy_compatibility_seams",
  registryVersion: "1.0.0",
  seams: [
    {
      seamId: "legacy.voice.agent_contract",
      seamVersion: "1.0.0",
      domain: "voice",
      responsibility: "Declares voice agent domains, entrypoints, plans, context keys, actions and handoffs.",
      inputKinds: ["voice_context_variables", "agent_selection"],
      outputKinds: ["voice_agent_contract", "voice_context_validation"],
      effectKinds: [],
      sessionSemantics: ["conversation_plan", "agent_handoff"],
      knownLegacyIdentifiers: [
        "VoiceAgentDomain", "VoiceAgentContract", "VoiceContextValidation",
        "VoiceContextVariables", "VOICE_AGENT_CONTRACTS",
      ],
      compatibilityCriticality: "high",
      safetyCritical: true,
      shadowComparable: true,
      rollbackTarget: "legacy.voice.agent_contract",
      sourcePathReference: "src/lib/voiceAgentContracts.ts",
      status: "active",
      notes: "Descriptor only; Task 5 does not import or invoke the runtime contract selector.",
    },
    {
      seamId: "legacy.voice.session_bridge",
      seamVersion: "1.0.0",
      domain: "session",
      responsibility: "Bridges voice session identity and touch answers through browser storage and events.",
      inputKinds: ["session_reference", "triage_touch_answer"],
      outputKinds: ["session_reference", "browser_event"],
      effectKinds: [
        "read_session_id", "write_session_id", "ensure_session_id",
        "clear_session_id", "session_changed_event", "triage_touch_answer_event",
      ],
      sessionSemantics: [
        "VYVA_VOICE_SESSION_STORAGE_KEY",
        "VYVA_VOICE_SESSION_CHANGED_EVENT",
        "VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT",
      ],
      knownLegacyIdentifiers: [
        "VoiceSessionChangedDetail", "VoiceTriageTouchAnswerDetail",
        "readVoiceSessionId", "writeVoiceSessionId", "ensureVoiceSessionId",
        "clearVoiceSessionId", "emitVoiceTriageTouchAnswer",
      ],
      compatibilityCriticality: "critical",
      safetyCritical: true,
      shadowComparable: true,
      rollbackTarget: "legacy.voice.session_bridge",
      sourcePathReference: "src/lib/voiceSessionBridge.ts",
      status: "active",
      notes: "Browser storage and events are represented as non-executable effect vocabulary only.",
    },
    {
      seamId: "legacy.voice.session_state",
      seamVersion: "1.0.0",
      domain: "session",
      responsibility: "Derives the visible voice session phase from connection and transfer state.",
      inputKinds: ["voice_connection_status"],
      outputKinds: ["voice_session_phase", "voice_session_phase_label"],
      effectKinds: ["session_phase_change"],
      sessionSemantics: ["BaseVoiceConnectionStatus", "VoiceSessionPhase"],
      knownLegacyIdentifiers: ["deriveVoiceSessionPhase", "voiceSessionPhaseLabel"],
      compatibilityCriticality: "high",
      safetyCritical: false,
      shadowComparable: true,
      rollbackTarget: "legacy.voice.session_state",
      sourcePathReference: "src/lib/voiceSessionState.ts",
      status: "active",
      notes: "Phase derivation is observed; Task 5 does not mutate connection state.",
    },
    {
      seamId: "legacy.voice.engine",
      seamVersion: "1.0.0",
      domain: "social",
      responsibility: "Uses browser speech synthesis and speaking-state UI effects.",
      inputKinds: ["speech_text_reference", "speech_options"],
      outputKinds: ["speech_state"],
      effectKinds: ["speech_playback"],
      sessionSemantics: ["speaking", "stopped"],
      knownLegacyIdentifiers: ["speak", "stopSpeaking"],
      compatibilityCriticality: "medium",
      safetyCritical: false,
      shadowComparable: false,
      rollbackTarget: "legacy.voice.engine",
      sourcePathReference: "src/social/voiceEngine.ts",
      status: "active",
      notes: "Speech is never invoked by the compatibility contract.",
    },
    {
      seamId: "legacy.triage.current_protocol",
      seamVersion: "1.0.0",
      domain: "triage",
      responsibility: "Adapts current deterministic triage protocols, rules, urgency and vitals.",
      inputKinds: ["triage_rule_input", "triage_vitals"],
      outputKinds: ["triage_rule_decision", "triage_urgency"],
      effectKinds: [],
      sessionSemantics: ["triage_protocol_progress"],
      knownLegacyIdentifiers: [
        "TRIAGE_PROTOCOLS", "evaluateTriage", "evaluateTriageRules",
        "TriageProtocol", "TriageRuleDecision", "TriageUrgency",
      ],
      compatibilityCriticality: "critical",
      safetyCritical: true,
      shadowComparable: true,
      rollbackTarget: "legacy.triage.current_protocol",
      sourcePathReference: "src/triage/adapters/fromCurrentProtocol.ts",
      status: "active",
      notes: "Protocol evaluation is not called from Task 5.",
    },
    {
      seamId: "legacy.triage.route_outcome",
      seamVersion: "1.0.0",
      domain: "triage",
      responsibility: "Applies the triage safety floor, route outcome, fallback report and escalation telemetry.",
      inputKinds: ["triage_summary", "triage_wizard_context", "health_memory_reference"],
      outputKinds: ["triage_route_outcome", "triage_outcome_telemetry"],
      effectKinds: [
        "route_outcome", "triage_fallback_report", "escalation_outcome",
      ],
      sessionSemantics: ["triage_stage", "fallback_report"],
      knownLegacyIdentifiers: [
        "TriageOutcomeTelemetry", "CRITICAL_RED_FLAG_IDS",
        "buildFallbackTriageReport", "evaluateTriageSafetyFloor",
        "applyTriageSafetyFloor", "primaryEscalationSource",
      ],
      compatibilityCriticality: "critical",
      safetyCritical: true,
      shadowComparable: true,
      rollbackTarget: "legacy.triage.route_outcome",
      sourcePathReference: "src/triage/engine/routeOutcome.ts",
      status: "active",
      notes: "Legacy safety remains authoritative until a separately reviewed runtime milestone.",
    },
  ],
  nonExecutable: true,
};

export const COMPATIBILITY_MODES = [
  "legacy_only", "shadow_compare", "candidate_delivery", "authoritative",
] as const;
export type CompatibilityMode = typeof COMPATIBILITY_MODES[number];
export const compatibilityModeSchema = z.enum(COMPATIBILITY_MODES);

export const compatibilityModeStateSchema = z.object({
  requestedMode: compatibilityModeSchema,
  effectiveMode: z.enum(["legacy_only", "shadow_compare"]),
  defaultMode: z.literal("legacy_only"),
  activationEligibility: z.enum([
    "eligible", "ineligible", "future_contract_required",
  ]),
  featureFlagReference: opaqueReferenceSchema.optional(),
  rolloutReference: opaqueReferenceSchema.optional(),
  reasonCode: stableIdSchema,
  nonExecutable: z.literal(true),
}).strict().superRefine((state, context) => {
  const currentEligible = ["legacy_only", "shadow_compare"];
  if (!currentEligible.includes(state.effectiveMode) ||
    (state.effectiveMode === "shadow_compare" &&
      state.requestedMode === "legacy_only") ||
    (["candidate_delivery", "authoritative"].includes(state.requestedMode) &&
      state.activationEligibility !== "future_contract_required") ||
    (currentEligible.includes(state.requestedMode) &&
      state.requestedMode !== state.effectiveMode)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid mode" });
  }
});

export const legacyInputSnapshotSchema = z.object({
  snapshotId: opaqueReferenceSchema,
  seamId: legacySeamIdSchema,
  seamVersion: semverSchema,
  capturedAt: dateTimeSchema,
  correlationId: opaqueReferenceSchema,
  sessionReference: opaqueReferenceSchema.optional(),
  userReference: opaqueReferenceSchema.optional(),
  profileReference: opaqueReferenceSchema.optional(),
  locale: z.string().min(2).max(20),
  channel: z.enum(["voice", "pwa", "telephone", "touch", "text", "caregiver", "operator"]),
  deviceClass: z.enum(["mobile", "tablet", "desktop", "telephone", "unknown"]),
  agentDomain: stableIdSchema.optional(),
  agentContractId: stableIdSchema.optional(),
  entrypoint: stableIdSchema.optional(),
  planId: stableIdSchema.optional(),
  startsFrom: stableIdSchema.optional(),
  contextKeyPresence: z.record(stableIdSchema, z.boolean()),
  contextValidationStatus: z.enum(["ready", "missing_required", "idle", "not_applicable"]),
  actionType: stableIdSchema.optional(),
  legacyRouteReference: opaqueReferenceSchema.optional(),
  legacyFlowReference: opaqueReferenceSchema.optional(),
  triageProtocolReference: opaqueReferenceSchema.optional(),
  safeMetadata: safeMetadataSchema,
}).strict();
export type LegacyInputSnapshot = z.infer<typeof legacyInputSnapshotSchema>;

export const legacyEffectSchema = z.object({
  effectId: opaqueReferenceSchema,
  effectType: z.enum(LEGACY_EFFECT_KINDS),
  sourceSeamId: legacySeamIdSchema,
  correlationId: opaqueReferenceSchema,
  sessionReference: opaqueReferenceSchema.optional(),
  payloadReference: opaqueReferenceSchema.optional(),
  safetyClassification: z.enum(["none", "routine", "sensitive", "critical"]),
  nonExecutable: z.literal(true),
}).strict();

export const legacyResponseDigestProvenanceSchema = z.object({
  algorithm: z.literal("sha256"),
  canonicalizationVersion: z.literal("1.0.0"),
  nonExecutable: z.literal(true),
}).strict();
export type LegacyResponseDigestProvenance = z.infer<
  typeof legacyResponseDigestProvenanceSchema
>;

export const legacyOutputSnapshotSchema = z.object({
  snapshotId: opaqueReferenceSchema,
  inputSnapshotId: opaqueReferenceSchema,
  seamId: legacySeamIdSchema,
  seamVersion: semverSchema,
  capturedAt: dateTimeSchema,
  correlationId: opaqueReferenceSchema,
  responseReference: opaqueReferenceSchema.optional(),
  responseStatus: z.enum(["success", "fallback", "blocked", "error", "no_response"]),
  responseDigest: legacySafeDigestSchema.optional(),
  responseDigestProvenance: legacyResponseDigestProvenanceSchema.optional(),
  semanticResponseFactIds: unique(stableIdSchema),
  sessionWriteProposals: unique(stableIdSchema),
  browserEventProposals: unique(stableIdSchema),
  routeOutcome: stableIdSchema.optional(),
  escalationOutcome: stableIdSchema.optional(),
  fallbackOutcome: stableIdSchema.optional(),
  safetyClassification: z.enum(["clear", "watch", "urgent", "emergency", "unknown"]),
  uiNavigationOutcome: stableIdSchema.optional(),
  legacyErrorClassification: stableIdSchema.optional(),
  effects: z.array(legacyEffectSchema).max(MAX_ITEMS),
  auditReference: opaqueReferenceSchema,
  safeMetadata: safeMetadataSchema,
  nonExecutable: z.literal(true),
}).strict().superRefine((snapshot, context) => {
  if (
    Boolean(snapshot.responseDigest) !==
      Boolean(snapshot.responseDigestProvenance)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid response digest provenance",
    });
  }
});
export type LegacyOutputSnapshot = z.infer<typeof legacyOutputSnapshotSchema>;

export const contractVersionBundleSchema = z.object({
  interactionEventVersion: semverSchema,
  flowStateVersion: semverSchema,
  specialistContractVersion: semverSchema,
  flowCatalogueVersion: semverSchema,
  presentationRegistryVersion: semverSchema,
  orchestratorPolicyVersion: semverSchema,
  compatibilitySchemaVersion: semverSchema,
}).strict();

export const COMPARISON_DIMENSION_NAMES = [
  "response", "session", "safety", "routing", "escalation",
  "presentation", "effects",
] as const;
export type ComparisonDimensionName =
  typeof COMPARISON_DIMENSION_NAMES[number];

export const POLICY_DIFFERENCE_AUTHORITY_MATRIX_VERSION = "1.0.0";
export const POLICY_DIFFERENCE_CATEGORIES = [
  "LEGACY_FORMAT_ONLY",
] as const;
export const policyDifferenceCategorySchema = z.enum(
  POLICY_DIFFERENCE_CATEGORIES,
);
export const policyDifferenceAuthorityEntrySchema = z.object({
  differenceCategory: policyDifferenceCategorySchema,
  permittedDimensions: unique(z.enum(COMPARISON_DIMENSION_NAMES), 7),
  requiredTask4SubjectTypes: unique(z.literal("response_guidance")),
  permittedTask4PolicyIds: unique(stableIdSchema),
  permittedTask4PolicyCategories: unique(
    z.literal("response_composition"),
  ),
  permittedFindingOutcomes: unique(z.literal("allow")),
  permittedDirectiveTypes: unique(stableIdSchema),
  requiredPlanTypes: unique(z.literal("approved_response_plan")),
  requiresSameSubjectId: z.boolean(),
  requiresSamePresentation: z.boolean(),
  requiresSameFlow: z.boolean(),
  requiresSameScene: z.boolean(),
  requiresSameResponsePlan: z.boolean(),
  requiresSameEffectType: z.boolean(),
  comparisonPolicyIds: unique(z.literal("policy.compatibility.default")),
  nonExecutable: z.literal(true),
}).strict();
export type PolicyDifferenceAuthorityEntry = z.infer<
  typeof policyDifferenceAuthorityEntrySchema
>;

export const VYVA_POLICY_DIFFERENCE_AUTHORITY_MATRIX = Object.freeze({
  matrixId: "vyva.compatibility.policy_difference_authority",
  matrixVersion: POLICY_DIFFERENCE_AUTHORITY_MATRIX_VERSION,
  entries: [{
    differenceCategory: "LEGACY_FORMAT_ONLY",
    permittedDimensions: ["response"],
    requiredTask4SubjectTypes: ["response_guidance"],
    permittedTask4PolicyIds: ["policy.response_composition.allowed"],
    permittedTask4PolicyCategories: ["response_composition"],
    permittedFindingOutcomes: ["allow"],
    permittedDirectiveTypes: [],
    requiredPlanTypes: ["approved_response_plan"],
    requiresSameSubjectId: true,
    requiresSamePresentation: false,
    requiresSameFlow: false,
    requiresSameScene: false,
    requiresSameResponsePlan: true,
    requiresSameEffectType: false,
    comparisonPolicyIds: ["policy.compatibility.default"],
    nonExecutable: true,
  }],
  nonExecutable: true,
} as const);

export const policyDifferenceAuthorityMatrixSchema = z.object({
  matrixId: z.literal("vyva.compatibility.policy_difference_authority"),
  matrixVersion: z.literal(POLICY_DIFFERENCE_AUTHORITY_MATRIX_VERSION),
  entries: z.array(policyDifferenceAuthorityEntrySchema)
    .length(POLICY_DIFFERENCE_CATEGORIES.length),
  nonExecutable: z.literal(true),
}).strict().superRefine((matrix, context) => {
  const categories = matrix.entries.map((entry) => entry.differenceCategory);
  if (
    new Set(categories).size !== categories.length ||
    POLICY_DIFFERENCE_CATEGORIES.some((category) =>
      !categories.includes(category))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid policy difference authority matrix",
    });
  }
});

export const COMPARISON_OUTCOMES = [
  "exact_match", "normalized_match", "semantic_match",
  "approved_policy_difference", "legacy_safer", "canonical_safer",
  "incompatible", "missing_legacy_evidence", "missing_canonical_evidence",
  "not_comparable",
] as const;
export type ComparisonOutcome = typeof COMPARISON_OUTCOMES[number];

export const PARITY_CLASSIFICATIONS = [
  "byte_equivalent", "semantically_equivalent",
  "policy_approved_difference", "safe_fallback_required",
  "incompatible", "insufficient_evidence",
] as const;
export type ParityClassification = typeof PARITY_CLASSIFICATIONS[number];

export const SUPPORTED_DIGEST_ALGORITHMS = ["sha256"] as const;
export const SUPPORTED_CANONICALIZATION_VERSIONS = ["1.0.0"] as const;
export const digestRecordSchema = z.object({
  algorithm: z.enum(SUPPORTED_DIGEST_ALGORITHMS),
  value: z.string().regex(/^[a-f0-9]{64}$/),
  canonicalizationVersion: z.enum(SUPPORTED_CANONICALIZATION_VERSIONS),
}).strict();
export type DigestRecord = z.infer<typeof digestRecordSchema>;

export const COMPARATOR_IDS = [
  "comparator.exact_digest",
  "comparator.normalized_contract",
  "comparator.semantic_fixture",
  "comparator.policy_difference",
] as const;
export const comparatorIdSchema = z.enum(COMPARATOR_IDS);
export const comparatorDescriptorSchema = z.object({
  comparatorId: comparatorIdSchema,
  comparatorVersion: z.literal("1.0.0"),
  supportedDimensions: unique(z.enum(COMPARISON_DIMENSION_NAMES), 7),
  supportedComparisonOutcomes: unique(z.enum(COMPARISON_OUTCOMES), 10),
  deterministic: z.literal(true),
  requiresEvidenceReference: z.boolean(),
  allowsPolicyDifference: z.boolean(),
  canonicalizationVersion: z.enum(SUPPORTED_CANONICALIZATION_VERSIONS)
    .optional(),
  nonExecutable: z.literal(true),
}).strict();
export type ComparatorDescriptor = z.infer<typeof comparatorDescriptorSchema>;

const allComparisonDimensions = [...COMPARISON_DIMENSION_NAMES];
export const VYVA_COMPARATOR_REGISTRY = Object.freeze({
  registryId: "vyva.compatibility.comparators",
  registryVersion: "1.0.0",
  comparators: [
    {
      comparatorId: "comparator.exact_digest",
      comparatorVersion: "1.0.0",
      supportedDimensions: allComparisonDimensions,
      supportedComparisonOutcomes: ["exact_match"],
      deterministic: true,
      requiresEvidenceReference: false,
      allowsPolicyDifference: false,
      canonicalizationVersion: "1.0.0",
      nonExecutable: true,
    },
    {
      comparatorId: "comparator.normalized_contract",
      comparatorVersion: "1.0.0",
      supportedDimensions: allComparisonDimensions,
      supportedComparisonOutcomes: ["normalized_match"],
      deterministic: true,
      requiresEvidenceReference: true,
      allowsPolicyDifference: false,
      canonicalizationVersion: "1.0.0",
      nonExecutable: true,
    },
    {
      comparatorId: "comparator.semantic_fixture",
      comparatorVersion: "1.0.0",
      supportedDimensions: allComparisonDimensions,
      supportedComparisonOutcomes: [
        "semantic_match", "legacy_safer", "canonical_safer",
        "incompatible", "missing_legacy_evidence",
        "missing_canonical_evidence", "not_comparable",
      ],
      deterministic: true,
      requiresEvidenceReference: true,
      allowsPolicyDifference: false,
      nonExecutable: true,
    },
    {
      comparatorId: "comparator.policy_difference",
      comparatorVersion: "1.0.0",
      supportedDimensions: allComparisonDimensions,
      supportedComparisonOutcomes: ["approved_policy_difference"],
      deterministic: true,
      requiresEvidenceReference: true,
      allowsPolicyDifference: true,
      nonExecutable: true,
    },
  ],
  nonExecutable: true,
} as const);

export const comparatorRegistrySchema = z.object({
  registryId: z.literal("vyva.compatibility.comparators"),
  registryVersion: z.literal("1.0.0"),
  comparators: z.array(comparatorDescriptorSchema)
    .length(COMPARATOR_IDS.length),
  nonExecutable: z.literal(true),
}).strict().superRefine((registry, context) => {
  const expected = new Set(COMPARATOR_IDS);
  const ids = registry.comparators.map((item) => item.comparatorId);
  if (new Set(ids).size !== ids.length ||
    ids.some((id) => !expected.has(id)) ||
    COMPARATOR_IDS.some((id) => !ids.includes(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid comparator registry" });
  }
});

const allowedOutcomesByDimensionSchema = z.object(
  Object.fromEntries(COMPARISON_DIMENSION_NAMES.map((dimension) => [
    dimension,
    unique(z.enum(COMPARISON_OUTCOMES), COMPARISON_OUTCOMES.length),
  ])) as Record<ComparisonDimensionName, z.ZodTypeAny>,
).strict();

export const COMPARISON_POLICY_IDS = [
  "policy.compatibility.default",
] as const;
export const comparisonPolicyDescriptorSchema = z.object({
  comparisonPolicyId: z.enum(COMPARISON_POLICY_IDS),
  comparisonPolicyVersion: z.literal("1.0.0"),
  requiredDimensions: z.array(z.enum(COMPARISON_DIMENSION_NAMES)).length(7)
    .refine((values) => new Set(values).size === values.length, "duplicate value"),
  optionalDimensions: unique(z.enum(COMPARISON_DIMENSION_NAMES), 7),
  allowedOutcomeByDimension: allowedOutcomesByDimensionSchema,
  requiredDigestDimensions: unique(z.enum(COMPARISON_DIMENSION_NAMES), 7),
  semanticComparatorIds: unique(comparatorIdSchema, COMPARATOR_IDS.length),
  allowedPolicyDifferenceCategories: unique(stableIdSchema),
  snapshotMaxAgeSeconds: z.number().int().positive().max(86_400),
  requiredSafetyInvariants: unique(stableIdSchema),
  requiredConsentInvariants: unique(stableIdSchema),
  requiredPrivacyInvariants: unique(stableIdSchema),
  requiredAuditEvidence: unique(stableIdSchema),
  nonExecutable: z.literal(true),
}).strict();
export type ComparisonPolicyDescriptor =
  z.infer<typeof comparisonPolicyDescriptorSchema>;

const allOutcomes = [...COMPARISON_OUTCOMES];
export const VYVA_COMPARISON_POLICY_REGISTRY = Object.freeze({
  registryId: "vyva.compatibility.comparison_policies",
  registryVersion: "1.0.0",
  policies: [{
    comparisonPolicyId: "policy.compatibility.default",
    comparisonPolicyVersion: "1.0.0",
    requiredDimensions: allComparisonDimensions,
    optionalDimensions: [],
    allowedOutcomeByDimension: Object.fromEntries(
      COMPARISON_DIMENSION_NAMES.map((dimension) => [dimension, allOutcomes]),
    ),
    requiredDigestDimensions: allComparisonDimensions,
    semanticComparatorIds: [
      "comparator.normalized_contract",
      "comparator.semantic_fixture",
      "comparator.policy_difference",
    ],
    allowedPolicyDifferenceCategories: ["LEGACY_FORMAT_ONLY"],
    snapshotMaxAgeSeconds: 300,
    requiredSafetyInvariants: ["safety.no_downgrade"],
    requiredConsentInvariants: ["consent.no_downgrade"],
    requiredPrivacyInvariants: ["privacy.no_downgrade"],
    requiredAuditEvidence: ["audit.correlation_complete"],
    nonExecutable: true,
  }],
  nonExecutable: true,
} as const);

export const comparisonPolicyRegistrySchema = z.object({
  registryId: z.literal("vyva.compatibility.comparison_policies"),
  registryVersion: z.literal("1.0.0"),
  policies: z.array(comparisonPolicyDescriptorSchema)
    .length(COMPARISON_POLICY_IDS.length),
  nonExecutable: z.literal(true),
}).strict().superRefine((registry, context) => {
  const ids = registry.policies.map((item) => item.comparisonPolicyId);
  if (new Set(ids).size !== ids.length ||
    COMPARISON_POLICY_IDS.some((id) => !ids.includes(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid comparison policy registry" });
  }
});

export const comparisonPolicyReferenceSchema = z.object({
  comparisonPolicyId: z.enum(COMPARISON_POLICY_IDS),
  version: z.literal("1.0.0"),
  requiredDimensions: z.array(z.enum(COMPARISON_DIMENSION_NAMES)).length(7)
    .refine((values) => new Set(values).size === values.length, "duplicate value"),
  allowedDifferenceCodes: unique(stableIdSchema),
  safetyDowngradeAllowed: z.literal(false),
  consentDowngradeAllowed: z.literal(false),
}).strict();

export const compatibilityEvaluationRequestSchema = z.object({
  compatibilityRequestId: opaqueReferenceSchema,
  compatibilitySchemaVersion: z.literal(COMPATIBILITY_SCHEMA_VERSION),
  contractVersions: contractVersionBundleSchema,
  legacyInputSnapshot: legacyInputSnapshotSchema,
  normalizedEvent: interactionEventSchema,
  currentFlowState: flowStateSchema,
  policyEvaluationRequest: orchestratorPolicyEvaluationRequestSchema,
  suppliedPolicyDecision: orchestratorPolicyDecisionSchema,
  compatibilityMode: compatibilityModeStateSchema,
  legacySeamSnapshot: legacySeamDescriptorSchema,
  expectedComparisonPolicy: comparisonPolicyReferenceSchema,
  auditContext: z.object({
    auditReference: opaqueReferenceSchema,
    correlationId: opaqueReferenceSchema,
    sessionReference: opaqueReferenceSchema.optional(),
    capturedAt: dateTimeSchema,
    metadata: safeMetadataSchema,
  }).strict(),
  nonExecutable: z.literal(true),
}).strict();
export type CompatibilityEvaluationRequest =
  z.infer<typeof compatibilityEvaluationRequestSchema>;

export const ADAPTER_CATEGORIES = [
  "legacy_response_adapter", "legacy_session_adapter", "channel_adapter",
  "presentation_adapter", "tool_adapter", "memory_adapter",
  "flow_state_adapter", "audit_adapter", "escalation_adapter",
] as const;
export type AdapterCategory = typeof ADAPTER_CATEGORIES[number];

export const authorityVectorSchema = z.object({
  channels: unique(stableIdSchema),
  targets: unique(opaqueReferenceSchema),
  toolIds: unique(stableIdSchema),
  toolAuthorizationIds: unique(opaqueReferenceSchema),
  toolSchemaIds: unique(stableIdSchema),
  toolExpectedResultTypes: unique(opaqueReferenceSchema),
  toolRiskClassifications: unique(specialistRiskLevelSchema),
  toolIdempotencyKeyReferences: unique(opaqueReferenceSchema),
  toolConsentAuthorizationIds: unique(opaqueReferenceSchema),
  toolArgumentDigestIds: unique(opaqueReferenceSchema),
  memoryAuthorizationIds: unique(opaqueReferenceSchema),
  memorySubjectIds: unique(opaqueReferenceSchema),
  memoryCategories: unique(stableIdSchema),
  memoryTargets: unique(z.enum(["postgres", "mem0", "working_memory"])),
  retentionModes: unique(z.enum(["none", "session", "short_term", "long_term"])),
  escalationTypes: unique(z.enum(["emergency", "caregiver", "operator", "clinician", "technical"])),
  escalationTargets: unique(opaqueReferenceSchema),
  escalationChannels: unique(stableIdSchema),
  escalationUrgencies: unique(z.enum(["routine", "urgent", "immediate"])),
  escalationAuthorizationIds: unique(opaqueReferenceSchema),
  escalationConsentAuthorizationIds: unique(opaqueReferenceSchema),
  escalationDuplicateReferences: unique(opaqueReferenceSchema),
  presentationIds: unique(stableIdSchema),
  presentationVersions: unique(semverSchema),
  sceneIds: unique(stableIdSchema),
  flowIds: unique(stableIdSchema),
  flowVersions: unique(semverSchema),
  responseFactIds: unique(opaqueReferenceSchema),
  medicationInstructionIds: unique(opaqueReferenceSchema),
  consentScopes: unique(stableIdSchema),
  sessionWriteTypes: unique(stableIdSchema),
  browserEventTypes: unique(stableIdSchema),
  legacyEffectKinds: unique(z.enum(LEGACY_EFFECT_KINDS)),
  scheduleIds: unique(opaqueReferenceSchema),
  retryPolicies: unique(stableIdSchema),
  minimumSafetyRank: z.number().int().min(0).max(4),
  minimumPrivacyRank: z.number().int().min(0).max(4),
  confirmationRequired: z.boolean(),
  acknowledgementRequired: z.boolean(),
  requiredDisclaimerIds: unique(stableIdSchema),
  prohibitedClaimIds: unique(stableIdSchema),
  auditRequired: z.boolean(),
  idempotencyRequired: z.boolean(),
  timeoutPolicyIds: unique(stableIdSchema),
  failurePolicyIds: unique(stableIdSchema),
  providerAuthority: z.literal(false),
  executionAuthority: z.literal(false),
}).strict();
export type AuthorityVector = z.infer<typeof authorityVectorSchema>;

export const ADAPTER_EFFECT_TYPES = [
  "response", "session_write", "browser_event", "tool", "memory",
  "flow_state", "presentation", "audit", "escalation",
] as const;

export const adapterEffectProposalSchema = z.object({
  effectId: opaqueReferenceSchema,
  effectType: z.enum(ADAPTER_EFFECT_TYPES),
  authority: authorityVectorSchema,
  sourceAuthorizationId: opaqueReferenceSchema.optional(),
  sourcePlanId: opaqueReferenceSchema,
  payloadReference: opaqueReferenceSchema.optional(),
  nonExecutable: z.literal(true),
}).strict();

export const adapterAuthorizationPlanSchema = z.object({
  adapterPlanId: opaqueReferenceSchema,
  adapterCategory: z.enum(ADAPTER_CATEGORIES),
  sourceDecisionId: opaqueReferenceSchema,
  sourceAdjudicationIds: unique(opaqueReferenceSchema),
  sourceFindingIds: unique(opaqueReferenceSchema),
  sourcePlanIds: unique(opaqueReferenceSchema),
  sourceDirectiveIds: unique(opaqueReferenceSchema),
  sourceSeamId: legacySeamIdSchema,
  targetSeamId: legacySeamIdSchema,
  sourceAuthority: authorityVectorSchema,
  authorizedEffects: z.array(adapterEffectProposalSchema).max(MAX_ITEMS),
  prohibitedEffects: unique(z.enum(ADAPTER_EFFECT_TYPES)),
  narrowingConstraints: unique(stableIdSchema),
  correlationId: opaqueReferenceSchema,
  auditReference: opaqueReferenceSchema,
  nonExecutable: z.literal(true),
}).strict();
export type AdapterAuthorizationPlan =
  z.infer<typeof adapterAuthorizationPlanSchema>;

const VECTOR_ARRAY_FIELDS = [
  "channels", "targets", "toolIds", "toolAuthorizationIds", "toolSchemaIds",
  "toolExpectedResultTypes", "toolRiskClassifications",
  "toolIdempotencyKeyReferences",
  "toolConsentAuthorizationIds", "toolArgumentDigestIds",
  "memoryAuthorizationIds", "memorySubjectIds", "memoryCategories",
  "memoryTargets", "retentionModes", "escalationTypes",
  "escalationTargets", "escalationChannels", "escalationUrgencies",
  "escalationAuthorizationIds", "escalationConsentAuthorizationIds",
  "escalationDuplicateReferences", "presentationIds", "presentationVersions",
  "sceneIds", "flowIds", "flowVersions",
  "responseFactIds", "medicationInstructionIds", "consentScopes",
  "sessionWriteTypes", "browserEventTypes", "legacyEffectKinds",
  "scheduleIds", "retryPolicies",
] as const satisfies readonly (keyof AuthorityVector)[];

export function validateAdapterNonBroadening(
  source: AuthorityVector,
  proposed: AuthorityVector,
): void {
  for (const field of VECTOR_ARRAY_FIELDS) {
    const sourceValues = new Set(source[field] as readonly string[]);
    if ((proposed[field] as readonly string[]).some((value) =>
      !sourceValues.has(value))) fail("COMPATIBILITY_ADAPTER_BROADENING");
  }
  for (const field of [
    "requiredDisclaimerIds", "prohibitedClaimIds", "timeoutPolicyIds",
    "failurePolicyIds",
  ] as const) {
    const proposedValues = new Set(proposed[field]);
    if (source[field].some((value) => !proposedValues.has(value))) {
      fail("COMPATIBILITY_ADAPTER_BROADENING");
    }
  }
  if (proposed.minimumSafetyRank < source.minimumSafetyRank ||
    proposed.minimumPrivacyRank < source.minimumPrivacyRank ||
    (source.confirmationRequired && !proposed.confirmationRequired) ||
    (source.acknowledgementRequired && !proposed.acknowledgementRequired) ||
    (source.auditRequired && !proposed.auditRequired) ||
    (source.idempotencyRequired && !proposed.idempotencyRequired) ||
    proposed.providerAuthority || proposed.executionAuthority) {
    fail("COMPATIBILITY_ADAPTER_BROADENING");
  }
}

export const COMPARISON_DIMENSIONS = COMPARISON_OUTCOMES;
export const comparisonDimensionSchema = z.object({
  dimension: z.enum(COMPARISON_DIMENSION_NAMES),
  classification: z.enum(COMPARISON_OUTCOMES),
  legacyDigest: digestRecordSchema.optional(),
  canonicalDigest: digestRecordSchema.optional(),
  comparatorId: comparatorIdSchema,
  comparatorVersion: z.literal("1.0.0"),
  comparatorEvidenceReferences: unique(opaqueReferenceSchema),
  differenceCategory: policyDifferenceCategorySchema.optional(),
  policyFindingIds: unique(opaqueReferenceSchema),
  directiveIds: unique(opaqueReferenceSchema),
  safetyDowngrade: z.boolean(),
  consentDowngrade: z.boolean(),
  privacyDowngrade: z.boolean(),
}).strict();

type ComparisonDimension = z.infer<typeof comparisonDimensionSchema>;

export const responseComparisonEvidenceSchema = z.object({
  evidenceReference: opaqueReferenceSchema,
  compatibilityRequestId: opaqueReferenceSchema,
  task4DecisionId: opaqueReferenceSchema,
  legacyResponseReference: opaqueReferenceSchema,
  canonicalResponseReference: opaqueReferenceSchema,
  canonicalDigest: digestRecordSchema,
  requiredDisclaimers: unique(safeTextSchema),
  prohibitedClaims: unique(safeTextSchema),
  medicationReferenceIds: unique(opaqueReferenceSchema),
  safetyInvariantPassed: z.literal(true),
  consentInvariantPassed: z.literal(true),
  privacyInvariantPassed: z.literal(true),
  emergencyAuthorityPreserved: z.literal(true),
  nonExecutable: z.literal(true),
}).strict();
export type ResponseComparisonEvidence = z.infer<
  typeof responseComparisonEvidenceSchema
>;

function digestRecordsMatch(
  left: DigestRecord | undefined,
  right: DigestRecord | undefined,
): boolean {
  return Boolean(left && right &&
    left.algorithm === right.algorithm &&
    left.value === right.value &&
    left.canonicalizationVersion === right.canonicalizationVersion);
}

function comparatorFor(
  comparatorId: string,
  comparatorVersion: string,
): ComparatorDescriptor | undefined {
  return VYVA_COMPARATOR_REGISTRY.comparators.find((item) =>
    item.comparatorId === comparatorId &&
    item.comparatorVersion === comparatorVersion) as
      ComparatorDescriptor | undefined;
}

function parityCompatible(
  classification: ParityClassification,
  dimensions: readonly ComparisonDimension[],
): boolean {
  const has = (outcomes: readonly ComparisonOutcome[]) =>
    dimensions.some((item) => outcomes.includes(item.classification));
  const everyIn = (outcomes: readonly ComparisonOutcome[]) =>
    dimensions.every((item) => outcomes.includes(item.classification));
  const downgrade = dimensions.some((item) =>
    item.safetyDowngrade || item.consentDowngrade || item.privacyDowngrade);
  const semanticEvidenceValid = dimensions
    .filter((item) => ["normalized_match", "semantic_match"].includes(
      item.classification,
    ))
    .every((item) => {
      const comparator = comparatorFor(item.comparatorId, item.comparatorVersion);
      return Boolean(
        comparator &&
        comparator.deterministic &&
        comparator.supportedDimensions.includes(item.dimension) &&
        comparator.supportedComparisonOutcomes.includes(item.classification) &&
        item.comparatorEvidenceReferences.length > 0,
      );
    });
  const approvedEvidenceValid = dimensions
    .filter((item) => item.classification === "approved_policy_difference")
    .every((item) => {
      const comparator = comparatorFor(item.comparatorId, item.comparatorVersion);
      return Boolean(
        comparator?.allowsPolicyDifference &&
        comparator.supportedDimensions.includes(item.dimension) &&
        item.comparatorEvidenceReferences.length > 0 &&
        item.differenceCategory !== undefined &&
        (item.policyFindingIds.length > 0 || item.directiveIds.length > 0),
      );
    });
  const allComparatorsResolve = dimensions.every((item) => {
    const comparator = comparatorFor(item.comparatorId, item.comparatorVersion);
    return Boolean(comparator &&
      comparator.supportedDimensions.includes(item.dimension) &&
      comparator.supportedComparisonOutcomes.includes(item.classification));
  });
  if (!allComparatorsResolve ||
    new Set(dimensions.map((item) => item.dimension)).size !==
      dimensions.length) return false;
  switch (classification) {
    case "byte_equivalent":
      return everyIn(["exact_match"]) &&
        dimensions.every((item) =>
          item.comparatorId === "comparator.exact_digest" &&
          digestRecordsMatch(item.legacyDigest, item.canonicalDigest) &&
          !item.safetyDowngrade && !item.consentDowngrade &&
          !item.privacyDowngrade);
    case "semantically_equivalent":
      return everyIn(["exact_match", "normalized_match", "semantic_match"]) &&
        has(["normalized_match", "semantic_match"]) &&
        semanticEvidenceValid && !downgrade;
    case "policy_approved_difference":
      return has(["approved_policy_difference"]) &&
        !has([
          "incompatible", "missing_legacy_evidence",
          "missing_canonical_evidence", "not_comparable",
        ]) && approvedEvidenceValid && !downgrade;
    case "safe_fallback_required":
      return has([
        "legacy_safer", "canonical_safer", "incompatible",
      ]) || downgrade;
    case "incompatible":
      return has(["incompatible"]) || downgrade;
    case "insufficient_evidence":
      return has([
        "missing_legacy_evidence", "missing_canonical_evidence",
        "not_comparable",
      ]);
  }
}

export function assertParityClassificationCompatibility(
  classification: ParityClassification,
  dimensions: readonly ComparisonDimension[],
): void {
  if (!parityCompatible(classification, dimensions)) {
    fail("COMPATIBILITY_PARITY_INVALID");
  }
}

export const shadowComparisonRecordSchema = z.object({
  comparisonId: opaqueReferenceSchema,
  compatibilityRequestId: opaqueReferenceSchema,
  legacySnapshotId: opaqueReferenceSchema,
  canonicalDecisionId: opaqueReferenceSchema,
  seamId: legacySeamIdSchema,
  comparisonPolicyId: z.enum(COMPARISON_POLICY_IDS),
  comparisonPolicyVersion: z.literal("1.0.0"),
  comparatorId: comparatorIdSchema,
  comparatorVersion: z.literal("1.0.0"),
  comparedAt: dateTimeSchema,
  responseComparison: comparisonDimensionSchema,
  responseEvidence: responseComparisonEvidenceSchema,
  sessionComparison: comparisonDimensionSchema,
  safetyComparison: comparisonDimensionSchema,
  routingComparison: comparisonDimensionSchema,
  escalationComparison: comparisonDimensionSchema,
  presentationComparison: comparisonDimensionSchema,
  effectComparison: comparisonDimensionSchema,
  expectedDifferenceReferences: unique(opaqueReferenceSchema),
  mismatchFindings: unique(stableIdSchema),
  finalClassification: z.enum(PARITY_CLASSIFICATIONS),
  auditReference: opaqueReferenceSchema,
  nonExecutable: z.literal(true),
}).strict().superRefine((record, context) => {
  const dimensions = [
    record.responseComparison, record.sessionComparison,
    record.safetyComparison, record.routingComparison,
    record.escalationComparison, record.presentationComparison,
    record.effectComparison,
  ];
  if (
    dimensions.some((dimension, index) =>
      dimension.dimension !== COMPARISON_DIMENSION_NAMES[index]) ||
    !parityCompatible(record.finalClassification, dimensions)
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid parity" });
  }
});
export type ShadowComparisonRecord =
  z.infer<typeof shadowComparisonRecordSchema>;

export const goldenCompatibilityCaseSchema = z.object({
  goldenCaseId: stableIdSchema,
  version: z.literal("1.0.0"),
  title: safeTextSchema,
  purpose: stableIdSchema,
  seamId: legacySeamIdSchema,
  inputFixtureReference: opaqueReferenceSchema,
  legacyExpectedReference: opaqueReferenceSchema,
  canonicalExpectedReference: opaqueReferenceSchema,
  flowReference: z.object({
    catalogueVersion: semverSchema,
    flowId: stableIdSchema,
    version: semverSchema,
  }).strict(),
  presentationReference: z.object({
    registryVersion: semverSchema,
    presentationId: stableIdSchema,
    version: semverSchema,
  }).strict(),
  policyReferences: unique(stableIdSchema),
  comparisonPolicyId: z.enum(COMPARISON_POLICY_IDS),
  comparisonPolicyVersion: z.literal("1.0.0"),
  expectedClassification: z.enum(PARITY_CLASSIFICATIONS),
  requiredSafetyInvariants: unique(stableIdSchema),
  requiredConsentInvariants: unique(stableIdSchema),
  requiredPrivacyInvariants: unique(stableIdSchema),
  requiredSessionInvariants: unique(stableIdSchema),
  requiredRoutingInvariants: unique(stableIdSchema),
  requiredEffectInvariants: unique(stableIdSchema),
  requiredAuditInvariants: unique(stableIdSchema),
  allowedDifferences: unique(stableIdSchema),
  prohibitedDifferences: unique(stableIdSchema),
  status: z.enum(["draft", "approved", "deprecated", "retired"]),
  provenance: z.object({
    fixtureKind: z.literal("synthetic"),
    sourceReference: opaqueReferenceSchema,
    approvedByReference: opaqueReferenceSchema.optional(),
  }).strict(),
  nonExecutable: z.literal(true),
}).strict();

export const goldenCompatibilityCatalogueSchema = z.object({
  catalogueId: z.literal("vyva.compatibility.golden_cases"),
  catalogueVersion: z.literal("1.0.0"),
  cases: z.array(goldenCompatibilityCaseSchema).max(MAX_ITEMS),
  nonExecutable: z.literal(true),
}).strict().superRefine((catalogue, context) => {
  const ids = catalogue.cases.map((item) => item.goldenCaseId);
  const versions = catalogue.cases.map((item) =>
    `${item.goldenCaseId}@${item.version}`);
  if (new Set(ids).size !== ids.length ||
    new Set(versions).size !== versions.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate case" });
  }
});
export type GoldenCompatibilityCatalogue =
  z.infer<typeof goldenCompatibilityCatalogueSchema>;

export const compatibilityInvariantResultSchema = z.object({
  invariantId: stableIdSchema,
  category: z.enum([
    "safety", "consent", "privacy", "session", "response",
    "routing", "effect", "audit",
  ]),
  passed: z.boolean(),
  evidenceReference: opaqueReferenceSchema,
}).strict();

export const compatibilityEvidenceSchema = z.object({
  evidenceId: opaqueReferenceSchema,
  goldenCaseId: stableIdSchema,
  goldenCaseVersion: semverSchema,
  runId: opaqueReferenceSchema,
  commitReference: z.string().regex(/^[a-f0-9]{7,64}$/),
  legacySeamId: legacySeamIdSchema,
  legacyVersion: z.literal("1.0.0"),
  canonicalContractVersions: contractVersionBundleSchema,
  comparatorId: comparatorIdSchema,
  comparatorVersion: z.literal("1.0.0"),
  comparisonPolicyId: z.enum(COMPARISON_POLICY_IDS),
  comparisonPolicyVersion: z.literal("1.0.0"),
  observedClassification: z.enum(PARITY_CLASSIFICATIONS),
  expectedClassification: z.enum(PARITY_CLASSIFICATIONS),
  invariantResults: z.array(compatibilityInvariantResultSchema).min(1).max(MAX_ITEMS),
  mismatchReferences: unique(opaqueReferenceSchema),
  generatedAt: dateTimeSchema,
  reviewedByReference: opaqueReferenceSchema.optional(),
  reviewStatus: z.enum(["pending", "accepted", "rejected", "expired"]),
  expiry: dateTimeSchema,
  nonExecutable: z.literal(true),
}).strict().superRefine((evidence, context) => {
  const invariantIds = evidence.invariantResults.map((item) => item.invariantId);
  const mandatoryFailure = evidence.invariantResults.some((item) =>
    ["safety", "consent"].includes(item.category) && !item.passed);
  const versions = evidence.canonicalContractVersions;
  const supported = SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS;
  const invalidVersions =
    versions.interactionEventVersion !== supported.interactionEvent ||
    versions.flowStateVersion !== supported.flowState ||
    versions.specialistContractVersion !== supported.specialist ||
    versions.flowCatalogueVersion !== supported.flowCatalogue ||
    versions.presentationRegistryVersion !== supported.presentationRegistry ||
    versions.orchestratorPolicyVersion !== supported.orchestratorPolicy ||
    versions.compatibilitySchemaVersion !== supported.compatibilityBoundary;
  if (
    new Set(invariantIds).size !== invariantIds.length ||
    invalidVersions ||
    evidence.reviewStatus === "accepted" &&
    (
      evidence.observedClassification !== evidence.expectedClassification ||
      mandatoryFailure ||
      !evidence.reviewedByReference
    )
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid evidence" });
  }
});
export type CompatibilityEvidence = z.infer<typeof compatibilityEvidenceSchema>;

export const compatibilityRollbackPlanSchema = z.object({
  rollbackPlanId: opaqueReferenceSchema,
  triggerKinds: unique(stableIdSchema),
  sourceMode: compatibilityModeSchema,
  targetMode: compatibilityModeSchema,
  targetLegacySeamId: legacySeamIdSchema,
  reasonCodes: unique(stableIdSchema),
  requiredFindings: unique(opaqueReferenceSchema),
  requiredEvidence: unique(opaqueReferenceSchema),
  auditReference: opaqueReferenceSchema,
  expectedRecoverySemantics: z.object({
    preserveEmergencyHandling: z.literal(true),
    preserveRequiredAudit: z.literal(true),
    restoreRevokedConsent: z.literal(false),
    handlerSeamId: legacySeamIdSchema,
  }).strict(),
  nonExecutable: z.literal(true),
}).strict().superRefine((plan, context) => {
  const rank: Record<CompatibilityMode, number> = {
    legacy_only: 0,
    shadow_compare: 1,
    candidate_delivery: 2,
    authoritative: 3,
  };
  if (plan.targetMode === "authoritative" ||
    rank[plan.targetMode] >= rank[plan.sourceMode] ||
    plan.expectedRecoverySemantics.handlerSeamId !== plan.targetLegacySeamId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid rollback" });
  }
});
export type CompatibilityRollbackPlan =
  z.infer<typeof compatibilityRollbackPlanSchema>;

export const compatibilityFeatureFlagStateSchema = z.object({
  flagId: stableIdSchema,
  flagVersion: semverSchema,
  defaultMode: z.literal("legacy_only"),
  requestedMode: compatibilityModeSchema,
  effectiveMode: z.enum(["legacy_only", "shadow_compare"]),
  environmentClass: z.enum(["local", "test", "staging", "production"]),
  audienceClass: stableIdSchema,
  percentageBasisPoints: z.number().int().min(0).max(10_000),
  allowListReference: opaqueReferenceSchema.optional(),
  denyListReference: opaqueReferenceSchema.optional(),
  denyListMatched: z.boolean(),
  prerequisiteEvidenceIds: unique(opaqueReferenceSchema),
  rollbackPlanId: opaqueReferenceSchema.optional(),
  expiry: dateTimeSchema,
  ownerReference: opaqueReferenceSchema,
  auditReference: opaqueReferenceSchema,
  nonExecutable: z.literal(true),
}).strict().superRefine((flag, context) => {
  if (flag.effectiveMode === "authoritative" ||
    (flag.denyListMatched && flag.effectiveMode !== "legacy_only") ||
    (flag.effectiveMode !== "legacy_only" && !flag.rollbackPlanId) ||
    (flag.effectiveMode !== "legacy_only" &&
      flag.prerequisiteEvidenceIds.length === 0) ||
    (flag.requestedMode === "legacy_only" &&
      flag.effectiveMode !== "legacy_only") ||
    (flag.effectiveMode === "shadow_compare" &&
      flag.percentageBasisPoints === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid flag" });
  }
});
export type CompatibilityFeatureFlagState =
  z.infer<typeof compatibilityFeatureFlagStateSchema>;

export const COMPATIBILITY_FAILURE_CLASSIFICATIONS = [
  "invalid_request", "stale_contract", "unsupported_seam",
  "invalid_task4_decision", "unauthorized_adapter_effect", "parity_mismatch",
  "safety_mismatch", "consent_mismatch", "missing_evidence",
  "invalid_feature_flag_state", "invalid_rollback",
  "audit_correlation_failure",
] as const;

export const COMPATIBILITY_SAFE_FAILURE_CODE_MAP = Object.freeze({
  invalid_request: "COMPATIBILITY_REQUEST_INVALID",
  stale_contract: "COMPATIBILITY_VERSION_INVALID",
  unsupported_seam: "COMPATIBILITY_SEAM_REGISTRY_INVALID",
  invalid_task4_decision: "COMPATIBILITY_DECISION_INVALID",
  unauthorized_adapter_effect: "COMPATIBILITY_EFFECT_UNAUTHORIZED",
  parity_mismatch: "COMPATIBILITY_PARITY_INVALID",
  safety_mismatch: "COMPATIBILITY_SAFETY_MISMATCH",
  consent_mismatch: "COMPATIBILITY_CONSENT_MISMATCH",
  missing_evidence: "COMPATIBILITY_EVIDENCE_INVALID",
  invalid_feature_flag_state: "COMPATIBILITY_FEATURE_FLAG_INVALID",
  invalid_rollback: "COMPATIBILITY_ROLLBACK_INVALID",
  audit_correlation_failure: "COMPATIBILITY_AUDIT_INVALID",
} as const);
const compatibilityPublicErrorCodeSchema = z.enum([
  "COMPATIBILITY_REQUEST_INVALID",
  "COMPATIBILITY_VERSION_INVALID",
  "COMPATIBILITY_SEAM_REGISTRY_INVALID",
  "COMPATIBILITY_DECISION_INVALID",
  "COMPATIBILITY_EFFECT_UNAUTHORIZED",
  "COMPATIBILITY_PARITY_INVALID",
  "COMPATIBILITY_SAFETY_MISMATCH",
  "COMPATIBILITY_CONSENT_MISMATCH",
  "COMPATIBILITY_EVIDENCE_INVALID",
  "COMPATIBILITY_FEATURE_FLAG_INVALID",
  "COMPATIBILITY_ROLLBACK_INVALID",
  "COMPATIBILITY_AUDIT_INVALID",
]);

export const compatibilitySafeFailureSchema = z.object({
  failureId: opaqueReferenceSchema,
  classification: z.enum(COMPATIBILITY_FAILURE_CLASSIFICATIONS),
  fixedPublicErrorCode: compatibilityPublicErrorCodeSchema,
  fallbackRecommendation: z.enum([
    "remain_legacy_only", "continue_shadow_without_delivery",
    "disable_candidate", "require_manual_review", "stop_comparison",
  ]),
  rollbackPlanReference: opaqueReferenceSchema.optional(),
  blockingFindingIds: unique(opaqueReferenceSchema),
  auditReference: opaqueReferenceSchema,
  nonExecutable: z.literal(true),
}).strict().superRefine((failure, context) => {
  const expected =
    COMPATIBILITY_SAFE_FAILURE_CODE_MAP[failure.classification];
  const reviewRequired = [
    "invalid_task4_decision", "safety_mismatch", "consent_mismatch",
    "audit_correlation_failure",
  ].includes(failure.classification);
  if (failure.fixedPublicErrorCode !== expected ||
    (reviewRequired && failure.fallbackRecommendation !== "require_manual_review")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid safe failure mapping",
    });
  }
});

export const compatibilityObservabilityRecordSchema = z.object({
  observabilityId: opaqueReferenceSchema,
  compatibilityRequestId: opaqueReferenceSchema,
  decisionComparisonReference: opaqueReferenceSchema.optional(),
  responseComparison: z.enum(COMPARISON_DIMENSIONS),
  sessionComparison: z.enum(COMPARISON_DIMENSIONS),
  effectComparison: z.enum(COMPARISON_DIMENSIONS),
  safetyDivergence: z.boolean(),
  consentDivergence: z.boolean(),
  fallbackRecommendation: z.enum([
    "none", "remain_legacy_only", "continue_shadow_without_delivery",
    "disable_candidate", "require_manual_review", "stop_comparison",
  ]),
  rolloutEligibility: z.enum(["eligible", "ineligible", "insufficient_evidence"]),
  latencyBucketReference: stableIdSchema,
  errorClassification: stableIdSchema.optional(),
  correlationId: opaqueReferenceSchema,
  auditReference: opaqueReferenceSchema,
  safeMetadata: safeMetadataSchema,
  nonExecutable: z.literal(true),
}).strict();

export const compatibilityDecisionRecordSchema = z.object({
  compatibilityDecisionId: opaqueReferenceSchema,
  compatibilityRequestId: opaqueReferenceSchema,
  compatibilitySchemaVersion: z.literal(COMPATIBILITY_SCHEMA_VERSION),
  decidedAt: dateTimeSchema,
  modeState: compatibilityModeStateSchema,
  legacyOutputSnapshot: legacyOutputSnapshotSchema,
  legacyDisposition: z.object({
    responsePreserved: z.literal(true),
    sessionPreserved: z.literal(true),
    effectsPreserved: z.literal(true),
    deliveryAuthority: z.literal("legacy_handler"),
    nonExecutable: z.literal(true),
  }).strict(),
  adapterPlans: z.array(adapterAuthorizationPlanSchema).max(MAX_ITEMS),
  shadowComparison: shadowComparisonRecordSchema.optional(),
  evidence: z.array(compatibilityEvidenceSchema).max(MAX_ITEMS),
  featureFlagState: compatibilityFeatureFlagStateSchema.optional(),
  rollbackPlan: compatibilityRollbackPlanSchema.optional(),
  safeFailure: compatibilitySafeFailureSchema.optional(),
  observability: compatibilityObservabilityRecordSchema,
  finalClassification: z.enum(PARITY_CLASSIFICATIONS),
  auditReference: opaqueReferenceSchema,
  nonExecutable: z.literal(true),
}).strict();
export type CompatibilityDecisionRecord =
  z.infer<typeof compatibilityDecisionRecordSchema>;

export type CompatibilityValidationOptions = OrchestratorPolicyValidationOptions & {
  seamRegistry?: unknown;
  comparatorRegistry?: unknown;
  comparisonPolicyRegistry?: unknown;
  flowCatalogue?: unknown;
  presentationRegistry?: unknown;
  goldenCatalogue?: unknown;
  now?: string;
};

type ValidatedSources = {
  seamRegistry: LegacySeamRegistry;
  comparatorRegistry: z.infer<typeof comparatorRegistrySchema>;
  comparisonPolicyRegistry: z.infer<typeof comparisonPolicyRegistrySchema>;
  flowCatalogue: FlowCatalogue;
  presentationRegistry: PresentationRegistry;
  goldenCatalogue?: GoldenCompatibilityCatalogue;
  now?: string;
};

function validateVersions(
  versions: z.infer<typeof contractVersionBundleSchema>,
): void {
  const expected = SUPPORTED_COMPATIBILITY_CONTRACT_VERSIONS;
  if (
    versions.interactionEventVersion !== expected.interactionEvent ||
    versions.flowStateVersion !== expected.flowState ||
    versions.specialistContractVersion !== expected.specialist ||
    versions.flowCatalogueVersion !== expected.flowCatalogue ||
    versions.presentationRegistryVersion !== expected.presentationRegistry ||
    versions.orchestratorPolicyVersion !== expected.orchestratorPolicy ||
    versions.compatibilitySchemaVersion !== expected.compatibilityBoundary
  ) fail("COMPATIBILITY_VERSION_INVALID");
}

function sourcesFor(options: CompatibilityValidationOptions): ValidatedSources {
  const seamRegistry = parseLegacySeamRegistry(
    options.seamRegistry ?? VYVA_LEGACY_SEAM_REGISTRY,
  );
  const comparatorRegistry = parseComparatorRegistry(
    options.comparatorRegistry ?? VYVA_COMPARATOR_REGISTRY,
  );
  const comparisonPolicyRegistry = parseComparisonPolicyRegistry(
    options.comparisonPolicyRegistry ?? VYVA_COMPARISON_POLICY_REGISTRY,
  );
  const flowCatalogue = parseFlowCatalogue(
    options.flowCatalogue ?? VYVA_FLOW_CATALOGUE,
  );
  const presentationRegistry = parsePresentationRegistry(
    options.presentationRegistry ?? VYVA_PRESENTATION_REGISTRY,
  );
  const goldenCatalogue = options.goldenCatalogue === undefined
    ? undefined
    : parseGoldenCompatibilityCatalogue(options.goldenCatalogue, {
      flowCatalogue,
      presentationRegistry,
    });
  const now = options.now;
  if (now !== undefined && !dateTimeSchema.safeParse(now).success) {
    fail("COMPATIBILITY_VERSION_INVALID");
  }
  return {
    seamRegistry,
    comparatorRegistry,
    comparisonPolicyRegistry,
    flowCatalogue,
    presentationRegistry,
    goldenCatalogue,
    now,
  };
}

function seamFor(
  registry: LegacySeamRegistry,
  seamId: string,
  seamVersion: string,
): LegacySeamDescriptor {
  const seam = registry.seams.find((item) =>
    item.seamId === seamId && item.seamVersion === seamVersion);
  if (!seam || seam.status === "retired") {
    fail("COMPATIBILITY_REFERENCE_INVALID");
  }
  return seam;
}

function assertRequestCorrelation(
  request: CompatibilityEvaluationRequest,
  sources: ValidatedSources,
  options: CompatibilityValidationOptions,
): void {
  validateVersions(request.contractVersions);
  const normalizedEvent = parseInteractionEvent(request.normalizedEvent);
  const currentFlowState = parseFlowState(request.currentFlowState);
  const policyRequest = parseOrchestratorPolicyEvaluationRequest(
    request.policyEvaluationRequest,
    options,
  );
  parseOrchestratorPolicyDecision(request.suppliedPolicyDecision);
  validateOrchestratorPolicyDecision(
    request.policyEvaluationRequest,
    request.suppliedPolicyDecision,
    options,
  );
  const seam = seamFor(
    sources.seamRegistry,
    request.legacyInputSnapshot.seamId,
    request.legacyInputSnapshot.seamVersion,
  );
  const comparisonPolicy = sources.comparisonPolicyRegistry.policies.find(
    (item) =>
      item.comparisonPolicyId ===
        request.expectedComparisonPolicy.comparisonPolicyId &&
      item.comparisonPolicyVersion ===
        request.expectedComparisonPolicy.version,
  );
  if (!comparisonPolicy ||
    !canonicalContractEqual(
      [...request.expectedComparisonPolicy.requiredDimensions].sort(),
      [...comparisonPolicy.requiredDimensions].sort(),
    ) ||
    request.expectedComparisonPolicy.allowedDifferenceCodes.some((code) =>
      !comparisonPolicy.allowedPolicyDifferenceCategories.includes(code))) {
    fail("COMPATIBILITY_COMPARISON_INVALID");
  }
  const inputAgeSeconds = (
    Date.parse(request.auditContext.capturedAt) -
    Date.parse(request.legacyInputSnapshot.capturedAt)
  ) / 1000;
  if (
    inputAgeSeconds < 0 ||
    inputAgeSeconds > comparisonPolicy.snapshotMaxAgeSeconds ||
    seam.seamId !== request.legacySeamSnapshot.seamId ||
    seam.seamVersion !== request.legacySeamSnapshot.seamVersion ||
    JSON.stringify(seam) !== JSON.stringify(request.legacySeamSnapshot) ||
    request.legacyInputSnapshot.correlationId !==
      request.auditContext.correlationId ||
    request.normalizedEvent.correlationId !==
      request.legacyInputSnapshot.correlationId ||
    !policyRequest.interactionEvent ||
    !canonicalContractEqual(
      normalizedEvent,
      parseInteractionEvent(policyRequest.interactionEvent),
    ) ||
    !policyRequest.activeFlowState ||
    !canonicalContractEqual(
      currentFlowState,
      parseFlowState(policyRequest.activeFlowState),
    ) ||
    request.suppliedPolicyDecision.evaluationId !==
      request.policyEvaluationRequest.evaluationId ||
    request.legacyInputSnapshot.capturedAt !==
      request.auditContext.capturedAt ||
    request.auditContext.sessionReference !==
      request.legacyInputSnapshot.sessionReference ||
    request.currentFlowState.sessionId !==
      request.legacyInputSnapshot.sessionReference
  ) fail("COMPATIBILITY_CORRELATION_INVALID");
}

function allDecisionPlanIds(decision: OrchestratorPolicyDecision): Set<string> {
  return new Set([
    decision.approvedPresentationPlan?.presentationId,
    decision.approvedFlowStateProposal?.approvalId,
    decision.followUpAuthorization?.authorizationId,
    decision.escalationAuthorization?.authorizationId,
    decision.deferPlan?.deferPlanId,
    decision.safeFailurePlan?.failureCode,
    ...decision.toolAuthorizations.map((item) => item.authorizationId),
    ...decision.memoryAuthorizations.map((item) => item.authorizationId),
    ...decision.adjudications
      .filter((item) =>
        ["approve", "approve_with_constraints", "require_confirmation"]
          .includes(item.decision))
      .map((item) => item.subjectId),
  ].filter((item): item is string => Boolean(item)));
}

function task4AuthorityVector(
  decision: OrchestratorPolicyDecision,
  policyRequest: OrchestratorPolicyEvaluationRequest,
): AuthorityVector {
  const presentation = decision.approvedPresentationPlan;
  const response = decision.approvedResponsePlan;
  const escalation = decision.escalationAuthorization;
  const followUp = decision.followUpAuthorization;
  const privacyRank = presentation
    ? ["public", "personal", "sensitive", "restricted"].indexOf(
      presentation.approvedPrivacyPolicy.sensitivity,
    )
    : 0;
  const presentationSafetyRank = presentation
    ? ["routine", "important", "urgent", "immediate"].indexOf(
      presentation.approvedSafetyPolicy.urgency,
    ) + (presentation.safetyDecision === "emergency_required" ? 1 : 0)
    : 0;
  const responseSafetyRank = response
    ? ["routine", "prompt", "urgent", "immediate"].indexOf(response.urgency)
    : 0;
  const findingRank = (category: "safety" | "privacy") =>
    decision.findings.reduce((maximum, finding) => {
      const relevant = category === "safety"
        ? finding.category === "deterministic_safety" ||
          finding.policyId.includes(".safety.")
        : finding.category === "privacy" ||
          finding.policyId.includes(".privacy.");
      if (!relevant) return maximum;
      return Math.max(maximum, [
        "informational", "caution", "blocking", "critical",
      ].indexOf(finding.severity) + 1);
    }, 0);
  return {
    channels: [
      presentation?.approvedChannel,
      escalation?.approvedChannel,
      followUp?.approvedChannel,
      ...(followUp?.fallbackChannels ?? []),
    ].filter((item): item is string => Boolean(item)),
    targets: [escalation?.targetId].filter(
      (item): item is string => Boolean(item),
    ),
    toolIds: decision.toolAuthorizations.map((item) => item.toolId),
    toolAuthorizationIds: decision.toolAuthorizations.map((item) =>
      item.authorizationId),
    toolSchemaIds: decision.toolAuthorizations.flatMap((item) =>
      item.argumentSchemaId ? [item.argumentSchemaId] : []),
    toolExpectedResultTypes: decision.toolAuthorizations.flatMap((item) =>
      item.expectedResultType ? [item.expectedResultType] : []),
    toolRiskClassifications: [...new Set(
      decision.toolAuthorizations.flatMap((authorization) => {
        const proposal = policyRequest.specialistResponse?.proposedToolCalls
          .find((item) => item.proposalId === authorization.proposalId);
        return proposal ? [proposal.riskLevel] : [];
      }),
    )] as SpecialistRiskLevel[],
    toolIdempotencyKeyReferences: decision.toolAuthorizations.flatMap((item) =>
      item.idempotencyKeyReference ? [item.idempotencyKeyReference] : []),
    toolConsentAuthorizationIds: decision.toolAuthorizations.flatMap((item) =>
      item.consentAuthorizationIds),
    toolArgumentDigestIds: [],
    memoryAuthorizationIds: decision.memoryAuthorizations.map((item) =>
      item.authorizationId),
    memorySubjectIds: decision.memoryAuthorizations.map((item) =>
      item.subjectId),
    memoryCategories: decision.memoryAuthorizations.map((item) =>
      item.category),
    memoryTargets: decision.memoryAuthorizations.flatMap((item) =>
      item.target ? [item.target] : []),
    retentionModes: decision.memoryAuthorizations.map((item) =>
      item.maximumRetention),
    escalationTypes: escalation ? [escalation.type] : [],
    escalationTargets: escalation?.targetId ? [escalation.targetId] : [],
    escalationChannels: escalation?.approvedChannel
      ? [escalation.approvedChannel]
      : [],
    escalationUrgencies: escalation ? [escalation.urgency] : [],
    escalationAuthorizationIds: escalation
      ? [escalation.authorizationId]
      : [],
    escalationConsentAuthorizationIds:
      escalation?.consentAuthorizationIds ?? [],
    escalationDuplicateReferences: escalation?.duplicateOfEscalationId
      ? [escalation.duplicateOfEscalationId]
      : [],
    presentationIds: presentation ? [presentation.presentationId] : [],
    presentationVersions: presentation ? [presentation.version] : [],
    sceneIds: presentation ? [presentation.sceneId] : [],
    flowIds: [
      presentation?.flowId,
      decision.approvedFlowStateProposal?.flowId,
    ].filter((item): item is string => Boolean(item)),
    flowVersions: [
      presentation?.flowVersion,
      decision.approvedFlowStateProposal?.flowVersion,
    ].filter((item): item is string => Boolean(item)),
    responseFactIds: response?.approvedFacts.map((item) => item.factId) ?? [],
    medicationInstructionIds: response?.approvedFacts.flatMap((item) =>
      item.carePlanReferenceId
        ? [item.carePlanReferenceId]
        : item.medicationReferenceId
          ? [item.medicationReferenceId]
          : []) ?? [],
    consentScopes: decision.consentAuthorizations
      .filter((item) => item.decision === "allow")
      .map((item) => item.scope),
    sessionWriteTypes: decision.approvedFlowStateProposal
      ? ["flow_state_update"]
      : [],
    browserEventTypes: presentation?.approvedUIInstructionIds ?? [],
    legacyEffectKinds: [],
    scheduleIds: [],
    retryPolicies: followUp?.noResponseDecision.retryAllowed
      ? ["followup_retry"]
      : [],
    minimumSafetyRank: Math.max(
      presentationSafetyRank,
      responseSafetyRank,
      findingRank("safety"),
      escalation?.type === "emergency" ? 4 : 0,
    ),
    minimumPrivacyRank: Math.max(privacyRank, findingRank("privacy")),
    confirmationRequired: decision.toolAuthorizations.some((item) =>
      item.confirmationRequired),
    acknowledgementRequired:
      presentation?.voiceSynchronizationDecision.acknowledgement === "required",
    requiredDisclaimerIds: response?.requiredDisclaimers ?? [],
    prohibitedClaimIds: [
      ...(response?.prohibitedClaims ?? []),
      ...(presentation?.approvedSafetyPolicy.prohibitedClaims ?? []),
    ],
    auditRequired: true,
    idempotencyRequired: decision.toolAuthorizations.some((item) =>
      item.idempotencyRequired),
    timeoutPolicyIds:
      presentation?.voiceSynchronizationDecision.silenceTimeoutSeconds
        ? ["presentation_silence_timeout"]
        : [],
    failurePolicyIds: decision.safeFailurePlan
      ? [decision.safeFailurePlan.failureCode]
      : [],
    providerAuthority: false,
    executionAuthority: false,
  };
}

function task4AuthorityForPlan(
  decision: OrchestratorPolicyDecision,
  plan: AdapterAuthorizationPlan,
  policyRequest: OrchestratorPolicyEvaluationRequest,
): AuthorityVector {
  const global = task4AuthorityVector(decision, policyRequest);
  const scoped = { ...global } as AuthorityVector;
  for (const field of VECTOR_ARRAY_FIELDS) {
    (scoped[field] as string[]) = [];
  }
  scoped.requiredDisclaimerIds = [];
  scoped.prohibitedClaimIds = [];
  scoped.timeoutPolicyIds = [];
  scoped.failurePolicyIds = [];
  scoped.minimumSafetyRank = 0;
  scoped.minimumPrivacyRank = 0;
  scoped.confirmationRequired = false;
  scoped.acknowledgementRequired = false;
  scoped.auditRequired = true;
  scoped.idempotencyRequired = false;
  const copy = (...fields: (keyof AuthorityVector)[]) => {
    for (const field of fields) {
      (scoped as unknown as Record<string, unknown>)[field] = global[field];
    }
  };
  switch (plan.adapterCategory) {
    case "legacy_response_adapter":
      copy(
        "responseFactIds", "medicationInstructionIds",
        "requiredDisclaimerIds", "prohibitedClaimIds", "minimumSafetyRank",
      );
      break;
    case "legacy_session_adapter":
    case "flow_state_adapter":
      copy("flowIds", "flowVersions", "sessionWriteTypes");
      break;
    case "channel_adapter":
      copy("channels", "browserEventTypes", "sceneIds");
      break;
    case "presentation_adapter":
      copy(
        "channels", "presentationIds", "presentationVersions", "sceneIds",
        "flowIds", "flowVersions", "browserEventTypes", "minimumSafetyRank",
        "minimumPrivacyRank", "acknowledgementRequired",
        "requiredDisclaimerIds", "prohibitedClaimIds", "timeoutPolicyIds",
      );
      break;
    case "tool_adapter": {
      const authorizations = decision.toolAuthorizations.filter((item) =>
        plan.sourcePlanIds.includes(item.authorizationId));
      scoped.toolIds = authorizations.map((item) => item.toolId);
      scoped.toolAuthorizationIds = authorizations.map((item) =>
        item.authorizationId);
      scoped.toolSchemaIds = authorizations.flatMap((item) =>
        item.argumentSchemaId ? [item.argumentSchemaId] : []);
      scoped.toolExpectedResultTypes = authorizations.flatMap((item) =>
        item.expectedResultType ? [item.expectedResultType] : []);
      scoped.toolRiskClassifications = [...new Set(
        authorizations.flatMap((authorization) => {
          const proposal = policyRequest.specialistResponse?.proposedToolCalls
            .find((item) => item.proposalId === authorization.proposalId);
          return proposal ? [proposal.riskLevel] : [];
        }),
      )] as SpecialistRiskLevel[];
      scoped.toolIdempotencyKeyReferences = authorizations.flatMap((item) =>
        item.idempotencyKeyReference ? [item.idempotencyKeyReference] : []);
      scoped.toolConsentAuthorizationIds = authorizations.flatMap((item) =>
        item.consentAuthorizationIds);
      scoped.consentScopes = decision.consentAuthorizations
        .filter((item) =>
          scoped.toolConsentAuthorizationIds.includes(item.authorizationId) &&
          item.decision === "allow")
        .map((item) => item.scope);
      scoped.confirmationRequired = authorizations.some((item) =>
        item.confirmationRequired);
      scoped.idempotencyRequired = authorizations.some((item) =>
        item.idempotencyRequired);
      break;
    }
    case "memory_adapter": {
      const authorizations = decision.memoryAuthorizations.filter((item) =>
        plan.sourcePlanIds.includes(item.authorizationId));
      scoped.memoryAuthorizationIds = authorizations.map((item) =>
        item.authorizationId);
      scoped.memorySubjectIds = authorizations.map((item) => item.subjectId);
      scoped.memoryCategories = authorizations.map((item) => item.category);
      scoped.memoryTargets = authorizations.flatMap((item) =>
        item.target ? [item.target] : []);
      scoped.retentionModes = authorizations.map((item) =>
        item.maximumRetention);
      scoped.toolConsentAuthorizationIds = authorizations.flatMap((item) =>
        item.consentAuthorizationIds);
      scoped.consentScopes = decision.consentAuthorizations
        .filter((item) =>
          scoped.toolConsentAuthorizationIds.includes(item.authorizationId) &&
          item.decision === "allow")
        .map((item) => item.scope);
      break;
    }
    case "escalation_adapter":
      copy(
        "channels", "targets", "escalationTypes", "escalationTargets",
        "escalationChannels", "escalationUrgencies",
        "escalationAuthorizationIds", "escalationConsentAuthorizationIds",
        "escalationDuplicateReferences",
      );
      scoped.consentScopes = decision.consentAuthorizations
        .filter((item) =>
          scoped.escalationConsentAuthorizationIds.includes(
            item.authorizationId,
          ) && item.decision === "allow")
        .map((item) => item.scope);
      break;
    case "audit_adapter":
      break;
  }
  return scoped;
}

function assertEffectAuthority(
  effect: z.infer<typeof adapterEffectProposalSchema>,
  decision: OrchestratorPolicyDecision,
  policyRequest: OrchestratorPolicyEvaluationRequest,
  plan: AdapterAuthorizationPlan,
  seam: LegacySeamDescriptor,
): void {
  const authority = effect.authority;
  const exactSet = (actual: readonly string[], expected: readonly string[]) =>
    actual.length === expected.length &&
    actual.every((item) => expected.includes(item));
  if (effect.effectType === "audit") {
    if (effect.sourcePlanId !== plan.adapterPlanId ||
      effect.sourceAuthorizationId !== undefined) {
      fail("COMPATIBILITY_EFFECT_UNAUTHORIZED");
    }
    return;
  }
  if (!plan.sourcePlanIds.includes(effect.sourcePlanId)) {
    fail("COMPATIBILITY_REFERENCE_INVALID");
  }
  const allowed = effect.effectType === "response"
    ? Boolean(decision.approvedResponsePlan) &&
      decision.adjudications.some((item) =>
        item.subjectId === effect.sourcePlanId &&
        item.subjectType === "response_guidance" &&
        ["approve", "approve_with_constraints", "require_confirmation"]
          .includes(item.decision)) &&
      decision.approvedResponsePlan!.policyFindingIds.every((id) =>
        plan.sourceFindingIds.includes(id)) &&
      authority.responseFactIds.every((id) =>
        decision.approvedResponsePlan?.approvedFacts.some((fact) =>
          fact.factId === id))
    : effect.effectType === "session_write" ||
        effect.effectType === "flow_state"
      ? Boolean(decision.approvedFlowStateProposal) &&
        effect.sourcePlanId === decision.approvedFlowStateProposal?.approvalId &&
        decision.adjudications.some((item) =>
          item.subjectType === "flow_state_update" &&
          item.subjectId === decision.approvedFlowStateProposal?.subjectId &&
          plan.sourceAdjudicationIds.includes(item.adjudicationId) &&
          ["approve", "approve_with_constraints", "require_confirmation"]
            .includes(item.decision)) &&
        decision.approvedFlowStateProposal!.policyFindingIds.every((id) =>
          plan.sourceFindingIds.includes(id)) &&
        exactSet(authority.flowIds, [
          decision.approvedFlowStateProposal!.flowId,
        ]) &&
        exactSet(authority.flowVersions, [
          decision.approvedFlowStateProposal!.flowVersion,
        ])
      : effect.effectType === "browser_event"
        ? Boolean(decision.approvedPresentationPlan) &&
          effect.sourcePlanId ===
            decision.approvedPresentationPlan?.presentationId &&
          decision.adjudications.some((item) =>
            item.subjectType === "presentation" &&
            item.subjectId ===
              decision.approvedPresentationPlan?.presentationId &&
            plan.sourceAdjudicationIds.includes(item.adjudicationId) &&
            ["approve", "approve_with_constraints", "require_confirmation"]
              .includes(item.decision)) &&
          exactSet(authority.sceneIds, [
            decision.approvedPresentationPlan!.sceneId,
          ]) &&
          exactSet(authority.channels, [
            decision.approvedPresentationPlan!.approvedChannel,
          ]) &&
          authority.browserEventTypes.every((id) =>
            decision.approvedPresentationPlan?.approvedUIInstructionIds.includes(id)) &&
          authority.legacyEffectKinds.length > 0 &&
          authority.legacyEffectKinds.every((kind) =>
            seam.effectKinds.includes(kind))
        : effect.effectType === "presentation"
          ? Boolean(decision.approvedPresentationPlan) &&
            effect.sourcePlanId ===
              decision.approvedPresentationPlan?.presentationId &&
            decision.adjudications.some((item) =>
              item.subjectType === "presentation" &&
              item.subjectId ===
                decision.approvedPresentationPlan?.presentationId &&
              plan.sourceAdjudicationIds.includes(item.adjudicationId) &&
              ["approve", "approve_with_constraints",
                "require_confirmation"].includes(item.decision)) &&
            decision.approvedPresentationPlan!.policyFindingIds.every((id) =>
              plan.sourceFindingIds.includes(id)) &&
            exactSet(authority.presentationIds, [
              decision.approvedPresentationPlan!.presentationId,
            ]) &&
            exactSet(authority.presentationVersions, [
              decision.approvedPresentationPlan!.version,
            ]) &&
            exactSet(authority.sceneIds, [
              decision.approvedPresentationPlan!.sceneId,
            ]) &&
            exactSet(authority.flowIds, [
              decision.approvedPresentationPlan!.flowId,
            ]) &&
            exactSet(authority.flowVersions, [
              decision.approvedPresentationPlan!.flowVersion,
            ]) &&
            exactSet(authority.channels, [
              decision.approvedPresentationPlan!.approvedChannel,
            ])
          : effect.effectType === "tool"
            ? decision.toolAuthorizations.some((authorization) =>
              authorization.authorizationId === effect.sourceAuthorizationId &&
              effect.sourcePlanId === authorization.authorizationId &&
              plan.sourceAdjudicationIds.includes(
                authorization.adjudicationId,
              ) &&
              authorization.policyFindingIds.every((id) =>
                plan.sourceFindingIds.includes(id)) &&
              ["approve", "approve_with_constraints", "require_confirmation"]
                .includes(authorization.decision) &&
              exactSet(authority.toolAuthorizationIds, [
                authorization.authorizationId,
              ]) &&
              exactSet(authority.toolIds, [authorization.toolId]) &&
              exactSet(authority.toolSchemaIds,
                authorization.argumentSchemaId
                  ? [authorization.argumentSchemaId]
                  : []) &&
              exactSet(authority.toolExpectedResultTypes,
                authorization.expectedResultType
                  ? [authorization.expectedResultType]
                  : []) &&
              exactSet(
                authority.toolRiskClassifications,
                policyRequest.specialistResponse?.proposedToolCalls
                  .filter((proposal) =>
                    proposal.proposalId === authorization.proposalId)
                  .map((proposal) => proposal.riskLevel) ?? [],
              ) &&
              exactSet(authority.toolIdempotencyKeyReferences,
                authorization.idempotencyKeyReference
                  ? [authorization.idempotencyKeyReference]
                  : []) &&
              exactSet(authority.toolConsentAuthorizationIds,
                authorization.consentAuthorizationIds) &&
              exactSet(
                authority.consentScopes,
                decision.consentAuthorizations
                  .filter((consent) =>
                    authorization.consentAuthorizationIds.includes(
                      consent.authorizationId,
                    ) && consent.decision === "allow")
                  .map((consent) => consent.scope),
              ) &&
              authority.confirmationRequired ===
                authorization.confirmationRequired &&
              authority.idempotencyRequired ===
                authorization.idempotencyRequired &&
              effect.payloadReference === authorization.proposalId)
            : effect.effectType === "memory"
              ? decision.memoryAuthorizations.some((authorization) =>
                authorization.authorizationId === effect.sourceAuthorizationId &&
                effect.sourcePlanId === authorization.authorizationId &&
                plan.sourceAdjudicationIds.includes(
                  authorization.adjudicationId,
                ) &&
                authorization.policyFindingIds.every((id) =>
                  plan.sourceFindingIds.includes(id)) &&
                ["approve", "approve_with_constraints", "require_confirmation"]
                  .includes(authorization.decision) &&
                exactSet(authority.memoryAuthorizationIds,
                  [authorization.authorizationId]) &&
                exactSet(authority.memorySubjectIds,
                  [authorization.subjectId]) &&
                exactSet(authority.memoryCategories,
                  [authorization.category]) &&
                exactSet(authority.memoryTargets,
                  authorization.target ? [authorization.target] : []) &&
                exactSet(authority.retentionModes,
                  [authorization.maximumRetention]) &&
                exactSet(
                  authority.consentScopes,
                  decision.consentAuthorizations
                    .filter((consent) =>
                      authorization.consentAuthorizationIds.includes(
                        consent.authorizationId,
                      ) && consent.decision === "allow")
                    .map((consent) => consent.scope),
                ))
              : effect.effectType === "escalation"
                ? decision.escalationAuthorization?.authorizationId ===
                    effect.sourceAuthorizationId &&
                  effect.sourcePlanId ===
                    decision.escalationAuthorization.authorizationId &&
                  decision.adjudications.some((adjudication) =>
                    adjudication.subjectType === "escalation" &&
                    adjudication.subjectId ===
                      decision.escalationAuthorization?.subjectId &&
                    plan.sourceAdjudicationIds.includes(
                      adjudication.adjudicationId,
                    ) &&
                    ["approve", "approve_with_constraints",
                      "require_confirmation"].includes(
                        adjudication.decision,
                      )) &&
                  decision.escalationAuthorization.policyFindingIds.every(
                    (id) => plan.sourceFindingIds.includes(id),
                  ) &&
                  exactSet(authority.escalationAuthorizationIds,
                    [decision.escalationAuthorization.authorizationId]) &&
                  exactSet(authority.escalationTypes,
                    [decision.escalationAuthorization.type]) &&
                  exactSet(authority.escalationChannels,
                    decision.escalationAuthorization.approvedChannel
                      ? [decision.escalationAuthorization.approvedChannel]
                      : []) &&
                  exactSet(authority.escalationUrgencies,
                    [decision.escalationAuthorization.urgency]) &&
                  exactSet(authority.escalationConsentAuthorizationIds,
                    decision.escalationAuthorization
                      .consentAuthorizationIds) &&
                  exactSet(
                    authority.consentScopes,
                    decision.consentAuthorizations
                      .filter((consent) =>
                        decision.escalationAuthorization
                          ?.consentAuthorizationIds.includes(
                            consent.authorizationId,
                          ) && consent.decision === "allow")
                      .map((consent) => consent.scope),
                  ) &&
                  exactSet(authority.escalationDuplicateReferences,
                    decision.escalationAuthorization.duplicateOfEscalationId
                      ? [decision.escalationAuthorization
                        .duplicateOfEscalationId]
                      : []) &&
                  exactSet(authority.escalationTargets,
                    decision.escalationAuthorization.targetId
                      ? [decision.escalationAuthorization.targetId]
                      : [])
                : false;
  if (!allowed) fail("COMPATIBILITY_EFFECT_UNAUTHORIZED");
}

function assertAdapterPlan(
  request: CompatibilityEvaluationRequest,
  plan: AdapterAuthorizationPlan,
  decision: OrchestratorPolicyDecision,
  sources: ValidatedSources,
): void {
  seamFor(sources.seamRegistry, plan.sourceSeamId, "1.0.0");
  const targetSeam = seamFor(
    sources.seamRegistry,
    plan.targetSeamId,
    "1.0.0",
  );
  const adjudications = new Set(decision.adjudications.map((item) =>
    item.adjudicationId));
  const findings = new Set(decision.findings.map((item) => item.findingId));
  const directives = new Set(decision.systemDirectives.map((item) =>
    item.directiveId));
  const planIds = allDecisionPlanIds(decision);
  const sourceAdjudications = decision.adjudications.filter((item) =>
    plan.sourceAdjudicationIds.includes(item.adjudicationId));
  const allowedEffectsByCategory: Record<
    AdapterCategory,
    readonly (typeof ADAPTER_EFFECT_TYPES[number])[]
  > = {
    legacy_response_adapter: ["response"],
    legacy_session_adapter: ["session_write", "browser_event"],
    channel_adapter: ["browser_event"],
    presentation_adapter: ["presentation", "browser_event"],
    tool_adapter: ["tool"],
    memory_adapter: ["memory"],
    flow_state_adapter: ["flow_state"],
    audit_adapter: ["audit"],
    escalation_adapter: ["escalation"],
  };
  const subjectAuthority = task4AuthorityForPlan(
    decision,
    plan,
    request.policyEvaluationRequest,
  );
  if (
    plan.adapterCategory === "tool_adapter" &&
    (
      subjectAuthority.toolAuthorizationIds.length !== 1 ||
      subjectAuthority.toolRiskClassifications.length !== 1 ||
      !exactStringValues(
        plan.sourceAuthority.toolRiskClassifications,
        subjectAuthority.toolRiskClassifications,
      )
    )
  ) {
    fail("COMPATIBILITY_ADAPTER_BROADENING");
  }
  if (["channel_adapter", "legacy_session_adapter"].includes(
    plan.adapterCategory,
  )) {
    subjectAuthority.legacyEffectKinds = [...targetSeam.effectKinds];
  }
  validateAdapterNonBroadening(subjectAuthority, plan.sourceAuthority);
  if (
    plan.sourcePlanIds.includes(plan.adapterPlanId) ||
    plan.sourceDecisionId !== decision.decisionId ||
    plan.correlationId !== request.auditContext.correlationId ||
    plan.auditReference !== request.auditContext.auditReference ||
    plan.sourceAdjudicationIds.some((id) => !adjudications.has(id)) ||
    plan.sourceFindingIds.some((id) => !findings.has(id)) ||
    plan.sourceDirectiveIds.some((id) => !directives.has(id)) ||
    plan.sourcePlanIds.some((id) => !planIds.has(id)) ||
    sourceAdjudications.length !== plan.sourceAdjudicationIds.length ||
    sourceAdjudications.some((item) =>
      !["approve", "approve_with_constraints", "require_confirmation"]
        .includes(item.decision)) ||
    sourceAdjudications.some((item) =>
      item.constraints.some((constraint) =>
        !plan.narrowingConstraints.includes(constraint.constraintId))) ||
    plan.authorizedEffects.some((effect) =>
      !allowedEffectsByCategory[plan.adapterCategory].includes(
        effect.effectType,
      )) ||
    plan.authorizedEffects.some((effect) =>
      plan.prohibitedEffects.includes(effect.effectType))
  ) fail("COMPATIBILITY_REFERENCE_INVALID");
  for (const effect of plan.authorizedEffects) {
    validateAdapterNonBroadening(plan.sourceAuthority, effect.authority);
    assertEffectAuthority(
      effect,
      decision,
      request.policyEvaluationRequest,
      plan,
      targetSeam,
    );
  }
}

function permits(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function exactStringValues(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return actual.length === expected.length &&
    actual.every((value) => expected.includes(value));
}

function assertResponseDigestBinding(
  request: CompatibilityEvaluationRequest,
  decision: CompatibilityDecisionRecord,
  comparison: ShadowComparisonRecord,
): void {
  const response = comparison.responseComparison;
  const digestRequired = [
    "exact_match", "approved_policy_difference",
  ].includes(response.classification);
  if (!digestRequired) return;
  const snapshotDigest = decision.legacyOutputSnapshot.responseDigest
    ?.match(/^sha256:([a-f0-9]{64})$/);
  const snapshotProvenance =
    decision.legacyOutputSnapshot.responseDigestProvenance;
  const legacyReference = decision.legacyOutputSnapshot.responseReference;
  const evidence = comparison.responseEvidence;
  const responsePlan = request.suppliedPolicyDecision.approvedResponsePlan;
  const responseSubject = request.policyEvaluationRequest.specialistResponse
    ?.requestId;
  const canonicalResponseReference = responsePlan && responseSubject
    ? `${responseSubject}.response_guidance`
    : request.suppliedPolicyDecision.decisionId;
  const requiredDisclaimers = responsePlan?.requiredDisclaimers ?? [];
  const prohibitedClaims = responsePlan?.prohibitedClaims ?? [];
  const medicationReferenceIds = responsePlan?.approvedFacts.flatMap((fact) =>
    fact.medicationReferenceId
      ? [fact.medicationReferenceId]
      : fact.carePlanReferenceId
        ? [fact.carePlanReferenceId]
        : []) ?? [];
  if (
    !snapshotDigest ||
    !snapshotProvenance ||
    !legacyReference ||
    !response.legacyDigest ||
    !response.canonicalDigest ||
    response.legacyDigest.algorithm !== snapshotProvenance.algorithm ||
    response.legacyDigest.canonicalizationVersion !==
      snapshotProvenance.canonicalizationVersion ||
    response.legacyDigest.value !== snapshotDigest[1] ||
    !digestRecordsMatch(response.canonicalDigest, evidence.canonicalDigest) ||
    evidence.compatibilityRequestId !== request.compatibilityRequestId ||
    evidence.task4DecisionId !== request.suppliedPolicyDecision.decisionId ||
    evidence.legacyResponseReference !== legacyReference ||
    evidence.canonicalResponseReference !== canonicalResponseReference ||
    !exactStringValues(
      evidence.requiredDisclaimers,
      requiredDisclaimers,
    ) ||
    !exactStringValues(evidence.prohibitedClaims, prohibitedClaims) ||
    !exactStringValues(
      evidence.medicationReferenceIds,
      medicationReferenceIds,
    ) ||
    (
      response.classification === "approved_policy_difference" &&
      !response.comparatorEvidenceReferences.includes(
        evidence.evidenceReference,
      )
    )
  ) {
    fail("COMPATIBILITY_COMPARISON_INVALID");
  }
}

function assertPolicyDifferenceAuthority(
  request: CompatibilityEvaluationRequest,
  comparison: ShadowComparisonRecord,
  policy: ComparisonPolicyDescriptor,
  dimensions: readonly ComparisonDimension[],
): void {
  const approvedDimensions = dimensions.filter((item) =>
    item.classification === "approved_policy_difference");
  if (comparison.finalClassification !== "policy_approved_difference") {
    if (dimensions.some((item) => item.differenceCategory !== undefined)) {
      fail("COMPATIBILITY_COMPARISON_INVALID");
    }
    return;
  }
  const categories = [...new Set(approvedDimensions.map((item) =>
    item.differenceCategory).filter(
      (item): item is typeof POLICY_DIFFERENCE_CATEGORIES[number] =>
        item !== undefined,
    ))];
  if (
    approvedDimensions.length === 0 ||
    categories.length !== comparison.expectedDifferenceReferences.length ||
    categories.some((category) =>
      !comparison.expectedDifferenceReferences.includes(category)) ||
    comparison.expectedDifferenceReferences.some((category) =>
      !categories.includes(
        category as typeof POLICY_DIFFERENCE_CATEGORIES[number],
      ))
  ) {
    fail("COMPATIBILITY_COMPARISON_INVALID");
  }

  const task4Request = request.policyEvaluationRequest;
  const task4Decision = request.suppliedPolicyDecision;
  if (task4Decision.evaluationId !== task4Request.evaluationId) {
    fail("COMPATIBILITY_REFERENCE_INVALID");
  }
  for (const dimension of approvedDimensions) {
    const entry = VYVA_POLICY_DIFFERENCE_AUTHORITY_MATRIX.entries.find(
      (candidate) =>
        candidate.differenceCategory === dimension.differenceCategory,
    );
    if (
      !entry ||
      !permits(entry.permittedDimensions, dimension.dimension) ||
      !permits(entry.comparisonPolicyIds, policy.comparisonPolicyId) ||
      !policy.allowedPolicyDifferenceCategories.includes(
        entry.differenceCategory,
      ) ||
      dimension.policyFindingIds.length !== 1 ||
      dimension.directiveIds.length !== 0
    ) {
      fail("COMPATIBILITY_COMPARISON_INVALID");
    }
    const finding = task4Decision.findings.find((item) =>
      item.findingId === dimension.policyFindingIds[0]);
    if (
      !finding ||
      !finding.subjectId ||
      !permits(entry.permittedTask4PolicyIds, finding.policyId) ||
      !permits(entry.permittedTask4PolicyCategories, finding.category) ||
      !permits(entry.permittedFindingOutcomes, finding.outcome) ||
      !permits(entry.requiredTask4SubjectTypes, finding.subjectType)
    ) {
      fail("COMPATIBILITY_REFERENCE_INVALID");
    }
    const specialistResponseId = task4Request.specialistResponse?.requestId;
    const expectedSubjectId = specialistResponseId
      ? `${specialistResponseId}.response_guidance`
      : undefined;
    const adjudication = task4Decision.adjudications.find((item) =>
      item.subjectType === finding.subjectType &&
      item.subjectId === finding.subjectId &&
      item.policyFindingIds.includes(finding.findingId));
    if (
      entry.requiresSameSubjectId &&
      (
        !expectedSubjectId ||
        finding.subjectId !== expectedSubjectId ||
        !finding.sourceReferenceIds.includes(specialistResponseId!)
      ) ||
      !adjudication ||
      !["approve", "approve_with_constraints"].includes(
        adjudication.decision,
      )
    ) {
      fail("COMPATIBILITY_REFERENCE_INVALID");
    }
    const responsePlan = task4Decision.approvedResponsePlan;
    if (
      entry.requiresSameResponsePlan &&
      (
        !responsePlan ||
        !responsePlan.policyFindingIds.includes(finding.findingId) ||
        !responsePlan.approvedFacts.some((fact) =>
          fact.sourceReferenceId === finding.subjectId)
      )
    ) {
      fail("COMPATIBILITY_REFERENCE_INVALID");
    }
  }
}

function assertComparison(
  request: CompatibilityEvaluationRequest,
  decision: CompatibilityDecisionRecord,
  sources: ValidatedSources,
): void {
  const comparison = decision.shadowComparison;
  if (request.compatibilityMode.effectiveMode === "shadow_compare" &&
    !comparison) fail("COMPATIBILITY_COMPARISON_INVALID");
  if (!comparison) return;
  if (
    comparison.compatibilityRequestId !== request.compatibilityRequestId ||
    comparison.legacySnapshotId !== decision.legacyOutputSnapshot.snapshotId ||
    comparison.canonicalDecisionId !== request.suppliedPolicyDecision.decisionId ||
    comparison.seamId !== request.legacyInputSnapshot.seamId ||
    comparison.comparisonPolicyId !==
      request.expectedComparisonPolicy.comparisonPolicyId ||
    comparison.comparisonPolicyVersion !==
      request.expectedComparisonPolicy.version ||
    comparison.auditReference !== request.auditContext.auditReference ||
    comparison.finalClassification !== decision.finalClassification
  ) fail("COMPATIBILITY_COMPARISON_INVALID");
  if (
    Date.parse(comparison.comparedAt) <
      Date.parse(decision.legacyOutputSnapshot.capturedAt) ||
    Date.parse(comparison.comparedAt) < Date.parse(decision.decidedAt)
  ) fail("COMPATIBILITY_CORRELATION_INVALID");
  const policyFindingIds = new Set(
    request.suppliedPolicyDecision.findings.map((item) => item.findingId),
  );
  const directiveIds = new Set(
    request.suppliedPolicyDecision.systemDirectives.map((item) =>
      item.directiveId),
  );
  const dimensions = [
    comparison.responseComparison, comparison.sessionComparison,
    comparison.safetyComparison, comparison.routingComparison,
    comparison.escalationComparison, comparison.presentationComparison,
    comparison.effectComparison,
  ];
  const expectedDimensionOrder = COMPARISON_DIMENSION_NAMES;
  const policy = sources.comparisonPolicyRegistry.policies.find((item) =>
    item.comparisonPolicyId === comparison.comparisonPolicyId &&
    item.comparisonPolicyVersion === comparison.comparisonPolicyVersion);
  const comparator = sources.comparatorRegistry.comparators.find((item) =>
    item.comparatorId === comparison.comparatorId &&
    item.comparatorVersion === comparison.comparatorVersion);
  if (!policy || !comparator ||
    dimensions.some((item, index) =>
      item.dimension !== expectedDimensionOrder[index] ||
      !policy.allowedOutcomeByDimension[item.dimension]
        .includes(item.classification) ||
      !sources.comparatorRegistry.comparators.some((candidate) =>
        candidate.comparatorId === item.comparatorId &&
        candidate.comparatorVersion === item.comparatorVersion)) ||
    (comparison.finalClassification === "policy_approved_difference" &&
      (
        comparison.expectedDifferenceReferences.length === 0 ||
        comparison.expectedDifferenceReferences.some((reference) =>
          !policy.allowedPolicyDifferenceCategories.includes(reference))
      ))) {
    fail("COMPATIBILITY_COMPARISON_INVALID");
  }
  assertParityClassificationCompatibility(
    comparison.finalClassification,
    dimensions,
  );
  assertPolicyDifferenceAuthority(request, comparison, policy, dimensions);
  if (dimensions.some((item) =>
    item.policyFindingIds.some((id) => !policyFindingIds.has(id)) ||
    item.directiveIds.some((id) => !directiveIds.has(id)))) {
    fail("COMPATIBILITY_REFERENCE_INVALID");
  }
}

function assertEvidenceAndFlag(
  request: CompatibilityEvaluationRequest,
  decision: CompatibilityDecisionRecord,
  sources: ValidatedSources,
): void {
  const evidenceIds = new Set(decision.evidence.map((item) => item.evidenceId));
  if (evidenceIds.size !== decision.evidence.length) {
    fail("COMPATIBILITY_REFERENCE_INVALID");
  }
  for (const evidence of decision.evidence) {
    const golden = sources.goldenCatalogue?.cases.find((item) =>
      item.goldenCaseId === evidence.goldenCaseId &&
      item.version === evidence.goldenCaseVersion);
    const policy = sources.comparisonPolicyRegistry.policies.find((item) =>
      item.comparisonPolicyId === evidence.comparisonPolicyId &&
      item.comparisonPolicyVersion === evidence.comparisonPolicyVersion);
    const comparator = sources.comparatorRegistry.comparators.find((item) =>
      item.comparatorId === evidence.comparatorId &&
      item.comparatorVersion === evidence.comparatorVersion);
    const requiredByCategory = {
      safety: [
        ...(golden?.requiredSafetyInvariants ?? []),
        ...(policy?.requiredSafetyInvariants ?? []),
      ],
      consent: [
        ...(golden?.requiredConsentInvariants ?? []),
        ...(policy?.requiredConsentInvariants ?? []),
      ],
      privacy: [
        ...(golden?.requiredPrivacyInvariants ?? []),
        ...(policy?.requiredPrivacyInvariants ?? []),
      ],
      session: golden?.requiredSessionInvariants ?? [],
      routing: golden?.requiredRoutingInvariants ?? [],
      effect: golden?.requiredEffectInvariants ?? [],
      audit: [
        ...(golden?.requiredAuditInvariants ?? []),
        ...(policy?.requiredAuditEvidence ?? []),
      ],
    };
    const registeredInvariantIds = new Set(
      Object.values(requiredByCategory).flat(),
    );
    const evidenceInvariantIds = evidence.invariantResults.map((item) =>
      item.invariantId);
    const complete = [...registeredInvariantIds].every((id) =>
      evidenceInvariantIds.filter((candidate) => candidate === id).length === 1);
    const categoriesMatch = evidence.invariantResults.every((result) =>
      registeredInvariantIds.has(result.invariantId) &&
      requiredByCategory[result.category as keyof typeof requiredByCategory]
        ?.includes(result.invariantId));
    const evaluationTime = sources.now ?? decision.decidedAt;
    if (!golden || !policy || !comparator ||
      golden.status !== "approved" ||
      golden.seamId !== request.legacyInputSnapshot.seamId ||
      evidence.legacySeamId !== request.legacyInputSnapshot.seamId ||
      evidence.legacyVersion !== request.legacyInputSnapshot.seamVersion ||
      evidence.comparisonPolicyId !== golden.comparisonPolicyId ||
      evidence.comparisonPolicyVersion !== golden.comparisonPolicyVersion ||
      (decision.shadowComparison !== undefined &&
        (
          evidence.comparatorId !== decision.shadowComparison.comparatorId ||
          evidence.comparatorVersion !==
            decision.shadowComparison.comparatorVersion ||
          evidence.comparisonPolicyId !==
            decision.shadowComparison.comparisonPolicyId ||
          evidence.comparisonPolicyVersion !==
            decision.shadowComparison.comparisonPolicyVersion
        )) ||
      evidence.expectedClassification !== golden.expectedClassification ||
      evidence.observedClassification !== decision.finalClassification ||
      !complete || !categoriesMatch ||
      evidence.invariantResults.some((item) => !item.passed) ||
      Date.parse(evidence.expiry) <= Date.parse(evaluationTime) ||
      evidence.reviewStatus !== "accepted") {
      fail("COMPATIBILITY_EVIDENCE_INVALID");
    }
  }
  const flag = decision.featureFlagState;
  if (!flag) {
    if (request.compatibilityMode.requestedMode !== "legacy_only" ||
      request.compatibilityMode.featureFlagReference !== undefined) {
      fail("COMPATIBILITY_FEATURE_FLAG_INVALID");
    }
    return;
  }
  const rollback = decision.rollbackPlan;
  if (
    request.compatibilityMode.featureFlagReference !== flag.flagId ||
    Date.parse(flag.expiry) <=
      Date.parse(sources.now ?? decision.decidedAt) ||
    flag.prerequisiteEvidenceIds.some((id) => !evidenceIds.has(id)) ||
    (flag.rollbackPlanId && flag.rollbackPlanId !== rollback?.rollbackPlanId) ||
    flag.effectiveMode !== request.compatibilityMode.effectiveMode ||
    (flag.effectiveMode !== "legacy_only" &&
      (!decision.shadowComparison ||
        decision.shadowComparison.compatibilityRequestId !==
          request.compatibilityRequestId ||
        ["incompatible", "insufficient_evidence", "safe_fallback_required"]
          .includes(decision.finalClassification))) ||
    (flag.effectiveMode !== "legacy_only" &&
      decision.evidence.some((item) =>
        item.invariantResults.some((result) =>
          ["safety", "consent"].includes(result.category) && !result.passed)))
  ) fail("COMPATIBILITY_FEATURE_FLAG_INVALID");
}

function assertDecisionCorrelation(
  request: CompatibilityEvaluationRequest,
  decision: CompatibilityDecisionRecord,
  sources: ValidatedSources,
): void {
  if (
    decision.compatibilityRequestId !== request.compatibilityRequestId ||
    decision.compatibilitySchemaVersion !== request.compatibilitySchemaVersion ||
    decision.modeState.requestedMode !== request.compatibilityMode.requestedMode ||
    decision.modeState.effectiveMode !== request.compatibilityMode.effectiveMode ||
    decision.legacyOutputSnapshot.inputSnapshotId !==
      request.legacyInputSnapshot.snapshotId ||
    decision.legacyOutputSnapshot.seamId !== request.legacyInputSnapshot.seamId ||
    decision.legacyOutputSnapshot.seamVersion !==
      request.legacyInputSnapshot.seamVersion ||
    decision.legacyOutputSnapshot.correlationId !==
      request.legacyInputSnapshot.correlationId ||
    Date.parse(decision.legacyOutputSnapshot.capturedAt) <
      Date.parse(request.legacyInputSnapshot.capturedAt) ||
    Date.parse(decision.decidedAt) <
      Date.parse(decision.legacyOutputSnapshot.capturedAt) ||
    decision.auditReference !== request.auditContext.auditReference ||
    decision.observability.compatibilityRequestId !==
      request.compatibilityRequestId ||
    decision.observability.correlationId !== request.auditContext.correlationId ||
    decision.observability.auditReference !== request.auditContext.auditReference
  ) fail("COMPATIBILITY_CORRELATION_INVALID");
  if (
    request.compatibilityMode.effectiveMode === "shadow_compare" &&
    decision.adapterPlans.length > 0
  ) fail("COMPATIBILITY_MODE_INVALID");
  if (
    ["candidate_delivery", "authoritative"].includes(
      decision.modeState.effectiveMode,
    )
  ) fail("COMPATIBILITY_MODE_INVALID");
  const adapterPlanIds = decision.adapterPlans.map((plan) =>
    plan.adapterPlanId);
  const effectIds = decision.adapterPlans.flatMap((plan) =>
    plan.authorizedEffects.map((effect) => effect.effectId));
  const legacyEffectIds = decision.legacyOutputSnapshot.effects.map((effect) =>
    effect.effectId);
  if (
    new Set(adapterPlanIds).size !== adapterPlanIds.length ||
    new Set(effectIds).size !== effectIds.length ||
    new Set(legacyEffectIds).size !== legacyEffectIds.length
  ) fail("COMPATIBILITY_REFERENCE_INVALID");
  const comparisonPolicy = sources.comparisonPolicyRegistry.policies.find(
    (item) =>
      item.comparisonPolicyId ===
        request.expectedComparisonPolicy.comparisonPolicyId &&
      item.comparisonPolicyVersion ===
        request.expectedComparisonPolicy.version,
  );
  const outputAgeSeconds = (
    Date.parse(decision.decidedAt) -
    Date.parse(decision.legacyOutputSnapshot.capturedAt)
  ) / 1000;
  if (!comparisonPolicy || outputAgeSeconds < 0 ||
    outputAgeSeconds > comparisonPolicy.snapshotMaxAgeSeconds) {
    fail("COMPATIBILITY_CORRELATION_INVALID");
  }
  if (decision.legacyOutputSnapshot.effects.some((effect) =>
    effect.sourceSeamId !== request.legacyInputSnapshot.seamId ||
    effect.correlationId !== request.auditContext.correlationId ||
    (effect.sessionReference !== undefined &&
      effect.sessionReference !== request.legacyInputSnapshot.sessionReference)
  )) fail("COMPATIBILITY_CORRELATION_INVALID");
  for (const plan of decision.adapterPlans) {
    assertAdapterPlan(request, plan, request.suppliedPolicyDecision, sources);
  }
  assertComparison(request, decision, sources);
  assertEvidenceAndFlag(request, decision, sources);
  const findingIds = new Set(request.suppliedPolicyDecision.findings.map(
    (finding) => finding.findingId,
  ));
  const evidenceIds = new Set(decision.evidence.map((evidence) =>
    evidence.evidenceId));
  if (
    decision.rollbackPlan &&
    (
      decision.rollbackPlan.targetLegacySeamId !==
        request.legacyInputSnapshot.seamId ||
      decision.rollbackPlan.auditReference !==
        request.auditContext.auditReference ||
      decision.rollbackPlan.requiredFindings.some((id) =>
        !findingIds.has(id)) ||
      decision.rollbackPlan.requiredEvidence.some((id) =>
        !evidenceIds.has(id))
    )
  ) fail("COMPATIBILITY_ROLLBACK_INVALID");
  if (
    decision.safeFailure &&
    (
      decision.safeFailure.auditReference !== request.auditContext.auditReference ||
      decision.safeFailure.blockingFindingIds.some((id) =>
        !findingIds.has(id)) ||
      (decision.safeFailure.rollbackPlanReference &&
        decision.safeFailure.rollbackPlanReference !==
          decision.rollbackPlan?.rollbackPlanId)
    )
  ) fail("COMPATIBILITY_SAFE_FAILURE_INVALID");
  if (
    decision.observability.decisionComparisonReference !==
      decision.shadowComparison?.comparisonId &&
    decision.observability.decisionComparisonReference !== undefined
  ) fail("COMPATIBILITY_REFERENCE_INVALID");
  if (decision.shadowComparison && (
    decision.observability.responseComparison !==
      decision.shadowComparison.responseComparison.classification ||
    decision.observability.sessionComparison !==
      decision.shadowComparison.sessionComparison.classification ||
    decision.observability.effectComparison !==
      decision.shadowComparison.effectComparison.classification ||
    decision.observability.safetyDivergence !==
      decision.shadowComparison.safetyComparison.safetyDowngrade ||
    decision.observability.consentDivergence !==
      [
        decision.shadowComparison.responseComparison,
        decision.shadowComparison.sessionComparison,
        decision.shadowComparison.safetyComparison,
        decision.shadowComparison.routingComparison,
        decision.shadowComparison.escalationComparison,
        decision.shadowComparison.presentationComparison,
        decision.shadowComparison.effectComparison,
      ].some((dimension) => dimension.consentDowngrade)
  )) fail("COMPATIBILITY_COMPARISON_INVALID");
  if (decision.shadowComparison) {
    assertResponseDigestBinding(request, decision, decision.shadowComparison);
  }
}

export function parseLegacySeamRegistry(input: unknown): LegacySeamRegistry {
  const parsed = parseWith(
    legacySeamRegistrySchema,
    input,
    "COMPATIBILITY_SEAM_REGISTRY_INVALID",
  );
  if (!canonicalContractEqual(parsed, VYVA_LEGACY_SEAM_REGISTRY)) {
    fail("COMPATIBILITY_SEAM_REGISTRY_INVALID");
  }
  return parsed;
}

export function parseComparatorRegistry(
  input: unknown,
): z.infer<typeof comparatorRegistrySchema> {
  const parsed = parseWith(
    comparatorRegistrySchema,
    input,
    "COMPATIBILITY_COMPARISON_INVALID",
  );
  if (!canonicalContractEqual(parsed, VYVA_COMPARATOR_REGISTRY)) {
    fail("COMPATIBILITY_COMPARISON_INVALID");
  }
  return parsed;
}

export function parseComparisonPolicyRegistry(
  input: unknown,
): z.infer<typeof comparisonPolicyRegistrySchema> {
  const parsed = parseWith(
    comparisonPolicyRegistrySchema,
    input,
    "COMPATIBILITY_COMPARISON_INVALID",
  );
  if (!canonicalContractEqual(parsed, VYVA_COMPARISON_POLICY_REGISTRY)) {
    fail("COMPATIBILITY_COMPARISON_INVALID");
  }
  return parsed;
}

export function parsePolicyDifferenceAuthorityMatrix(
  input: unknown,
): z.infer<typeof policyDifferenceAuthorityMatrixSchema> {
  const parsed = parseWith(
    policyDifferenceAuthorityMatrixSchema,
    input,
    "COMPATIBILITY_COMPARISON_INVALID",
  );
  if (!canonicalContractEqual(
    parsed,
    VYVA_POLICY_DIFFERENCE_AUTHORITY_MATRIX,
  )) {
    fail("COMPATIBILITY_COMPARISON_INVALID");
  }
  return parsed;
}

export function parseCompatibilityEvaluationRequest(
  input: unknown,
  options: CompatibilityValidationOptions = {},
): CompatibilityEvaluationRequest {
  const parsed = parseWith(
    compatibilityEvaluationRequestSchema,
    input,
    "COMPATIBILITY_REQUEST_INVALID",
  );
  assertRequestCorrelation(parsed, sourcesFor(options), options);
  return parsed;
}

export function parseAdapterAuthorizationPlan(
  input: unknown,
): AdapterAuthorizationPlan {
  return parseWith(
    adapterAuthorizationPlanSchema,
    input,
    "COMPATIBILITY_ADAPTER_PLAN_INVALID",
  );
}

export function parseShadowComparisonRecord(
  input: unknown,
): ShadowComparisonRecord {
  return parseWith(
    shadowComparisonRecordSchema,
    input,
    "COMPATIBILITY_COMPARISON_INVALID",
  );
}

export function parseGoldenCompatibilityCatalogue(
  input: unknown,
  options: {
    flowCatalogue?: unknown;
    presentationRegistry?: unknown;
  } = {},
): GoldenCompatibilityCatalogue {
  const parsed = parseWith(
    goldenCompatibilityCatalogueSchema,
    input,
    "COMPATIBILITY_GOLDEN_CASE_INVALID",
  );
  const flows = parseFlowCatalogue(options.flowCatalogue ?? VYVA_FLOW_CATALOGUE);
  const presentations = parsePresentationRegistry(
    options.presentationRegistry ?? VYVA_PRESENTATION_REGISTRY,
  );
  const policyIds = new Set(ORCHESTRATOR_POLICY_PRECEDENCE.map((item) =>
    item.policyId));
  for (const item of parsed.cases) {
    if (
      item.flowReference.catalogueVersion !== flows.catalogueVersion ||
      !flows.flows.some((flow) =>
        flow.flowId === item.flowReference.flowId &&
        flow.version === item.flowReference.version) ||
      item.presentationReference.registryVersion !==
        presentations.registryVersion ||
      !presentations.presentations.some((presentation) =>
        presentation.presentationId ===
          item.presentationReference.presentationId &&
        presentation.version === item.presentationReference.version &&
        presentation.supportedFlowIds.includes(item.flowReference.flowId)) ||
      item.policyReferences.some((id) => !policyIds.has(id)) ||
      !VYVA_COMPARISON_POLICY_REGISTRY.policies.some((policy) =>
        policy.comparisonPolicyId === item.comparisonPolicyId &&
        policy.comparisonPolicyVersion === item.comparisonPolicyVersion)
    ) fail("COMPATIBILITY_REFERENCE_INVALID");
  }
  return parsed;
}

export function parseCompatibilityEvidence(
  input: unknown,
): CompatibilityEvidence {
  return parseWith(
    compatibilityEvidenceSchema,
    input,
    "COMPATIBILITY_EVIDENCE_INVALID",
  );
}

export function parseCompatibilityFeatureFlagState(
  input: unknown,
): CompatibilityFeatureFlagState {
  return parseWith(
    compatibilityFeatureFlagStateSchema,
    input,
    "COMPATIBILITY_FEATURE_FLAG_INVALID",
  );
}

export function parseCompatibilityRollbackPlan(
  input: unknown,
): CompatibilityRollbackPlan {
  return parseWith(
    compatibilityRollbackPlanSchema,
    input,
    "COMPATIBILITY_ROLLBACK_INVALID",
  );
}

export function parseCompatibilityDecisionRecord(
  input: unknown,
): CompatibilityDecisionRecord {
  return parseWith(
    compatibilityDecisionRecordSchema,
    input,
    "COMPATIBILITY_DECISION_INVALID",
  );
}

export function validateCompatibilityDecisionForRequest(
  requestInput: unknown,
  decisionInput: unknown,
  options: CompatibilityValidationOptions = {},
): CompatibilityDecisionRecord {
  const sources = sourcesFor(options);
  const request = parseCompatibilityEvaluationRequest(requestInput, options);
  const decision = parseCompatibilityDecisionRecord(decisionInput);
  assertDecisionCorrelation(request, decision, sources);
  return decision;
}

// Compile-time boundary markers. These are accepted frozen shapes, not runtime
// adapters and not imports from the legacy implementation under src/.
export type FrozenTask1InteractionEvent = InteractionEvent;
export type FrozenTask1FlowState = FlowState;
export type FrozenTask4PolicyRequest = OrchestratorPolicyEvaluationRequest;
export type FrozenTask4PolicyDecision = OrchestratorPolicyDecision;
export { OrchestrationContractError };
