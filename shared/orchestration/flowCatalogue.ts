import { z } from "zod";
import {
  INTERACTION_MODALITIES,
  interactionTriggerSourceSchema,
} from "./events";
import {
  OrchestrationContractError,
  type OrchestrationContractErrorCode,
} from "./errors";
import { ANSWER_KINDS, FLOW_LIFECYCLE_STATES } from "./flowState";

const idSchema = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/);
const namespaceIdSchema = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/);
const semverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const textSchema = z.string().min(1).max(2_000);
const trustClassificationSchema = z.enum([
  "likely_scam", "suspicious", "insufficient_evidence", "no_obvious_indicators",
]);
const uniqueStrings = <T extends z.ZodTypeAny>(item: T, minimum = 0) =>
  z.array(item).min(minimum).superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate values" });
    }
  });

export const FLOW_KINDS = [
  "domain", "subflow", "shared", "engagement", "safety", "assessment",
] as const;
export const FLOW_STATUSES = [
  "draft", "approved", "pilot", "active", "deprecated", "retired",
] as const;
export const FLOW_CHANNELS = [
  "voice", "pwa", "telephone", "touch", "text", "caregiver", "operator",
] as const;
export const OWNER_SPECIALIST_IDS = [
  "safety", "preventive_health", "symptom_assessment", "visual_health",
  "medication", "mental_wellbeing", "social", "concierge", "scam_fraud",
  "brain_coach", "caregiver", "operator", "engagement", "orchestration",
] as const;
export const CONSENT_SCOPE_IDS = [
  "health_data", "sensitive_health_evidence", "image_capture", "image_retention",
  "document_capture", "mem0_write", "caregiver_disclosure", "operator_disclosure",
  "external_tool_use", "proactive_push", "outbound_call",
  "longitudinal_evidence_comparison",
] as const;

const consentRequirementSchema = z.object({
  scope: z.enum(CONSENT_SCOPE_IDS),
  timing: z.enum(["before_entry", "before_action"]),
  revocable: z.boolean(),
  reusable: z.boolean(),
  purposeSpecific: z.boolean(),
}).strict();

const entryConditionSchema = z.object({
  requiredConsentScopes: uniqueStrings(z.enum(CONSENT_SCOPE_IDS)),
  requiresActiveProfile: z.boolean(),
  minimumContextKeys: uniqueStrings(namespaceIdSchema),
  permittedTriggers: uniqueStrings(interactionTriggerSourceSchema),
  requiredChannels: uniqueStrings(z.enum(FLOW_CHANNELS)),
  prerequisiteSafetyCheckIds: uniqueStrings(idSchema),
  requiredAssetKinds: uniqueStrings(z.enum(["image", "document", "screenshot"])),
  requiredPriorOutcomes: uniqueStrings(idSchema),
  exclusionConditionIds: uniqueStrings(idSchema),
}).strict();

const evidenceRequirementSchema = z.object({
  purpose: textSchema,
  required: z.boolean(),
  acceptedKinds: uniqueStrings(z.enum([
    "spoken_description", "copied_text", "screenshot", "image", "document",
    "phone_number", "website_reference", "measurement",
  ]), 1),
  acceptedMimeFamilies: uniqueStrings(z.string().regex(/^[a-z]+\/(?:\*|[a-z0-9.+-]+)$/)),
  qualityCheckRequired: z.boolean(),
  contextualQuestionIds: uniqueStrings(idSchema),
  imageAloneInsufficient: z.boolean(),
  observationOnly: z.boolean(),
  retention: z.enum(["none", "session", "purpose_limited", "longitudinal_opt_in"]),
  comparisonEligible: z.boolean(),
}).strict();

const memoryPolicySchema = z.object({
  allowedReadCategories: uniqueStrings(namespaceIdSchema),
  proposedWriteCategories: uniqueStrings(namespaceIdSchema),
  prohibitedCategories: uniqueStrings(namespaceIdSchema),
  permittedTargets: uniqueStrings(z.enum(["postgres", "mem0", "working_memory"])),
  writeConfirmation: z.enum(["never", "sensitive_only", "always"]),
  retentionClassification: z.enum(["none", "session", "short_term", "long_term"]),
}).strict();

const uiSceneSchema = z.object({
  sceneId: idSchema,
  purpose: textSchema,
  supportedInstructionTypes: uniqueStrings(z.enum([
    "show_choice_question", "show_scale", "show_text_prompt",
    "show_measurement_input", "show_image_upload", "show_document_upload",
    "show_summary", "show_confirmation", "show_progress", "clear_scene",
  ]), 1),
}).strict();

const outcomeSchema = z.object({
  outcomeId: idSchema,
  category: z.enum([
    "completed", "information", "action_proposed", "followup", "escalation",
    "blocked", "likely_scam", "suspicious", "insufficient_evidence",
    "no_obvious_indicators", "escalated", "followup_required",
    "account_protection_started", "user_declined_help",
  ]),
  trustClassification: trustClassificationSchema.optional(),
  description: textSchema,
  terminal: z.boolean(),
  allowedNextFlowIds: uniqueStrings(idSchema),
  escalationRequirement: z.enum(["none", "optional", "required"]).optional(),
  followUpEligible: z.boolean(),
  memorySummaryPolicy: z.enum(["none", "structured", "consent_required"]),
}).strict();

const compatibilitySchema = z.object({
  isCurrent: z.boolean(),
  minimumCompatibleVersion: semverSchema.optional(),
  migrationPolicy: z.enum(["none", "explicit_adapter", "restart_required"]),
  breakingChange: z.boolean(),
  deprecatedVersions: uniqueStrings(semverSchema),
  replacementFlowId: idSchema.optional(),
  replacementVersion: semverSchema.optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.replacementFlowId) !== Boolean(value.replacementVersion)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "replacement pair required" });
  }
});

type JsonMetadataValue =
  | null
  | boolean
  | number
  | string
  | JsonMetadataValue[]
  | { [key: string]: JsonMetadataValue };

