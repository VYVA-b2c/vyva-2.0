import { z } from "zod";
import { assetReferenceSchema } from "./assets";
import { interactionTriggerSourceSchema } from "./events";
import {
  OrchestrationContractError,
  type OrchestrationContractErrorCode,
} from "./errors";
import {
  canTransition,
  expectedFlowInputSchema,
  flowLifecycleStateSchema,
  normalizedAnswerSchema,
  pendingToolSchema,
  resumeMetadataSchema,
} from "./flowState";

const id = z.string().min(1).max(160);
const text = z.string().min(1).max(4_000);
const dateTime = z.string().datetime({ offset: true });
const record = z.record(z.unknown());

export const specialistRiskLevelSchema = z.enum([
  "none", "low", "medium", "high", "emergency",
]);
export const memorySensitivitySchema = z.enum([
  "public", "internal", "sensitive", "restricted",
]);

export const specialistUserInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event_reference"), eventId: id }).strict(),
  z.object({ kind: z.literal("safe_text"), text, redacted: z.literal(true) }).strict(),
  z.object({ kind: z.literal("asset_reference"), asset: assetReferenceSchema }).strict(),
]);

export const specialistNormalizedInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), answer: normalizedAnswerSchema }).strict(),
  z.object({
    type: z.literal("event_reference"), eventId: id, summary: text.optional(),
  }).strict(),
]);

export const specialistMemoryItemSchema = z.object({
  category: id,
  source: z.enum(["postgres", "mem0", "working_memory", "tool", "user", "system"]),
  value: z.unknown(),
  observedAt: dateTime.optional(),
  recordId: id.optional(),
  sensitivity: memorySensitivitySchema,
  confidence: z.number().min(0).max(1).optional(),
  consentBasis: text.optional(),
  provenance: record.optional(),
}).strict();

export const specialistToolDescriptorSchema = z.object({
  toolId: id,
  description: text,
  inputSchemaId: id.optional(),
  outputSchemaId: id.optional(),
  requiresConfirmation: z.boolean(),
  requiresConsent: z.boolean(),
  idempotencyRequired: z.boolean(),
  allowedRiskLevels: z.array(specialistRiskLevelSchema).min(1),
}).strict();

export const specialistRequestSchema = z.object({
  requestId: id,
  correlationId: id,
  causationId: id.optional(),
  specialistId: id,
  specialistVersion: id,
  flowId: id,
  flowVersion: id,
  flowInstanceId: id,
  currentState: flowLifecycleStateSchema,
  userId: id,
  profileId: id.optional(),
  sessionId: id,
  intent: z.object({
    name: id,
    confidence: z.number().min(0).max(1),
    source: z.enum(["deterministic", "orchestrator", "scheduled", "explicit"]),
    rationaleCode: id.optional(),
  }).strict(),
  userInput: specialistUserInputSchema,
  normalizedInput: specialistNormalizedInputSchema,
  inputModality: z.enum([
    "voice", "touch", "text", "image", "document", "measurement", "tool", "system",
  ]),
  triggerSource: interactionTriggerSourceSchema,
  relevantMemory: z.array(specialistMemoryItemSchema),
  domainContext: record,
  safetyContext: z.object({
    emergencyChecked: z.boolean(),
    deterministicSafetyResult: z.enum(["clear", "emergency", "uncertain", "not_applicable"]),
    flags: z.array(id),
    riskLevel: specialistRiskLevelSchema,
    restrictions: z.array(text),
    escalationAlreadyActive: z.boolean(),
  }).strict(),
  consentContext: z.object({
    scopes: z.array(id),
    decisionId: id.optional(),
    channelAllowed: z.boolean(),
    memoryReadAllowed: z.boolean(),
    memoryWriteAllowed: z.boolean(),
    externalToolUseAllowed: z.boolean(),
    caregiverEscalationAllowed: z.boolean(),
    operatorEscalationAllowed: z.boolean(),
  }).strict(),
  previousAnswers: z.record(normalizedAnswerSchema),
  currentQuestion: expectedFlowInputSchema.optional(),
  availableTools: z.array(specialistToolDescriptorSchema),
  uiContext: z.object({
    currentRoute: z.string().max(500).optional(),
    sceneId: id.optional(),
    visibleInstructionIds: z.array(id),
    visibleOptionIds: z.array(id),
    deviceClass: z.enum(["mobile", "tablet", "desktop", "telephone", "unknown"]).optional(),
    accessibilityPreferences: record.optional(),
  }).strict(),
  locale: id,
  timezone: id,
  channel: z.object({
    type: z.enum(["voice", "pwa", "telephone", "touch", "text", "caregiver", "operator"]),
    supportsVoice: z.boolean(),
    supportsVisuals: z.boolean(),
  }).strict(),
  metadata: record,
  requestedAt: dateTime,
}).strict().superRefine((request, context) => {
  if (request.specialistId !== "safety" && !request.safetyContext.emergencyChecked) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "EMERGENCY_CHECK_REQUIRED",
      path: ["safetyContext", "emergencyChecked"],
    });
  }
});

