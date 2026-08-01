import { z } from "zod";
import {
  interactionEventSchema,
  parseInteractionEvent,
  type InteractionEvent,
} from "./events";
import {
  canTransition,
  expectedFlowInputSchema,
  flowLifecycleStateSchema,
  flowStateSchema,
  parseFlowState,
  type FlowState,
} from "./flowState";
import {
  boundedMetadataSchema,
  CONSENT_SCOPE_IDS,
  FLOW_CHANNELS,
  parseFlowCatalogue,
  VYVA_FLOW_CATALOGUE,
  type FlowCatalogue,
  type FlowDefinition,
} from "./flowCatalogue";
import {
  PRESENTATION_DEVICE_CLASSES,
  parsePresentationRegistry,
  VYVA_PRESENTATION_REGISTRY,
  type PresentationDefinition,
  type PresentationRegistry,
} from "./presentationRegistry";
import {
  escalationProposalSchema,
  followUpRecommendationSchema,
  memoryReadRequestSchema,
  memorySensitivitySchema,
  memoryWriteProposalSchema,
  parseSpecialistRequest,
  parseSpecialistResponse,
  proposedToolCallSchema,
  specialistFlowStateUpdateSchema,
  specialistRequestSchema,
  specialistResponseSchema,
  specialistRiskLevelSchema,
  specialistToolDescriptorSchema,
  validateSpecialistResponse,
  type SpecialistRequest,
  type SpecialistResponse,
} from "./specialist";
import {
  OrchestrationContractError,
  type OrchestrationContractErrorCode,
} from "./errors";

const opaqueIdSchema = z.string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/);
const stableIdSchema = z.string()
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/)
  .max(240);
const reasonCodeSchema = z.string()
  .regex(/^[A-Z][A-Z0-9_]{1,127}$/);
const semverSchema = z.string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const dateTimeSchema = z.string().datetime({ offset: true });
const safeTextSchema = z.string().min(1).max(2_000);
const safeShortTextSchema = z.string().min(1).max(500);
const MAX_POLICY_ITEMS = 256;
const MAX_PRESENTATION_CANDIDATES = 64;
const MAX_DECISION_ITEMS = 128;
const MAX_CONSTRAINTS_PER_ADJUDICATION = 32;
const unique = <T extends z.ZodTypeAny>(schema: T, minimum = 0) =>
  z.array(schema).min(minimum).max(MAX_POLICY_ITEMS)
    .superRefine((items, context) => {
    const values = items.map((item) => (
      typeof item === "string" ? item : JSON.stringify(item)
    ));
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate values",
      });
    }
  });

export const ORCHESTRATOR_POLICY_STAGES = [
  "ingress",
  "specialist_invocation",
  "specialist_response",
  "proposal_adjudication",
  "presentation_approval",
  "delivery_approval",
  "safe_failure",
] as const;
export type OrchestratorPolicyStage =
  typeof ORCHESTRATOR_POLICY_STAGES[number];
export const orchestratorPolicyStageSchema = z.enum(
  ORCHESTRATOR_POLICY_STAGES,
);

export const ORCHESTRATOR_POLICY_CATEGORIES = [
  "deterministic_safety",
  "consent",
  "privacy",
  "correlation",
  "flow_eligibility",
  "specialist_validity",
  "escalation",
  "tool",
  "memory",
  "flow_update",
  "followup",
  "presentation",
  "response_composition",
  "audit",
  "safe_failure",
] as const;
export type OrchestratorPolicyCategory =
  typeof ORCHESTRATOR_POLICY_CATEGORIES[number];

export const ORCHESTRATOR_POLICY_EFFECTS = [
  "allow",
  "constrain",
  "deny",
  "require_confirmation",
  "require_escalation",
  "require_revalidation",
  "require_safe_fallback",
] as const;
export type OrchestratorPolicyEffect =
  typeof ORCHESTRATOR_POLICY_EFFECTS[number];

const policyDefinitionSchema = z.object({
  policyId: stableIdSchema,
  category: z.enum(ORCHESTRATOR_POLICY_CATEGORIES),
  priority: z.number().int().positive(),
  appliesAtStages: unique(orchestratorPolicyStageSchema, 1),
  effect: z.enum(ORCHESTRATOR_POLICY_EFFECTS),
  description: safeShortTextSchema,
  auditRequired: z.boolean(),
}).strict();

export type OrchestratorPolicyDefinition = z.infer<
  typeof policyDefinitionSchema
>;

const ALL_POLICY_STAGES = [...ORCHESTRATOR_POLICY_STAGES];
const DECISION_STAGES: OrchestratorPolicyStage[] = [
  "specialist_response",
  "proposal_adjudication",
  "presentation_approval",
  "delivery_approval",
  "safe_failure",
];

/**
 * Ordered policy facts only. There are no predicates, callbacks or executable
 * rules in this registry.
 */
export const ORCHESTRATOR_POLICY_PRECEDENCE: readonly OrchestratorPolicyDefinition[] = [
  {
    policyId: "policy.safety.checked",
    category: "deterministic_safety",
    priority: 1500,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "allow",
    description: "A current deterministic safety result is present.",
    auditRequired: true,
  },
  {
    policyId: "policy.safety.emergency",
    category: "deterministic_safety",
    priority: 1490,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "require_escalation",
    description: "A deterministic emergency result requires safety precedence.",
    auditRequired: true,
  },
  {
    policyId: "policy.safety.no_downgrade",
    category: "deterministic_safety",
    priority: 1480,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "deny",
    description: "A lower-risk proposal cannot downgrade deterministic safety.",
    auditRequired: true,
  },
  {
    policyId: "policy.consent.allowed",
    category: "consent",
    priority: 1400,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "allow",
    description: "Purpose-specific consent permits the proposed operation.",
    auditRequired: true,
  },
  {
    policyId: "policy.consent.revoked",
    category: "consent",
    priority: 1390,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "deny",
    description: "Revoked consent denies the proposed operation.",
    auditRequired: true,
  },
  {
    policyId: "policy.consent.confirmation",
    category: "consent",
    priority: 1380,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "require_confirmation",
    description: "Fresh purpose-specific consent confirmation is required.",
    auditRequired: true,
  },
  {
    policyId: "policy.privacy.allowed",
    category: "privacy",
    priority: 1370,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "allow",
    description: "The proposal preserves the required privacy treatment.",
    auditRequired: true,
  },
  {
    policyId: "policy.privacy.no_downgrade",
    category: "privacy",
    priority: 1360,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "deny",
    description: "Privacy treatment cannot be weakened.",
    auditRequired: true,
  },
  {
    policyId: "policy.correlation.valid",
    category: "correlation",
    priority: 1300,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "allow",
    description: "Identity, Flow and version references are current.",
    auditRequired: true,
  },
  {
    policyId: "policy.correlation.revalidate",
    category: "correlation",
    priority: 1290,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "require_revalidation",
    description: "Stale or mismatched correlation requires current state.",
    auditRequired: true,
  },
  {
    policyId: "policy.flow.eligible",
    category: "flow_eligibility",
    priority: 1200,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "allow",
    description: "The Flow and version are eligible for this session.",
    auditRequired: true,
  },
  {
    policyId: "policy.flow.ineligible",
    category: "flow_eligibility",
    priority: 1190,
    appliesAtStages: ALL_POLICY_STAGES,
    effect: "deny",
    description: "The Flow or version is not eligible.",
    auditRequired: true,
  },
  {
    policyId: "policy.specialist.valid",
    category: "specialist_validity",
    priority: 1100,
    appliesAtStages: [
      "specialist_invocation", "specialist_response",
      "proposal_adjudication", "presentation_approval", "delivery_approval",
    ],
    effect: "allow",
    description: "The Specialist boundary and correlation are valid.",
    auditRequired: true,
  },
  {
    policyId: "policy.specialist.invalid",
    category: "specialist_validity",
    priority: 1090,
    appliesAtStages: [
      "specialist_invocation", "specialist_response",
      "proposal_adjudication", "presentation_approval", "delivery_approval",
    ],
    effect: "deny",
    description: "The Specialist boundary or response is invalid.",
    auditRequired: true,
  },
  {
    policyId: "policy.tool.outside_flow_narrow_exception",
    category: "tool",
    priority: 1080,
    appliesAtStages: ["proposal_adjudication"],
    effect: "allow",
    description: "A registered narrow policy permits one named Tool outside the Flow declaration.",
    auditRequired: true,
  },
  ...([
    ["escalation", 1000],
    ["tool", 900],
    ["memory", 800],
    ["flow_update", 700],
    ["followup", 600],
    ["presentation", 500],
    ["response_composition", 400],
    ["audit", 300],
  ] as const).flatMap(([category, priority]) => ([{
    policyId: `policy.${category}.allowed`,
    category,
    priority,
    appliesAtStages: DECISION_STAGES,
    effect: "allow",
    description: `The ${category.replaceAll("_", " ")} proposal is authorized.`,
    auditRequired: true,
  }, {
    policyId: `policy.${category}.denied`,
    category,
    priority: priority - 10,
    appliesAtStages: DECISION_STAGES,
    effect: "deny",
    description: `The ${category.replaceAll("_", " ")} proposal is denied.`,
    auditRequired: true,
  }] satisfies OrchestratorPolicyDefinition[])),
  {
    policyId: "policy.safe_failure.required",
    category: "safe_failure",
    priority: 200,
    appliesAtStages: DECISION_STAGES,
    effect: "require_safe_fallback",
    description: "A safe non-executing fallback is required.",
    auditRequired: true,
  },
  {
    policyId: "policy.tool.confirmation",
    category: "tool",
    priority: 190,
    appliesAtStages: ["proposal_adjudication"],
    effect: "require_confirmation",
    description: "The named Tool proposal requires explicit confirmation.",
    auditRequired: true,
  },
] as const;

export const ORCHESTRATOR_POLICY_PRIORITY = Object.freeze(
  Object.fromEntries(
    ORCHESTRATOR_POLICY_CATEGORIES.map((category) => [
      category,
      Math.max(
        ...ORCHESTRATOR_POLICY_PRECEDENCE
          .filter((policy) => policy.category === category)
          .map((policy) => policy.priority),
      ),
    ]),
  ) as Record<OrchestratorPolicyCategory, number>,
);

const POLICY_BY_ID = new Map(
  ORCHESTRATOR_POLICY_PRECEDENCE.map((policy) => [policy.policyId, policy]),
);

const ORCHESTRATOR_METADATA_DENIED_KEYS = new Set([
  "apikey", "accesstoken", "refreshtoken", "authorizationheader", "token",
  "authtoken", "bearertoken", "sessiontoken",
  "credential", "credentials", "secret", "password", "privatekey",
  "providerclient", "provideradapter", "runtimeadapter", "adapter",
  "callback", "handler", "endpoint", "url", "hiddenreasoning",
  "chainofthought", "reasoningtrace", "diagnosis", "diagnosticdecision",
  "frauddecision", "scamdecision", "rawprovidererror", "providerstack",
  "stacktrace", "executetool", "toolexecution", "writememory", "memorywrite",
  "schedulefollowup", "createschedule", "schedulejob", "emitevent", "dispatchevent",
  "executeescalation", "notifycaregiver", "notifyoperator",
  "runtimecomponent", "reactcomponent",
  "rawmessage", "rawusermessage", "usermessage", "transcript",
  "rawtranscript", "image", "imagedata", "rawimage", "base64", "binary",
  "toolarguments", "toolargs", "rawarguments", "providerpayload",
  "providerresponse", "healthimage", "documentcontents",
  "financialdetails", "cardnumber", "accountnumber",
]);

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsDeniedMetadata(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsDeniedMetadata);
  if (!value || typeof value !== "object") {
    return typeof value === "string" && /^https?:\/\//i.test(value);
  }
  return Object.entries(value).some(([key, nested]) =>
    ORCHESTRATOR_METADATA_DENIED_KEYS.has(normalizedKey(key)) ||
    containsDeniedMetadata(nested));
}

function passesLuhn(value: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function containsLabeledFinancialAuditValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsLabeledFinancialAuditValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(containsLabeledFinancialAuditValue);
  }
  return typeof value === "string" &&
    /(?:^|[^a-z0-9])(?:bank[_-]?account|account|acct|card|routing[_-]?(?:number|no)|sort[_-]?code|wallet[_-]?account)[_:-]?\d{6,19}(?:$|[^a-z0-9])/i
      .test(value);
}

function containsUnsafeAuditValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsUnsafeAuditValue);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsUnsafeAuditValue);
  }
  if (typeof value !== "string") return false;
  const isLabeledFinancialValue = containsLabeledFinancialAuditValue(value);
  const compactDigits = value.replace(/[\s-]/g, "");
  const isPaymentCard = /^\d{13,19}$/.test(compactDigits) &&
    passesLuhn(compactDigits);
  const isIban = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i.test(
    value.replace(/\s/g, ""),
  );
  const isDataUri = /^data:[^,]{0,200},/i.test(value);
  const isLongBase64 = value.length >= 80 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value) &&
    value.length % 4 === 0;
  const hasBinaryControls = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 8) || code === 11 || code === 12 ||
      (code >= 14 && code <= 31);
  });
  const isSafeAuditReference =
    dateTimeSchema.safeParse(value).success ||
    opaqueIdSchema.safeParse(value).success ||
    reasonCodeSchema.safeParse(value).success ||
    stableIdSchema.safeParse(value).success ||
    semverSchema.safeParse(value).success;
  return isLabeledFinancialValue || isPaymentCard || isIban || isDataUri || isLongBase64 ||
    hasBinaryControls || !isSafeAuditReference;
}

const ORCHESTRATOR_RAW_BOUNDARY_DENIED_KEYS = new Set(
  [...ORCHESTRATOR_METADATA_DENIED_KEYS].filter((key) =>
    ![
      "rawmessage", "rawusermessage", "usermessage", "transcript",
      "rawtranscript", "image", "imagedata", "rawimage", "base64", "binary",
      "toolarguments", "toolargs", "rawarguments", "providerpayload",
      "providerresponse", "healthimage", "documentcontents",
      "financialdetails", "cardnumber", "accountnumber",
      "token", "authtoken", "bearertoken", "sessiontoken",
    ].includes(key)),
);

export const orchestratorPolicyMetadataSchema = boundedMetadataSchema
  .superRefine((metadata, context) => {
    if (containsDeniedMetadata(metadata)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ORCHESTRATOR_METADATA_INVALID",
      });
    }
  });

export const orchestratorAuditMetadataSchema = boundedMetadataSchema
  .superRefine((metadata, context) => {
    if (
      containsDeniedMetadata(metadata) ||
      containsUnsafeAuditValue(metadata)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: containsLabeledFinancialAuditValue(metadata)
          ? "ORCHESTRATOR_AUDIT_VALUE_INVALID"
          : "AUDIT_CONTENT_NOT_MINIMIZED",
      });
    }
  });

export const flowDefinitionReferenceSchema = z.object({
  catalogueVersion: semverSchema,
  flowId: stableIdSchema,
  version: semverSchema,
  status: z.enum(["draft", "approved", "pilot", "active", "deprecated", "retired"]),
  sessionEligibility: z.enum(["new_session", "existing_session"]),
}).strict();

export const presentationReferenceSchema = z.object({
  presentationId: stableIdSchema,
  version: semverSchema,
  familyId: stableIdSchema,
  flowId: stableIdSchema,
  flowVersion: semverSchema,
  sceneId: stableIdSchema,
}).strict();

export const presentationCandidateReferenceSchema = z.object({
  presentationId: stableIdSchema,
  version: semverSchema,
  familyId: stableIdSchema,
  sceneId: stableIdSchema,
  supportedFlowIds: unique(stableIdSchema, 1),
  status: z.enum(["draft", "approved", "pilot", "active", "deprecated", "retired"]),
  currentEligibility: z.enum(["eligible", "ineligible", "requires_revalidation"]),
  candidacyReason: reasonCodeSchema.optional(),
}).strict();

const questionReferenceSchema = z.object({
  questionId: opaqueIdSchema,
  sceneId: stableIdSchema,
  flowVersion: semverSchema,
}).strict();

const sceneReferenceSchema = z.object({
  sceneId: stableIdSchema,
  flowId: stableIdSchema,
  flowVersion: semverSchema,
}).strict();

export const ORCHESTRATOR_CONSENT_SCOPES = [
  ...CONSENT_SCOPE_IDS,
  "image_analysis",
  "document_retention",
  "memory_read",
  "memory_write",
  "health_evidence",
  "clinician_disclosure",
] as const;
const orchestratorConsentScopeSchema = z.enum(ORCHESTRATOR_CONSENT_SCOPES);

export const approvedMedicationAuthoritySourceSchema = z.object({
  sourceReferenceId: opaqueIdSchema,
  issuerType: z.enum(["clinician", "approved_care_plan"]),
  issuerReferenceId: opaqueIdSchema,
  carePlanId: opaqueIdSchema.optional(),
  userId: opaqueIdSchema,
  profileId: opaqueIdSchema.optional(),
  status: z.enum(["active", "expired", "revoked"]),
  metadata: boundedMetadataSchema,
}).strict().superRefine((source, context) => {
  if (source.issuerType === "approved_care_plan" && !source.carePlanId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "approved care-plan source requires care-plan identity",
    });
  }
});

export const approvedCarePlanInstructionSchema = z.object({
  instructionReferenceId: opaqueIdSchema,
  carePlanId: opaqueIdSchema,
  instructionId: opaqueIdSchema,
  userId: opaqueIdSchema,
  profileId: opaqueIdSchema.optional(),
  medicationReferenceId: opaqueIdSchema,
  instructionType: z.enum([
    "medication_reminder",
    "approved_care_plan_instruction",
    "medication_instruction",
  ]),
  authorizedInstructionText: safeShortTextSchema,
  safeInstructionCode: stableIdSchema.optional(),
  dosage: z.number().positive().max(1_000_000).optional(),
  unit: z.enum(["mg", "mcg", "g", "ml", "tablet", "capsule"]).optional(),
  timing: safeShortTextSchema.optional(),
  validFrom: dateTimeSchema,
  validUntil: dateTimeSchema.optional(),
  issuerType: z.enum(["clinician", "approved_care_plan"]),
  issuerReferenceId: opaqueIdSchema,
  consentDecisionId: opaqueIdSchema.optional(),
  sourceRecordReferenceId: opaqueIdSchema,
  status: z.enum(["active", "expired", "revoked"]),
  metadata: boundedMetadataSchema,
}).strict().superRefine((instruction, context) => {
  if (Boolean(instruction.dosage) !== Boolean(instruction.unit)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dosage and unit must be supplied together",
    });
  }
});

export const emergencyExceptionBasisSchema = z.object({
  safetyFindingId: opaqueIdSchema,
  auditReferenceId: opaqueIdSchema,
}).strict();

export const clinicianDisclosureAuthorizationSourceSchema = z.object({
  consentDecisionId: opaqueIdSchema,
  scope: z.literal("clinician_disclosure"),
  purpose: stableIdSchema,
  targetType: z.enum([
    "specific_clinician",
    "approved_care_team",
    "emergency_clinical_service",
  ]),
  targetId: opaqueIdSchema.optional(),
  approvedTargetIds: unique(opaqueIdSchema).optional(),
  allowedChannels: unique(z.enum(FLOW_CHANNELS), 1),
  status: z.enum(["granted", "denied", "revoked"]),
  grantedAt: dateTimeSchema,
  expiresAt: dateTimeSchema.optional(),
  revokedAt: dateTimeSchema.optional(),
  emergencyExceptionBasis: emergencyExceptionBasisSchema.optional(),
  metadata: boundedMetadataSchema,
}).strict().superRefine((source, context) => {
  if (
    source.targetType === "specific_clinician" &&
    !source.targetId
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "specific clinician target required",
    });
  }
  if (
    source.targetType === "approved_care_team" &&
    !source.approvedTargetIds?.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "approved care-team targets required",
    });
  }
});

export const POLICY_SUBJECT_TYPES = [
  "response_guidance",
  "next_question",
  "ui_instruction",
  "presentation",
  "memory_read",
  "memory_write",
  "tool_call",
  "escalation",
  "flow_state_update",
  "completion",
  "followup",
] as const;
export type PolicySubjectType = typeof POLICY_SUBJECT_TYPES[number];

export const proposalRetentionDescriptorSchema = z.object({
  subjectType: z.enum(POLICY_SUBJECT_TYPES),
  subjectId: opaqueIdSchema,
  evidenceType: z.enum([
    "image", "document", "structured_observation", "none",
  ]),
  processingMode: z.enum(["transient", "retained", "longitudinal"]),
  retentionTarget: z.enum([
    "none",
    "working_memory",
    "postgres",
    "mem0",
    "external_tool",
  ]),
  retentionPurpose: stableIdSchema,
  consentScopeRequired: orchestratorConsentScopeSchema.optional(),
  noticeRequired: z.boolean(),
  retentionClass: z.enum(["none", "session", "short_term", "long_term"]),
  expiresAt: dateTimeSchema.optional(),
  sourceCapabilityId: stableIdSchema.optional(),
  sourceToolId: opaqueIdSchema.optional(),
  metadata: boundedMetadataSchema,
}).strict().superRefine((descriptor, context) => {
  const persistent = ["postgres", "mem0", "external_tool"].includes(
    descriptor.retentionTarget,
  );
  if (
    (descriptor.processingMode === "transient" && persistent) ||
    (descriptor.processingMode !== "transient" &&
      descriptor.retentionTarget === "none") ||
    (descriptor.processingMode === "transient" &&
      descriptor.retentionClass !== "none" &&
      descriptor.retentionTarget !== "working_memory") ||
    (descriptor.processingMode !== "transient" &&
      descriptor.retentionClass === "none") ||
    (persistent && !descriptor.consentScopeRequired) ||
    (descriptor.processingMode !== "transient" &&
      !descriptor.noticeRequired)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid retention classification",
    });
  }
});

export const consentDecisionReferenceSchema = z.object({
  scope: orchestratorConsentScopeSchema,
  decisionId: opaqueIdSchema.optional(),
  status: z.enum(["granted", "denied", "revoked", "requires_confirmation"]),
  authorizationBasis: z.enum([
    "explicit_user_consent",
    "recorded_profile_consent",
    "caregiver_authority",
    "operator_authority",
    "legal_basis",
    "emergency_exception",
  ]),
  purpose: stableIdSchema,
  decidedAt: dateTimeSchema,
  expiresAt: dateTimeSchema.optional(),
  requiresRevalidation: z.boolean(),
  permittedChannels: unique(z.enum(FLOW_CHANNELS)).optional(),
  permittedTargetIds: unique(opaqueIdSchema).optional(),
  emergencyExceptionFindingId: opaqueIdSchema.optional(),
  auditReferenceId: opaqueIdSchema.optional(),
}).strict();