const METADATA_RESERVED_KEYS = new Set([
  "apikey", "api_key", "accesstoken", "access_token", "refreshtoken",
  "refresh_token", "secret", "password", "credential", "credentials",
  "authorization", "authheader", "privatekey", "private_key", "clientsecret",
  "client_secret", "providerclient", "providerinstance", "provideradapter",
  "sdkclient", "executable", "callback", "handler", "component",
  "reactcomponent",
]);
const MAX_METADATA_DEPTH = 5;
const MAX_METADATA_KEYS = 64;
const MAX_METADATA_ARRAY_LENGTH = 32;
const MAX_METADATA_STRING_LENGTH = 2_000;
const MAX_METADATA_SERIALIZED_LENGTH = 16_384;

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeJsonMetadata(value: unknown): value is Record<string, JsonMetadataValue> {
  if (!value || typeof value !== "object" || !isPlainObject(value)) return false;
  let keyCount = 0;
  const ancestors = new WeakSet<object>();
  const inspect = (candidate: unknown, depth: number): boolean => {
    if (candidate === null) return true;
    if (typeof candidate === "string") {
      return candidate.length <= MAX_METADATA_STRING_LENGTH;
    }
    if (typeof candidate === "number") return Number.isFinite(candidate);
    if (typeof candidate === "boolean") return true;
    if (
      candidate === undefined ||
      typeof candidate === "function" ||
      typeof candidate === "symbol" ||
      typeof candidate === "bigint" ||
      !candidate ||
      typeof candidate !== "object" ||
      depth > MAX_METADATA_DEPTH ||
      ancestors.has(candidate)
    ) {
      return false;
    }
    if (
      candidate instanceof Date ||
      candidate instanceof Map ||
      candidate instanceof Set ||
      candidate instanceof RegExp ||
      candidate instanceof Error ||
      ArrayBuffer.isView(candidate) ||
      candidate instanceof ArrayBuffer
    ) {
      return false;
    }
    ancestors.add(candidate);
    let valid = true;
    if (Array.isArray(candidate)) {
      valid =
        candidate.length <= MAX_METADATA_ARRAY_LENGTH &&
        candidate.every((item) => inspect(item, depth + 1));
    } else if (
      !isPlainObject(candidate) ||
      Object.getOwnPropertySymbols(candidate).length > 0
    ) {
      valid = false;
    } else {
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        keyCount += 1;
        if (
          key.length > 160 ||
          keyCount > MAX_METADATA_KEYS ||
          METADATA_RESERVED_KEYS.has(key.toLowerCase()) ||
          !descriptor.enumerable ||
          !("value" in descriptor) ||
          !inspect(descriptor.value, depth + 1)
        ) {
          valid = false;
          break;
        }
      }
    }
    ancestors.delete(candidate);
    return valid;
  };
  if (!inspect(value, 1)) return false;
  try {
    return JSON.stringify(value).length <= MAX_METADATA_SERIALIZED_LENGTH;
  } catch {
    return false;
  }
}

export const boundedMetadataSchema = z.custom<Record<string, JsonMetadataValue>>(
  isSafeJsonMetadata,
  { message: "FLOW_METADATA_INVALID" },
);

export const capabilityDefinitionSchema = z.object({
  capabilityId: idSchema,
  version: semverSchema,
  description: textSchema,
  inputKinds: uniqueStrings(z.enum(INTERACTION_MODALITIES)),
  outputKinds: uniqueStrings(idSchema),
  requiredConsentScopes: uniqueStrings(z.enum(CONSENT_SCOPE_IDS)),
  riskClassification: z.enum(["none", "low", "medium", "high", "critical"]),
  providerNeutral: z.literal(true),
  runtimeResponsibility: textSchema,
  supportedFlowIds: uniqueStrings(idSchema),
  supportedDomains: uniqueStrings(namespaceIdSchema),
  canStartFlow: z.literal(false),
  canSpeak: z.literal(false),
  canDiagnose: z.literal(false),
  canExecuteEscalation: z.literal(false),
  canWriteMemory: z.literal(false),
  canChooseOutcome: z.literal(false),
  metadata: boundedMetadataSchema,
}).strict();

export const flowDefinitionSchema = z.object({
  flowId: idSchema,
  version: semverSchema,
  displayName: z.string().min(1).max(160),
  description: textSchema,
  domain: namespaceIdSchema,
  kind: z.enum(FLOW_KINDS),
  status: z.enum(FLOW_STATUSES),
  ownerSpecialistId: z.enum(OWNER_SPECIALIST_IDS),
  parentFlowId: idSchema.optional(),
  subflowIds: uniqueStrings(idSchema),
  capabilityIds: uniqueStrings(idSchema),
  supportedTriggers: uniqueStrings(interactionTriggerSourceSchema, 1),
  supportedChannels: uniqueStrings(z.enum(FLOW_CHANNELS), 1),
  entryConditions: uniqueStrings(entryConditionSchema),
  lifecyclePolicy: z.object({
    allowedStates: uniqueStrings(z.enum(FLOW_LIFECYCLE_STATES), 1),
    selectableStatuses: uniqueStrings(z.enum(["approved", "pilot", "active"])),
  }).strict(),
  expectedInputKinds: uniqueStrings(z.enum(ANSWER_KINDS)),
  evidenceRequirements: z.array(evidenceRequirementSchema),
  requiredTools: z.array(idSchema),
  optionalTools: z.array(idSchema),
  deterministicSafetyChecks: uniqueStrings(idSchema),
  consentRequirements: z.array(consentRequirementSchema),
  memoryPolicy: memoryPolicySchema,
  uiScenes: z.array(uiSceneSchema),
  outcomes: z.array(outcomeSchema).min(1),
  escalationRules: z.array(z.object({
    ruleId: idSchema,
    safetyCheckIds: uniqueStrings(idSchema),
    target: z.enum(["caregiver", "operator", "clinician", "emergency_services"]),
    requiresConsent: z.boolean(),
  }).strict()),
  followUpPolicy: z.object({
    mode: z.enum(["none", "recommended", "required", "conditional"]),
    purpose: textSchema.optional(),
    minimumDelaySeconds: z.number().int().nonnegative().optional(),
    maximumDelaySeconds: z.number().int().positive().optional(),
    allowedChannels: uniqueStrings(z.enum(FLOW_CHANNELS)),
    fallbackAllowed: z.boolean(),
    consentRequired: z.boolean(),
    noResponsePolicy: z.enum(["none", "record_only", "retry", "escalate"]),
  }).strict().superRefine((value, context) => {
    if (
      value.minimumDelaySeconds !== undefined &&
      value.maximumDelaySeconds !== undefined &&
      value.maximumDelaySeconds < value.minimumDelaySeconds
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid delay range" });
    }
  }),
  interruptionPolicy: z.object({
    mayInterrupt: z.boolean(),
    mayBeInterrupted: z.boolean(),
    preemptionScope: z.enum(["none", "ordinary_only", "all_non_emergency"]),
  }).strict(),
  resumptionPolicy: z.object({
    mayResume: z.boolean(),
    expiresAfterSeconds: z.number().int().positive().optional(),
    revalidateOnResume: z.boolean(),
    freshSafetyCheckOnResume: z.boolean(),
    channelSwitchAllowed: z.boolean(),
  }).strict(),
  compatibility: compatibilitySchema,
  metadata: boundedMetadataSchema,
}).strict();

export const flowCatalogueSchema = z.object({
  catalogueVersion: semverSchema,
  flows: z.array(flowDefinitionSchema).min(1),
  capabilities: z.array(capabilityDefinitionSchema).min(1),
  metadata: boundedMetadataSchema,
}).strict();