const uiBase = z.object({
  instructionId: id,
  questionId: id.optional(),
  sceneId: id.optional(),
  priority: z.number().int().min(0).max(100).optional(),
});
export const specialistUIInstructionSchema = z.discriminatedUnion("type", [
  uiBase.extend({
    type: z.literal("show_choice_question"),
    payload: z.object({
      prompt: text,
      options: z.array(z.object({ id, label: text }).strict()).min(1),
    }).strict(),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_scale"),
    payload: z.object({
      prompt: text, minimum: z.number(), maximum: z.number(), step: z.number().positive(),
    }).strict().refine((value) => value.maximum > value.minimum),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_text_prompt"),
    payload: z.object({ prompt: text, multiline: z.boolean() }).strict(),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_measurement_input"),
    payload: z.object({ prompt: text, unit: id }).strict(),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_image_upload"),
    payload: z.object({ prompt: text }).strict(),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_document_upload"),
    payload: z.object({ prompt: text, acceptedTypes: z.array(id) }).strict(),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_summary"),
    payload: z.object({ title: text, items: z.array(text) }).strict(),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_confirmation"),
    payload: z.object({ prompt: text, confirmLabel: text }).strict(),
  }).strict(),
  uiBase.extend({
    type: z.literal("show_progress"),
    payload: z.object({ label: text, percent: z.number().min(0).max(100) }).strict(),
  }).strict(),
  uiBase.extend({ type: z.literal("clear_scene"), payload: z.object({}).strict() }).strict(),
]);

export const memoryReadRequestSchema = z.object({
  category: id,
  reason: text,
  required: z.boolean(),
  sensitivityCeiling: memorySensitivitySchema,
  timeRange: z.object({ from: dateTime.optional(), to: dateTime.optional() }).strict().optional(),
}).strict();
export const memoryWriteProposalSchema = z.object({
  category: id,
  value: z.unknown(),
  sensitivity: memorySensitivitySchema,
  reason: text,
  expiry: dateTime.optional(),
  requiresUserConfirmation: z.boolean(),
  target: z.enum(["postgres", "mem0", "working_memory"]),
}).strict();
export const proposedToolCallSchema = z.object({
  proposalId: id,
  toolId: id,
  arguments: record,
  reason: text,
  requiresConfirmation: z.boolean(),
  idempotencyKey: id.optional(),
  expectedResultType: id.optional(),
  riskLevel: specialistRiskLevelSchema,
}).strict();
export const escalationProposalSchema = z.object({
  type: z.enum(["emergency", "caregiver", "operator", "clinician", "technical"]),
  reasonCode: id,
  urgency: z.enum(["routine", "urgent", "immediate"]),
  summary: text,
  targetId: id.optional(),
  requiresConsent: z.boolean(),
  recommendedChannel: z.enum(["voice", "pwa", "telephone", "text", "caregiver", "operator"]).optional(),
}).strict();

const RESERVED_FLOW_PATCH_KEYS = new Set([
  "flowid",
  "flowversion",
  "lifecyclestate",
  "currentstate",
  "expectedinput",
  "pendingtool",
  "interruptedstate",
  "resumemetadata",
  "completionreference",
  "requestid",
  "specialistid",
  "userid",
  "profileid",
  "sessionid",
  "safetycontext",
  "consentcontext",
  "risklevel",
  "safetyflags",
  "escalation",
  "auditmetadata",
  "createdat",
  "updatedat",
]);
const MAX_DOMAIN_PATCH_DEPTH = 5;
const MAX_DOMAIN_PATCH_KEYS = 64;
const MAX_DOMAIN_PATCH_SERIALIZED_LENGTH = 16_384;