const specialistRequestObjectSchema = specialistRequestSchema.innerType();

export const orchestratorSafetyContextSchema =
  specialistRequestObjectSchema.shape.safetyContext.extend({
    resultId: opaqueIdSchema,
    checkedAt: dateTimeSchema,
    emergencyPresentationRequired: z.boolean(),
  }).strict();

export const orchestratorConsentContextSchema =
  specialistRequestObjectSchema.shape.consentContext.extend({
    scopes: unique(orchestratorConsentScopeSchema),
    decisions: z.array(consentDecisionReferenceSchema).max(MAX_POLICY_ITEMS),
    revokedScopes: unique(orchestratorConsentScopeSchema),
    proactivePushAllowed: z.boolean(),
    outboundCallAllowed: z.boolean(),
    imageCaptureAllowed: z.boolean(),
    documentCaptureAllowed: z.boolean(),
    imageRetentionAllowed: z.boolean(),
    longitudinalComparisonAllowed: z.boolean(),
    mem0Allowed: z.boolean(),
  }).strict();

export const orchestratorChannelContextSchema = z.object({
  channel: z.enum(FLOW_CHANNELS),
  allowed: z.boolean(),
  triggerSource: z.enum([
    "user", "push", "outbound_call", "caregiver", "operator", "schedule", "system",
  ]),
  supportsVoice: z.boolean(),
  supportsVisuals: z.boolean(),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  timezone: z.string().min(1).max(100),
}).strict();

export const orchestratorDeviceContextSchema = z.object({
  deviceClass: z.enum(PRESENTATION_DEVICE_CLASSES),
  sharedDevice: z.boolean(),
  captionsAvailable: z.boolean(),
  screenReaderRequired: z.boolean(),
  keyboardNavigationRequired: z.boolean(),
  reducedMotionRequired: z.boolean(),
  highContrastRequired: z.boolean(),
}).strict();

export const orchestratorMemoryPolicyContextSchema = z.object({
  readAllowed: z.boolean(),
  writeAllowed: z.boolean(),
  mem0Allowed: z.boolean(),
  allowedReadCategories: unique(stableIdSchema),
  allowedWriteCategories: unique(stableIdSchema),
  prohibitedCategories: unique(stableIdSchema),
  permittedTargets: unique(z.enum(["postgres", "mem0", "working_memory"])),
  sensitivityCeiling: memorySensitivitySchema,
  maximumRetention: z.enum(["none", "session", "short_term", "long_term"]),
}).strict();

export const orchestratorToolPolicyContextSchema = z.object({
  externalToolUseAllowed: z.boolean(),
  availableTools: z.array(specialistToolDescriptorSchema).max(MAX_POLICY_ITEMS),
  allowedToolIds: unique(opaqueIdSchema),
  prohibitedToolIds: unique(opaqueIdSchema),
  maximumRiskLevel: specialistRiskLevelSchema,
  onePendingToolOnly: z.literal(true),
}).strict();

export const orchestratorEscalationContextSchema = z.object({
  activeEscalationId: opaqueIdSchema.optional(),
  allowedTypes: unique(z.enum([
    "emergency", "caregiver", "operator", "clinician", "technical",
  ])),
  allowedChannels: unique(z.enum(FLOW_CHANNELS)),
  caregiverDisclosureAllowed: z.boolean(),
  operatorDisclosureAllowed: z.boolean(),
  emergencyExceptionRecorded: z.boolean(),
}).strict();

export const activeAuditContextSchema = z.object({
  auditSessionId: opaqueIdSchema,
  previousDecisionIds: unique(opaqueIdSchema),
  correlationIds: unique(opaqueIdSchema, 1),
  retentionClassification: z.enum([
    "operational", "safety", "consent", "clinical_support", "legal",
  ]),
}).strict();

export const flowOperationContextSchema = z.object({
  operation: z.enum([
    "continue", "interrupt", "resume", "switch", "preempt",
  ]),
  targetFlowReference: flowDefinitionReferenceSchema.optional(),
  interruptedFlowState: flowStateSchema.optional(),
  interruptionReasonCode: reasonCodeSchema.optional(),
  interruptedAt: dateTimeSchema.optional(),
  expiresAt: dateTimeSchema.optional(),
  freshSafetyCheckAfterInterruption: z.boolean().optional(),
  revalidationProof: z.object({
    revalidationReferenceId: opaqueIdSchema,
    revalidatedAt: dateTimeSchema,
    flowId: stableIdSchema,
    flowVersion: semverSchema,
    safetyResultReference: opaqueIdSchema,
  }).strict().optional(),
  previousChannel: z.enum(FLOW_CHANNELS).optional(),
  ordinaryActiveFlowCount: z.number().int().min(0).max(1),
}).strict();

export const specialistInvocationAuthorizationSchema = z.object({
  decision: z.enum([
    "approved",
    "approved_with_reduced_context",
    "additional_consent_required",
    "denied",
    "safety_specialist_required",
  ]),
  specialistRequestId: opaqueIdSchema,
  excludedMemoryReferenceIds: unique(opaqueIdSchema),
  excludedEvidenceReferenceIds: unique(opaqueIdSchema),
  excludedContextReferenceIds: unique(opaqueIdSchema),
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

export const orchestratorPolicyEvaluationRequestSchema = z.object({
  evaluationId: opaqueIdSchema,
  policyVersion: semverSchema,
  stage: orchestratorPolicyStageSchema,
  requestedAt: dateTimeSchema,
  userId: opaqueIdSchema,
  profileId: opaqueIdSchema.optional(),
  sessionId: opaqueIdSchema,
  interactionEvent: interactionEventSchema,
  activeFlowState: flowStateSchema,
  flowDefinitionReference: flowDefinitionReferenceSchema,
  activePresentationReference: presentationReferenceSchema.optional(),
  currentQuestionReference: questionReferenceSchema.optional(),
  currentSceneReference: sceneReferenceSchema.optional(),
  specialistRequest: specialistRequestSchema.optional(),
  specialistResponse: specialistResponseSchema.optional(),
  safetyContext: orchestratorSafetyContextSchema,
  consentContext: orchestratorConsentContextSchema,
  channelContext: orchestratorChannelContextSchema,
  deviceContext: orchestratorDeviceContextSchema,
  memoryPolicyContext: orchestratorMemoryPolicyContextSchema,
  toolPolicyContext: orchestratorToolPolicyContextSchema,
  escalationContext: orchestratorEscalationContextSchema,
  availablePresentationCandidates: z.array(presentationCandidateReferenceSchema)
    .max(MAX_PRESENTATION_CANDIDATES),
  activeAuditContext: activeAuditContextSchema,
  approvedMedicationAuthoritySources: z.array(
    approvedMedicationAuthoritySourceSchema,
  ).max(MAX_POLICY_ITEMS).optional(),
  approvedCarePlanInstructions: z.array(approvedCarePlanInstructionSchema)
    .max(MAX_POLICY_ITEMS).optional(),
  clinicianDisclosureAuthorizationSources: z.array(
    clinicianDisclosureAuthorizationSourceSchema,
  ).max(MAX_POLICY_ITEMS).optional(),
  proposalRetentionDescriptors: z.array(proposalRetentionDescriptorSchema)
    .max(MAX_POLICY_ITEMS),
  previousPolicyDecisionId: opaqueIdSchema.optional(),
  flowOperationContext: flowOperationContextSchema.optional(),
  metadata: orchestratorPolicyMetadataSchema,
}).strict();

export type OrchestratorPolicyEvaluationRequest = z.infer<
  typeof orchestratorPolicyEvaluationRequestSchema
>;

export const policyFindingSchema = z.object({
  findingId: opaqueIdSchema,
  policyId: stableIdSchema,
  category: z.enum(ORCHESTRATOR_POLICY_CATEGORIES),
  severity: z.enum(["informational", "caution", "blocking", "critical"]),
  outcome: z.enum(ORCHESTRATOR_POLICY_EFFECTS),
  reasonCode: reasonCodeSchema,
  subjectType: z.enum(POLICY_SUBJECT_TYPES),
  subjectId: opaqueIdSchema.optional(),
  sourceReferenceIds: unique(opaqueIdSchema),
  userSafeSummary: safeShortTextSchema.optional(),
  auditSummary: safeShortTextSchema,
  createdAt: dateTimeSchema,
  metadata: orchestratorPolicyMetadataSchema,
}).strict();

const constraintBase = {
  constraintId: opaqueIdSchema,
  reasonCode: reasonCodeSchema,
  subjectId: opaqueIdSchema,
  sourcePolicyId: stableIdSchema,
};
const emptyParameters = z.object({}).strict();
export const policyConstraintSchema = z.discriminatedUnion("type", [
  z.object({
    ...constraintBase,
    type: z.enum([
      "require_user_confirmation",
      "require_fresh_consent",
      "require_fresh_safety_check",
      "require_human_review",
      "require_accessible_fallback",
      "require_privacy_fallback",
      "require_idempotency",
      "require_current_correlation",
      "block_optional_proposal",
    ]),
    parameters: emptyParameters,
  }).strict(),
  z.object({
    ...constraintBase,
    type: z.literal("restrict_channel"),
    parameters: z.object({
      allowedChannels: unique(z.enum(FLOW_CHANNELS), 1),
    }).strict(),
  }).strict(),
  z.object({
    ...constraintBase,
    type: z.literal("restrict_memory_target"),
    parameters: z.object({
      allowedTargets: unique(
        z.enum(["postgres", "mem0", "working_memory"]),
        1,
      ),
    }).strict(),
  }).strict(),
  z.object({
    ...constraintBase,
    type: z.literal("restrict_retention"),
    parameters: z.object({
      maximumRetention: z.enum(["none", "session", "short_term", "long_term"]),
    }).strict(),
  }).strict(),
  z.object({
    ...constraintBase,
    type: z.literal("redact_argument_paths"),
    parameters: z.object({
      paths: unique(z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/), 1),
    }).strict(),
  }).strict(),
  z.object({
    ...constraintBase,
    type: z.literal("prohibit_claim"),
    parameters: z.object({ claim: safeShortTextSchema }).strict(),
  }).strict(),
  z.object({
    ...constraintBase,
    type: z.literal("require_disclaimer"),
    parameters: z.object({ localizationKey: stableIdSchema }).strict(),
  }).strict(),
  z.object({
    ...constraintBase,
    type: z.literal("force_safe_presentation"),
    parameters: z.object({
      presentationId: stableIdSchema,
      version: semverSchema,
    }).strict(),
  }).strict(),
]);

export const proposalAdjudicationSchema = z.object({
  adjudicationId: opaqueIdSchema,
  subjectType: z.enum(POLICY_SUBJECT_TYPES),
  subjectId: opaqueIdSchema,
  decision: z.enum([
    "approve", "approve_with_constraints", "reject",
    "require_confirmation", "defer",
  ]),
  policyFindingIds: unique(opaqueIdSchema),
  constraints: z.array(policyConstraintSchema)
    .max(MAX_CONSTRAINTS_PER_ADJUDICATION),
  approvedAt: dateTimeSchema,
  metadata: orchestratorPolicyMetadataSchema,
}).strict().superRefine((adjudication, context) => {
  if (
    ["approve_with_constraints", "require_confirmation"].includes(
      adjudication.decision,
    ) &&
    adjudication.constraints.length === 0
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "constraints required",
      path: ["constraints"],
    });
  }
  if (
    !["approve_with_constraints", "require_confirmation"].includes(
      adjudication.decision,
    ) &&
    adjudication.constraints.length > 0
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "constraints not allowed",
      path: ["constraints"],
    });
  }
});

export const consentAuthorizationSchema = z.object({
  authorizationId: opaqueIdSchema,
  scope: orchestratorConsentScopeSchema,
  consentDecisionId: opaqueIdSchema.optional(),
  authorizationBasis: z.enum([
    "explicit_user_consent",
    "recorded_profile_consent",
    "caregiver_authority",
    "operator_authority",
    "legal_basis",
    "emergency_exception",
  ]),
  purpose: stableIdSchema,
  targetId: opaqueIdSchema.optional(),
  decision: z.enum(["allow", "deny", "require_confirmation", "require_revalidation"]),
  expiresAt: dateTimeSchema.optional(),
  policyFindingIds: unique(opaqueIdSchema),
}).strict();