export type FlowDefinition = z.infer<typeof flowDefinitionSchema>;
export type CapabilityDefinition = z.infer<typeof capabilityDefinitionSchema>;
export type FlowCatalogue = z.infer<typeof flowCatalogueSchema>;

function fail(code: OrchestrationContractErrorCode): never {
  throw new OrchestrationContractError(code);
}
function duplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function validateRawMetadata(input: unknown): void {
  if (!input || typeof input !== "object") return;
  const candidate = input as {
    metadata?: unknown;
    flows?: Array<{ metadata?: unknown }>;
    capabilities?: Array<{ metadata?: unknown }>;
  };
  const flows = Array.isArray(candidate.flows) ? candidate.flows : [];
  const capabilities = Array.isArray(candidate.capabilities)
    ? candidate.capabilities
    : [];
  const values = [
    candidate.metadata,
    ...flows.map((item) => item?.metadata),
    ...capabilities.map((item) => item?.metadata),
  ];
  try {
    if (values.some((value) => !isSafeJsonMetadata(value))) {
      fail("FLOW_METADATA_INVALID");
    }
  } catch {
    fail("FLOW_METADATA_INVALID");
  }
}

function validateReferences(catalogue: FlowCatalogue): void {
  const flows = new Map(catalogue.flows.map((flow) => [flow.flowId, flow]));
  const flowVersions = new Set(
    catalogue.flows.map((flow) => `${flow.flowId}@${flow.version}`),
  );
  const capabilities = new Set(catalogue.capabilities.map((item) => item.capabilityId));
  for (const flow of catalogue.flows) {
    if (flow.parentFlowId && !flows.has(flow.parentFlowId)) fail("FLOW_REFERENCE_INVALID");
    for (const subflowId of flow.subflowIds) {
      const subflow = flows.get(subflowId);
      if (!subflow || subflow.parentFlowId !== flow.flowId) fail("FLOW_REFERENCE_INVALID");
    }
    if (flow.parentFlowId && !flows.get(flow.parentFlowId)?.subflowIds.includes(flow.flowId)) {
      fail("FLOW_REFERENCE_INVALID");
    }
    for (const capabilityId of flow.capabilityIds) {
      if (!capabilities.has(capabilityId)) fail("CAPABILITY_REFERENCE_INVALID");
    }
    for (const outcome of flow.outcomes) {
      if (outcome.allowedNextFlowIds.some((id) => !flows.has(id))) {
        fail("FLOW_REFERENCE_INVALID");
      }
    }
    if (
      flow.compatibility.replacementFlowId &&
      !flowVersions.has(
        `${flow.compatibility.replacementFlowId}@${flow.compatibility.replacementVersion}`,
      )
    ) {
      fail("FLOW_REFERENCE_INVALID");
    }
  }
  for (const capability of catalogue.capabilities) {
    if (capability.supportedFlowIds.some((id) => !flows.has(id))) {
      fail("FLOW_REFERENCE_INVALID");
    }
  }
  for (const start of catalogue.flows) {
    const seen = new Set<string>();
    let current: FlowDefinition | undefined = start;
    while (current?.parentFlowId) {
      if (seen.has(current.flowId)) fail("FLOW_REFERENCE_CYCLE");
      seen.add(current.flowId);
      current = flows.get(current.parentFlowId);
    }
  }
}

function validatePolicies(catalogue: FlowCatalogue): void {
  const capabilities = new Map(
    catalogue.capabilities.map((item) => [item.capabilityId, item]),
  );
  for (const flow of catalogue.flows) {
    if (
      duplicates(flow.uiScenes.map((scene) => scene.sceneId)) ||
      duplicates(flow.outcomes.map((outcome) => outcome.outcomeId))
    ) {
      fail("FLOW_COLLECTION_INVALID");
    }
    if (
      duplicates(flow.requiredTools) ||
      duplicates(flow.optionalTools) ||
      flow.requiredTools.some((toolId) => flow.optionalTools.includes(toolId))
    ) {
      fail("FLOW_TOOL_POLICY_INVALID");
    }
    if (
      flow.outcomes.some(
        (outcome) => outcome.terminal && outcome.allowedNextFlowIds.length > 0,
      )
    ) {
      fail("FLOW_OUTCOME_POLICY_INVALID");
    }
    if (flow.status === "retired" && flow.compatibility.isCurrent) {
      fail("FLOW_COMPATIBILITY_INVALID");
    }
    if (
      flow.status === "deprecated" &&
      !flow.compatibility.replacementFlowId
    ) {
      fail("FLOW_COMPATIBILITY_INVALID");
    }
    if (
      (flow.domain === "caregiver" &&
        !flow.supportedTriggers.includes("caregiver")) ||
      (flow.domain === "operator" &&
        !flow.supportedTriggers.includes("operator"))
    ) {
      fail("FLOW_TRIGGER_POLICY_INVALID");
    }
    if (
      flow.interruptionPolicy.preemptionScope === "all_non_emergency" &&
      !flow.flowId.startsWith("safety.")
    ) {
      fail("FLOW_SAFETY_POLICY_INVALID");
    }
    const isVisual = flow.flowId.startsWith("health.visual.");
    if (isVisual) {
      const evidenceConsent = flow.consentRequirements.some(
        (item) => item.scope === "image_capture" && item.timing === "before_entry",
      );
      const qualityCapability = flow.capabilityIds.includes(
        "capability.multimodal.quality_check",
      );
      const evidenceSafe = flow.evidenceRequirements.some(
        (item) =>
          item.acceptedKinds.includes("image") &&
          item.qualityCheckRequired &&
          item.imageAloneInsufficient &&
          item.observationOnly,
      );
      if (!evidenceConsent) fail("FLOW_CONSENT_POLICY_INVALID");
      if (!qualityCapability || !evidenceSafe) fail("FLOW_EVIDENCE_POLICY_INVALID");
      if (!flow.deterministicSafetyChecks.length) fail("FLOW_SAFETY_POLICY_INVALID");
      if (
        flow.flowId === "health.visual.stool_assessment" &&
        !flow.deterministicSafetyChecks.includes("safety_check.stool_bleeding")
      ) {
        fail("FLOW_SAFETY_POLICY_INVALID");
      }
    }
    if (flow.flowId.startsWith("trust.")) {
      const prohibitedClassifications = new Set([
        "safe", "verified_safe", "definitely_safe", "cleared", "trusted",
        "legitimate", "guaranteed_safe", "no_risk",
      ]);
      const guaranteeLanguage = [
        "guaranteed safe", "definitely safe", "confirmed legitimate",
        "no possibility of fraud", "completely trustworthy",
      ];
      for (const outcome of flow.outcomes) {
        const localId = outcome.outcomeId.split(".").at(-1)!;
        const isClassification = trustClassificationSchema.safeParse(
          outcome.category,
        ).success;
        if (
          prohibitedClassifications.has(localId) ||
          guaranteeLanguage.some((phrase) =>
            outcome.description.toLowerCase().includes(phrase))
        ) {
          fail("FLOW_TRUST_POLICY_INVALID");
        }
        if (
          isClassification &&
          outcome.trustClassification !== outcome.category
        ) {
          fail("FLOW_TRUST_POLICY_INVALID");
        }
        if (
          outcome.trustClassification &&
          outcome.trustClassification !== outcome.category
        ) {
          fail("FLOW_TRUST_POLICY_INVALID");
        }
      }
      if (!flow.metadata.prohibitsGuaranteedSafeVerdict) {
        fail("FLOW_TRUST_POLICY_INVALID");
      }
    }
    const needsEvidenceCapture = flow.evidenceRequirements.some((item) => item.required);
    if (
      needsEvidenceCapture &&
      !flow.capabilityIds.some((id) =>
        id.includes("image_capture") ||
        id.includes("document_capture") ||
        id.includes("screenshot_capture"))
    ) {
      fail("FLOW_EVIDENCE_POLICY_INVALID");
    }
    if (flow.supportedTriggers.includes("push")) {
      if (
        !flow.capabilityIds.includes("capability.communication.push") ||
        !flow.supportedChannels.includes("pwa") ||
        !flow.consentRequirements.some(
          (consent) => consent.scope === "proactive_push",
        )
      ) {
        fail("FLOW_TRIGGER_POLICY_INVALID");
      }
    }
    if (flow.supportedTriggers.includes("outbound_call")) {
      if (
        !flow.capabilityIds.includes("capability.communication.outbound_call") ||
        !flow.supportedChannels.includes("telephone") ||
        !flow.consentRequirements.some(
          (consent) => consent.scope === "outbound_call",
        )
      ) {
        fail("FLOW_TRIGGER_POLICY_INVALID");
      }
    }
    for (const id of flow.capabilityIds) {
      const capability = capabilities.get(id);
      if (
        capability &&
        capability.supportedFlowIds.length &&
        !capability.supportedFlowIds.includes(flow.flowId)
      ) {
        fail("CAPABILITY_REFERENCE_INVALID");
      }
    }
  }
}