function isSafeDomainStatePatch(value: Record<string, unknown>): boolean {
  let keyCount = 0;
  const visited = new WeakSet<object>();
  const inspect = (candidate: unknown, depth: number): boolean => {
    if (!candidate || typeof candidate !== "object") return true;
    if (depth > MAX_DOMAIN_PATCH_DEPTH || visited.has(candidate)) return false;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      return candidate.every((item) => inspect(item, depth + 1));
    }
    for (const [key, child] of Object.entries(candidate)) {
      keyCount += 1;
      if (
        keyCount > MAX_DOMAIN_PATCH_KEYS ||
        RESERVED_FLOW_PATCH_KEYS.has(key.toLowerCase()) ||
        !inspect(child, depth + 1)
      ) {
        return false;
      }
    }
    return true;
  };

  if (!inspect(value, 1)) return false;
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" &&
      serialized.length <= MAX_DOMAIN_PATCH_SERIALIZED_LENGTH;
  } catch {
    return false;
  }
}

export const domainStatePatchSchema = z.record(z.unknown()).superRefine(
  (patch, context) => {
    if (!isSafeDomainStatePatch(patch)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FLOW_PATCH_INVALID",
      });
    }
  },
);

export const specialistFlowStateUpdateSchema = z.object({
  nextLifecycleState: flowLifecycleStateSchema,
  expectedInput: expectedFlowInputSchema.optional(),
  pendingTool: pendingToolSchema.optional(),
  domainStatePatch: domainStatePatchSchema.optional(),
  clearExpectedInput: z.boolean().optional(),
  pauseReason: text.optional(),
  resumeMetadata: resumeMetadataSchema.optional(),
  completionReference: id.optional(),
  reasonCode: id,
}).strict();
export const followUpRecommendationSchema = z.object({
  purpose: text,
  preferredChannel: z.enum(["voice", "pwa", "telephone", "text", "caregiver", "operator"]).optional(),
  fallbackChannels: z.array(z.enum(["voice", "pwa", "telephone", "text", "caregiver", "operator"])),
  requiresConsent: z.boolean(),
  reason: text,
  dueAt: dateTime.optional(),
  delaySeconds: z.number().int().positive().optional(),
  summary: text,
}).strict().refine(
  (value) => Boolean(value.dueAt) !== Boolean(value.delaySeconds),
  { message: "FOLLOWUP_INVALID" },
);

export const specialistResponseSchema = z.object({
  requestId: id,
  specialistId: id,
  status: z.enum([
    "answered", "needs_information", "proposed_action", "complete",
    "blocked", "escalated", "failed",
  ]),
  interpretation: z.object({
    summary: text,
    confidence: z.number().min(0).max(1),
    missingInformation: z.array(text),
  }).strict(),
  nextQuestion: expectedFlowInputSchema.optional(),
  responseGuidance: z.object({
    facts: z.array(text),
    tone: id.optional(),
    acknowledgements: z.array(text).optional(),
    prohibitedClaims: z.array(text),
    requiredDisclaimers: z.array(text).optional(),
    urgency: z.enum(["routine", "prompt", "urgent", "immediate"]),
    brevity: z.enum(["brief", "standard", "detailed"]).optional(),
  }).strict(),
  uiInstructions: z.array(specialistUIInstructionSchema),
  memoryReadsRequested: z.array(memoryReadRequestSchema),
  memoryWritesProposed: z.array(memoryWriteProposalSchema),
  proposedToolCalls: z.array(proposedToolCallSchema),
  riskLevel: specialistRiskLevelSchema,
  safetyFlags: z.array(id),
  escalation: escalationProposalSchema.optional(),
  flowStateUpdate: specialistFlowStateUpdateSchema.optional(),
  completionResult: record.optional(),
  followUpRecommendation: followUpRecommendationSchema.optional(),
  auditMetadata: z.object({
    decisionCodes: z.array(id),
    modelId: id.optional(),
    promptVersion: id.optional(),
    durationMs: z.number().int().nonnegative().optional(),
  }).strict(),
  blockedReason: text.optional(),
  failureCode: id.optional(),
}).strict().superRefine((response, context) => {
  const requireField = (present: boolean, path: string) => {
    if (!present) context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "RESPONSE_STATUS_INVARIANT_FAILED",
      path: [path],
    });
  };
  if (response.status === "needs_information") requireField(Boolean(response.nextQuestion), "nextQuestion");
  if (response.status === "proposed_action") requireField(response.proposedToolCalls.length > 0, "proposedToolCalls");
  if (response.status === "complete") requireField(Boolean(response.completionResult), "completionResult");
  if (response.status === "blocked") requireField(Boolean(response.blockedReason), "blockedReason");
  if (response.status === "escalated") requireField(Boolean(response.escalation), "escalation");
  if (response.status === "failed") requireField(Boolean(response.failureCode), "failureCode");
  const onlyForStatus = (
    present: boolean,
    allowedStatus: typeof response.status,
    path: string,
  ) => {
    if (present && response.status !== allowedStatus) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RESPONSE_STATUS_INVARIANT_FAILED",
        path: [path],
      });
    }
  };
  onlyForStatus(Boolean(response.nextQuestion), "needs_information", "nextQuestion");
  onlyForStatus(response.proposedToolCalls.length > 0, "proposed_action", "proposedToolCalls");
  onlyForStatus(Boolean(response.completionResult), "complete", "completionResult");
  onlyForStatus(Boolean(response.blockedReason), "blocked", "blockedReason");
  onlyForStatus(Boolean(response.escalation), "escalated", "escalation");
  onlyForStatus(Boolean(response.failureCode), "failed", "failureCode");
});