export const toolAuthorizationSchema = z.object({
  authorizationId: opaqueIdSchema,
  proposalId: opaqueIdSchema,
  adjudicationId: opaqueIdSchema,
  toolId: opaqueIdSchema,
  decision: z.enum([
    "approve", "approve_with_constraints", "require_confirmation", "reject", "defer",
  ]),
  confirmationRequired: z.boolean(),
  idempotencyRequired: z.boolean(),
  idempotencyKeyReference: opaqueIdSchema.optional(),
  expectedResultType: opaqueIdSchema.optional(),
  argumentSchemaId: opaqueIdSchema.optional(),
  outsideFlowPolicyId: stableIdSchema.optional(),
  consentAuthorizationIds: unique(opaqueIdSchema),
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

export const memoryAuthorizationSchema = z.object({
  authorizationId: opaqueIdSchema,
  subjectId: opaqueIdSchema,
  adjudicationId: opaqueIdSchema,
  operation: z.enum(["read", "write"]),
  category: opaqueIdSchema,
  target: z.enum(["postgres", "mem0", "working_memory"]).optional(),
  decision: z.enum([
    "approve", "approve_with_constraints", "require_confirmation", "reject", "defer",
  ]),
  sensitivityCeiling: memorySensitivitySchema,
  maximumRetention: z.enum(["none", "session", "short_term", "long_term"]),
  consentAuthorizationIds: unique(opaqueIdSchema),
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

export const escalationAuthorizationSchema = z.object({
  authorizationId: opaqueIdSchema,
  subjectId: opaqueIdSchema,
  type: z.enum(["emergency", "caregiver", "operator", "clinician", "technical"]),
  urgency: z.enum(["routine", "urgent", "immediate"]),
  targetId: opaqueIdSchema.optional(),
  approvedChannel: z.enum(FLOW_CHANNELS).optional(),
  consentAuthorizationIds: unique(opaqueIdSchema),
  policyFindingIds: unique(opaqueIdSchema),
  duplicateOfEscalationId: opaqueIdSchema.optional(),
  nonExecutable: z.literal(true),
}).strict();

export const approvedFlowStateProposalSchema = z.object({
  approvalId: opaqueIdSchema,
  subjectId: opaqueIdSchema,
  flowId: stableIdSchema,
  flowVersion: semverSchema,
  fromState: flowLifecycleStateSchema,
  toState: flowLifecycleStateSchema,
  proposal: specialistFlowStateUpdateSchema,
  completionOutcomeId: stableIdSchema.optional(),
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

export const followUpAuthorizationSchema = z.object({
  authorizationId: opaqueIdSchema,
  subjectId: opaqueIdSchema,
  adjudicationId: opaqueIdSchema,
  purpose: safeShortTextSchema,
  approvedChannel: z.enum(FLOW_CHANNELS),
  fallbackChannels: unique(z.enum(FLOW_CHANNELS)),
  dueAt: dateTimeSchema.optional(),
  delaySeconds: z.number().int().positive().optional(),
  consentAuthorizationIds: unique(opaqueIdSchema),
  noResponseDecision: z.object({
    retryAllowed: z.boolean(),
    fallbackAllowed: z.boolean(),
    escalationAfterNoResponse: z.boolean(),
    maximumAttempts: z.number().int().positive().max(10).optional(),
    humanReviewRequired: z.boolean(),
  }).strict(),
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict().refine(
  (value) => Boolean(value.dueAt) !== Boolean(value.delaySeconds),
  { message: "exactly one follow-up timing mechanism is required" },
);

const voiceSynchronizationDecisionSchema = z.object({
  spokenContentSlotIds: unique(stableIdSchema),
  screenVisibleContentSlotIds: unique(stableIdSchema),
  interactionTiming: z.enum(["before_speech", "with_speech", "after_speech", "voice_only"]),
  bargeInAllowed: z.boolean(),
  interruptSpeechOnSubmit: z.boolean(),
  acknowledgement: z.enum(["none", "brief", "required"]),
  repetition: z.enum(["none", "on_request", "once", "until_answered"]),
  silenceTimeoutSeconds: z.number().int().positive().max(3_600).optional(),
  captionsRequired: z.boolean(),
  fallbackBehavior: z.enum([
    "none", "repeat_text", "accessible_text", "request_human", "safe_fallback",
  ]),
}).strict();

export const deliveryContextSwitchAuthorizationSchema = z.object({
  authorizationId: opaqueIdSchema,
  sourcePolicyId: stableIdSchema,
  reasonCode: reasonCodeSchema,
  flowId: stableIdSchema,
  flowVersion: semverSchema,
  sceneId: stableIdSchema,
  channelSwitch: z.object({
    from: z.enum(FLOW_CHANNELS),
    to: z.enum(FLOW_CHANNELS),
  }).strict().optional(),
  deviceSwitch: z.object({
    from: z.enum(PRESENTATION_DEVICE_CLASSES),
    to: z.enum(PRESENTATION_DEVICE_CLASSES),
  }).strict().optional(),
  localeSwitch: z.object({
    from: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
    to: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  }).strict().optional(),
  consentAuthorizationIds: unique(opaqueIdSchema),
  policyFindingIds: unique(opaqueIdSchema, 1),
  nonExecutable: z.literal(true),
}).strict().refine(
  (value) =>
    Boolean(value.channelSwitch) ||
    Boolean(value.deviceSwitch) ||
    Boolean(value.localeSwitch),
  { message: "at least one delivery-context switch is required" },
);

export const flowSwitchAuthorizationSchema = z.object({
  authorizationId: opaqueIdSchema,
  subjectId: opaqueIdSchema,
  sourcePolicyId: stableIdSchema,
  targetFlowId: stableIdSchema,
  targetFlowVersion: semverSchema,
  targetSceneId: stableIdSchema,
  policyFindingIds: unique(opaqueIdSchema, 1),
  nonExecutable: z.literal(true),
}).strict();

const approvedPrivacyPolicySchema = z.object({
  sensitivity: z.enum(["public", "personal", "sensitive", "restricted"]),
  screenObscuringAllowed: z.boolean(),
  hideInAppSwitcher: z.boolean(),
  screenshotPolicy: z.enum(["allowed", "warn", "prohibited"]),
  recordingPolicy: z.enum(["allowed", "consent_required", "prohibited"]),
  evidencePreviewPolicy: z.enum(["none", "optional", "required"]),
  autoClearPolicy: z.enum(["none", "on_exit", "after_submission", "timed"]),
  consentNoticeRequired: z.boolean(),
  retentionNoticeRequired: z.boolean(),
  shoulderSurfingWarning: z.boolean(),
  caregiverVisibility: z.enum(["none", "consent_required", "authorized_summary"]),
  operatorVisibility: z.enum(["none", "consent_required", "authorized_case"]),
}).strict();

const approvedSafetyPolicySchema = z.object({
  safetyCritical: z.boolean(),
  urgency: z.enum(["routine", "important", "urgent", "immediate"]),
  dismissalPolicy: z.enum(["allowed", "confirm", "prohibited"]),
  deferPolicy: z.enum(["allowed", "confirm", "prohibited"]),
  acknowledgementRequired: z.boolean(),
  confirmationRequired: z.boolean(),
  humanHelpAvailable: z.boolean(),
  emergencyActionVisible: z.boolean(),
  prohibitedClaims: unique(z.enum([
    "diagnosis", "guaranteed_safe", "safe_verdict", "clinical_certainty",
    "tool_already_executed",
  ])),
  requiredDisclaimers: unique(stableIdSchema),
  timeoutBehavior: z.enum([
    "none", "remain_visible", "repeat", "safe_fallback", "expire",
  ]),
}).strict();

export const approvedPresentationPlanSchema = z.object({
  presentationId: stableIdSchema,
  version: semverSchema,
  familyId: stableIdSchema,
  flowId: stableIdSchema,
  flowVersion: semverSchema,
  sceneId: stableIdSchema,
  expectedInputReference: questionReferenceSchema.optional(),
  approvedUIInstructionIds: unique(opaqueIdSchema),
  approvedActionIds: unique(stableIdSchema),
  approvedEventMappingIds: unique(stableIdSchema),
  approvedContentSlotIds: unique(stableIdSchema, 1),
  approvedFallbackPresentationId: stableIdSchema.optional(),
  approvedChannel: z.enum(FLOW_CHANNELS),
  approvedDeviceClass: z.enum(PRESENTATION_DEVICE_CLASSES),
  approvedLocale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  accessibilityDecision: z.enum(["meets", "meets_with_fallback"]),
  privacyDecision: z.enum(["preserved", "strengthened"]),
  safetyDecision: z.enum(["preserved", "strengthened", "emergency_required"]),
  approvedPrivacyPolicy: approvedPrivacyPolicySchema,
  approvedSafetyPolicy: approvedSafetyPolicySchema,
  voiceSynchronizationDecision: voiceSynchronizationDecisionSchema,
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

const approvedFactSchema = z.object({
  factId: opaqueIdSchema,
  text: safeShortTextSchema,
  sourceType: z.enum([
    "specialist",
    "deterministic_safety",
    "flow_catalogue",
    "safe_failure",
  ]),
  sourceReferenceId: opaqueIdSchema,
  classification: z.enum([
    "general",
    "medication_reminder",
    "medication_identity",
    "adherence_confirmation",
    "approved_care_plan_instruction",
    "general_medication_safety",
    "medication_instruction",
  ]).optional(),
  carePlanReferenceId: opaqueIdSchema.optional(),
  medicationReferenceId: opaqueIdSchema.optional(),
  dosage: z.number().positive().max(1_000_000).optional(),
  unit: z.enum(["mg", "mcg", "g", "ml", "tablet", "capsule"]).optional(),
  medicationPolicyFindingId: opaqueIdSchema.optional(),
}).strict();

const responsePolicyTraceSchema = z.object({
  text: safeShortTextSchema,
  sourceReferenceId: opaqueIdSchema,
  policyFindingId: opaqueIdSchema,
}).strict();

export const approvedResponsePlanSchema = z.object({
  approvedFacts: z.array(approvedFactSchema).max(MAX_DECISION_ITEMS),
  approvedAcknowledgements: unique(safeShortTextSchema),
  approvedTone: z.enum(["calm", "supportive", "neutral", "direct", "reassuring"]),
  urgency: z.enum(["routine", "prompt", "urgent", "immediate"]),
  brevityPreference: z.enum(["brief", "standard", "detailed"]),
  prohibitedClaims: unique(safeShortTextSchema),
  requiredDisclaimers: unique(stableIdSchema),
  localizationKeys: unique(stableIdSchema),
  contentSlotAssignments: z.array(z.object({
    contentSlotId: stableIdSchema,
    factIds: unique(opaqueIdSchema),
    localizationKey: stableIdSchema,
  }).strict()).max(MAX_DECISION_ITEMS),
  safeUncertaintyLanguage: safeShortTextSchema.optional(),
  evidenceLimitations: unique(safeShortTextSchema),
  evidenceLimitationReferences: z.array(responsePolicyTraceSchema)
    .max(MAX_DECISION_ITEMS).optional(),
  escalationLanguageRequirements: unique(safeShortTextSchema),
  escalationLanguageReferences: z.array(responsePolicyTraceSchema)
    .max(MAX_DECISION_ITEMS).optional(),
  policyFindingIds: unique(opaqueIdSchema),
}).strict();

export const deferPlanSchema = z.object({
  reasonCode: reasonCodeSchema,
  resumability: z.enum(["not_resumable", "user_initiated", "policy_revalidation"]),
  expiresAt: dateTimeSchema.optional(),
  deferredAdjudicationIds: unique(opaqueIdSchema),
  directiveIds: unique(opaqueIdSchema),
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

export const safeFailurePlanSchema = z.object({
  failureCode: reasonCodeSchema,
  userSafeSummaryCode: reasonCodeSchema,
  auditSummary: safeShortTextSchema,
  recoverable: z.boolean(),
  approvedFallbackPresentationId: stableIdSchema.optional(),
  approvedVoiceFallbackPolicy: z.enum([
    "none", "repeat_safe_summary", "accessible_text",
    "request_human", "emergency_guidance",
  ]).optional(),
  flowUpdateProposal: approvedFlowStateProposalSchema.optional(),
  retryPolicy: z.enum(["none", "user_initiated", "revalidate_context", "human_review"]),
  recoveryDecisionReferenceId: opaqueIdSchema.optional(),
  policyFindingIds: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

export const SYSTEM_DIRECTIVE_TYPES = [
  "require_safety_escalation",
  "require_fresh_safety_check",
  "require_current_state_refresh",
  "require_consent_confirmation",
  "force_safe_presentation",
  "defer_routine_proposals",
  "invalidate_stale_submission",
  "require_human_review",
  "produce_safe_failure",
] as const;

export const systemOwnedDirectiveSchema = z.object({
  directiveId: opaqueIdSchema,
  type: z.enum(SYSTEM_DIRECTIVE_TYPES),
  sourcePolicyId: stableIdSchema,
  reasonCode: reasonCodeSchema,
  flowReference: z.object({
    flowId: stableIdSchema,
    flowVersion: semverSchema,
  }).strict(),
  subjectReferences: unique(opaqueIdSchema),
  nonExecutable: z.literal(true),
}).strict();

export const auditDecisionRecordSchema = z.object({
  auditDecisionId: opaqueIdSchema,
  evaluationId: opaqueIdSchema,
  decisionId: opaqueIdSchema,
  policyVersion: semverSchema,
  policyStage: orchestratorPolicyStageSchema,
  verdict: z.enum([
    "approve", "approve_with_constraints", "request_more_information",
    "defer", "reject", "escalate", "safe_fail",
  ]),
  userId: opaqueIdSchema,
  sessionId: opaqueIdSchema,
  flowId: stableIdSchema,
  flowVersion: semverSchema,
  specialistRequestId: opaqueIdSchema.optional(),
  specialistResponseId: opaqueIdSchema.optional(),
  selectedPresentationId: stableIdSchema.optional(),
  selectedPresentationVersion: semverSchema.optional(),
  findingIds: unique(opaqueIdSchema),
  adjudicationIds: unique(opaqueIdSchema),
  constraintIds: unique(opaqueIdSchema),
  directiveIds: unique(opaqueIdSchema),
  consentDecisionReferences: unique(opaqueIdSchema),
  safetyResultReference: opaqueIdSchema,
  previousDecisionReference: opaqueIdSchema.optional(),
  createdAt: dateTimeSchema,
  retentionClassification: z.enum([
    "operational", "safety", "consent", "clinical_support", "legal",
  ]),
  metadata: orchestratorAuditMetadataSchema,
}).strict().superRefine((record, context) => {
  if (
    Boolean(record.selectedPresentationId) !==
    Boolean(record.selectedPresentationVersion)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "selected presentation pair required",
    });
  }
});

export const ORCHESTRATOR_VERDICTS = [
  "approve",
  "approve_with_constraints",
  "request_more_information",
  "defer",
  "reject",
  "escalate",
  "safe_fail",
] as const;

export const ORCHESTRATOR_PLAN_CATEGORIES = [
  "next_question",
  "ui_instruction",
  "presentation",
  "response_plan",
  "tool_authorization",
  "memory_read_authorization",
  "memory_write_authorization",
  "escalation_authorization",
  "flow_update",
  "completion",
  "followup",
  "directive",
  "safe_failure_plan",
] as const;

export const ORCHESTRATOR_VERDICT_COMPATIBILITY = {
  approve: {
    adjudicationDecisions: ["approve"],
    requiredPlanCategories: [],
    forbiddenPlanCategories: ["safe_failure_plan"],
  },
  approve_with_constraints: {
    adjudicationDecisions: ["approve", "approve_with_constraints"],
    requiredPlanCategories: [],
    forbiddenPlanCategories: ["safe_failure_plan"],
  },
  request_more_information: {
    adjudicationDecisions: ["approve", "approve_with_constraints"],
    requiredPlanCategories: ["next_question", "presentation", "flow_update"],
    forbiddenPlanCategories: ["safe_failure_plan"],
  },
  defer: {
    adjudicationDecisions: ["defer"],
    requiredPlanCategories: ["directive"],
    forbiddenPlanCategories: ["safe_failure_plan"],
  },
  reject: {
    adjudicationDecisions: ["reject"],
    requiredPlanCategories: [],
    forbiddenPlanCategories: [...ORCHESTRATOR_PLAN_CATEGORIES],
  },
  escalate: {
    adjudicationDecisions: ["approve", "approve_with_constraints"],
    requiredPlanCategories: ["escalation_authorization"],
    forbiddenPlanCategories: ["safe_failure_plan"],
  },
  safe_fail: {
    adjudicationDecisions: ["defer", "reject"],
    requiredPlanCategories: ["safe_failure_plan"],
    forbiddenPlanCategories: [
      "next_question",
      "tool_authorization",
      "memory_read_authorization",
      "memory_write_authorization",
      "followup",
      "completion",
    ],
  },
} as const satisfies Record<
  typeof ORCHESTRATOR_VERDICTS[number],
  {
    adjudicationDecisions: readonly ProposalAdjudication["decision"][];
    requiredPlanCategories: readonly typeof ORCHESTRATOR_PLAN_CATEGORIES[number][];
    forbiddenPlanCategories: readonly typeof ORCHESTRATOR_PLAN_CATEGORIES[number][];
  }
>;

export const ORCHESTRATOR_STAGE_VERDICT_COMPATIBILITY = {
  ingress: ["reject", "safe_fail"],
  specialist_invocation: [
    "approve", "reject", "safe_fail",
  ],
  specialist_response: [
    "request_more_information", "defer", "reject", "escalate", "safe_fail",
  ],
  proposal_adjudication: [...ORCHESTRATOR_VERDICTS],
  presentation_approval: [...ORCHESTRATOR_VERDICTS],
  delivery_approval: [...ORCHESTRATOR_VERDICTS],
  safe_failure: ["safe_fail"],
} as const satisfies Record<
  OrchestratorPolicyStage,
  readonly typeof ORCHESTRATOR_VERDICTS[number][]
>;

export const ORCHESTRATOR_CONSENT_TEST_DIMENSIONS = [
  "valid", "missing", "revoked", "expired", "wrong_purpose", "wrong_scope",
  "wrong_channel", "wrong_target",
] as const;

export const ORCHESTRATOR_CONSENT_ACTIONS = [
  "tool_use", "image_capture", "image_analysis", "image_retention",
  "document_capture", "document_retention", "longitudinal_comparison",
  "memory_read", "memory_write", "mem0_write", "caregiver_disclosure",
  "operator_disclosure", "clinician_disclosure", "proactive_push",
  "outbound_call", "followup_channel", "escalation", "emergency_exception",
] as const;

export const ORCHESTRATOR_CONSENT_COMPATIBILITY_MATRIX =
  ORCHESTRATOR_CONSENT_ACTIONS.flatMap((action) =>
    ORCHESTRATOR_CONSENT_TEST_DIMENSIONS.map((dimension) => ({
      action,
      dimension,
      compatible: dimension === "valid",
    })));

export const ORCHESTRATOR_ESCALATION_TYPES = [
  "emergency", "caregiver", "operator", "clinician", "technical",
] as const;

export const ORCHESTRATOR_ESCALATION_TEST_DIMENSIONS = [
  "permitted_flow_rule",
  "missing_flow_rule",
  "valid_target",
  "missing_target",
  "wrong_target",
  "valid_channel",
  "wrong_channel",
  "valid_consent",
  "wrong_consent",
  "revoked_consent",
  "expired_consent",
  "duplicate_escalation",
  "emergency_exception",
  "non_execution",
] as const;

export const ORCHESTRATOR_ESCALATION_COMPATIBILITY_MATRIX =
  ORCHESTRATOR_ESCALATION_TYPES.flatMap((type) =>
    ORCHESTRATOR_ESCALATION_TEST_DIMENSIONS.map((dimension) => ({
      type,
      dimension,
    })));

export const ORCHESTRATOR_RESUME_PROOF_CASES = [
  "valid",
  "missing",
  "wrong_flow",
  "wrong_version",
  "before_interruption",
  "after_request",
  "stale_safety",
  "mismatched_safety_reference",
  "missing_fresh_safety",
  "channel_switch_denied",
  "channel_switch_allowed",
  "expired_interruption",
] as const;

export const ORCHESTRATOR_DIRECT_SELF_REFERENCE_CASES = [
  "directive_subject",
  "constraint_subject",
  "adjudication_subject",
  "adjudication_constraint",
  "adjudication_finding",
  "previous_decision",
  "recovery_decision",
] as const;

export const ORCHESTRATOR_BOUNDED_COLLECTION_LIMITS = {
  candidates: MAX_PRESENTATION_CANDIDATES,
  findings: MAX_DECISION_ITEMS,
  adjudications: MAX_DECISION_ITEMS,
  constraints: MAX_CONSTRAINTS_PER_ADJUDICATION,
  consentAuthorizations: MAX_DECISION_ITEMS,
  toolAuthorizations: MAX_DECISION_ITEMS,
  memoryAuthorizations: MAX_DECISION_ITEMS,
  escalationAuthorizations: 1,
  directives: MAX_DECISION_ITEMS,
  auditCorrelations: MAX_POLICY_ITEMS,
  availableTools: MAX_POLICY_ITEMS,
  responseFacts: MAX_DECISION_ITEMS,
  assignments: MAX_DECISION_ITEMS,
  retentionDescriptors: MAX_POLICY_ITEMS,
} as const;

export const orchestratorPolicyDecisionSchema = z.object({
  decisionId: opaqueIdSchema,
  evaluationId: opaqueIdSchema,
  policyVersion: semverSchema,
  stage: orchestratorPolicyStageSchema,
  decidedAt: dateTimeSchema,
  verdict: z.enum(ORCHESTRATOR_VERDICTS),
  rejectionCode: reasonCodeSchema.optional(),
  findings: z.array(policyFindingSchema).max(MAX_DECISION_ITEMS),
  adjudications: z.array(proposalAdjudicationSchema).max(MAX_DECISION_ITEMS),
  consentAuthorizations: z.array(consentAuthorizationSchema)
    .max(MAX_DECISION_ITEMS),
  toolAuthorizations: z.array(toolAuthorizationSchema).max(MAX_DECISION_ITEMS),
  memoryAuthorizations: z.array(memoryAuthorizationSchema)
    .max(MAX_DECISION_ITEMS),
  escalationAuthorization: escalationAuthorizationSchema.optional(),
  deliveryContextSwitchAuthorization:
    deliveryContextSwitchAuthorizationSchema.optional(),
  flowSwitchAuthorization: flowSwitchAuthorizationSchema.optional(),
  specialistInvocationAuthorization:
    specialistInvocationAuthorizationSchema.optional(),
  approvedFlowStateProposal: approvedFlowStateProposalSchema.optional(),
  followUpAuthorization: followUpAuthorizationSchema.optional(),
  approvedPresentationPlan: approvedPresentationPlanSchema.optional(),
  approvedResponsePlan: approvedResponsePlanSchema.optional(),
  deferPlan: deferPlanSchema.optional(),
  safeFailurePlan: safeFailurePlanSchema.optional(),
  systemDirectives: z.array(systemOwnedDirectiveSchema).max(MAX_DECISION_ITEMS),
  auditRecord: auditDecisionRecordSchema,
  metadata: orchestratorPolicyMetadataSchema,
}).strict();

export type PolicyFinding = z.infer<typeof policyFindingSchema>;
export type PolicyConstraint = z.infer<typeof policyConstraintSchema>;
export type ProposalAdjudication = z.infer<typeof proposalAdjudicationSchema>;
export type OrchestratorPolicyDecision = z.infer<
  typeof orchestratorPolicyDecisionSchema
>;

function fail(code: OrchestrationContractErrorCode): never {
  throw new OrchestrationContractError(code);
}

function schemaFailureCode(
  error: z.ZodError,
  fallback: OrchestrationContractErrorCode,
): OrchestrationContractErrorCode {
  const known = new Set<OrchestrationContractErrorCode>([
    "ORCHESTRATOR_METADATA_INVALID",
    "AUDIT_CONTENT_NOT_MINIMIZED",
    "ORCHESTRATOR_AUDIT_VALUE_INVALID",
  ]);
  return error.issues.find(
    (issue) =>
      issue.code === z.ZodIssueCode.custom &&
      known.has(issue.message as OrchestrationContractErrorCode),
  )?.message as OrchestrationContractErrorCode | undefined ?? fallback;
}

function assertSafeRawBoundary(
  value: unknown,
  fallback: OrchestrationContractErrorCode,
): void {
  const inspect = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach(inspect);
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, nested] of Object.entries(candidate)) {
      const normalized = normalizedKey(key);
      if (ORCHESTRATOR_RAW_BOUNDARY_DENIED_KEYS.has(normalized)) {
        if (
          ["hiddenreasoning", "chainofthought", "reasoningtrace"].includes(normalized)
        ) {
          fail("HIDDEN_REASONING_NOT_ALLOWED");
        }
        fail(fallback);
      }
      inspect(nested);
    }
  };
  inspect(value);
}

export type OrchestratorPolicyValidationOptions = {
  flowCatalogue?: FlowCatalogue;
  presentationRegistry?: PresentationRegistry;
};

type ValidatedPolicySources = {
  flowCatalogue: FlowCatalogue;
  presentationRegistry: PresentationRegistry;
};

function validatePolicySources(
  options: OrchestratorPolicyValidationOptions = {},
): ValidatedPolicySources {
  return {
    flowCatalogue: options.flowCatalogue
      ? parseFlowCatalogue(options.flowCatalogue)
      : VYVA_FLOW_CATALOGUE,
    presentationRegistry: options.presentationRegistry
      ? parsePresentationRegistry(options.presentationRegistry)
      : VYVA_PRESENTATION_REGISTRY,
  };
}

function resolveFlow(
  reference: z.infer<typeof flowDefinitionReferenceSchema>,
  sources: ValidatedPolicySources,
): FlowDefinition {
  const flow = sources.flowCatalogue.flows.find(
    (candidate) =>
      candidate.flowId === reference.flowId &&
      candidate.version === reference.version,
  );
  if (!flow) fail("FLOW_VERSION_NOT_ELIGIBLE");
  if (
    reference.catalogueVersion !== sources.flowCatalogue.catalogueVersion ||
    reference.status !== flow.status
  ) {
    fail("FLOW_VERSION_NOT_ELIGIBLE");
  }
  if (
    reference.sessionEligibility === "new_session" &&
    (
      !flow.compatibility.isCurrent ||
      !flow.lifecyclePolicy.selectableStatuses.includes(
        flow.status as "approved" | "pilot" | "active",
      )
    )
  ) {
    fail("FLOW_NOT_ELIGIBLE");
  }
  if (flow.status === "retired") fail("FLOW_NOT_ELIGIBLE");
  return flow;
}

function resolvePresentation(
  presentationId: string,
  version: string,
  sources: ValidatedPolicySources,
): PresentationDefinition {
  const presentation = sources.presentationRegistry.presentations.find(
    (candidate) =>
      candidate.presentationId === presentationId &&
      candidate.version === version,
  );
  if (!presentation) fail("PRESENTATION_AUTHORIZATION_DENIED");
  return presentation;
}

function assertRequestStage(
  request: OrchestratorPolicyEvaluationRequest,
): void {
  const hasRequest = Boolean(request.specialistRequest);
  const hasResponse = Boolean(request.specialistResponse);
  if (
    (request.stage === "specialist_invocation" && (!hasRequest || hasResponse)) ||
    (
      ["specialist_response", "proposal_adjudication"].includes(request.stage) &&
      (!hasRequest || !hasResponse)
    ) ||
    (
      ["presentation_approval", "delivery_approval"].includes(request.stage) &&
      request.availablePresentationCandidates.length === 0
    ) ||
    (
      request.stage === "ingress" &&
      (hasRequest || hasResponse)
    )
  ) {
    fail("ORCHESTRATOR_POLICY_STAGE_INVALID");
  }
}

function assertRequestCorrelation(
  request: OrchestratorPolicyEvaluationRequest,
  flow: FlowDefinition,
): void {
  const event = request.interactionEvent;
  const state = request.activeFlowState;
  if (
    event.userId !== request.userId ||
    (event.sessionId && event.sessionId !== request.sessionId) ||
    state.userId !== request.userId ||
    state.sessionId !== request.sessionId ||
    state.flowId !== request.flowDefinitionReference.flowId ||
    state.flowVersion !== request.flowDefinitionReference.version ||
    (event.flowId && event.flowId !== state.flowId) ||
    (event.flowVersion && event.flowVersion !== state.flowVersion) ||
    (
      request.profileId &&
      event.profileId &&
      request.profileId !== event.profileId
    )
  ) {
    fail("ORCHESTRATOR_CORRELATION_INVALID");
  }
  if (
    flow.entryConditions.some((condition) => condition.requiresActiveProfile) &&
    !request.profileId
  ) {
    fail("ORCHESTRATOR_CORRELATION_INVALID");
  }
  if (request.currentQuestionReference) {
    const expected = state.expectedInput;
    if (
      !expected ||
      request.currentQuestionReference.questionId !== expected.questionId ||
      request.currentQuestionReference.sceneId !== expected.sceneId ||
      request.currentQuestionReference.flowVersion !== expected.flowVersion
    ) {
      fail("ORCHESTRATOR_CORRELATION_INVALID");
    }
  }
  if (request.currentSceneReference) {
    if (
      request.currentSceneReference.flowId !== flow.flowId ||
      request.currentSceneReference.flowVersion !== flow.version ||
      !flow.uiScenes.some(
        (scene) => scene.sceneId === request.currentSceneReference?.sceneId,
      )
    ) {
      fail("ORCHESTRATOR_CORRELATION_INVALID");
    }
  }
  if (request.specialistRequest) {
    const specialistRequest = request.specialistRequest;
    if (
      specialistRequest.userId !== request.userId ||
      specialistRequest.sessionId !== request.sessionId ||
      specialistRequest.flowId !== flow.flowId ||
      specialistRequest.flowVersion !== flow.version ||
      specialistRequest.correlationId !== event.correlationId ||
      specialistRequest.specialistId !== flow.ownerSpecialistId
    ) {
      fail("SPECIALIST_INVOCATION_NOT_ALLOWED");
    }
  }
  if (
    request.previousPolicyDecisionId &&
    !request.activeAuditContext.previousDecisionIds.includes(
      request.previousPolicyDecisionId,
    )
  ) {
    fail("ORCHESTRATOR_CORRELATION_INVALID");
  }
  const requiredAuditCorrelations = [
    event.eventId,
    event.correlationId,
    request.evaluationId,
    request.sessionId,
    request.previousPolicyDecisionId,
  ].filter((item): item is string => Boolean(item));
  if (requiredAuditCorrelations.some(
    (id) => !request.activeAuditContext.correlationIds.includes(id),
  )) {
    fail("ORCHESTRATOR_CORRELATION_INVALID");
  }
}

function assertRequestPolicy(
  request: OrchestratorPolicyEvaluationRequest,
  flow: FlowDefinition,
  sources: ValidatedPolicySources,
): void {
  if (
    !flow.supportedTriggers.includes(request.channelContext.triggerSource) ||
    !flow.supportedChannels.includes(request.channelContext.channel) ||
    request.interactionEvent.triggerSource !== request.channelContext.triggerSource
  ) {
    fail("CHANNEL_AUTHORIZATION_DENIED");
  }
  if (!request.channelContext.allowed) fail("CHANNEL_AUTHORIZATION_DENIED");
  if (!request.consentContext.channelAllowed) {
    fail("CHANNEL_AUTHORIZATION_DENIED");
  }
  if (
    (request.channelContext.triggerSource === "push" &&
      !request.consentContext.proactivePushAllowed) ||
    (request.channelContext.triggerSource === "outbound_call" &&
      !request.consentContext.outboundCallAllowed)
  ) {
    fail("CHANNEL_AUTHORIZATION_DENIED");
  }
  if (
    !flow.flowId.startsWith("safety.") &&
    !request.safetyContext.emergencyChecked
  ) {
    fail("SAFETY_PRECEDENCE_REQUIRED");
  }
  const revoked = new Set(request.consentContext.revokedScopes);
  for (const requirement of flow.consentRequirements.filter(
    (item) => item.timing === "before_entry",
  )) {
    if (revoked.has(requirement.scope)) fail("CONSENT_REVOKED");
    const decision = request.consentContext.decisions.find(
      (item) => item.scope === requirement.scope,
    );
    if (
      !request.consentContext.scopes.includes(requirement.scope) ||
      !decision ||
      decision.status !== "granted" ||
      decision.requiresRevalidation ||
      (decision.expiresAt && Date.parse(decision.expiresAt) <=
        Date.parse(request.requestedAt))
    ) {
      fail("CONSENT_AUTHORIZATION_REQUIRED");
    }
  }
  if (
    request.specialistResponse &&
    request.safetyContext.deterministicSafetyResult === "emergency" &&
    rankRisk(request.specialistResponse.riskLevel) <
      rankRisk(request.safetyContext.riskLevel)
  ) {
    fail("SAFETY_DOWNGRADE_ATTEMPTED");
  }
  for (const candidate of request.availablePresentationCandidates) {
    const presentation = resolvePresentation(
      candidate.presentationId,
      candidate.version,
      sources,
    );
    if (
      candidate.familyId !== presentation.familyId ||
      candidate.sceneId !== presentation.sceneId ||
      candidate.status !== presentation.status ||
      candidate.supportedFlowIds.length !==
        presentation.supportedFlowIds.length ||
      !candidate.supportedFlowIds.every((id) =>
        presentation.supportedFlowIds.includes(id))
    ) {
      fail("PRESENTATION_AUTHORIZATION_DENIED");
    }
  }
  if (request.activePresentationReference) {
    const active = resolvePresentation(
      request.activePresentationReference.presentationId,
      request.activePresentationReference.version,
      sources,
    );
    if (
      request.activePresentationReference.familyId !== active.familyId ||
      request.activePresentationReference.flowId !== flow.flowId ||
      request.activePresentationReference.flowVersion !== flow.version ||
      request.activePresentationReference.sceneId !== active.sceneId ||
      !active.supportedFlowIds.includes(flow.flowId)
    ) {
      fail("ORCHESTRATOR_CORRELATION_INVALID");
    }
  }
  const authoritySources = request.approvedMedicationAuthoritySources ?? [];
  const authoritySourceIds = authoritySources.map(
    (item) => item.sourceReferenceId,
  );
  const instructions = request.approvedCarePlanInstructions ?? [];
  const instructionIds = instructions.map(
    (item) => item.instructionReferenceId,
  );
  const clinicianSources = request.clinicianDisclosureAuthorizationSources ?? [];
  const clinicianConsentIds = clinicianSources.map(
    (item) => item.consentDecisionId,
  );
  if (
    new Set(authoritySourceIds).size !== authoritySourceIds.length ||
    new Set(instructionIds).size !== instructionIds.length ||
    new Set(clinicianConsentIds).size !== clinicianConsentIds.length ||
    authoritySources.some(
      (source) =>
        source.userId !== request.userId ||
        Boolean(request.profileId) !== Boolean(source.profileId) ||
        (source.profileId && source.profileId !== request.profileId),
    ) ||
    instructions.some((instruction) => {
      const source = authoritySources.find(
        (item) =>
          item.sourceReferenceId === instruction.sourceRecordReferenceId &&
          item.issuerType === instruction.issuerType &&
          item.issuerReferenceId === instruction.issuerReferenceId &&
          (
            instruction.issuerType !== "approved_care_plan" ||
            item.carePlanId === instruction.carePlanId
          ),
      );
      return instruction.userId !== request.userId ||
        Boolean(request.profileId) !== Boolean(instruction.profileId) ||
        (instruction.profileId && instruction.profileId !== request.profileId) ||
        !source ||
        (
          instruction.consentDecisionId &&
          !request.consentContext.decisions.some(
            (decision) =>
              decision.decisionId === instruction.consentDecisionId &&
              decision.status === "granted",
          )
        );
    }) ||
    clinicianSources.some(
      (source) =>
        !request.consentContext.decisions.some(
          (decision) =>
            decision.decisionId === source.consentDecisionId &&
            decision.scope === "clinician_disclosure",
        ),
    )
  ) {
    fail("ORCHESTRATOR_PROVENANCE_INVALID");
  }
  const subjectIds = new Set(
    collectAdjudicableSubjects(request).map((subject) => subject.subjectId),
  );
  const subjectsById = new Map(
    collectAdjudicableSubjects(request).map(
      (subject) => [subject.subjectId, subject.subjectType],
    ),
  );
  const retentionKeys = request.proposalRetentionDescriptors.map(
    (descriptor) => `${descriptor.subjectType}:${descriptor.subjectId}`,
  );
  if (
    new Set(retentionKeys).size !== retentionKeys.length ||
    request.proposalRetentionDescriptors.some(
      (descriptor) => {
        const subjectType = subjectsById.get(descriptor.subjectId);
        return !subjectIds.has(descriptor.subjectId) ||
          subjectType !== descriptor.subjectType;
      },
    )
  ) {
    fail("ORCHESTRATOR_RETENTION_POLICY_INVALID");
  }
}

export function parseOrchestratorPolicyEvaluationRequest(
  input: unknown,
  options: OrchestratorPolicyValidationOptions = {},
): OrchestratorPolicyEvaluationRequest {
  assertSafeRawBoundary(input, "ORCHESTRATOR_POLICY_REQUEST_INVALID");
  const raw = input as {
    interactionEvent?: unknown;
    activeFlowState?: unknown;
    specialistRequest?: unknown;
    specialistResponse?: unknown;
  };
  if (raw?.interactionEvent !== undefined) parseInteractionEvent(raw.interactionEvent);
  if (raw?.activeFlowState !== undefined) parseFlowState(raw.activeFlowState);
  if (raw?.specialistRequest !== undefined) {
    parseSpecialistRequest(raw.specialistRequest);
  }
  if (raw?.specialistResponse !== undefined) {
    parseSpecialistResponse(raw.specialistResponse);
  }
  if (
    raw?.specialistRequest !== undefined &&
    raw?.specialistResponse !== undefined
  ) {
    validateSpecialistResponse(raw.specialistRequest, raw.specialistResponse);
  }
  const parsed = orchestratorPolicyEvaluationRequestSchema.safeParse(input);
  if (!parsed.success) {
    fail(schemaFailureCode(
      parsed.error,
      "ORCHESTRATOR_POLICY_REQUEST_INVALID",
    ));
  }
  const request = parsed.data;
  const sources = validatePolicySources(options);
  assertRequestStage(request);
  const flow = resolveFlow(request.flowDefinitionReference, sources);
  assertRequestCorrelation(request, flow);
  assertRequestPolicy(request, flow, sources);
  return request;
}

export function parseOrchestratorPolicyDecision(
  input: unknown,
): OrchestratorPolicyDecision {
  assertSafeRawBoundary(input, "ORCHESTRATOR_POLICY_DECISION_INVALID");
  const parsed = orchestratorPolicyDecisionSchema.safeParse(input);
  if (!parsed.success) {
    fail(schemaFailureCode(
      parsed.error,
      "ORCHESTRATOR_POLICY_DECISION_INVALID",
    ));
  }
  return parsed.data;
}

export type AdjudicableSubject = {
  subjectType: PolicySubjectType;
  subjectId: string;
};

/**
 * Task 2 has stable IDs for questions, UI instructions and Tool calls. Singular
 * proposals and indexed memory proposals receive deterministic policy-boundary
 * references without modifying the frozen Task 2 response.
 */
export function collectAdjudicableSubjects(
  request: OrchestratorPolicyEvaluationRequest,
): AdjudicableSubject[] {
  const response = request.specialistResponse;
  const subjects: AdjudicableSubject[] = [];
  if (response) {
    subjects.push({
      subjectType: "response_guidance",
      subjectId: `${response.requestId}.response_guidance`,
    });
    if (response.nextQuestion) {
      subjects.push({
        subjectType: "next_question",
        subjectId: response.nextQuestion.questionId,
      });
    }
    response.uiInstructions.forEach((instruction) =>
      subjects.push({
        subjectType: "ui_instruction",
        subjectId: instruction.instructionId,
      }));
    response.memoryReadsRequested.forEach((_, index) =>
      subjects.push({
        subjectType: "memory_read",
        subjectId: `${response.requestId}.memory_read.${index}`,
      }));
    response.memoryWritesProposed.forEach((_, index) =>
      subjects.push({
        subjectType: "memory_write",
        subjectId: `${response.requestId}.memory_write.${index}`,
      }));
    response.proposedToolCalls.forEach((proposal) =>
      subjects.push({
        subjectType: "tool_call",
        subjectId: proposal.proposalId,
      }));
    if (response.escalation) {
      subjects.push({
        subjectType: "escalation",
        subjectId: `${response.requestId}.escalation`,
      });
    }
    if (response.flowStateUpdate) {
      subjects.push({
        subjectType: "flow_state_update",
        subjectId: `${response.requestId}.flow_state_update`,
      });
    }
    if (response.completionResult) {
      subjects.push({
        subjectType: "completion",
        subjectId: `${response.requestId}.completion`,
      });
    }
    if (response.followUpRecommendation) {
      subjects.push({
        subjectType: "followup",
        subjectId: `${response.requestId}.followup`,
      });
    }
  }
  request.availablePresentationCandidates.forEach((candidate) =>
    subjects.push({
      subjectType: "presentation",
      subjectId: candidate.presentationId,
    }));
  return subjects;
}

function assertUniqueIds(decision: OrchestratorPolicyDecision): void {
  const groups = [
    decision.findings.map((item) => item.findingId),
    decision.adjudications.map((item) => item.adjudicationId),
    decision.adjudications.flatMap((item) =>
      item.constraints.map((constraint) => constraint.constraintId)),
    decision.consentAuthorizations.map((item) => item.authorizationId),
    decision.toolAuthorizations.map((item) => item.authorizationId),
    decision.memoryAuthorizations.map((item) => item.authorizationId),
    decision.systemDirectives.map((item) => item.directiveId),
    decision.deliveryContextSwitchAuthorization
      ? [decision.deliveryContextSwitchAuthorization.authorizationId]
      : [],
    decision.flowSwitchAuthorization
      ? [decision.flowSwitchAuthorization.authorizationId]
      : [],
  ];
  const all = groups.flat();
  if (new Set(all).size !== all.length) {
    fail("ORCHESTRATOR_POLICY_DECISION_INVALID");
  }
}

function assertNoDirectSelfReferences(
  decision: OrchestratorPolicyDecision,
): void {
  for (const adjudication of decision.adjudications) {
    if (
      adjudication.subjectId === adjudication.adjudicationId ||
      adjudication.policyFindingIds.includes(adjudication.adjudicationId) ||
      adjudication.constraints.some(
        (constraint) =>
          constraint.constraintId === adjudication.adjudicationId ||
          constraint.subjectId === constraint.constraintId,
      )
    ) {
      fail("ORCHESTRATOR_REFERENCE_SELF_CYCLE");
    }
  }
  for (const directive of decision.systemDirectives) {
    if (directive.subjectReferences.includes(directive.directiveId)) {
      fail("ORCHESTRATOR_REFERENCE_SELF_CYCLE");
    }
  }
  if (
    decision.safeFailurePlan?.recoveryDecisionReferenceId ===
      decision.decisionId
  ) {
    fail("ORCHESTRATOR_REFERENCE_SELF_CYCLE");
  }
}

export function validatePolicyFindingCompatibility(
  severity: PolicyFinding["severity"],
  outcome: PolicyFinding["outcome"],
): void {
  const compatibleOutcomes: Record<
    PolicyFinding["severity"],
    readonly OrchestratorPolicyEffect[]
  > = {
    informational: ["allow"],
    caution: [
      "allow",
      "constrain",
      "require_confirmation",
      "require_revalidation",
    ],
    blocking: [
      "deny",
      "require_confirmation",
      "require_revalidation",
      "require_safe_fallback",
    ],
    critical: ["deny", "require_escalation", "require_safe_fallback"],
  };
  if (!compatibleOutcomes[severity].includes(outcome)) {
    fail("ORCHESTRATOR_FINDING_COMPATIBILITY_INVALID");
  }
}

function assertFindings(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  subjectKeys: Set<string>,
): void {
  for (const finding of decision.findings) {
    const policy = POLICY_BY_ID.get(finding.policyId);
    if (
      !policy ||
      policy.category !== finding.category ||
      policy.effect !== finding.outcome ||
      !policy.appliesAtStages.includes(request.stage)
    ) {
      fail("ORCHESTRATOR_FINDING_INVALID");
    }
    validatePolicyFindingCompatibility(finding.severity, finding.outcome);
    if (
      finding.subjectId &&
      !subjectKeys.has(`${finding.subjectType}:${finding.subjectId}`)
    ) {
      fail("ORCHESTRATOR_FINDING_INVALID");
    }
  }
  const reflectedBlocking = decision.findings.some((finding) =>
    ["blocking", "critical"].includes(finding.severity) &&
    ["deny", "require_escalation", "require_revalidation", "require_safe_fallback"]
      .includes(finding.outcome));
  if (
    reflectedBlocking &&
    ["approve", "approve_with_constraints"].includes(decision.verdict)
  ) {
    fail("ORCHESTRATOR_PRECEDENCE_VIOLATION");
  }
  const findingsBySubject = new Map<string, PolicyFinding[]>();
  for (const finding of decision.findings) {
    const key = `${finding.subjectType}:${finding.subjectId ?? "*"}`;
    findingsBySubject.set(key, [...(findingsBySubject.get(key) ?? []), finding]);
  }
  for (const findings of findingsBySubject.values()) {
    const denials = findings.filter((finding) =>
      ["deny", "require_escalation", "require_revalidation", "require_safe_fallback"]
        .includes(finding.outcome));
    const allows = findings.filter((finding) => finding.outcome === "allow");
    if (denials.some((denial) =>
      !(
        ["require_confirmation", "require_revalidation"].includes(
          denial.outcome,
        ) &&
        decision.adjudications.some(
          (item) =>
            item.subjectType === denial.subjectType &&
            item.subjectId === denial.subjectId &&
            ["approve_with_constraints", "require_confirmation"].includes(
              item.decision,
            ) &&
            item.policyFindingIds.includes(denial.findingId),
        )
      ) &&
      allows.some((allow) =>
        (POLICY_BY_ID.get(denial.policyId)?.priority ?? 0) >
        (POLICY_BY_ID.get(allow.policyId)?.priority ?? 0)))) {
      fail("ORCHESTRATOR_PRECEDENCE_VIOLATION");
    }
  }
}

function assertAdjudications(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  subjectKeys: Set<string>,
  flow: FlowDefinition,
  sources: ValidatedPolicySources,
): void {
  const findingIds = new Set(decision.findings.map((item) => item.findingId));
  const seen = new Set<string>();
  for (const adjudication of decision.adjudications) {
    const key = `${adjudication.subjectType}:${adjudication.subjectId}`;
    if (!subjectKeys.has(key) || seen.has(key)) {
      fail("ORCHESTRATOR_ADJUDICATION_INVALID");
    }
    seen.add(key);
    if (adjudication.policyFindingIds.some((id) => !findingIds.has(id))) {
      fail("ORCHESTRATOR_ADJUDICATION_INVALID");
    }
    for (const constraint of adjudication.constraints) {
      if (
        constraint.subjectId !== adjudication.subjectId ||
        !POLICY_BY_ID.has(constraint.sourcePolicyId)
      ) {
        fail("ORCHESTRATOR_CONSTRAINT_INVALID");
      }
      if (
        constraint.type === "restrict_channel" &&
        adjudication.subjectType === "tool_call"
      ) {
        fail("ORCHESTRATOR_CONSTRAINT_INVALID");
      }
      if (
        constraint.type === "restrict_channel" &&
        constraint.parameters.allowedChannels.some(
          (channel) => {
            let allowed: readonly string[] = [request.channelContext.channel];
            if (adjudication.subjectType === "presentation") {
              const candidate = request.availablePresentationCandidates.find(
                (item) => item.presentationId === adjudication.subjectId,
              );
              const presentation = candidate
                ? resolvePresentation(
                  candidate.presentationId,
                  candidate.version,
                  sources,
                )
                : undefined;
              allowed = presentation?.supportedChannels.filter(
                (channel) => channel === request.channelContext.channel,
              ) ?? [];
            } else if (adjudication.subjectType === "followup") {
              const proposal =
                request.specialistResponse?.followUpRecommendation;
              allowed = proposal
                ? [
                  ...(proposal.preferredChannel
                    ? [proposal.preferredChannel]
                    : []),
                  ...proposal.fallbackChannels,
                ].filter((item) =>
                  flow.followUpPolicy.allowedChannels.includes(item))
                : [];
            } else if (adjudication.subjectType === "escalation") {
              allowed = request.escalationContext.allowedChannels;
            }
            return !allowed.includes(channel);
          },
        )
      ) {
        fail("ORCHESTRATOR_CONSTRAINT_INVALID");
      }
      if (
        constraint.type === "restrict_memory_target" &&
        (
          constraint.parameters.allowedTargets.some(
            (target) => !request.memoryPolicyContext.permittedTargets.includes(
              target,
            ),
          ) ||
          (
            adjudication.subjectType === "memory_write" &&
            (() => {
              const proposal = memoryProposalFor(
                request,
                adjudication.subjectId,
              );
              return proposal?.operation !== "write" ||
                !constraint.parameters.allowedTargets.includes(
                  proposal.proposal.target,
                );
            })()
          )
        )
      ) {
        fail("ORCHESTRATOR_CONSTRAINT_INVALID");
      }
      if (constraint.type === "redact_argument_paths") {
        const proposal = request.specialistResponse?.proposedToolCalls.find(
          (item) => item.proposalId === adjudication.subjectId,
        );
        const pathExists = (path: string) => {
          let value: unknown = proposal?.arguments;
          for (const segment of path.split(".")) {
            if (!value || typeof value !== "object" ||
              !Object.hasOwn(value, segment)) return false;
            value = (value as Record<string, unknown>)[segment];
          }
          return true;
        };
        if (
          adjudication.subjectType !== "tool_call" ||
          !proposal ||
          constraint.parameters.paths.some((path) => !pathExists(path))
        ) {
          fail("ORCHESTRATOR_CONSTRAINT_INVALID");
        }
      }
      if (
        constraint.type === "restrict_retention" &&
        rankRetention(constraint.parameters.maximumRetention) >
          rankRetention(request.memoryPolicyContext.maximumRetention)
      ) {
        fail("ORCHESTRATOR_CONSTRAINT_INVALID");
      }
      if (constraint.type === "force_safe_presentation") {
        const forced = resolvePresentation(
          constraint.parameters.presentationId,
          constraint.parameters.version,
          sources,
        );
        const currentCandidate = request.availablePresentationCandidates.find(
          (item) => item.presentationId === adjudication.subjectId,
        );
        const current = currentCandidate
          ? resolvePresentation(
            currentCandidate.presentationId,
            currentCandidate.version,
            sources,
          )
          : undefined;
        if (
          adjudication.subjectType !== "presentation" ||
          !current ||
          !request.availablePresentationCandidates.some(
            (item) =>
              item.presentationId === forced.presentationId &&
              item.version === forced.version &&
              item.currentEligibility === "eligible",
          ) ||
          !forced.supportedFlowIds.includes(flow.flowId) ||
          forced.sceneId !== current.sceneId ||
          !hasEqualOrSaferPrivacyTreatment(forced, current) ||
          !hasEqualOrSaferSafetyTreatment(forced, current)
        ) {
          fail("ORCHESTRATOR_CONSTRAINT_INVALID");
        }
      }
    }
  }
}

function containsEvery<T>(candidate: readonly T[], required: readonly T[]): boolean {
  const candidateValues = new Set(candidate);
  return required.every((value) => candidateValues.has(value));
}

function hasEqualOrSaferPrivacyTreatment(
  candidate: PresentationDefinition,
  baseline: PresentationDefinition,
): boolean {
  const next = candidate.privacyTreatment;
  const current = baseline.privacyTreatment;
  const visibilityRank = ["authorized_summary", "consent_required", "none"];
  const operatorVisibilityRank = ["authorized_case", "consent_required", "none"];
  return (
    ["public", "personal", "sensitive", "restricted"].indexOf(next.sensitivity) >=
      ["public", "personal", "sensitive", "restricted"].indexOf(current.sensitivity) &&
    (!current.screenObscuringAllowed || next.screenObscuringAllowed) &&
    (!current.hideInAppSwitcher || next.hideInAppSwitcher) &&
    ["allowed", "warn", "prohibited"].indexOf(next.screenshotPolicy) >=
      ["allowed", "warn", "prohibited"].indexOf(current.screenshotPolicy) &&
    ["allowed", "consent_required", "prohibited"].indexOf(next.recordingPolicy) >=
      ["allowed", "consent_required", "prohibited"].indexOf(current.recordingPolicy) &&
    ["none", "optional", "required"].indexOf(next.evidencePreviewPolicy) >=
      ["none", "optional", "required"].indexOf(current.evidencePreviewPolicy) &&
    (current.autoClearPolicy === "none" || next.autoClearPolicy === current.autoClearPolicy) &&
    (!current.consentNoticeRequired || next.consentNoticeRequired) &&
    (!current.retentionNoticeRequired || next.retentionNoticeRequired) &&
    (!current.shoulderSurfingWarning || next.shoulderSurfingWarning) &&
    visibilityRank.indexOf(next.caregiverVisibility) >=
      visibilityRank.indexOf(current.caregiverVisibility) &&
    operatorVisibilityRank.indexOf(next.operatorVisibility) >=
      operatorVisibilityRank.indexOf(current.operatorVisibility) &&
    (!current.evidencePurposeLocalizationKey ||
      next.evidencePurposeLocalizationKey === current.evidencePurposeLocalizationKey) &&
    (!current.retakeAvailable || next.retakeAvailable) &&
    (!current.deletionAvailable || next.deletionAvailable) &&
    (!current.safeAbandonmentAvailable || next.safeAbandonmentAvailable)
  );
}

function hasEqualOrSaferSafetyTreatment(
  candidate: PresentationDefinition,
  baseline: PresentationDefinition,
): boolean {
  const next = candidate.safetyTreatment;
  const current = baseline.safetyTreatment;
  return (
    (!current.safetyCritical || next.safetyCritical) &&
    ["routine", "important", "urgent", "immediate"].indexOf(next.urgency) >=
      ["routine", "important", "urgent", "immediate"].indexOf(current.urgency) &&
    ["allowed", "confirm", "prohibited"].indexOf(next.dismissalPolicy) >=
      ["allowed", "confirm", "prohibited"].indexOf(current.dismissalPolicy) &&
    ["allowed", "confirm", "prohibited"].indexOf(next.deferPolicy) >=
      ["allowed", "confirm", "prohibited"].indexOf(current.deferPolicy) &&
    (!current.acknowledgementRequired || next.acknowledgementRequired) &&
    (!current.confirmationRequired || next.confirmationRequired) &&
    (!current.humanHelpAvailable || next.humanHelpAvailable) &&
    (!current.emergencyActionVisible || next.emergencyActionVisible) &&
    containsEvery(next.prohibitedClaims, current.prohibitedClaims) &&
    containsEvery(next.requiredDisclaimers, current.requiredDisclaimers) &&
    (!current.safeFallbackPresentationId ||
      next.safeFallbackPresentationId === current.safeFallbackPresentationId) &&
    (current.timeoutBehavior === "none" ||
      next.timeoutBehavior === current.timeoutBehavior) &&
    (!next.coerciveDefault || current.coerciveDefault) &&
    next.toolExecutionState === current.toolExecutionState
  );
}

function rankRisk(value: z.infer<typeof specialistRiskLevelSchema>): number {
  return ["none", "low", "medium", "high", "emergency"].indexOf(value);
}
function rankSensitivity(
  value: z.infer<typeof memorySensitivitySchema>,
): number {
  return ["public", "internal", "sensitive", "restricted"].indexOf(value);
}
function rankRetention(
  value: "none" | "session" | "short_term" | "long_term",
): number {
  return ["none", "session", "short_term", "long_term"].indexOf(value);
}

function hasCorrelatedCriticalEmergencyFinding(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  basis: z.infer<typeof emergencyExceptionBasisSchema>,
): boolean {
  return request.safetyContext.deterministicSafetyResult === "emergency" &&
    basis.auditReferenceId === request.activeAuditContext.auditSessionId &&
    decision.auditRecord.findingIds.includes(basis.safetyFindingId) &&
    decision.findings.some(
      (finding) =>
        finding.findingId === basis.safetyFindingId &&
        finding.policyId === "policy.safety.emergency" &&
        finding.category === "deterministic_safety" &&
        finding.severity === "critical" &&
        finding.outcome === "require_escalation" &&
        finding.sourceReferenceIds.includes(request.safetyContext.resultId),
    );
}

function isValidClinicianEmergencyExceptionAuthorization(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): boolean {
  const authorization = decision.escalationAuthorization;
  if (
    authorization?.type !== "clinician" ||
    !authorization.targetId ||
    !authorization.approvedChannel ||
    !request.escalationContext.allowedChannels.includes(
      authorization.approvedChannel,
    )
  ) {
    return false;
  }
  const consentAuthorization = authorization.consentAuthorizationIds
    .map((id) =>
      decision.consentAuthorizations.find(
        (consent) => consent.authorizationId === id,
      ))
    .find(
      (consent) =>
        consent?.scope === "clinician_disclosure" &&
        consent.authorizationBasis === "emergency_exception" &&
        consent.decision === "allow" &&
        consent.targetId === authorization.targetId,
    );
  const source = (request.clinicianDisclosureAuthorizationSources ?? [])
    .find(
      (candidate) =>
        candidate.consentDecisionId === consentAuthorization?.consentDecisionId,
    );
  const basis = source?.emergencyExceptionBasis;
  const targetAllowed = Boolean(
    source &&
    (
      source.targetId === authorization.targetId ||
      source.approvedTargetIds?.includes(authorization.targetId)
    ),
  );
  const requestTime = Date.parse(request.requestedAt);
  return Boolean(
    consentAuthorization &&
    source &&
    source.targetType === "emergency_clinical_service" &&
    source.status === "granted" &&
    !source.revokedAt &&
    (!source.expiresAt || Date.parse(source.expiresAt) > requestTime) &&
    source.purpose === consentAuthorization.purpose &&
    source.allowedChannels.includes(authorization.approvedChannel) &&
    targetAllowed &&
    basis &&
    consentAuthorization.policyFindingIds.includes(basis.safetyFindingId) &&
    authorization.policyFindingIds.includes(basis.safetyFindingId) &&
    hasCorrelatedCriticalEmergencyFinding(request, decision, basis)
  );
}

function isValidCriticalSafetyEscalationAuthorization(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): boolean {
  if (request.safetyContext.deterministicSafetyResult !== "emergency") {
    return false;
  }
  if (decision.escalationAuthorization?.type === "emergency") {
    return !(request.clinicianDisclosureAuthorizationSources ?? []).some(
      (source) => Boolean(source.emergencyExceptionBasis),
    );
  }
  return isValidClinicianEmergencyExceptionAuthorization(request, decision);
}

function assertConsent(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): void {
  const findingIds = new Set(decision.findings.map((item) => item.findingId));
  const decisionIds = new Set(
    request.consentContext.decisions
      .map((item) => item.decisionId)
      .filter((item): item is string => Boolean(item)),
  );
  for (const authorization of decision.consentAuthorizations) {
    if (
      authorization.consentDecisionId &&
      !decisionIds.has(authorization.consentDecisionId)
    ) {
      fail("CONSENT_AUTHORIZATION_REQUIRED");
    }
    const sourceDecision = request.consentContext.decisions.find(
      (item) => item.decisionId === authorization.consentDecisionId,
    );
    if (
      authorization.decision === "allow" &&
      (
        !sourceDecision ||
        sourceDecision.scope !== authorization.scope ||
        sourceDecision.purpose !== authorization.purpose ||
        sourceDecision.status !== "granted" ||
        sourceDecision.requiresRevalidation ||
        sourceDecision.authorizationBasis !== authorization.authorizationBasis ||
        (
          sourceDecision.permittedChannels &&
          !sourceDecision.permittedChannels.includes(
            request.channelContext.channel,
          )
        ) ||
        (
          authorization.targetId &&
          !request.clinicianDisclosureAuthorizationSources?.some(
            (source) =>
              source.consentDecisionId === sourceDecision.decisionId,
          ) &&
          !sourceDecision.permittedTargetIds?.includes(
            authorization.targetId,
          )
        ) ||
        (
          sourceDecision.expiresAt &&
          Date.parse(sourceDecision.expiresAt) <= Date.parse(request.requestedAt)
        ) ||
        (
          authorization.expiresAt &&
          Date.parse(authorization.expiresAt) <= Date.parse(request.requestedAt)
        )
      )
    ) {
      fail("CONSENT_AUTHORIZATION_REQUIRED");
    }
    if (authorization.policyFindingIds.some((id) => !findingIds.has(id))) {
      fail("CONSENT_AUTHORIZATION_REQUIRED");
    }
    if (
      request.consentContext.revokedScopes.includes(authorization.scope) &&
      authorization.decision === "allow" &&
      authorization.authorizationBasis !== "emergency_exception"
    ) {
      fail("CONSENT_REVOKED");
    }
    if (
      authorization.authorizationBasis === "emergency_exception" &&
      (
        !sourceDecision?.emergencyExceptionFindingId ||
        !sourceDecision.auditReferenceId ||
        !hasCorrelatedCriticalEmergencyFinding(request, decision, {
          safetyFindingId: sourceDecision.emergencyExceptionFindingId,
          auditReferenceId: sourceDecision.auditReferenceId,
        })
      )
    ) {
      fail("CONSENT_ACTION_NOT_AUTHORIZED");
    }
  }
}

function assertBeforeActionConsent(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
  sources: ValidatedPolicySources,
): void {
  const approvedConsent = (
    scope: z.infer<typeof orchestratorConsentScopeSchema>,
    channel?: z.infer<typeof orchestratorChannelContextSchema>["channel"],
  ) => decision.consentAuthorizations.some((authorization) => {
    const source = request.consentContext.decisions.find(
      (item) => item.decisionId === authorization.consentDecisionId,
    );
    return (
      authorization.scope === scope &&
      authorization.decision === "allow" &&
      source?.status === "granted" &&
      (!channel || !source.permittedChannels ||
        source.permittedChannels.includes(channel))
    );
  });
  const required = new Set<z.infer<typeof orchestratorConsentScopeSchema>>();
  const approvedTool = decision.toolAuthorizations.some((item) =>
    ["approve", "approve_with_constraints", "require_confirmation"].includes(
      item.decision,
    ));
  if (approvedTool) required.add("external_tool_use");
  for (const authorization of decision.memoryAuthorizations) {
    if (!["approve", "approve_with_constraints"].includes(authorization.decision)) {
      continue;
    }
    required.add(authorization.operation === "read" ? "memory_read" : "memory_write");
    if (authorization.target === "mem0") required.add("mem0_write");
  }
  const instructionTypes = request.specialistResponse?.uiInstructions
    .filter((instruction) =>
      decision.approvedPresentationPlan?.approvedUIInstructionIds.includes(
        instruction.instructionId,
      ))
    .map((instruction) => instruction.type) ?? [];
  if (instructionTypes.includes("show_image_upload")) required.add("image_capture");
  if (instructionTypes.includes("show_document_upload")) {
    required.add("document_capture");
  }
  const selectedPresentation = decision.approvedPresentationPlan
    ? resolvePresentation(
      decision.approvedPresentationPlan.presentationId,
      decision.approvedPresentationPlan.version,
      sources,
    )
    : undefined;
  const selectedActions = selectedPresentation?.actions.filter((action) =>
    decision.approvedPresentationPlan?.approvedActionIds.includes(
      action.actionId,
    )) ?? [];
  if (
    selectedActions.some((action) =>
      ["capture_image", "upload_image"].includes(action.kind))
  ) {
    required.add("image_capture");
  }
  if (
    selectedActions.some((action) =>
      ["capture_document", "upload_document"].includes(action.kind))
  ) {
    required.add("document_capture");
  }
  const retainedImageEvidence = flow.evidenceRequirements.some((item) =>
    item.acceptedKinds.some((kind) => ["image", "screenshot"].includes(kind)) &&
    item.retention !== "none"
  );
  const imageRetentionRequested = instructionTypes.includes("show_image_upload") &&
    (
      retainedImageEvidence ||
      selectedPresentation?.privacyTreatment.retentionNoticeRequired
    );
  if (imageRetentionRequested) {
    if (!request.consentContext.imageRetentionAllowed) {
      fail("CONSENT_ACTION_NOT_AUTHORIZED");
    }
    required.add("image_retention");
  }
  const longitudinalComparisonRequested = imageRetentionRequested &&
    flow.evidenceRequirements.some((item) =>
      item.comparisonEligible && item.retention === "longitudinal_opt_in");
  if (longitudinalComparisonRequested) {
    if (!request.consentContext.longitudinalComparisonAllowed) {
      fail("CONSENT_ACTION_NOT_AUTHORIZED");
    }
    required.add("longitudinal_evidence_comparison");
  }
  const approvingAdjudications = decision.adjudications.filter(
    (item) =>
      ["approve", "approve_with_constraints", "require_confirmation"]
        .includes(item.decision),
  );
  const requiredDescriptorKeys = new Set<string>();
  for (const adjudication of approvingAdjudications) {
    const key = `${adjudication.subjectType}:${adjudication.subjectId}`;
    if (
      adjudication.subjectType === "tool_call" ||
      adjudication.subjectType === "memory_write"
    ) {
      requiredDescriptorKeys.add(key);
    }
    if (adjudication.subjectType === "ui_instruction") {
      const instruction = request.specialistResponse?.uiInstructions.find(
        (item) => item.instructionId === adjudication.subjectId,
      );
      if (
        instruction &&
        ["show_image_upload", "show_document_upload"].includes(
          instruction.type,
        )
      ) requiredDescriptorKeys.add(key);
    }
    if (
      adjudication.subjectType === "presentation" &&
      selectedActions.some((action) =>
        [
          "capture_image", "upload_image",
          "capture_document", "upload_document",
        ].includes(action.kind))
    ) {
      requiredDescriptorKeys.add(key);
    }
  }
  const suppliedDescriptorKeys = new Set(
    request.proposalRetentionDescriptors.map(
      (item) => `${item.subjectType}:${item.subjectId}`,
    ),
  );
  if (
    [...requiredDescriptorKeys].some(
      (key) => !suppliedDescriptorKeys.has(key),
    )
  ) {
    fail("ORCHESTRATOR_RETENTION_DESCRIPTOR_REQUIRED");
  }
  for (const descriptor of request.proposalRetentionDescriptors) {
    const adjudication = decision.adjudications.find(
      (item) =>
        item.subjectType === descriptor.subjectType &&
        item.subjectId === descriptor.subjectId,
    );
    if (
      !adjudication ||
      !["approve", "approve_with_constraints", "require_confirmation"]
        .includes(adjudication.decision)
    ) {
      continue;
    }
    if (descriptor.subjectType === "tool_call") {
      const proposal = request.specialistResponse?.proposedToolCalls.find(
        (item) => item.proposalId === descriptor.subjectId,
      );
      const tool = request.toolPolicyContext.availableTools.find(
        (item) => item.toolId === proposal?.toolId,
      );
      if (
        !proposal ||
        descriptor.sourceToolId !== proposal.toolId ||
        (
          descriptor.sourceCapabilityId &&
          !flow.capabilityIds.includes(
            descriptor.sourceCapabilityId,
          )
        ) ||
        !tool
      ) {
        fail("ORCHESTRATOR_RETENTION_POLICY_INVALID");
      }
    }
    if (
      descriptor.subjectType === "memory_write" &&
      !decision.memoryAuthorizations.some(
        (item) =>
          item.subjectId === descriptor.subjectId &&
          item.operation === "write" &&
          (
            descriptor.retentionTarget === "external_tool" ||
            item.target === descriptor.retentionTarget
          ),
      )
    ) {
      fail("ORCHESTRATOR_RETENTION_POLICY_INVALID");
    }
    if (
      descriptor.subjectType === "tool_call" &&
      descriptor.evidenceType === "image"
    ) {
      required.add("image_analysis");
    }
    if (descriptor.processingMode === "transient") continue;
    const retentionScope = descriptor.consentScopeRequired;
    if (!retentionScope) fail("ORCHESTRATOR_RETENTION_POLICY_INVALID");
    required.add(retentionScope);
    if (
      descriptor.evidenceType === "image" &&
      retentionScope !== "image_retention"
    ) fail("ORCHESTRATOR_RETENTION_POLICY_INVALID");
    if (
      descriptor.evidenceType === "document" &&
      retentionScope !== "document_retention"
    ) fail("ORCHESTRATOR_RETENTION_POLICY_INVALID");
    if (descriptor.processingMode === "longitudinal") {
      required.add("longitudinal_evidence_comparison");
    }
    if (adjudication.decision === "require_confirmation") {
      const hasConfirmation = decision.consentAuthorizations.some(
        (authorization) =>
          authorization.scope === descriptor.consentScopeRequired &&
          authorization.decision === "require_confirmation",
      );
      if (!hasConfirmation) {
        fail("ORCHESTRATOR_RETENTION_POLICY_INVALID");
      }
    }
  }
  const escalation = decision.escalationAuthorization;
  if (escalation?.type === "caregiver") required.add("caregiver_disclosure");
  if (escalation?.type === "operator") required.add("operator_disclosure");
  if (escalation?.type === "clinician") required.add("clinician_disclosure");
  const followUp = decision.followUpAuthorization;
  if (followUp?.approvedChannel === "telephone") required.add("outbound_call");
  if (followUp?.approvedChannel === "pwa") required.add("proactive_push");
  for (const requirement of flow.consentRequirements.filter(
    (item) => item.timing === "before_action",
  )) {
    if (required.has(requirement.scope)) required.add(requirement.scope);
  }
  for (const scope of required) {
    const channel = followUp &&
      ["proactive_push", "outbound_call"].includes(scope)
      ? followUp.approvedChannel
        : escalation &&
          [
            "caregiver_disclosure",
            "operator_disclosure",
            "clinician_disclosure",
          ].includes(scope)
        ? escalation.approvedChannel
        : undefined;
    const confirmationConsent = decision.consentAuthorizations.some(
      (authorization) => {
        const source = request.consentContext.decisions.find(
          (item) => item.decisionId === authorization.consentDecisionId,
        );
        return authorization.scope === scope &&
          authorization.decision === "require_confirmation" &&
          source?.status === "requires_confirmation" &&
          (!channel || !source.permittedChannels ||
            source.permittedChannels.includes(channel));
      },
    );
    if (!approvedConsent(scope, channel) && !confirmationConsent) {
      fail("CONSENT_ACTION_NOT_AUTHORIZED");
    }
  }
}

function adjudicationFor(
  decision: OrchestratorPolicyDecision,
  subjectType: PolicySubjectType,
  subjectId: string,
): ProposalAdjudication | undefined {
  return decision.adjudications.find(
    (item) =>
      item.subjectType === subjectType &&
      item.subjectId === subjectId,
  );
}

function assertTools(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
): void {
  const response = request.specialistResponse;
  const proposals = new Map(
    response?.proposedToolCalls.map((item) => [item.proposalId, item]) ?? [],
  );
  const available = new Map(
    request.toolPolicyContext.availableTools.map((item) => [item.toolId, item]),
  );
  for (const authorization of decision.toolAuthorizations) {
    const proposal = proposals.get(authorization.proposalId);
    const descriptor = proposal ? available.get(proposal.toolId) : undefined;
    const adjudication = adjudicationFor(
      decision,
      "tool_call",
      authorization.proposalId,
    );
    const explicitlyAllowed = Boolean(
      authorization.outsideFlowPolicyId &&
      authorization.outsideFlowPolicyId ===
        "policy.tool.outside_flow_narrow_exception" &&
      decision.findings.some(
      (finding) =>
        finding.policyId === authorization.outsideFlowPolicyId &&
        finding.subjectType === "tool_call" &&
        finding.subjectId === authorization.proposalId,
      ),
    );
    if (
      !proposal ||
      !descriptor ||
      !adjudication ||
      authorization.adjudicationId !== adjudication.adjudicationId ||
      authorization.toolId !== proposal.toolId ||
      authorization.decision !== adjudication.decision ||
      !request.toolPolicyContext.allowedToolIds.includes(proposal.toolId) ||
      request.toolPolicyContext.prohibitedToolIds.includes(proposal.toolId) ||
      (
        !flow.requiredTools.includes(proposal.toolId) &&
        !flow.optionalTools.includes(proposal.toolId) &&
        !explicitlyAllowed
      ) ||
      rankRisk(proposal.riskLevel) >
        rankRisk(request.toolPolicyContext.maximumRiskLevel) ||
      (descriptor.requiresConfirmation && !authorization.confirmationRequired) ||
      (descriptor.idempotencyRequired &&
        (
          !authorization.idempotencyRequired ||
          !proposal.idempotencyKey ||
          authorization.idempotencyKeyReference !== proposal.idempotencyKey
        )) ||
      authorization.expectedResultType !== proposal.expectedResultType ||
      authorization.argumentSchemaId !== descriptor.inputSchemaId ||
      (
        descriptor.outputSchemaId &&
        proposal.expectedResultType !== descriptor.outputSchemaId
      ) ||
      (
        descriptor.requiresConsent &&
        !authorization.consentAuthorizationIds.some((id) =>
          decision.consentAuthorizations.some(
            (consent) =>
              consent.authorizationId === id &&
              consent.scope === "external_tool_use" &&
              consent.decision === "allow",
          ))
      )
    ) {
      fail("TOOL_AUTHORIZATION_DENIED");
    }
    if (
      ["approve", "approve_with_constraints", "require_confirmation"].includes(
        authorization.decision,
      ) &&
      (
        !request.toolPolicyContext.externalToolUseAllowed ||
        !request.consentContext.externalToolUseAllowed
      )
    ) {
      fail("TOOL_AUTHORIZATION_DENIED");
    }
  }
  const approvedToolSubjects = decision.adjudications.filter(
    (item) =>
      item.subjectType === "tool_call" &&
      ["approve", "approve_with_constraints", "require_confirmation"].includes(
        item.decision,
      ),
  );
  if (approvedToolSubjects.some((item) =>
    !decision.toolAuthorizations.some((auth) => auth.proposalId === item.subjectId)
  )) {
    fail("TOOL_AUTHORIZATION_DENIED");
  }
  if (
    request.toolPolicyContext.onePendingToolOnly &&
    (
      approvedToolSubjects.length > 1 ||
      (
        Boolean(request.activeFlowState.pendingTool) &&
        approvedToolSubjects.some(
          (item) =>
            item.subjectId !== request.activeFlowState.pendingTool?.requestId,
        )
      )
    )
  ) {
    fail("TOOL_CARDINALITY_VIOLATION");
  }
  const waiting = decision.approvedFlowStateProposal;
  if (
    waiting?.toState === "waiting_for_tool" &&
    (
      !waiting.proposal.pendingTool ||
      approvedToolSubjects.length !== 1 ||
      waiting.proposal.pendingTool.requestId !== approvedToolSubjects[0].subjectId ||
      waiting.proposal.pendingTool.toolId !==
        proposals.get(approvedToolSubjects[0].subjectId)?.toolId
    )
  ) {
    fail("TOOL_CARDINALITY_VIOLATION");
  }
}

function assertSpecialistInvocation(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
): void {
  if (request.stage !== "specialist_invocation") {
    if (decision.specialistInvocationAuthorization) {
      fail("SPECIALIST_CONTEXT_AUTHORIZATION_DENIED");
    }
    return;
  }
  const specialistRequest = request.specialistRequest;
  const authorization = decision.specialistInvocationAuthorization;
  if (
    !specialistRequest ||
    !authorization ||
    authorization.specialistRequestId !== specialistRequest.requestId
  ) {
    fail("SPECIALIST_CONTEXT_AUTHORIZATION_DENIED");
  }
  const memoryIds = specialistRequest.relevantMemory
    .map((item) => item.recordId)
    .filter((item): item is string => Boolean(item));
  const invalidMemoryIds = specialistRequest.relevantMemory
    .filter((item) =>
      !flow.memoryPolicy.allowedReadCategories.includes(item.category) ||
      !request.memoryPolicyContext.allowedReadCategories.includes(item.category) ||
      !request.consentContext.memoryReadAllowed ||
      !specialistRequest.consentContext.memoryReadAllowed ||
      rankSensitivity(item.sensitivity) >
        rankSensitivity(request.memoryPolicyContext.sensitivityCeiling))
    .map((item) => item.recordId)
    .filter((item): item is string => Boolean(item));
  const invalidToolIds = specialistRequest.availableTools
    .filter((tool) =>
      !flow.requiredTools.includes(tool.toolId) &&
      !flow.optionalTools.includes(tool.toolId) ||
      !request.toolPolicyContext.allowedToolIds.includes(tool.toolId) ||
      !request.consentContext.externalToolUseAllowed)
    .map((tool) => tool.toolId);
  const assetId = specialistRequest.userInput.kind === "asset_reference"
    ? specialistRequest.userInput.asset.assetId
    : undefined;
  const assetKind = specialistRequest.userInput.kind === "asset_reference"
    ? specialistRequest.userInput.asset.contentType.startsWith("image/")
      ? "image"
      : "document"
    : undefined;
  const acceptedKinds = flow.evidenceRequirements.flatMap(
    (requirement) => requirement.acceptedKinds,
  );
  const invalidAsset = Boolean(
    assetKind &&
    (
      !acceptedKinds.includes(assetKind as typeof acceptedKinds[number]) ||
      (assetKind === "image" && !request.consentContext.imageCaptureAllowed) ||
      (assetKind === "document" &&
        !request.consentContext.documentCaptureAllowed)
    ),
  );
  const invalidScene = Boolean(
    specialistRequest.uiContext.sceneId &&
    !flow.uiScenes.some(
      (scene) => scene.sceneId === specialistRequest.uiContext.sceneId,
    ),
  );
  const reducedReferences = new Set([
    ...authorization.excludedMemoryReferenceIds,
    ...authorization.excludedEvidenceReferenceIds,
    ...authorization.excludedContextReferenceIds,
  ]);
  const expectedReduced = new Set([
    ...invalidMemoryIds,
    ...invalidToolIds,
    ...(invalidAsset && assetId ? [assetId] : []),
    ...(invalidScene && specialistRequest.uiContext.sceneId
      ? [specialistRequest.uiContext.sceneId]
      : []),
  ]);
  if (
    specialistRequest.specialistId !== flow.ownerSpecialistId ||
    specialistRequest.channel.type !== request.channelContext.channel ||
    !flow.supportedChannels.includes(specialistRequest.channel.type) ||
    (
      request.safetyContext.deterministicSafetyResult === "emergency" &&
      specialistRequest.specialistId !== "safety" &&
      authorization.decision !== "safety_specialist_required"
    ) ||
    (
      authorization.decision === "approved" &&
      expectedReduced.size > 0
    ) ||
    (
      authorization.decision === "approved_with_reduced_context" &&
      (
        expectedReduced.size === 0 ||
        [...expectedReduced].some((id) => !reducedReferences.has(id)) ||
        [...reducedReferences].some((id) =>
          !memoryIds.includes(id) &&
          !invalidToolIds.includes(id) &&
          id !== assetId &&
          id !== specialistRequest.uiContext.sceneId)
      )
    )
  ) {
    fail("SPECIALIST_CONTEXT_AUTHORIZATION_DENIED");
  }
}

function memoryProposalFor(
  request: OrchestratorPolicyEvaluationRequest,
  subjectId: string,
): {
  operation: "read" | "write";
  proposal: z.infer<typeof memoryReadRequestSchema> |
    z.infer<typeof memoryWriteProposalSchema>;
} | undefined {
  const response = request.specialistResponse;
  if (!response) return undefined;
  const readPrefix = `${response.requestId}.memory_read.`;
  const writePrefix = `${response.requestId}.memory_write.`;
  if (subjectId.startsWith(readPrefix)) {
    const index = Number(subjectId.slice(readPrefix.length));
    const proposal = response.memoryReadsRequested[index];
    return proposal ? { operation: "read", proposal } : undefined;
  }
  if (subjectId.startsWith(writePrefix)) {
    const index = Number(subjectId.slice(writePrefix.length));
    const proposal = response.memoryWritesProposed[index];
    return proposal ? { operation: "write", proposal } : undefined;
  }
  return undefined;
}

function assertMemory(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
): void {
  for (const authorization of decision.memoryAuthorizations) {
    const requiredScope = authorization.operation === "read"
      ? "memory_read"
      : authorization.target === "mem0"
        ? "mem0_write"
        : "memory_write";
    if (
      ["approve", "approve_with_constraints"].includes(authorization.decision) &&
      !authorization.consentAuthorizationIds.some((id) =>
        decision.consentAuthorizations.some(
          (consent) =>
            consent.authorizationId === id &&
            consent.scope === requiredScope &&
            consent.decision === "allow",
        ))
    ) {
      fail("MEMORY_AUTHORIZATION_DENIED");
    }
    const resolved = memoryProposalFor(request, authorization.subjectId);
    const subjectType = authorization.operation === "read"
      ? "memory_read" : "memory_write";
    const adjudication = adjudicationFor(
      decision,
      subjectType,
      authorization.subjectId,
    );
    if (
      !resolved ||
      resolved.operation !== authorization.operation ||
      !adjudication ||
      authorization.adjudicationId !== adjudication.adjudicationId ||
      authorization.decision !== adjudication.decision ||
      authorization.category !== resolved.proposal.category ||
      request.memoryPolicyContext.prohibitedCategories.includes(
        authorization.category,
      ) ||
      flow.memoryPolicy.prohibitedCategories.includes(
        authorization.category,
      ) ||
      rankSensitivity(authorization.sensitivityCeiling) >
        rankSensitivity(request.memoryPolicyContext.sensitivityCeiling) ||
      rankRetention(authorization.maximumRetention) >
        rankRetention(request.memoryPolicyContext.maximumRetention) ||
      rankRetention(authorization.maximumRetention) >
        rankRetention(flow.memoryPolicy.retentionClassification)
    ) {
      fail("MEMORY_AUTHORIZATION_DENIED");
    }
    if (authorization.operation === "read") {
      const proposal = resolved.proposal as z.infer<typeof memoryReadRequestSchema>;
      if (
        !request.memoryPolicyContext.readAllowed ||
        !request.consentContext.memoryReadAllowed ||
        !request.memoryPolicyContext.allowedReadCategories.includes(
          proposal.category,
        ) ||
        !flow.memoryPolicy.allowedReadCategories.includes(proposal.category) ||
        rankSensitivity(proposal.sensitivityCeiling) >
          rankSensitivity(authorization.sensitivityCeiling)
      ) {
        fail("MEMORY_AUTHORIZATION_DENIED");
      }
    } else {
      const proposal = resolved.proposal as z.infer<typeof memoryWriteProposalSchema>;
      if (
        !request.memoryPolicyContext.writeAllowed ||
        !request.consentContext.memoryWriteAllowed ||
        !request.memoryPolicyContext.allowedWriteCategories.includes(
          proposal.category,
        ) ||
        !flow.memoryPolicy.proposedWriteCategories.includes(proposal.category) ||
        authorization.target !== proposal.target ||
        !request.memoryPolicyContext.permittedTargets.includes(proposal.target) ||
        (
          proposal.target === "mem0" &&
          (!request.memoryPolicyContext.mem0Allowed ||
            !request.consentContext.mem0Allowed)
        ) ||
        (
          ["sensitive", "restricted"].includes(proposal.sensitivity) &&
          !["require_confirmation", "approve_with_constraints"].includes(
            authorization.decision,
          )
        ) ||
        (
          proposal.expiry &&
          Date.parse(proposal.expiry) <= Date.parse(request.requestedAt)
        )
      ) {
        fail("MEMORY_AUTHORIZATION_DENIED");
      }
    }
  }
  const approvedMemorySubjects = decision.adjudications.filter(
    (item) =>
      ["memory_read", "memory_write"].includes(item.subjectType) &&
      ["approve", "approve_with_constraints", "require_confirmation"].includes(
        item.decision,
      ),
  );
  if (approvedMemorySubjects.some((item) =>
    !decision.memoryAuthorizations.some(
      (authorization) => authorization.subjectId === item.subjectId,
    )
  )) {
    fail("MEMORY_AUTHORIZATION_DENIED");
  }
}

function assertEscalation(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
): void {
  const authorization = decision.escalationAuthorization;
  if (!authorization) {
    if (decision.verdict === "escalate") {
      fail("ESCALATION_AUTHORIZATION_DENIED");
    }
    return;
  }
  const response = request.specialistResponse;
  const expectedSubject = response
    ? `${response.requestId}.escalation`
    : undefined;
  const isSystemEmergency = authorization.type === "emergency" &&
    decision.systemDirectives.some(
      (directive) => directive.type === "require_safety_escalation",
    );
  if (
    !request.escalationContext.allowedTypes.includes(authorization.type) ||
    (
      authorization.approvedChannel &&
      !request.escalationContext.allowedChannels.includes(
        authorization.approvedChannel,
      )
    ) ||
    (
      !isSystemEmergency &&
      (
        !response?.escalation ||
        authorization.subjectId !== expectedSubject ||
        authorization.type !== response.escalation.type ||
        authorization.urgency !== response.escalation.urgency ||
        authorization.targetId !== response.escalation.targetId
      )
    )
  ) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  const target = authorization.type === "emergency"
    ? "emergency_services"
    : authorization.type === "technical"
      ? "operator"
      : authorization.type;
  const matchingRule = flow.escalationRules.find(
    (rule) =>
      rule.target === target &&
      (
        rule.safetyCheckIds.length === 0 ||
        rule.safetyCheckIds.some((id) =>
          request.safetyContext.flags.includes(id) ||
          response?.safetyFlags.includes(id) ||
          response?.escalation?.reasonCode === id)
      ),
  );
  if (!matchingRule && !isSystemEmergency) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  if (
    response?.escalation?.recommendedChannel &&
    authorization.approvedChannel !== response.escalation.recommendedChannel
  ) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  if (
    ["caregiver", "operator", "clinician"].includes(authorization.type) &&
    !authorization.targetId
  ) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  if (
    authorization.type === "caregiver" &&
    !request.escalationContext.caregiverDisclosureAllowed
  ) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  if (
    authorization.type === "operator" &&
    !request.escalationContext.operatorDisclosureAllowed
  ) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  if (
    request.escalationContext.activeEscalationId &&
    authorization.duplicateOfEscalationId !==
      request.escalationContext.activeEscalationId
  ) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  const requiredConsentScope = authorization.type === "caregiver"
    ? "caregiver_disclosure"
    : authorization.type === "operator"
      ? "operator_disclosure"
      : authorization.type === "clinician"
        ? "clinician_disclosure"
      : undefined;
  if (
    (matchingRule?.requiresConsent || requiredConsentScope) &&
    (
      authorization.consentAuthorizationIds.length === 0 ||
      authorization.consentAuthorizationIds.some((id) =>
        !decision.consentAuthorizations.some(
          (consent) =>
            consent.authorizationId === id &&
            consent.decision === "allow" &&
            (!requiredConsentScope || consent.scope === requiredConsentScope) &&
            (
              authorization.type !== "clinician" ||
              consent.targetId === authorization.targetId
            ),
        ))
    )
  ) {
    fail("ESCALATION_AUTHORIZATION_DENIED");
  }
  if (authorization.type === "clinician") {
    const consentAuthorization = authorization.consentAuthorizationIds
      .map((id) =>
        decision.consentAuthorizations.find(
          (consent) => consent.authorizationId === id,
        ))
      .find((consent) => consent?.scope === "clinician_disclosure");
    const source = (request.clinicianDisclosureAuthorizationSources ?? [])
      .find(
        (candidate) =>
          candidate.consentDecisionId ===
            consentAuthorization?.consentDecisionId,
      );
    const requestTime = Date.parse(request.requestedAt);
    const targetAllowed = source?.targetType === "specific_clinician"
      ? source.targetId === authorization.targetId
      : source?.targetType === "approved_care_team"
        ? Boolean(
          authorization.targetId &&
          source.approvedTargetIds?.includes(authorization.targetId),
        )
        : Boolean(
          authorization.targetId &&
          (
            source?.targetId === authorization.targetId ||
            source?.approvedTargetIds?.includes(authorization.targetId)
          )
        );
    const emergencyException = source?.targetType ===
      "emergency_clinical_service";
    const validEmergencyBasis = !emergencyException ||
      isValidClinicianEmergencyExceptionAuthorization(request, decision);
    if (
      !consentAuthorization ||
      !source ||
      source.status !== "granted" ||
      Boolean(source.revokedAt) ||
      (source.expiresAt && Date.parse(source.expiresAt) <= requestTime) ||
      source.purpose !== consentAuthorization.purpose ||
      !authorization.approvedChannel ||
      !source.allowedChannels.includes(authorization.approvedChannel) ||
      !targetAllowed ||
      consentAuthorization.targetId !== authorization.targetId ||
      (
        !emergencyException &&
        (
          Boolean(source.emergencyExceptionBasis) ||
          consentAuthorization.authorizationBasis === "emergency_exception"
        )
      ) ||
      !validEmergencyBasis
    ) {
      fail("ORCHESTRATOR_CONSENT_TARGET_INVALID");
    }
  }
}

function assertFlowUpdate(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
): void {
  const approval = decision.approvedFlowStateProposal;
  if (!approval) return;
  const response = request.specialistResponse;
  const subjectId = response
    ? `${response.requestId}.flow_state_update`
    : undefined;
  if (
    !response?.flowStateUpdate ||
    approval.subjectId !== subjectId ||
    JSON.stringify(approval.proposal) !==
      JSON.stringify(response.flowStateUpdate)
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
  assertFlowUpdateProposal(request, approval, flow);
}

function assertFlowUpdateProposal(
  request: OrchestratorPolicyEvaluationRequest,
  approval: z.infer<typeof approvedFlowStateProposalSchema>,
  flow: FlowDefinition,
): void {
  if (
    approval.flowId !== flow.flowId ||
    approval.flowVersion !== flow.version ||
    approval.fromState !== request.activeFlowState.state ||
    approval.toState !== approval.proposal.nextLifecycleState ||
    !canTransition(approval.fromState, approval.toState)
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
  const update = approval.proposal;
  if (
    Boolean(update.expectedInput) !==
      (update.nextLifecycleState === "waiting_for_user") ||
    Boolean(update.pendingTool) !==
      (update.nextLifecycleState === "waiting_for_tool")
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
  if (
    update.domainStatePatch &&
    ["flowId", "flowVersion", "state", "sessionId", "userId", "pendingTool",
      "expectedInput", "resumeMetadata", "interruptedState"].some(
      (key) => Object.hasOwn(update.domainStatePatch!, key),
    )
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
  const terminalOutcome = approval.completionOutcomeId
    ? flow.outcomes.find(
      (outcome) => outcome.outcomeId === approval.completionOutcomeId,
    )
    : undefined;
  if (
    Boolean(approval.completionOutcomeId) !==
      (approval.toState === "completed") ||
    (approval.completionOutcomeId && !terminalOutcome) ||
    (terminalOutcome && !terminalOutcome.terminal) ||
    (
      update.completionReference &&
      update.completionReference !== approval.completionOutcomeId
    ) ||
    (
      approval.toState === "interrupted" &&
      !update.resumeMetadata &&
      !update.pauseReason
    ) ||
    (
      approval.toState === "resuming" &&
      !update.resumeMetadata
    )
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
}

function assertFlowOperation(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
  sources: ValidatedPolicySources,
): void {
  const operation = request.flowOperationContext;
  const proposed = decision.approvedFlowStateProposal ??
    decision.safeFailurePlan?.flowUpdateProposal;
  if (
    !operation &&
    proposed &&
    ["interrupted", "resuming"].includes(proposed.toState)
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
  if (!operation) return;
  if (operation.ordinaryActiveFlowCount > 1) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
  if (
    operation.operation === "interrupt" &&
    (
      !flow.interruptionPolicy.mayBeInterrupted ||
      proposed?.toState !== "interrupted" ||
      !operation.interruptionReasonCode ||
      !operation.interruptedAt
    )
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
  if (operation.operation === "resume") {
    if (
      !flow.resumptionPolicy.mayResume ||
      proposed?.toState !== "resuming" ||
      !operation.interruptedAt ||
      (
        operation.expiresAt &&
        Date.parse(operation.expiresAt) <= Date.parse(request.requestedAt)
      ) ||
      (
        flow.resumptionPolicy.freshSafetyCheckOnResume &&
        (
          !operation.freshSafetyCheckAfterInterruption ||
          Date.parse(request.safetyContext.checkedAt) <=
            Date.parse(operation.interruptedAt)
        )
      ) ||
      (
        !flow.resumptionPolicy.channelSwitchAllowed &&
        operation.previousChannel &&
        operation.previousChannel !== request.channelContext.channel
      ) ||
      (
        flow.resumptionPolicy.revalidateOnResume &&
        (
          !operation.revalidationProof ||
          operation.revalidationProof.flowId !== flow.flowId ||
          operation.revalidationProof.flowVersion !== flow.version ||
          operation.revalidationProof.safetyResultReference !==
            request.safetyContext.resultId ||
          Date.parse(operation.revalidationProof.revalidatedAt) <=
            Date.parse(operation.interruptedAt) ||
          Date.parse(operation.revalidationProof.revalidatedAt) >
            Date.parse(request.requestedAt)
        )
      )
    ) {
      fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
    }
  }
  if (["switch", "preempt"].includes(operation.operation)) {
    if (!operation.targetFlowReference) {
      fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
    }
    const target = resolveFlow(operation.targetFlowReference, sources);
    if (
      target.flowId === flow.flowId ||
      !flow.interruptionPolicy.mayBeInterrupted ||
      (
        operation.operation === "preempt" &&
        (
          !target.interruptionPolicy.mayInterrupt ||
          (
            !target.flowId.startsWith("safety.") &&
            target.interruptionPolicy.preemptionScope !== "ordinary_only"
          ) ||
          (
            target.flowId.startsWith("safety.") &&
            target.interruptionPolicy.preemptionScope !== "all_non_emergency"
          )
        )
      )
    ) {
      fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
    }
  }
}

function assertFollowUp(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
): void {
  const authorization = decision.followUpAuthorization;
  if (!authorization) return;
  const response = request.specialistResponse;
  const proposal = response?.followUpRecommendation;
  const subjectId = response ? `${response.requestId}.followup` : undefined;
  if (
    !proposal ||
    authorization.subjectId !== subjectId ||
    flow.followUpPolicy.mode === "none" ||
    !flow.followUpPolicy.allowedChannels.includes(
      authorization.approvedChannel,
    ) ||
    authorization.purpose !== proposal.purpose ||
    authorization.purpose !== flow.followUpPolicy.purpose ||
    authorization.dueAt !== proposal.dueAt ||
    authorization.delaySeconds !== proposal.delaySeconds
  ) {
    fail("FOLLOWUP_AUTHORIZATION_DENIED");
  }
  const noResponse = authorization.noResponseDecision;
  if (
    noResponse.retryAllowed !==
      (flow.followUpPolicy.noResponsePolicy === "retry") ||
    noResponse.escalationAfterNoResponse !==
      (flow.followUpPolicy.noResponsePolicy === "escalate") ||
    noResponse.fallbackAllowed !== flow.followUpPolicy.fallbackAllowed ||
    (
      noResponse.retryAllowed &&
      (!noResponse.maximumAttempts || noResponse.maximumAttempts > 3)
    ) ||
    (
      noResponse.escalationAfterNoResponse &&
      !noResponse.humanReviewRequired
    )
  ) {
    fail("FOLLOWUP_AUTHORIZATION_DENIED");
  }
  if (
    authorization.fallbackChannels.some(
      (channel) =>
        !flow.followUpPolicy.fallbackAllowed ||
        !flow.followUpPolicy.allowedChannels.includes(channel),
    )
  ) {
    fail("FOLLOWUP_AUTHORIZATION_DENIED");
  }
  if (
    authorization.delaySeconds !== undefined &&
    (
      (
        flow.followUpPolicy.minimumDelaySeconds !== undefined &&
        authorization.delaySeconds < flow.followUpPolicy.minimumDelaySeconds
      ) ||
      (
        flow.followUpPolicy.maximumDelaySeconds !== undefined &&
        authorization.delaySeconds > flow.followUpPolicy.maximumDelaySeconds
      )
    )
  ) {
    fail("FOLLOWUP_AUTHORIZATION_DENIED");
  }
  if (
    authorization.consentAuthorizationIds.length === 0 ||
    authorization.consentAuthorizationIds.some((id) =>
      !decision.consentAuthorizations.some(
        (consent) =>
          consent.authorizationId === id &&
          consent.decision === "allow",
      )
    )
  ) {
    fail("FOLLOWUP_AUTHORIZATION_DENIED");
  }
  for (const channel of [
    authorization.approvedChannel,
    ...authorization.fallbackChannels,
  ]) {
    const channelAuthorized = authorization.consentAuthorizationIds.some(
      (id) => {
        const consent = decision.consentAuthorizations.find(
          (candidate) =>
            candidate.authorizationId === id &&
            candidate.decision === "allow",
        );
        const source = request.consentContext.decisions.find(
          (candidate) =>
            candidate.decisionId === consent?.consentDecisionId,
        );
        return Boolean(
          consent &&
          source &&
          (
            !source.permittedChannels ||
            source.permittedChannels.includes(channel)
          ),
        );
      },
    );
    if (!channelAuthorized) fail("FOLLOWUP_AUTHORIZATION_DENIED");
  }
}

function assertPresentation(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
  sources: ValidatedPolicySources,
): void {
  const plan = decision.approvedPresentationPlan;
  const contextSwitch = decision.deliveryContextSwitchAuthorization;
  if (!plan) {
    if (contextSwitch || decision.flowSwitchAuthorization) {
      fail("PRESENTATION_AUTHORIZATION_DENIED");
    }
    return;
  }
  const candidate = request.availablePresentationCandidates.find(
    (item) =>
      item.presentationId === plan.presentationId &&
      item.version === plan.version &&
      item.currentEligibility === "eligible",
  );
  const presentation = resolvePresentation(
    plan.presentationId,
    plan.version,
    sources,
  );
  const flowSwitch = decision.flowSwitchAuthorization;
  const targetFlowReference = request.flowOperationContext?.operation === "switch"
    ? request.flowOperationContext.targetFlowReference
    : undefined;
  const presentationFlow = flowSwitch && targetFlowReference
    ? resolveFlow(targetFlowReference, sources)
    : flow;
  const approving = (subjectType: PolicySubjectType, subjectId: string) => {
    const adjudication = adjudicationFor(decision, subjectType, subjectId);
    return Boolean(
      adjudication &&
      ["approve", "approve_with_constraints", "require_confirmation"]
        .includes(adjudication.decision),
    );
  };
  const activeSceneId = request.currentSceneReference?.sceneId;
  const sameFlowNextScene = plan.flowId === flow.flowId &&
    plan.flowVersion === flow.version &&
    plan.sceneId !== activeSceneId &&
    Boolean(
      request.specialistResponse?.nextQuestion?.sceneId === plan.sceneId &&
      decision.approvedFlowStateProposal?.proposal.expectedInput?.sceneId ===
        plan.sceneId &&
      request.specialistResponse?.flowStateUpdate &&
      approving("presentation", plan.presentationId) &&
      approving(
        "next_question",
        request.specialistResponse.nextQuestion.questionId,
      ) &&
      approving(
        "flow_state_update",
        `${request.specialistResponse.requestId}.flow_state_update`,
      ),
    );
  const authorizedFlowSwitch = Boolean(
    flowSwitch &&
    targetFlowReference &&
    POLICY_BY_ID.has(flowSwitch.sourcePolicyId) &&
    decision.findings.some(
      (finding) =>
        flowSwitch.policyFindingIds.includes(finding.findingId) &&
        finding.policyId === flowSwitch.sourcePolicyId &&
        finding.subjectType === "flow_state_update" &&
        finding.subjectId === flowSwitch.subjectId,
    ) &&
    flowSwitch.targetFlowId === targetFlowReference.flowId &&
    flowSwitch.targetFlowVersion === targetFlowReference.version &&
    flowSwitch.targetSceneId === plan.sceneId &&
    flowSwitch.targetFlowId === plan.flowId &&
    flowSwitch.targetFlowVersion === plan.flowVersion &&
    flowSwitch.subjectId ===
      `${request.specialistResponse?.requestId}.flow_state_update` &&
    approving("flow_state_update", flowSwitch.subjectId) &&
    approving("presentation", plan.presentationId),
  );
  if (
    !activeSceneId ||
    (
      plan.sceneId !== activeSceneId &&
      !sameFlowNextScene &&
      !authorizedFlowSwitch
    ) ||
    (plan.flowId !== flow.flowId && !authorizedFlowSwitch)
  ) {
    fail("ORCHESTRATOR_SCENE_TRANSITION_INVALID");
  }
  const channelChanged = plan.approvedChannel !== request.channelContext.channel;
  const deviceChanged =
    plan.approvedDeviceClass !== request.deviceContext.deviceClass;
  const localeChanged = plan.approvedLocale !== request.channelContext.locale;
  const deliveryContextChanged = channelChanged || deviceChanged || localeChanged;
  const switchFinding = contextSwitch
    ? decision.findings.find(
      (finding) =>
        contextSwitch.policyFindingIds.includes(finding.findingId) &&
        finding.policyId === contextSwitch.sourcePolicyId &&
        finding.subjectType === "presentation" &&
        finding.subjectId === plan.presentationId,
    )
    : undefined;
  const channelConsentAuthorized = !channelChanged || Boolean(
    contextSwitch?.consentAuthorizationIds.some((authorizationId) =>
      decision.consentAuthorizations.some((authorization) => {
        if (
          authorization.authorizationId !== authorizationId ||
          authorization.decision !== "allow"
        ) return false;
        const source = request.consentContext.decisions.find(
          (item) => item.decisionId === authorization.consentDecisionId,
        );
        return source?.status === "granted" &&
          source.permittedChannels?.includes(plan.approvedChannel);
      })
    ),
  );
  if (
    deliveryContextChanged !== Boolean(contextSwitch) ||
    (
      contextSwitch &&
      (
        contextSwitch.flowId !== flow.flowId ||
        contextSwitch.flowVersion !== flow.version ||
        contextSwitch.sceneId !== plan.sceneId ||
        !POLICY_BY_ID.has(contextSwitch.sourcePolicyId) ||
        !switchFinding ||
        (
          channelChanged
            ? (
              contextSwitch.channelSwitch?.from !==
                request.channelContext.channel ||
              contextSwitch.channelSwitch.to !== plan.approvedChannel ||
              !flow.supportedChannels.includes(plan.approvedChannel) ||
              !channelConsentAuthorized
            )
            : Boolean(contextSwitch.channelSwitch)
        ) ||
        (
          deviceChanged
            ? (
              contextSwitch.deviceSwitch?.from !==
                request.deviceContext.deviceClass ||
              contextSwitch.deviceSwitch.to !== plan.approvedDeviceClass
            )
            : Boolean(contextSwitch.deviceSwitch)
        ) ||
        (
          localeChanged
            ? (
              contextSwitch.localeSwitch?.from !==
                request.channelContext.locale ||
              contextSwitch.localeSwitch.to !== plan.approvedLocale
            )
            : Boolean(contextSwitch.localeSwitch)
        )
      )
    )
  ) {
    fail("PRESENTATION_AUTHORIZATION_DENIED");
  }
  if (
    !candidate ||
    !["approved", "pilot", "active"].includes(presentation.status) ||
    plan.familyId !== presentation.familyId ||
    plan.flowId !== presentationFlow.flowId ||
    plan.flowVersion !== presentationFlow.version ||
    plan.sceneId !== presentation.sceneId ||
    !presentation.supportedFlowIds.includes(presentationFlow.flowId) ||
    !presentation.supportedChannels.includes(plan.approvedChannel) ||
    !presentation.supportedDeviceClasses.includes(plan.approvedDeviceClass) ||
    !presentation.localizationPolicy.supportedLocales.includes(
      plan.approvedLocale,
    ) ||
    plan.approvedUIInstructionIds.some((id) =>
      !request.specialistResponse?.uiInstructions.some(
        (instruction) => instruction.instructionId === id,
      )
    ) ||
    request.specialistResponse?.uiInstructions.some(
      (instruction) =>
        plan.approvedUIInstructionIds.includes(instruction.instructionId) &&
        !presentation.supportedUIInstructionTypes.includes(instruction.type),
    ) ||
    plan.approvedActionIds.some((id) =>
      !presentation.actions.some((action) => action.actionId === id)
    ) ||
    plan.approvedEventMappingIds.some((id) =>
      !presentation.eventMappings.some(
        (mapping) => mapping.eventMappingId === id,
      )
    ) ||
    plan.approvedContentSlotIds.some((id) =>
      !presentation.contentSlots.some((slot) => slot.slotId === id)
    )
  ) {
    fail("PRESENTATION_AUTHORIZATION_DENIED");
  }
  if (
    (
      request.safetyContext.deterministicSafetyResult === "emergency" ||
      request.safetyContext.emergencyPresentationRequired
    ) &&
    (
      !presentation.safetyTreatment.safetyCritical ||
      plan.safetyDecision !== "emergency_required"
    )
  ) {
    fail("SAFETY_PRECEDENCE_REQUIRED");
  }
  if (
    request.safetyContext.emergencyPresentationRequired &&
    (
      presentation.safetyTreatment.requiredDisclaimers.length > 0 ||
      presentation.safetyTreatment.prohibitedClaims.length > 0
    ) &&
    !decision.approvedResponsePlan
  ) {
    fail("PRESENTATION_SAFETY_DOWNGRADE");
  }
  const approvedPrivacy = plan.approvedPrivacyPolicy;
  const canonicalPrivacy = presentation.privacyTreatment;
  const rank = (values: readonly string[], value: string) =>
    values.indexOf(value);
  if (
    rank(["public", "personal", "sensitive", "restricted"],
      approvedPrivacy.sensitivity) <
      rank(["public", "personal", "sensitive", "restricted"],
        canonicalPrivacy.sensitivity) ||
    canonicalPrivacy.screenObscuringAllowed &&
      !approvedPrivacy.screenObscuringAllowed ||
    canonicalPrivacy.hideInAppSwitcher && !approvedPrivacy.hideInAppSwitcher ||
    rank(["allowed", "warn", "prohibited"], approvedPrivacy.screenshotPolicy) <
      rank(["allowed", "warn", "prohibited"], canonicalPrivacy.screenshotPolicy) ||
    rank(["allowed", "consent_required", "prohibited"],
      approvedPrivacy.recordingPolicy) <
      rank(["allowed", "consent_required", "prohibited"],
        canonicalPrivacy.recordingPolicy) ||
    rank(["none", "optional", "required"],
      approvedPrivacy.evidencePreviewPolicy) <
      rank(["none", "optional", "required"],
        canonicalPrivacy.evidencePreviewPolicy) ||
    rank(["none", "on_exit", "timed", "after_submission"],
      approvedPrivacy.autoClearPolicy) <
      rank(["none", "on_exit", "timed", "after_submission"],
        canonicalPrivacy.autoClearPolicy) ||
    canonicalPrivacy.consentNoticeRequired &&
      !approvedPrivacy.consentNoticeRequired ||
    canonicalPrivacy.retentionNoticeRequired &&
      !approvedPrivacy.retentionNoticeRequired ||
    canonicalPrivacy.shoulderSurfingWarning &&
      !approvedPrivacy.shoulderSurfingWarning ||
    rank(["authorized_summary", "consent_required", "none"],
      approvedPrivacy.caregiverVisibility) <
      rank(["authorized_summary", "consent_required", "none"],
        canonicalPrivacy.caregiverVisibility) ||
    rank(["authorized_case", "consent_required", "none"],
      approvedPrivacy.operatorVisibility) <
      rank(["authorized_case", "consent_required", "none"],
        canonicalPrivacy.operatorVisibility)
  ) {
    fail("PRESENTATION_PRIVACY_DOWNGRADE");
  }
  const approvedSafety = plan.approvedSafetyPolicy;
  const canonicalSafety = presentation.safetyTreatment;
  if (
    canonicalSafety.safetyCritical && !approvedSafety.safetyCritical ||
    rank(["routine", "important", "urgent", "immediate"],
      approvedSafety.urgency) <
      rank(["routine", "important", "urgent", "immediate"],
        canonicalSafety.urgency) ||
    rank(["allowed", "confirm", "prohibited"],
      approvedSafety.dismissalPolicy) <
      rank(["allowed", "confirm", "prohibited"],
        canonicalSafety.dismissalPolicy) ||
    rank(["allowed", "confirm", "prohibited"], approvedSafety.deferPolicy) <
      rank(["allowed", "confirm", "prohibited"], canonicalSafety.deferPolicy) ||
    canonicalSafety.acknowledgementRequired &&
      !approvedSafety.acknowledgementRequired ||
    canonicalSafety.confirmationRequired &&
      !approvedSafety.confirmationRequired ||
    canonicalSafety.humanHelpAvailable && !approvedSafety.humanHelpAvailable ||
    canonicalSafety.emergencyActionVisible &&
      !approvedSafety.emergencyActionVisible ||
    canonicalSafety.prohibitedClaims.some(
      (claim) => !approvedSafety.prohibitedClaims.includes(claim),
    ) ||
    canonicalSafety.requiredDisclaimers.some(
      (key) => !approvedSafety.requiredDisclaimers.includes(key),
    ) ||
    approvedSafety.timeoutBehavior !== canonicalSafety.timeoutBehavior
  ) {
    fail("PRESENTATION_SAFETY_DOWNGRADE");
  }
  if (
    plan.expectedInputReference &&
    (
      !presentation.expectedInput ||
      plan.expectedInputReference.questionId !==
        presentation.expectedInput.questionId ||
      plan.expectedInputReference.sceneId !==
        presentation.expectedInput.sceneId ||
      plan.expectedInputReference.flowVersion !==
        presentation.expectedInput.flowVersion
    )
  ) {
    fail("PRESENTATION_AUTHORIZATION_DENIED");
  }
  if (
    request.specialistResponse?.nextQuestion &&
    presentation.expectedInput &&
    JSON.stringify(request.specialistResponse.nextQuestion) !==
      JSON.stringify(presentation.expectedInput)
  ) {
    fail("PRESENTATION_AUTHORIZATION_DENIED");
  }
  if (
    plan.approvedFallbackPresentationId &&
    plan.approvedFallbackPresentationId !== presentation.fallbackPresentationId &&
    plan.approvedFallbackPresentationId !==
      presentation.safetyTreatment.safeFallbackPresentationId
  ) {
    fail("PRESENTATION_AUTHORIZATION_DENIED");
  }
  const sync = plan.voiceSynchronizationDecision;
  const canonicalSync = presentation.voiceSynchronization;
  const sameSet = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length &&
    left.every((item) => right.includes(item));
  const requiredVisibleSlots = presentation.contentSlots
    .filter((slot) => slot.visualPolicy === "required")
    .map((slot) => slot.slotId);
  const canonicalOptionIds = presentation.expectedInput?.answerKind === "option"
    ? presentation.expectedInput.options.map((option) => option.id)
    : [];
  const approvedOptionIds = presentation.actions
    .filter((action) => plan.approvedActionIds.includes(action.actionId))
    .map((action) => action.optionId)
    .filter((item): item is string => Boolean(item));
  if (
    !sameSet(sync.spokenContentSlotIds, canonicalSync.spokenContentSlotIds) ||
    sync.screenVisibleContentSlotIds.some((id) =>
      !presentation.contentSlots.some((slot) =>
        slot.slotId === id && slot.visualPolicy !== "hidden")
    ) ||
    requiredVisibleSlots.some(
      (id) => !sync.screenVisibleContentSlotIds.includes(id),
    ) ||
    sync.interactionTiming !== canonicalSync.screenUpdateTiming ||
    sync.acknowledgement !== canonicalSync.acknowledgementPolicy ||
    sync.repetition !== canonicalSync.repeatPolicy ||
    sync.silenceTimeoutSeconds !==
      canonicalSync.silenceTimeoutPolicy.timeoutSeconds ||
    sync.fallbackBehavior !== canonicalSync.voiceFallbackBehavior ||
    sync.bargeInAllowed && !canonicalSync.bargeInAllowed ||
    sync.interruptSpeechOnSubmit !==
      canonicalSync.interruptSpeechOnSubmit ||
    canonicalSync.captionsRequired && !sync.captionsRequired ||
    !sameSet(canonicalOptionIds, approvedOptionIds)
  ) {
    fail("VOICE_UI_POLICY_MISMATCH");
  }
  const accessibility = presentation.accessibilityPolicy;
  if (
    (request.deviceContext.screenReaderRequired &&
      !accessibility.screenReaderRequired) ||
    (request.deviceContext.keyboardNavigationRequired &&
      !accessibility.keyboardNavigationRequired) ||
    (request.deviceContext.reducedMotionRequired &&
      !accessibility.reducedMotionSupported) ||
    (request.deviceContext.highContrastRequired &&
      !accessibility.highContrastSupported)
  ) {
    fail("PRESENTATION_AUTHORIZATION_DENIED");
  }
}

function assertResponse(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
  sources: ValidatedPolicySources,
): void {
  const plan = decision.approvedResponsePlan;
  if (!plan) return;
  const response = request.specialistResponse;
  const factIds = new Set(plan.approvedFacts.map((fact) => fact.factId));
  if (factIds.size !== plan.approvedFacts.length) {
    fail("RESPONSE_COMPOSITION_DENIED");
  }
  for (const fact of plan.approvedFacts) {
    const valid = fact.sourceType === "specialist"
      ? (
        !response ||
        fact.sourceReferenceId !== `${response.requestId}.response_guidance` ||
        !response.responseGuidance.facts.includes(fact.text)
      )
        ? false
        : true
      : fact.sourceType === "deterministic_safety"
        ? fact.sourceReferenceId === request.safetyContext.resultId &&
          fact.text ===
            `SAFETY_RESULT_${request.safetyContext.deterministicSafetyResult.toUpperCase()}`
        : fact.sourceType === "flow_catalogue"
          ? (
            (
              fact.sourceReferenceId === flow.flowId &&
              [flow.displayName, flow.description].includes(fact.text)
            ) ||
            flow.outcomes.some(
              (outcome) =>
                outcome.outcomeId === fact.sourceReferenceId &&
                outcome.description === fact.text,
            )
          )
          : Boolean(
            decision.safeFailurePlan &&
            fact.sourceReferenceId === decision.safeFailurePlan.failureCode &&
            fact.text === decision.safeFailurePlan.userSafeSummaryCode,
          );
    if (!valid) {
      fail("RESPONSE_COMPOSITION_DENIED");
    }
    const medicationClassification = fact.classification ?? "general";
    const irreversibleMedicationDirective =
      /\b(?:double|increase|decrease|change)\s+(?:the\s+|your\s+)?dose\b/i.test(
        fact.text,
      ) ||
      /\b(?:stop|start|skip)\s+(?:taking\s+)?(?:the\s+|your\s+)?(?:medicine|medication|dose)\b/i
        .test(fact.text) ||
      /\bskip\s+(?:the\s+)?next\s+dose\b/i.test(fact.text) ||
      /\b(?:combine|substitute|replace)\s+(?:this\s+|the\s+|your\s+)?(?:medicines?|medications?|drugs?)\b/i
        .test(fact.text) ||
      /\buse\s+(?:this\s+|the\s+|your\s+)?(?:medicine|medication|drug)\s+to\s+(?:diagnose|treat)\b/i
        .test(fact.text);
    const doseOrSuitabilityInstruction =
      /\btake\s+(?:\d+(?:\.\d+)?\s*)?(?:mg|mcg|g|ml|tablets?|capsules?)\b/i
        .test(fact.text) ||
      /\btake\s+(?:this|the|your)\s+(?:medicine|medication|dose)\s+now\b/i
        .test(fact.text) ||
      /\b(?:medicine|medication|drug)\b.{0,80}\b(?:appropriate|right for you|definitely safe|suitable)\b/i
        .test(fact.text);
    const medicationFinding = fact.medicationPolicyFindingId
      ? decision.findings.find(
        (finding) =>
          finding.findingId === fact.medicationPolicyFindingId &&
          finding.category === "response_composition" &&
          finding.outcome === "allow" &&
          finding.subjectType === "response_guidance" &&
          Boolean(
            fact.carePlanReferenceId &&
            finding.sourceReferenceIds.includes(fact.carePlanReferenceId),
          ),
      )
      : undefined;
    const canonicalInstruction = fact.carePlanReferenceId
      ? (request.approvedCarePlanInstructions ?? []).find(
        (instruction) =>
          instruction.instructionReferenceId === fact.carePlanReferenceId,
      )
      : undefined;
    const canonicalAuthority = canonicalInstruction
      ? (request.approvedMedicationAuthoritySources ?? []).find(
        (source) =>
          source.sourceReferenceId ===
            canonicalInstruction.sourceRecordReferenceId &&
          source.issuerType === canonicalInstruction.issuerType &&
          source.issuerReferenceId === canonicalInstruction.issuerReferenceId &&
          (
            canonicalInstruction.issuerType !== "approved_care_plan" ||
            source.carePlanId === canonicalInstruction.carePlanId
          ),
      )
      : undefined;
    const requestTime = Date.parse(request.requestedAt);
    const canonicalInstructionAuthorized = Boolean(
      canonicalInstruction &&
      canonicalAuthority &&
      canonicalInstruction.status === "active" &&
      canonicalAuthority.status === "active" &&
      canonicalInstruction.userId === request.userId &&
      canonicalAuthority.userId === request.userId &&
      canonicalInstruction.profileId === request.profileId &&
      canonicalAuthority.profileId === request.profileId &&
      canonicalInstruction.medicationReferenceId === fact.medicationReferenceId &&
      canonicalInstruction.authorizedInstructionText === fact.text &&
      canonicalInstruction.dosage === fact.dosage &&
      canonicalInstruction.unit === fact.unit &&
      Date.parse(canonicalInstruction.validFrom) <= requestTime &&
      (
        !canonicalInstruction.validUntil ||
        Date.parse(canonicalInstruction.validUntil) > requestTime
      ) &&
      (
        !canonicalInstruction.consentDecisionId ||
        request.consentContext.decisions.some(
          (consent) =>
            consent.decisionId === canonicalInstruction.consentDecisionId &&
            consent.status === "granted" &&
            (!consent.expiresAt ||
              Date.parse(consent.expiresAt) > requestTime),
        )
      ),
    );
    const approvedCarePlanInstruction =
      ["approved_care_plan_instruction", "medication_instruction"].includes(
        medicationClassification,
      ) &&
      Boolean(fact.carePlanReferenceId) &&
      Boolean(medicationFinding) &&
      canonicalInstructionAuthorized &&
      plan.requiredDisclaimers.includes("disclaimer.medication.care_plan");
    if (
      irreversibleMedicationDirective ||
      (doseOrSuitabilityInstruction && !approvedCarePlanInstruction) ||
      (
        !doseOrSuitabilityInstruction &&
        ["approved_care_plan_instruction", "medication_instruction"].includes(
          medicationClassification,
        ) &&
        !approvedCarePlanInstruction
      )
    ) {
      fail(
        ["approved_care_plan_instruction", "medication_instruction"].includes(
          medicationClassification,
        )
          ? "ORCHESTRATOR_PROVENANCE_INVALID"
          : "RESPONSE_COMPOSITION_DENIED",
      );
    }
    if (
      /\b(diagnos(?:e|is)|prescrib(?:e|ed)|guaranteed[ _-]?safe)\b/i.test(
        fact.text,
      )
    ) {
      fail("RESPONSE_COMPOSITION_DENIED");
    }
  }
  const assertPolicyTraces = (
    texts: readonly string[],
    traces: readonly z.infer<typeof responsePolicyTraceSchema>[],
  ) => {
    if (
      texts.length !== traces.length ||
      texts.some((text) => !traces.some((trace) => trace.text === text)) ||
      traces.some((trace) =>
        !texts.includes(trace.text) ||
        !plan.policyFindingIds.includes(trace.policyFindingId) ||
        !decision.findings.some(
          (finding) =>
            finding.findingId === trace.policyFindingId &&
            finding.category === "response_composition" &&
            finding.subjectType === "response_guidance" &&
            finding.sourceReferenceIds.includes(trace.sourceReferenceId),
        )
      )
    ) {
      fail("RESPONSE_COMPOSITION_DENIED");
    }
  };
  assertPolicyTraces(
    plan.evidenceLimitations,
    plan.evidenceLimitationReferences ?? [],
  );
  assertPolicyTraces(
    plan.escalationLanguageRequirements,
    plan.escalationLanguageReferences ?? [],
  );
  if (
    (
      flow.domain.startsWith("health.visual") ||
      flow.domain.startsWith("trust")
    ) &&
    flow.evidenceRequirements.length > 0 &&
    plan.evidenceLimitations.length === 0
  ) {
    fail("RESPONSE_COMPOSITION_DENIED");
  }
  if (
    decision.escalationAuthorization &&
    plan.escalationLanguageRequirements.length === 0
  ) {
    fail("RESPONSE_COMPOSITION_DENIED");
  }
  const presentation = decision.approvedPresentationPlan
    ? resolvePresentation(
      decision.approvedPresentationPlan.presentationId,
      decision.approvedPresentationPlan.version,
      sources,
    )
    : undefined;
  if (
    plan.approvedAcknowledgements.some(
      (item) => !response?.responseGuidance.acknowledgements?.includes(item),
    ) ||
    (
      response?.responseGuidance.tone &&
      plan.approvedTone !== response.responseGuidance.tone
    ) ||
    (
      response?.responseGuidance.brevity &&
      plan.brevityPreference !== response.responseGuidance.brevity
    ) ||
    (
      response &&
      ["routine", "prompt", "urgent", "immediate"].indexOf(plan.urgency) <
        ["routine", "prompt", "urgent", "immediate"].indexOf(
          response.responseGuidance.urgency,
        )
    ) ||
    plan.localizationKeys.some(
      (key) => !presentation?.localizationPolicy.requiredLocalizationKeys
        .includes(key),
    ) ||
    (
      presentation &&
      presentation.localizationPolicy.requiredLocalizationKeys.some(
        (key) => !plan.localizationKeys.includes(key),
      )
    ) ||
    plan.contentSlotAssignments.some((assignment) => {
      const slot = presentation?.contentSlots.find(
        (item) => item.slotId === assignment.contentSlotId,
      );
      return (
        !slot ||
        !decision.approvedPresentationPlan?.approvedContentSlotIds.includes(
          assignment.contentSlotId,
        ) ||
        slot.localizationKey !== assignment.localizationKey ||
        assignment.factIds.some((id) => !factIds.has(id))
      );
    }) ||
    (
      decision.verdict === "escalate" &&
      plan.escalationLanguageRequirements.length === 0
    )
  ) {
    fail("RESPONSE_COMPOSITION_DENIED");
  }
  const requiredDisclaimers = new Set([
    ...(response?.responseGuidance.requiredDisclaimers ?? []),
    ...(decision.approvedPresentationPlan
      ? resolvePresentation(
        decision.approvedPresentationPlan.presentationId,
        decision.approvedPresentationPlan.version,
        sources,
      ).safetyTreatment.requiredDisclaimers
      : []),
  ]);
  const prohibitedClaims = new Set([
    ...(response?.responseGuidance.prohibitedClaims ?? []),
    ...(decision.approvedPresentationPlan
      ? resolvePresentation(
        decision.approvedPresentationPlan.presentationId,
        decision.approvedPresentationPlan.version,
        sources,
      ).safetyTreatment.prohibitedClaims
      : []),
  ]);
  if (
    [...requiredDisclaimers].some(
      (item) => !plan.requiredDisclaimers.includes(item),
    ) ||
    [...prohibitedClaims].some(
      (item) => !plan.prohibitedClaims.includes(item),
    )
  ) {
    fail("RESPONSE_COMPOSITION_DENIED");
  }
}

function assertDirectives(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  subjectIds: Set<string>,
): void {
  for (const directive of decision.systemDirectives) {
    const policy = POLICY_BY_ID.get(directive.sourcePolicyId);
    if (
      !policy ||
      !policy.appliesAtStages.includes(request.stage) ||
      directive.flowReference.flowId !==
        request.flowDefinitionReference.flowId ||
      directive.flowReference.flowVersion !==
        request.flowDefinitionReference.version ||
      directive.subjectReferences.some((id) => !subjectIds.has(id))
    ) {
      fail("ORCHESTRATOR_DIRECTIVE_INVALID");
    }
  }
}

function assertSafety(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): void {
  if (request.safetyContext.deterministicSafetyResult !== "emergency") return;
  if (!["escalate", "safe_fail"].includes(decision.verdict)) {
    fail("SAFETY_DOWNGRADE_ATTEMPTED");
  }
  if (
    decision.verdict === "escalate" &&
    !isValidCriticalSafetyEscalationAuthorization(request, decision)
  ) {
    fail("SAFETY_PRECEDENCE_REQUIRED");
  }
  const routineApproved = decision.adjudications.some((item) =>
    ["tool_call", "memory_read", "memory_write", "followup"].includes(
      item.subjectType,
    ) &&
    ["approve", "approve_with_constraints", "require_confirmation"].includes(
      item.decision,
    ));
  if (routineApproved) fail("SAFETY_PRECEDENCE_REQUIRED");
}

function assertGlobalConflicts(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): void {
  const requiresEmergency = decision.findings.some(
    (finding) =>
      finding.outcome === "require_escalation" &&
      finding.category === "deterministic_safety",
  );
  const requiresFallback = decision.findings.some(
    (finding) => finding.outcome === "require_safe_fallback",
  );
  const routineApproved = decision.adjudications.some(
    (item) =>
      item.subjectType !== "escalation" &&
      ["approve", "approve_with_constraints", "require_confirmation"].includes(
        item.decision,
      ),
  );
  const deniedApprovedSubject = decision.findings.some(
    (finding) =>
      finding.outcome === "deny" &&
      finding.subjectId &&
      decision.adjudications.some(
        (item) =>
          item.subjectType === finding.subjectType &&
          item.subjectId === finding.subjectId &&
          ["approve", "approve_with_constraints", "require_confirmation"]
            .includes(item.decision),
      ),
  );
  if (
    (requiresEmergency &&
      (
        decision.verdict !== "escalate" ||
        !isValidCriticalSafetyEscalationAuthorization(request, decision) ||
        routineApproved
      )) ||
    (requiresFallback &&
      (decision.verdict !== "safe_fail" || routineApproved)) ||
    deniedApprovedSubject ||
    (
      request.safetyContext.deterministicSafetyResult === "emergency" &&
      Boolean(decision.deferPlan)
    )
  ) {
    fail("ORCHESTRATOR_PRECEDENCE_VIOLATION");
  }
}

function assertAuthorizationCompleteness(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): void {
  type RequiredPlan = {
    subjectType: PolicySubjectType;
    subjectId: string;
    mode: ProposalAdjudication["decision"];
  };
  const plans: RequiredPlan[] = [];
  const response = request.specialistResponse;
  if (decision.approvedResponsePlan && response) {
    plans.push({
      subjectType: "response_guidance",
      subjectId: `${response.requestId}.response_guidance`,
      mode: "approve",
    });
  }
  if (decision.approvedResponsePlan && !response) {
    fail("ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING");
  }
  const presentation = decision.approvedPresentationPlan;
  if (presentation) {
    plans.push({
      subjectType: "presentation",
      subjectId: presentation.presentationId,
      mode: "approve",
    });
    presentation.approvedUIInstructionIds.forEach((subjectId) =>
      plans.push({ subjectType: "ui_instruction", subjectId, mode: "approve" }));
  }
  const flowUpdate = decision.approvedFlowStateProposal;
  if (flowUpdate) {
    plans.push({
      subjectType: "flow_state_update",
      subjectId: flowUpdate.subjectId,
      mode: "approve",
    });
    if (flowUpdate.proposal.expectedInput) {
      plans.push({
        subjectType: "next_question",
        subjectId: flowUpdate.proposal.expectedInput.questionId,
        mode: "approve",
      });
    }
    if (flowUpdate.completionOutcomeId && response) {
      plans.push({
        subjectType: "completion",
        subjectId: `${response.requestId}.completion`,
        mode: "approve",
      });
    }
  }
  decision.toolAuthorizations
    .filter((item) => item.decision !== "reject")
    .forEach((item) => plans.push({
      subjectType: "tool_call",
      subjectId: item.proposalId,
      mode: item.decision,
    }));
  decision.memoryAuthorizations
    .filter((item) => item.decision !== "reject")
    .forEach((item) => plans.push({
      subjectType: item.operation === "read" ? "memory_read" : "memory_write",
      subjectId: item.subjectId,
      mode: item.decision,
    }));
  if (decision.escalationAuthorization) {
    plans.push({
      subjectType: "escalation",
      subjectId: decision.escalationAuthorization.subjectId,
      mode: "approve",
    });
  }
  if (decision.followUpAuthorization) {
    plans.push({
      subjectType: "followup",
      subjectId: decision.followUpAuthorization.subjectId,
      mode: "approve",
    });
  }
  const uniquePlans = new Set<string>();
  for (const plan of plans) {
    const key = `${plan.subjectType}:${plan.subjectId}`;
    if (uniquePlans.has(key)) continue;
    uniquePlans.add(key);
    const adjudications = decision.adjudications.filter(
      (item) =>
        item.subjectType === plan.subjectType &&
        item.subjectId === plan.subjectId,
    );
    if (adjudications.length !== 1) {
      fail("ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING");
    }
    const adjudication = adjudications[0];
    const compatible = plan.mode === "approve"
      ? ["approve", "approve_with_constraints"].includes(
        adjudication.decision,
      )
      : plan.mode === "approve_with_constraints"
        ? adjudication.decision === "approve_with_constraints"
        : plan.mode === "require_confirmation"
          ? adjudication.decision === "require_confirmation"
          : plan.mode === "defer"
            ? adjudication.decision === "defer"
            : adjudication.decision === "reject";
    if (
      !compatible ||
      adjudication.policyFindingIds.length === 0 ||
      adjudication.policyFindingIds.some((id) =>
        !decision.findings.some((finding) => finding.findingId === id))
    ) {
      fail("ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING");
    }
  }
  const approved = decision.adjudications.filter((item) =>
    ["approve", "approve_with_constraints", "require_confirmation"].includes(
      item.decision,
    ));
  if (
    decision.verdict !== "defer" &&
    approved.some(
      (item) => !uniquePlans.has(`${item.subjectType}:${item.subjectId}`),
    )
  ) {
    fail("ORCHESTRATOR_REVERSE_ADJUDICATION_MISSING");
  }
  if (
    response?.completionResult &&
    approved.some((item) => item.subjectType === "completion") &&
    decision.approvedFlowStateProposal?.completionOutcomeId !==
      response.completionResult.outcome
  ) {
    fail("FLOW_UPDATE_AUTHORIZATION_DENIED");
  }
}

function assertSafeFailure(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
  flow: FlowDefinition,
  sources: ValidatedPolicySources,
): void {
  const plan = decision.safeFailurePlan;
  if (!plan) return;
  if (plan.flowUpdateProposal) {
    assertFlowUpdateProposal(request, plan.flowUpdateProposal, flow);
  }
  if (plan.approvedFallbackPresentationId) {
    const fallback = sources.presentationRegistry.presentations.find(
      (presentation) =>
        presentation.presentationId === plan.approvedFallbackPresentationId &&
        presentation.compatibility.isCurrent,
    );
    if (
      !fallback ||
      !fallback.supportedFlowIds.includes(flow.flowId) ||
      !fallback.supportedChannels.includes(request.channelContext.channel)
    ) {
      fail("SAFE_FAILURE_INVALID");
    }
  }
  if (
    !plan.approvedFallbackPresentationId &&
    !plan.approvedVoiceFallbackPolicy
  ) {
    fail("SAFE_FAILURE_INVALID");
  }
  if (
    request.safetyContext.deterministicSafetyResult === "emergency" &&
    !decision.systemDirectives.some(
      (directive) => directive.type === "require_safety_escalation",
    ) &&
    decision.escalationAuthorization?.type !== "emergency"
  ) {
    fail("SAFETY_PRECEDENCE_REQUIRED");
  }
}

function assertVerdict(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): void {
  if (
    !ORCHESTRATOR_STAGE_VERDICT_COMPATIBILITY[request.stage].includes(
      decision.verdict as never,
    )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  const constraints = decision.adjudications.flatMap((item) => item.constraints);
  const approvedActionable = decision.adjudications.filter((item) =>
    ["approve", "approve_with_constraints", "require_confirmation"].includes(
      item.decision,
    ));
  const approvedSubjectKeys = new Set(
    approvedActionable.map((item) => `${item.subjectType}:${item.subjectId}`),
  );
  const allActionableSubjects = collectAdjudicableSubjects(request);
  const has = {
    question: Boolean(decision.approvedFlowStateProposal?.proposal.expectedInput),
    ui: Boolean(decision.approvedPresentationPlan?.approvedUIInstructionIds.length),
    presentation: Boolean(decision.approvedPresentationPlan),
    response: Boolean(decision.approvedResponsePlan),
    memory: decision.memoryAuthorizations.some((item) =>
      item.decision !== "reject"),
    tool: decision.toolAuthorizations.some((item) => item.decision !== "reject"),
    escalation: Boolean(decision.escalationAuthorization),
    flow: Boolean(decision.approvedFlowStateProposal),
    completion: Boolean(decision.approvedFlowStateProposal?.completionOutcomeId),
    followup: Boolean(decision.followUpAuthorization),
    defer: Boolean(decision.deferPlan),
    safeFailure: Boolean(decision.safeFailurePlan),
  };
  const ordinaryPlanCount = Object.entries(has)
    .filter(([key, value]) => value && !["defer", "safeFailure"].includes(key))
    .length;
  if (
    decision.verdict === "approve" &&
    (
      constraints.length > 0 ||
      decision.adjudications.some((item) => item.decision !== "approve") ||
      allActionableSubjects.some((subject) =>
        !approvedSubjectKeys.has(`${subject.subjectType}:${subject.subjectId}`))
    )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict === "approve_with_constraints" &&
    constraints.length === 0
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict === "request_more_information" &&
    (
      !request.specialistResponse?.nextQuestion ||
      decision.approvedFlowStateProposal?.toState !== "waiting_for_user" ||
      !decision.approvedFlowStateProposal.proposal.expectedInput ||
      !decision.approvedPresentationPlan
      || !adjudicationFor(
        decision,
        "next_question",
        request.specialistResponse.nextQuestion.questionId,
      )
    )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict === "defer" &&
    (
      !decision.deferPlan ||
      request.safetyContext.deterministicSafetyResult === "emergency" ||
      approvedActionable.length > 0 ||
      (
        decision.deferPlan.deferredAdjudicationIds.length === 0 &&
        decision.deferPlan.directiveIds.length === 0
      ) ||
      decision.deferPlan.deferredAdjudicationIds.some((id) =>
        !decision.adjudications.some(
          (item) => item.adjudicationId === id && item.decision === "defer",
        )
      ) ||
      decision.deferPlan.directiveIds.some((id) =>
        !decision.systemDirectives.some(
          (item) =>
            item.directiveId === id &&
            item.type === "defer_routine_proposals",
        )
      )
    )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict === "reject" &&
    (
      !decision.rejectionCode ||
      ordinaryPlanCount > 0 ||
      has.defer ||
      has.safeFailure ||
      decision.adjudications.some((item) => item.decision !== "reject") ||
      decision.toolAuthorizations.some((item) =>
        ["approve", "approve_with_constraints", "require_confirmation"]
          .includes(item.decision)) ||
      decision.memoryAuthorizations.some((item) =>
        ["approve", "approve_with_constraints", "require_confirmation"]
          .includes(item.decision)) ||
      allActionableSubjects.some((subject) => {
        const matching = decision.adjudications.filter(
          (item) =>
            item.subjectType === subject.subjectType &&
            item.subjectId === subject.subjectId,
        );
        return matching.length !== 1 ||
          matching[0].decision !== "reject" ||
          matching[0].policyFindingIds.length === 0;
      })
    )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict === "escalate" &&
    (
      !decision.escalationAuthorization ||
      decision.adjudications.some((item) =>
        item.subjectType !== "escalation" &&
        ["approve", "approve_with_constraints", "require_confirmation"]
          .includes(item.decision))
    )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict === "safe_fail" &&
    (
      !decision.safeFailurePlan ||
      ordinaryPlanCount > 0 ||
      approvedActionable.some((item) =>
        !["presentation", "response_guidance"].includes(item.subjectType))
    )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict !== "safe_fail" &&
    decision.safeFailurePlan
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
  if (
    decision.verdict !== "defer" && decision.deferPlan ||
    decision.verdict === "approve_with_constraints" &&
      !decision.adjudications.some(
        (item) =>
          item.decision === "approve_with_constraints" &&
          item.constraints.length > 0,
      )
  ) {
    fail("ORCHESTRATOR_VERDICT_INCOMPATIBLE");
  }
}

function assertAudit(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): void {
  const audit = decision.auditRecord;
  const findingIds = decision.findings.map((item) => item.findingId);
  const adjudicationIds = decision.adjudications.map(
    (item) => item.adjudicationId,
  );
  const constraintIds = decision.adjudications.flatMap((item) =>
    item.constraints.map((constraint) => constraint.constraintId));
  const directiveIds = decision.systemDirectives.map(
    (directive) => directive.directiveId,
  );
  const sameSet = (left: string[], right: string[]) =>
    left.length === right.length &&
    left.every((item) => right.includes(item));
  const requestConsentDecisionIds = new Set(
    request.consentContext.decisions
      .map((item) => item.decisionId)
      .filter((item): item is string => Boolean(item)),
  );
  if (
    audit.evaluationId !== request.evaluationId ||
    audit.decisionId !== decision.decisionId ||
    audit.policyVersion !== request.policyVersion ||
    audit.policyStage !== request.stage ||
    audit.verdict !== decision.verdict ||
    audit.userId !== request.userId ||
    audit.sessionId !== request.sessionId ||
    audit.flowId !== request.flowDefinitionReference.flowId ||
    audit.flowVersion !== request.flowDefinitionReference.version ||
    audit.safetyResultReference !== request.safetyContext.resultId ||
    audit.previousDecisionReference !== request.previousPolicyDecisionId ||
    audit.specialistRequestId !== request.specialistRequest?.requestId ||
    audit.specialistResponseId !== request.specialistResponse?.requestId ||
    audit.selectedPresentationId !==
      decision.approvedPresentationPlan?.presentationId ||
    audit.selectedPresentationVersion !==
      decision.approvedPresentationPlan?.version ||
    !sameSet(audit.findingIds, findingIds) ||
    !sameSet(audit.adjudicationIds, adjudicationIds) ||
    !sameSet(audit.constraintIds, constraintIds) ||
    !sameSet(audit.directiveIds, directiveIds) ||
    audit.consentDecisionReferences.some(
      (id) => !requestConsentDecisionIds.has(id),
    )
  ) {
    fail("AUDIT_DECISION_INVALID");
  }
}

function assertDecisionReferenceGraph(
  request: OrchestratorPolicyEvaluationRequest,
  decision: OrchestratorPolicyDecision,
): void {
  const findingIds = new Set(decision.findings.map((item) => item.findingId));
  const consentAuthorizationIds = new Set(
    decision.consentAuthorizations.map((item) => item.authorizationId),
  );
  const requireFindings = (ids: readonly string[]) => {
    if (ids.some((id) => !findingIds.has(id))) {
      fail("ORCHESTRATOR_REFERENCE_GRAPH_INVALID");
    }
  };
  decision.adjudications.forEach((item) => {
    requireFindings(item.policyFindingIds);
    item.constraints.forEach((constraint) => {
      if (
        !item.policyFindingIds.some((findingId) =>
          decision.findings.some(
            (finding) =>
              finding.findingId === findingId &&
              finding.policyId === constraint.sourcePolicyId,
          ))
      ) {
        fail("ORCHESTRATOR_REFERENCE_GRAPH_INVALID");
      }
    });
  });
  decision.consentAuthorizations.forEach((item) =>
    requireFindings(item.policyFindingIds));
  decision.toolAuthorizations.forEach((item) => {
    requireFindings(item.policyFindingIds);
    if (item.consentAuthorizationIds.some(
      (id) => !consentAuthorizationIds.has(id),
    )) fail("ORCHESTRATOR_REFERENCE_GRAPH_INVALID");
  });
  decision.memoryAuthorizations.forEach((item) => {
    requireFindings(item.policyFindingIds);
    if (item.consentAuthorizationIds.some(
      (id) => !consentAuthorizationIds.has(id),
    )) fail("ORCHESTRATOR_REFERENCE_GRAPH_INVALID");
  });
  const plans = [
    decision.escalationAuthorization,
    decision.approvedFlowStateProposal,
    decision.followUpAuthorization,
    decision.approvedPresentationPlan,
    decision.approvedResponsePlan,
    decision.deferPlan,
    decision.safeFailurePlan,
    decision.specialistInvocationAuthorization,
    decision.deliveryContextSwitchAuthorization,
    decision.flowSwitchAuthorization,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  plans.forEach((plan) => requireFindings(plan.policyFindingIds));
  for (const plan of [
    decision.escalationAuthorization,
    decision.followUpAuthorization,
  ]) {
    if (plan?.consentAuthorizationIds.some(
      (id) => !consentAuthorizationIds.has(id),
    )) fail("ORCHESTRATOR_REFERENCE_GRAPH_INVALID");
  }
  if (
    decision.deliveryContextSwitchAuthorization?.consentAuthorizationIds.some(
      (id) => !consentAuthorizationIds.has(id),
    )
  ) fail("ORCHESTRATOR_REFERENCE_GRAPH_INVALID");
  if (
    request.previousPolicyDecisionId === decision.decisionId ||
    decision.safeFailurePlan?.recoveryDecisionReferenceId ===
      decision.decisionId ||
    (
      decision.safeFailurePlan?.recoveryDecisionReferenceId &&
      !request.activeAuditContext.previousDecisionIds.includes(
        decision.safeFailurePlan.recoveryDecisionReferenceId,
      )
    )
  ) {
    fail("ORCHESTRATOR_REFERENCE_GRAPH_INVALID");
  }
}

export function validateOrchestratorPolicyDecision(
  requestInput: unknown,
  decisionInput: unknown,
  options: OrchestratorPolicyValidationOptions = {},
): OrchestratorPolicyDecision {
  const sources = validatePolicySources(options);
  const request = parseOrchestratorPolicyEvaluationRequest(
    requestInput,
    options,
  );
  const decision = parseOrchestratorPolicyDecision(decisionInput);
  if (
    decision.evaluationId !== request.evaluationId ||
    decision.policyVersion !== request.policyVersion ||
    decision.stage !== request.stage
  ) {
    fail("ORCHESTRATOR_CORRELATION_INVALID");
  }
  assertNoDirectSelfReferences(decision);
  assertUniqueIds(decision);
  const subjects = collectAdjudicableSubjects(request);
  const subjectKeys = new Set(
    subjects.map((subject) => `${subject.subjectType}:${subject.subjectId}`),
  );
  const subjectIds = new Set(subjects.map((subject) => subject.subjectId));
  const flow = resolveFlow(request.flowDefinitionReference, sources);
  assertFindings(request, decision, subjectKeys);
  assertAdjudications(request, decision, subjectKeys, flow, sources);
  assertConsent(request, decision);
  if (decision.verdict !== "reject") {
    assertAuthorizationCompleteness(request, decision);
  }
  assertVerdict(request, decision);
  assertSpecialistInvocation(request, decision, flow);
  assertTools(request, decision, flow);
  assertMemory(request, decision, flow);
  assertEscalation(request, decision, flow);
  assertBeforeActionConsent(request, decision, flow, sources);
  assertFlowUpdate(request, decision, flow);
  assertFlowOperation(request, decision, flow, sources);
  assertFollowUp(request, decision, flow);
  assertPresentation(request, decision, flow, sources);
  assertResponse(request, decision, flow, sources);
  assertDirectives(request, decision, subjectIds);
  assertSafety(request, decision);
  assertGlobalConflicts(request, decision);
  assertDecisionReferenceGraph(request, decision);
  assertSafeFailure(request, decision, flow, sources);
  assertAudit(request, decision);
  return decision;
}

export type OrchestratorSafetyContext = z.infer<
  typeof orchestratorSafetyContextSchema
>;
export type OrchestratorConsentContext = z.infer<
  typeof orchestratorConsentContextSchema
>;
export type ApprovedPresentationPlan = z.infer<
  typeof approvedPresentationPlanSchema
>;
export type ApprovedResponsePlan = z.infer<
  typeof approvedResponsePlanSchema
>;
export type AuditDecisionRecord = z.infer<typeof auditDecisionRecordSchema>;

// Compile-time reuse markers: Task 4 accepts the frozen shapes rather than
// defining parallel event, state, Specialist or proposal envelopes.
export type FrozenInteractionEvent = InteractionEvent;
export type FrozenFlowState = FlowState;
export type FrozenSpecialistRequest = SpecialistRequest;
export type FrozenSpecialistResponse = SpecialistResponse;
export const frozenProposalSchemas = {
  tool: proposedToolCallSchema,
  memoryRead: memoryReadRequestSchema,
  memoryWrite: memoryWriteProposalSchema,
  escalation: escalationProposalSchema,
  flowUpdate: specialistFlowStateUpdateSchema,
  followUp: followUpRecommendationSchema,
  expectedInput: expectedFlowInputSchema,
} as const;