export function parseFlowCatalogue(input: unknown): FlowCatalogue {
  validateRawMetadata(input);
  const parsed = flowCatalogueSchema.safeParse(input);
  if (!parsed.success) {
    const candidate = input as { flows?: unknown; capabilities?: unknown };
    const rawFlows = Array.isArray(candidate?.flows) ? candidate.flows : [];
    const rawCapabilities = Array.isArray(candidate?.capabilities)
      ? candidate.capabilities
      : [];
    const rawVersions = [
      ...rawFlows,
      ...rawCapabilities,
    ].map((item) => (item as { version?: unknown }).version);
    if (rawVersions.some(
      (value) => typeof value === "string" && !semverSchema.safeParse(value).success,
    )) {
      fail("FLOW_VERSION_INVALID");
    }
    const rawFlowIds = rawFlows.map(
      (item) => (item as { flowId?: string }).flowId,
    );
    if (rawFlowIds?.some((value) => typeof value === "string" && !idSchema.safeParse(value).success)) {
      fail("FLOW_CATALOGUE_INVALID");
    }
    fail("FLOW_CATALOGUE_INVALID");
  }
  const catalogue = parsed.data;
  const flowKeys = catalogue.flows.map((flow) => `${flow.flowId}@${flow.version}`);
  const capabilityKeys = catalogue.capabilities.map(
    (item) => `${item.capabilityId}@${item.version}`,
  );
  if (duplicates(flowKeys)) fail("FLOW_ID_DUPLICATE");
  if (duplicates(capabilityKeys)) fail("CAPABILITY_ID_DUPLICATE");
  const currentFlows = catalogue.flows.filter((flow) => flow.compatibility.isCurrent);
  if (duplicates(currentFlows.map((flow) => flow.flowId))) {
    fail("FLOW_COMPATIBILITY_INVALID");
  }
  validateReferences(catalogue);
  validatePolicies(catalogue);
  return catalogue;
}

const baseMemoryPolicy: FlowDefinition["memoryPolicy"] = {
  allowedReadCategories: [],
  proposedWriteCategories: [],
  prohibitedCategories: ["hidden_reasoning"],
  permittedTargets: ["working_memory"],
  writeConfirmation: "sensitive_only",
  retentionClassification: "session",
};