const hiddenKeys = new Set([
  "chainOfThought", "hiddenReasoning", "reasoningTrace", "internalReasoning",
]);
const executionKeys = new Set([
  "execute", "executeNow", "directExecution", "notifyCaregiver",
  "notifyOperator", "writeMemory", "providerErrorStack", "stack",
  "apiKey", "credentials", "secret",
]);
function containsKey(value: unknown, keys: ReadonlySet<string>): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsKey(item, keys));
  return Object.entries(value).some(
    ([key, child]) => keys.has(key) || containsKey(child, keys),
  );
}
function assertSafeBoundary(value: unknown): void {
  if (containsKey(value, hiddenKeys)) {
    throw new OrchestrationContractError("HIDDEN_REASONING_NOT_ALLOWED");
  }
  if (containsKey(value, executionKeys)) {
    throw new OrchestrationContractError("DIRECT_EXECUTION_NOT_ALLOWED");
  }
}
function validationError(
  fallback: OrchestrationContractErrorCode,
  error: z.ZodError,
): never {
  const known = new Set<OrchestrationContractErrorCode>([
    "EMERGENCY_CHECK_REQUIRED", "RESPONSE_STATUS_INVARIANT_FAILED",
    "FOLLOWUP_INVALID", "FLOW_PATCH_INVALID",
  ]);
  const code = error.issues.find(
    (issue) => issue.code === z.ZodIssueCode.custom && known.has(issue.message as OrchestrationContractErrorCode),
  )?.message as OrchestrationContractErrorCode | undefined;
  throw new OrchestrationContractError(code ?? fallback);
}