function titleFromId(flowId: string): string {
  return flowId.split(".").at(-1)!.replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type FlowOverrides = Partial<FlowDefinition> & Pick<FlowDefinition, "flowId" | "domain" | "ownerSpecialistId">;
function defineFlow(overrides: FlowOverrides): FlowDefinition {
  const flowId = overrides.flowId;
  return {
    flowId,
    version: "1.0.0",
    displayName: titleFromId(flowId),
    description: `Declarative catalogue definition for ${flowId}.`,
    domain: overrides.domain,
    kind: "domain",
    status: "draft",
    ownerSpecialistId: overrides.ownerSpecialistId,
    subflowIds: [],
    capabilityIds: [],
    supportedTriggers: ["user"],
    supportedChannels: ["voice", "pwa", "touch", "text"],
    entryConditions: [],
    lifecyclePolicy: {
      allowedStates: [...FLOW_LIFECYCLE_STATES],
      selectableStatuses: ["approved", "pilot", "active"],
    },
    expectedInputKinds: ["option", "free_text"],
    evidenceRequirements: [],
    requiredTools: [],
    optionalTools: [],
    deterministicSafetyChecks: ["safety_check.emergency_general"],
    consentRequirements: [],
    memoryPolicy: baseMemoryPolicy,
    uiScenes: [{
      sceneId: `${flowId}.main`,
      purpose: `Primary semantic scene for ${flowId}.`,
      supportedInstructionTypes: ["show_text_prompt", "show_choice_question"],
    }],
    outcomes: [{
      outcomeId: `${flowId}.completed`,
      category: "completed",
      description: "The Flow completed without an escalation proposal.",
      terminal: true,
      allowedNextFlowIds: [],
      escalationRequirement: "none",
      followUpEligible: false,
      memorySummaryPolicy: "structured",
    }],
    escalationRules: [],
    followUpPolicy: {
      mode: "none",
      allowedChannels: [],
      fallbackAllowed: false,
      consentRequired: false,
      noResponsePolicy: "record_only",
    },
    interruptionPolicy: {
      mayInterrupt: false,
      mayBeInterrupted: true,
      preemptionScope: "none",
    },
    resumptionPolicy: {
      mayResume: true,
      expiresAfterSeconds: 86_400,
      revalidateOnResume: true,
      freshSafetyCheckOnResume: true,
      channelSwitchAllowed: true,
    },
    compatibility: {
      isCurrent: true,
      minimumCompatibleVersion: "1.0.0",
      migrationPolicy: "none",
      breakingChange: false,
      deprecatedVersions: [],
    },
    metadata: {},
    ...overrides,
  };
}

const FLOW_GROUPS = {
  safety: [
    "emergency_check", "immediate_risk_assessment", "escalation_decision", "safety_followup",
  ],
  health: [
    "preventive_check", "symptom_assessment", "vitals_capture", "recovery_followup",
    "healthy_ageing_coaching",
  ],
  medication: [
    "reminder", "dose_confirmation", "dose_deferred", "missed_dose", "refill_check",
    "supply_check", "side_effect_report", "adherence_followup",
  ],
  wellbeing: [
    "mood_check", "loneliness_check", "distress_check", "cognitive_concern", "support", "followup",
  ],
  social: [
    "daily_checkin", "general_conversation", "reminiscence", "activity",
    "community_connection", "family_contact_suggestion", "loneliness_followup",
  ],
  brain_coach: [
    "activity_session",
  ],
  concierge: [
    "appointment_support", "transportation_support", "local_service_request",
    "shopping_support", "meal_support", "administrative_support",
    "community_resource_discovery", "operator_handoff",
  ],
  trust: [
    "scam_assessment", "suspicious_phone_call", "suspicious_message",
    "suspicious_email", "impersonation_scam", "payment_risk",
    "remote_access_request", "account_compromise", "fraud_exposure_followup",
  ],
  caregiver: [
    "request_checkin", "review_approved_summary", "respond_to_escalation",
    "update_preferences", "request_followup",
  ],
  operator: [
    "review_escalation", "review_failed_engagement", "contact_user",
    "contact_caregiver", "resolve_service_request", "record_outcome", "close_case", "reopen_case",
  ],
  engagement: [
    "proactive_attempt", "push_notification", "notification_resume", "outbound_call",
    "retry", "channel_fallback", "no_response_followup",
  ],
  orchestration: [
    "start_flow", "resume_flow", "interrupt_flow", "defer_flow", "cancel_flow",
    "complete_flow", "fail_flow", "escalate_flow", "expire_flow", "wait_for_user",
    "wait_for_tool", "tool_confirmation", "consent_check", "memory_read_approval",
    "memory_write_approval", "followup_recommendation",
  ],
} as const;

const OWNER_BY_DOMAIN: Record<keyof typeof FLOW_GROUPS, FlowDefinition["ownerSpecialistId"]> = {
  safety: "safety",
  health: "preventive_health",
  medication: "medication",
  wellbeing: "mental_wellbeing",
  social: "social",
  brain_coach: "brain_coach",
  concierge: "concierge",
  trust: "scam_fraud",
  caregiver: "caregiver",
  operator: "operator",
  engagement: "engagement",
  orchestration: "orchestration",
};

const genericFlows = Object.entries(FLOW_GROUPS).flatMap(([domain, names]) =>
  names.map((name) => defineFlow({
    flowId: `${domain}.${name}`,
    domain,
    ownerSpecialistId: OWNER_BY_DOMAIN[domain as keyof typeof FLOW_GROUPS],
    kind:
      domain === "orchestration" ? "shared" :
      domain === "engagement" ? "engagement" :
      domain === "safety" ? "safety" : "domain",
  })));

const visualNames = [
  "wound_assessment", "stool_assessment", "skin_assessment", "foot_assessment",
  "swelling_assessment", "medication_packaging_identification",
  "longitudinal_image_comparison",
] as const;
const visualFlowIds = visualNames.map((name) => `health.visual.${name}`);
const visualFlows = visualNames.map((name) => {
  const flowId = `health.visual.${name}`;
  const safetyCheck =
    name === "wound_assessment" ? "safety_check.wound_red_flags" :
    name === "stool_assessment" ? "safety_check.stool_bleeding" :
    "safety_check.emergency_general";
  return defineFlow({
    flowId,
    domain: "health.visual",
    ownerSpecialistId: "visual_health",
    kind: "assessment",
    parentFlowId: "health.symptom_assessment",
    capabilityIds: [
      "capability.multimodal.image_capture",
      "capability.multimodal.quality_check",
      "capability.multimodal.evidence_consent",
      "capability.multimodal.asset_authorization",
      "capability.multimodal.vision_analysis",
      "capability.multimodal.structured_observation_validation",
    ],
    expectedInputKinds: ["image", "option", "free_text"],
    evidenceRequirements: [{
      purpose: `Capture purpose-limited visual evidence for ${flowId}.`,
      required: true,
      acceptedKinds: ["image"],
      acceptedMimeFamilies: ["image/*"],
      qualityCheckRequired: true,
      contextualQuestionIds: [`${flowId}.context`],
      imageAloneInsufficient: true,
      observationOnly: true,
      retention: name === "longitudinal_image_comparison"
        ? "longitudinal_opt_in" : "purpose_limited",
      comparisonEligible: true,
    }],
    deterministicSafetyChecks: [...new Set([
      "safety_check.emergency_general", safetyCheck,
    ])],
    consentRequirements: [{
      scope: "image_capture",
      timing: "before_entry",
      revocable: true,
      reusable: false,
      purposeSpecific: true,
    }, {
      scope: "sensitive_health_evidence",
      timing: "before_entry",
      revocable: true,
      reusable: false,
      purposeSpecific: true,
    }],
    uiScenes: [{
      sceneId: `${flowId}.capture`,
      purpose: "Capture evidence without diagnostic claims.",
      supportedInstructionTypes: ["show_image_upload", "show_progress"],
    }, {
      sceneId: `${flowId}.context_questions`,
      purpose: "Collect required non-visual context.",
      supportedInstructionTypes: ["show_choice_question", "show_text_prompt"],
    }],
    escalationRules: [{
      ruleId: `${flowId}.red_flag`,
      safetyCheckIds: [safetyCheck],
      target: "clinician",
      requiresConsent: true,
    }],
    metadata: {
      visualBoundary: "observation_only",
      imageAloneInsufficient: true,
      processingSequence: [
        "deterministic_safety_check", "visual_observations",
        "specialist_interpretation", "orchestrator_decision",
      ],
    },
  });
});

function replaceFlow(
  flows: FlowDefinition[],
  flowId: string,
  update: Partial<FlowDefinition>,
): void {
  const index = flows.findIndex((flow) => flow.flowId === flowId);
  flows[index] = { ...flows[index], ...update };
}

const canonicalFlows = [...genericFlows, ...visualFlows];
replaceFlow(canonicalFlows, "health.symptom_assessment", {
  ownerSpecialistId: "symptom_assessment",
  subflowIds: visualFlowIds,
});
replaceFlow(canonicalFlows, "health.preventive_check", {
  status: "pilot",
  supportedTriggers: ["user", "push", "outbound_call", "schedule"],
  consentRequirements: [{
    scope: "health_data", timing: "before_entry",
    revocable: true, reusable: true, purposeSpecific: true,
  }, {
    scope: "proactive_push", timing: "before_entry",
    revocable: true, reusable: true, purposeSpecific: true,
  }, {
    scope: "outbound_call", timing: "before_entry",
    revocable: true, reusable: true, purposeSpecific: true,
  }],
  capabilityIds: [
    "capability.communication.push",
    "capability.communication.outbound_call",
  ],
  supportedChannels: ["voice", "pwa", "telephone", "touch", "text"],
  followUpPolicy: {
    mode: "conditional",
    purpose: "Continue the approved preventive check.",
    minimumDelaySeconds: 3_600,
    maximumDelaySeconds: 604_800,
    allowedChannels: ["pwa", "telephone", "text"],
    fallbackAllowed: true,
    consentRequired: true,
    noResponsePolicy: "record_only",
  },
  metadata: { intendedFirstImplementation: true, healthSupervisorRequired: false },
});
replaceFlow(canonicalFlows, "wellbeing.support", {
  status: "pilot",
  displayName: "Mental Wellbeing Support",
  description:
    "Stage 10B user-initiated ordinary Mental Wellbeing support flow. The flow adapts existing companion/social support semantics and does not diagnose, prescribe, write memory, trigger caregivers, schedule proactive outreach, or execute tools.",
  supportedTriggers: ["user"],
  supportedChannels: ["voice", "pwa", "touch", "text"],
  expectedInputKinds: ["free_text", "option"],
  requiredTools: [],
  optionalTools: [],
  deterministicSafetyChecks: ["safety_check.emergency_general"],
  memoryPolicy: {
    allowedReadCategories: [],
    proposedWriteCategories: [],
    prohibitedCategories: [
      "hidden_reasoning",
      "caregiver_private_data",
      "mental_health",
      "safety_emergency",
    ],
    permittedTargets: ["working_memory"],
    writeConfirmation: "always",
    retentionClassification: "none",
  },
  uiScenes: [{
    sceneId: "wellbeing.support.main",
    purpose:
      "Primary non-clinical wellbeing-support scene for acknowledgement, safe fallback, and optional reflection prompts.",
    supportedInstructionTypes: ["show_summary", "show_text_prompt", "clear_scene"],
  }],
  outcomes: [{
    outcomeId: "wellbeing.support.support_ready",
    category: "completed",
    description:
      "A supported ordinary wellbeing-support request was mapped to existing companion/social semantics and canonical presentation instructions.",
    terminal: true,
    allowedNextFlowIds: [],
    escalationRequirement: "none",
    followUpEligible: false,
    memorySummaryPolicy: "none",
  }, {
    outcomeId: "wellbeing.support.fallback_to_legacy",
    category: "blocked",
    description:
      "The request is unsupported, clinical, safety-sensitive, or outside the migrated Mental Wellbeing slice and should preserve legacy fallback or safety preemption.",
    terminal: true,
    allowedNextFlowIds: [],
    escalationRequirement: "none",
    followUpEligible: false,
    memorySummaryPolicy: "none",
  }],
  followUpPolicy: {
    mode: "none",
    allowedChannels: [],
    fallbackAllowed: false,
    consentRequired: false,
    noResponsePolicy: "record_only",
  },
  interruptionPolicy: {
    mayInterrupt: false,
    mayBeInterrupted: true,
    preemptionScope: "none",
  },
  resumptionPolicy: {
    mayResume: true,
    expiresAfterSeconds: 3_600,
    revalidateOnResume: true,
    freshSafetyCheckOnResume: true,
    channelSwitchAllowed: true,
  },
  metadata: {
    task16Stage: "stage_10b_mental_wellbeing_specialist",
    migrationBoundary: "ordinary_non_clinical_support_only",
    noPostgresMigrationRequired: true,
    legacyFallbackAvailable: true,
    noGlobalRegistryAdded: true,
    clinicalBoundary: "not_diagnosis_or_treatment",
    memoryBoundaryUnchanged: true,
    caregiverBoundaryUnchanged: true,
    proactiveBoundaryUnchanged: true,
  },
});
replaceFlow(canonicalFlows, "brain_coach.activity_session", {
  status: "pilot",
  displayName: "Brain Coach Activity Session",
  description:
    "Stage 10A Brain Coach activity-selection and session-entry flow. The flow adapts existing Brain Coach navigation behavior and does not execute games, schedules, memory writes, or caregiver mutations.",
  supportedTriggers: ["user"],
  supportedChannels: ["voice", "pwa", "touch", "text"],
  expectedInputKinds: ["free_text", "option"],
  requiredTools: [],
  optionalTools: ["tool.voice.open_app_action"],
  deterministicSafetyChecks: ["safety_check.emergency_general"],
  memoryPolicy: {
    allowedReadCategories: [],
    proposedWriteCategories: [],
    prohibitedCategories: ["hidden_reasoning", "caregiver_private_data"],
    permittedTargets: ["working_memory"],
    writeConfirmation: "always",
    retentionClassification: "none",
  },
  uiScenes: [{
    sceneId: "brain_coach.activity_session.main",
    purpose:
      "Primary Brain Coach activity-selection scene for opening existing supported activity surfaces.",
    supportedInstructionTypes: ["show_summary", "show_confirmation", "clear_scene"],
  }],
  outcomes: [{
    outcomeId: "brain_coach.activity_session.action_proposed",
    category: "action_proposed",
    description:
      "A supported existing Brain Coach activity/navigation action was proposed for Orchestrator tool authorization.",
    terminal: false,
    allowedNextFlowIds: [],
    escalationRequirement: "none",
    followUpEligible: false,
    memorySummaryPolicy: "none",
  }, {
    outcomeId: "brain_coach.activity_session.fallback_to_legacy",
    category: "blocked",
    description:
      "The request is unsupported, coming-soon, or outside the migrated Brain Coach slice and should preserve legacy fallback.",
    terminal: true,
    allowedNextFlowIds: [],
    escalationRequirement: "none",
    followUpEligible: false,
    memorySummaryPolicy: "none",
  }],
  followUpPolicy: {
    mode: "none",
    allowedChannels: [],
    fallbackAllowed: false,
    consentRequired: false,
    noResponsePolicy: "record_only",
  },
  interruptionPolicy: {
    mayInterrupt: false,
    mayBeInterrupted: true,
    preemptionScope: "none",
  },
  resumptionPolicy: {
    mayResume: true,
    expiresAfterSeconds: 3_600,
    revalidateOnResume: true,
    freshSafetyCheckOnResume: true,
    channelSwitchAllowed: true,
  },
  metadata: {
    task15Stage: "stage_10a_brain_coach_specialist",
    migrationBoundary: "activity_navigation_only",
    noPostgresMigrationRequired: true,
    legacyFallbackAvailable: true,
    caregiverBoundaryUnchanged: true,
    scheduleBoundaryUnchanged: true,
    gamePersistenceUnchanged: true,
    domainSupervisorRequired: false,
  },
});
replaceFlow(canonicalFlows, "medication.reminder", {
  status: "pilot",
  displayName: "Medication Routine Support",
  description:
    "Stage 10C Medication Specialist slice for user-initiated medication management, adherence-report and refill-context navigation only. The flow reuses existing medication surfaces and does not confirm doses, alter medication records, contact pharmacies, write memory, or execute clinical decisions.",
  supportedTriggers: ["user"],
  supportedChannels: ["voice", "pwa", "touch", "text"],
  expectedInputKinds: ["free_text", "option"],
  requiredTools: [],
  optionalTools: ["tool.voice.open_app_action"],
  deterministicSafetyChecks: [
    "safety_check.emergency_general",
    "safety_check.medication_risk",
  ],
  memoryPolicy: {
    allowedReadCategories: [],
    proposedWriteCategories: [],
    prohibitedCategories: [
      "hidden_reasoning",
      "caregiver_private_data",
      "raw_medication_speech",
    ],
    permittedTargets: ["working_memory"],
    writeConfirmation: "always",
    retentionClassification: "none",
  },
  uiScenes: [{
    sceneId: "medication.reminder.main",
    purpose:
      "Primary medication routine scene for opening existing medication management and report surfaces without recording a dose.",
    supportedInstructionTypes: ["show_text_prompt", "show_confirmation", "show_choice_question", "clear_scene"],
  }],
  outcomes: [{
    outcomeId: "medication.reminder.action_proposed",
    category: "action_proposed",
    description:
      "A supported existing medication navigation/context action was proposed for Orchestrator tool authorization.",
    terminal: false,
    allowedNextFlowIds: [],
    escalationRequirement: "none",
    followUpEligible: false,
    memorySummaryPolicy: "none",
  }, {
    outcomeId: "medication.reminder.fallback_to_legacy",
    category: "blocked",
    description:
      "The request is safety-sensitive, mutating, unsupported, or outside the migrated Medication slice and should preserve legacy or Safety routing.",
    terminal: true,
    allowedNextFlowIds: [],
    escalationRequirement: "none",
    followUpEligible: false,
    memorySummaryPolicy: "none",
  }],
  followUpPolicy: {
    mode: "none",
    allowedChannels: [],
    fallbackAllowed: false,
    consentRequired: false,
    noResponsePolicy: "record_only",
  },
  interruptionPolicy: {
    mayInterrupt: false,
    mayBeInterrupted: true,
    preemptionScope: "none",
  },
  resumptionPolicy: {
    mayResume: true,
    expiresAfterSeconds: 3_600,
    revalidateOnResume: true,
    freshSafetyCheckOnResume: true,
    channelSwitchAllowed: true,
  },
  metadata: {
    task17Stage: "stage_10c_medication_specialist",
    migrationBoundary: "medication_navigation_and_context_only",
    noPostgresMigrationRequired: true,
    legacyFallbackAvailable: true,
    noGlobalRegistryAdded: true,
    doseMutationBoundaryUnchanged: true,
    medicationRecordBoundaryUnchanged: true,
    caregiverBoundaryUnchanged: true,
    scheduleBoundaryUnchanged: true,
    pharmacyContactBoundaryUnchanged: true,
    medicationSafetyPrecedenceRequired: true,
    domainSupervisorRequired: false,
  },
});
replaceFlow(canonicalFlows, "safety.emergency_check", {
  status: "active",
  supportedTriggers: ["user", "caregiver", "operator", "system"],
  interruptionPolicy: {
    mayInterrupt: true, mayBeInterrupted: false, preemptionScope: "all_non_emergency",
  },
});
replaceFlow(canonicalFlows, "safety.immediate_risk_assessment", {
  interruptionPolicy: {
    mayInterrupt: true, mayBeInterrupted: false, preemptionScope: "all_non_emergency",
  },
});
for (const flow of canonicalFlows.filter((item) => item.flowId.startsWith("trust."))) {
  flow.expectedInputKinds = ["option", "free_text", "image", "document", "structured"];
  flow.capabilityIds = [
    "capability.multimodal.image_capture",
    "capability.multimodal.document_capture",
    "capability.multimodal.screenshot_capture",
  ];
  flow.deterministicSafetyChecks = [
    "safety_check.scam_active_payment",
    "safety_check.account_compromise",
    "safety_check.remote_access_request",
  ];
  flow.consentRequirements = [{
    scope: "document_capture", timing: "before_action",
    revocable: true, reusable: false, purposeSpecific: true,
  }, {
    scope: "image_capture", timing: "before_action",
    revocable: true, reusable: false, purposeSpecific: true,
  }];
  flow.evidenceRequirements = [{
    purpose: "Assess only the minimum evidence needed for scam or fraud indicators.",
    required: false,
    acceptedKinds: [
      "spoken_description", "copied_text", "screenshot", "image",
      "document", "phone_number", "website_reference",
    ],
    acceptedMimeFamilies: ["image/*", "application/pdf", "text/*"],
    qualityCheckRequired: false,
    contextualQuestionIds: [`${flow.flowId}.exposure_context`],
    imageAloneInsufficient: true,
    observationOnly: true,
    retention: "none",
    comparisonEligible: false,
  }];
  flow.outcomes = [
    "likely_scam", "suspicious", "insufficient_evidence", "no_obvious_indicators",
  ].map((category) => ({
    outcomeId: `${flow.flowId}.${category}`,
    category: category as FlowDefinition["outcomes"][number]["category"],
    trustClassification: category as FlowDefinition["outcomes"][number]["trustClassification"],
    description: category === "no_obvious_indicators"
      ? "No obvious indicators were observed; this is not a guarantee of safety."
      : `The evidence supports the ${category} classification.`,
    terminal: true,
    allowedNextFlowIds: [],
    escalationRequirement: category === "likely_scam" ? "optional" as const : "none" as const,
    followUpEligible: true,
    memorySummaryPolicy: "consent_required" as const,
  }));
  flow.metadata = {
    acceptedEvidenceTypes: [
      "spoken_description", "copied_text", "screenshot", "image",
      "document", "phone_number", "website_reference",
    ],
    sensitiveDataMinimization: true,
    checksPaymentExposure: true,
    checksCredentialExposure: true,
    checksRemoteAccess: true,
    checksAccountCompromise: true,
    caregiverEscalationAvailable: true,
    operatorEscalationAvailable: true,
    actedAlreadyFollowup: true,
    prohibitsGuaranteedSafeVerdict: true,
  };
}
replaceFlow(canonicalFlows, "trust.scam_assessment", {
  uiScenes: [{
    sceneId: "trust.scam.evidence_capture",
    purpose: "Capture the minimum evidence needed for assessment.",
    supportedInstructionTypes: [
      "show_text_prompt", "show_image_upload", "show_document_upload",
    ],
  }, {
    sceneId: "trust.scam.exposure_questions",
    purpose: "Ask about payment, credentials, remote access, and actions already taken.",
    supportedInstructionTypes: ["show_choice_question", "show_text_prompt"],
  }, {
    sceneId: "trust.scam.immediate_actions",
    purpose: "Present proposed immediate protective actions without execution.",
    supportedInstructionTypes: ["show_summary", "show_confirmation"],
  }, {
    sceneId: "trust.scam.escalation",
    purpose: "Present escalation or follow-up options.",
    supportedInstructionTypes: ["show_choice_question", "show_confirmation"],
  }],
});
replaceFlow(canonicalFlows, "health.visual.longitudinal_image_comparison", {
  capabilityIds: [
    ...canonicalFlows.find(
      (flow) => flow.flowId === "health.visual.longitudinal_image_comparison",
    )!.capabilityIds,
    "capability.multimodal.longitudinal_comparison",
    "capability.multimodal.retention_decision",
  ],
  consentRequirements: [
    ...canonicalFlows.find(
      (flow) => flow.flowId === "health.visual.longitudinal_image_comparison",
    )!.consentRequirements,
    {
      scope: "longitudinal_evidence_comparison",
      timing: "before_entry",
      revocable: true,
      reusable: false,
      purposeSpecific: true,
    },
  ],
});
replaceFlow(canonicalFlows, "engagement.push_notification", {
  supportedTriggers: ["push"],
  supportedChannels: ["pwa"],
  capabilityIds: ["capability.communication.push"],
  consentRequirements: [{
    scope: "proactive_push", timing: "before_entry",
    revocable: true, reusable: true, purposeSpecific: true,
  }],
});
replaceFlow(canonicalFlows, "engagement.outbound_call", {
  supportedTriggers: ["outbound_call"],
  supportedChannels: ["telephone"],
  capabilityIds: ["capability.communication.outbound_call"],
  consentRequirements: [{
    scope: "outbound_call", timing: "before_entry",
    revocable: true, reusable: true, purposeSpecific: true,
  }],
});
replaceFlow(canonicalFlows, "engagement.notification_resume", {
  supportedTriggers: ["push"],
  supportedChannels: ["pwa"],
  capabilityIds: ["capability.communication.push"],
  consentRequirements: [{
    scope: "proactive_push", timing: "before_entry",
    revocable: true, reusable: true, purposeSpecific: true,
  }],
});

for (const flow of canonicalFlows.filter((item) => item.domain === "caregiver")) {
  flow.supportedTriggers = ["caregiver"];
}
for (const flow of canonicalFlows.filter((item) => item.domain === "operator")) {
  flow.supportedTriggers = ["operator"];
}

function defineCapability(
  capabilityId: string,
  inputKinds: CapabilityDefinition["inputKinds"],
  overrides: Partial<CapabilityDefinition> = {},
): CapabilityDefinition {
  return {
    capabilityId,
    version: "1.0.0",
    description: `Provider-neutral capability contract for ${capabilityId}.`,
    inputKinds,
    outputKinds: [`${capabilityId}.result`],
    requiredConsentScopes: [],
    riskClassification: "low",
    providerNeutral: true,
    runtimeResponsibility: "A future authorized adapter performs this capability.",
    supportedFlowIds: [],
    supportedDomains: [],
    canStartFlow: false,
    canSpeak: false,
    canDiagnose: false,
    canExecuteEscalation: false,
    canWriteMemory: false,
    canChooseOutcome: false,
    metadata: {},
    ...overrides,
  };
}

export const CANONICAL_CAPABILITIES: CapabilityDefinition[] = [
  defineCapability("capability.multimodal.image_capture", ["image"], {
    requiredConsentScopes: ["image_capture"], riskClassification: "medium",
    supportedDomains: ["health.visual", "trust"],
  }),
  defineCapability("capability.multimodal.document_capture", ["document"], {
    requiredConsentScopes: ["document_capture"], supportedDomains: ["trust"],
  }),
  defineCapability("capability.multimodal.screenshot_capture", ["image"], {
    requiredConsentScopes: ["image_capture"], supportedDomains: ["trust"],
  }),
  defineCapability("capability.multimodal.quality_check", ["image"]),
  defineCapability("capability.multimodal.retake_request", ["image"]),
  defineCapability("capability.multimodal.evidence_consent", ["system"], {
    requiredConsentScopes: ["image_capture"],
  }),
  defineCapability("capability.multimodal.asset_authorization", ["system"], {
    riskClassification: "high",
  }),
  defineCapability("capability.multimodal.vision_analysis", ["image"], {
    riskClassification: "high",
    runtimeResponsibility: "A future adapter returns observations only, never a diagnosis.",
  }),
  defineCapability("capability.multimodal.structured_observation_validation", ["system"]),
  defineCapability("capability.multimodal.retention_decision", ["system"], {
    requiredConsentScopes: ["image_retention"],
  }),
  defineCapability("capability.multimodal.longitudinal_comparison", ["image"], {
    requiredConsentScopes: ["longitudinal_evidence_comparison"],
    riskClassification: "high",
  }),
  defineCapability("capability.communication.push", ["system"], {
    requiredConsentScopes: ["proactive_push"],
  }),
  defineCapability("capability.communication.outbound_call", ["system"], {
    requiredConsentScopes: ["outbound_call"], riskClassification: "medium",
  }),
  defineCapability("capability.communication.caregiver_handoff", ["system"], {
    requiredConsentScopes: ["caregiver_disclosure"], riskClassification: "high",
  }),
  defineCapability("capability.communication.operator_handoff", ["system"], {
    requiredConsentScopes: ["operator_disclosure"], riskClassification: "high",
  }),
];

export const REQUIRED_FLOW_IDS = canonicalFlows.map((flow) => flow.flowId);
export const REQUIRED_CAPABILITY_IDS = CANONICAL_CAPABILITIES.map(
  (capability) => capability.capabilityId,
);

export const VYVA_FLOW_CATALOGUE: FlowCatalogue = {
  catalogueVersion: "1.0.0",
  flows: canonicalFlows,
  capabilities: CANONICAL_CAPABILITIES,
  metadata: {
    runtimeConnected: false,
    task1Commit: "fbbf7de3bef2ea9abb3829bd57e5253287c7e748",
    task2Commit: "c15ea0cddc8664ccd88976231f57060d9adeaa66",
  },
};