export function parseSpecialistRequest(input: unknown): SpecialistRequest {
  assertSafeBoundary(input);
  const parsed = specialistRequestSchema.safeParse(input);
  if (!parsed.success) validationError("SPECIALIST_REQUEST_INVALID", parsed.error);
  return parsed.data;
}
export function parseSpecialistResponse(input: unknown): SpecialistResponse {
  assertSafeBoundary(input);
  const parsed = specialistResponseSchema.safeParse(input);
  if (!parsed.success) validationError("SPECIALIST_RESPONSE_INVALID", parsed.error);
  return parsed.data;
}
export function validateSpecialistResponse(
  requestInput: unknown,
  responseInput: unknown,
): SpecialistResponse {
  const request = parseSpecialistRequest(requestInput);
  const response = parseSpecialistResponse(responseInput);
  if (response.requestId !== request.requestId) throw new OrchestrationContractError("REQUEST_ID_MISMATCH");
  if (response.specialistId !== request.specialistId) throw new OrchestrationContractError("SPECIALIST_ID_MISMATCH");
  if (!request.consentContext.memoryReadAllowed && response.memoryReadsRequested.length) {
    throw new OrchestrationContractError("INVALID_MEMORY_PROPOSAL");
  }
  if (!request.consentContext.memoryWriteAllowed && response.memoryWritesProposed.length) {
    throw new OrchestrationContractError("INVALID_MEMORY_PROPOSAL");
  }
  for (const proposal of response.memoryWritesProposed) {
    if (proposal.category.toLowerCase().includes("reasoning")) {
      throw new OrchestrationContractError("HIDDEN_REASONING_NOT_ALLOWED");
    }
    if (["sensitive", "restricted"].includes(proposal.sensitivity) &&
        !proposal.requiresUserConfirmation) {
      throw new OrchestrationContractError("INVALID_MEMORY_PROPOSAL");
    }
  }
  const tools = new Map(request.availableTools.map((tool) => [tool.toolId, tool]));
  for (const proposal of response.proposedToolCalls) {
    const descriptor = tools.get(proposal.toolId);
    if (!descriptor) throw new OrchestrationContractError("TOOL_NOT_AVAILABLE");
    if (descriptor.requiresConfirmation && !proposal.requiresConfirmation) {
      throw new OrchestrationContractError("TOOL_CONFIRMATION_CANNOT_BE_WEAKENED");
    }
    if (descriptor.requiresConsent && !request.consentContext.externalToolUseAllowed) {
      throw new OrchestrationContractError("TOOL_CONSENT_NOT_ALLOWED");
    }
    if (descriptor.idempotencyRequired && !proposal.idempotencyKey) {
      throw new OrchestrationContractError("TOOL_IDEMPOTENCY_REQUIRED");
    }
    if (!descriptor.allowedRiskLevels.includes(proposal.riskLevel)) {
      throw new OrchestrationContractError("TOOL_NOT_AVAILABLE");
    }
  }
  if (!request.consentContext.channelAllowed && response.proposedToolCalls.length) {
    throw new OrchestrationContractError("TOOL_CONSENT_NOT_ALLOWED");
  }
  if (request.safetyContext.deterministicSafetyResult === "emergency" &&
      (response.riskLevel !== "emergency" || response.status !== "escalated")) {
    throw new OrchestrationContractError("SPECIALIST_RESPONSE_INVALID");
  }
  if (response.escalation?.type === "caregiver" &&
      !request.consentContext.caregiverEscalationAllowed) {
    throw new OrchestrationContractError("ESCALATION_PROPOSAL_INVALID");
  }
  if (response.escalation?.type === "operator" &&
      !request.consentContext.operatorEscalationAllowed) {
    throw new OrchestrationContractError("ESCALATION_PROPOSAL_INVALID");
  }
  if (
    response.escalation &&
    ["caregiver", "operator"].includes(response.escalation.type) &&
    !response.escalation.requiresConsent
  ) {
    throw new OrchestrationContractError("ESCALATION_PROPOSAL_INVALID");
  }
  if (response.flowStateUpdate) {
    const update = response.flowStateUpdate;
    if (!canTransition(request.currentState, update.nextLifecycleState) ||
        Boolean(update.expectedInput) !== (update.nextLifecycleState === "waiting_for_user") ||
        Boolean(update.pendingTool) !== (update.nextLifecycleState === "waiting_for_tool") ||
        Boolean(update.expectedInput && update.pendingTool) ||
        Boolean(update.expectedInput && update.clearExpectedInput)) {
      throw new OrchestrationContractError("FLOW_UPDATE_INVALID");
    }
    if (update.pendingTool) {
      const proposal = response.proposedToolCalls.find(
        (candidate) =>
          candidate.toolId === update.pendingTool?.toolId &&
          candidate.proposalId === update.pendingTool.requestId,
      );
      if (!proposal) {
        throw new OrchestrationContractError("FLOW_UPDATE_INVALID");
      }
    }
  }
  return response;
}

export type SpecialistRiskLevel = z.infer<typeof specialistRiskLevelSchema>;
export type SpecialistToolDescriptor = z.infer<typeof specialistToolDescriptorSchema>;
export type SpecialistRequest = z.infer<typeof specialistRequestSchema>;
export type SpecialistUIInstruction = z.infer<typeof specialistUIInstructionSchema>;
export type ProposedToolCall = z.infer<typeof proposedToolCallSchema>;
export type MemoryReadRequest = z.infer<typeof memoryReadRequestSchema>;
export type MemoryWriteProposal = z.infer<typeof memoryWriteProposalSchema>;
export type SpecialistResponse = z.infer<typeof specialistResponseSchema>;
