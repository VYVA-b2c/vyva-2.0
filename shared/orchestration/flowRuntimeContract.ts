import { z } from "zod";
import { FLOW_LIFECYCLE_STATES, type FlowLifecycleState } from "./flowState";
import type { FlowDefinition } from "./flowCatalogue";
import type { PresentationDefinition } from "./presentationRegistry";

const stableIdSchema = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/).max(240);
const namespaceIdSchema = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/).max(160);
const semverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const boundedTextSchema = z.string().min(1).max(2_000);

const unique = <T extends z.ZodTypeAny>(item: T, minimum = 0) =>
  z.array(item).min(minimum).superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate values" });
    }
  });

export const FLOW_RUNTIME_PRESENTATION_PATTERNS = [
  "voice_orb_idle",
  "voice_orb_connecting",
  "voice_orb_listening",
  "voice_orb_speaking",
  "touch_card_menu",
  "guided_choice",
  "guided_form",
  "progress_status",
  "review_confirm",
  "result_summary",
  "safe_fallback",
  "handoff_status",
] as const;

export const FLOW_RUNTIME_APPROVAL_GATES = [
  "none",
  "user_confirmation",
  "caregiver_approval",
  "operator_handoff",
  "clinical_escalation",
] as const;

export const FLOW_RUNTIME_INTERRUPTION_KINDS = [
  "sos",
  "caregiver",
  "safety",
  "stop",
  "timeout",
  "mode_switch",
] as const;

export const FLOW_RUNTIME_LIFECYCLE_STATES = [
  "idle",
  "collecting",
  "confirming",
  "active",
  "interrupted",
  "resumable",
  "complete",
  "error",
] as const;

export const FLOW_RUNTIME_ALIGNMENT_CLASSIFICATIONS = [
  "ALIGNED",
  "DOC GAP",
  "IMPLEMENTATION GAP",
  "CONFLICT",
  "UNRESOLVED",
] as const;

export const FLOW_RUNTIME_MODALITIES = ["voice", "touch", "text"] as const;

export const FLOW_RUNTIME_DEFERRED_CHANGE_IDS = [
  "global_flow_engine",
  "new_specialist_registry",
  "runtime_activation",
  "frontend_authority",
  "voice_specific_state_machine",
  "touch_specific_state_machine",
  "parallel_active_flows",
  "persistent_ui_state",
  "mem0_flow_authority",
  "caregiver_support_authority",
  "external_contact_execution",
  "booking_payment_order_execution",
  "clinical_medication_authority",
  "clinical_mental_health_authority",
  "proactive_delivery_execution",
] as const;

export type FlowRuntimePresentationPattern =
  (typeof FLOW_RUNTIME_PRESENTATION_PATTERNS)[number];
export type FlowRuntimeApprovalGate =
  (typeof FLOW_RUNTIME_APPROVAL_GATES)[number];
export type FlowRuntimeInterruptionKind =
  (typeof FLOW_RUNTIME_INTERRUPTION_KINDS)[number];
export type FlowRuntimeMode = "voice" | "touch" | "text" | "telephone";
export type FlowRuntimeStateScope = "persisted" | "transient";
export type FlowRuntimeCopyDensity = "heading_only" | "brief_helper" | "full";

export type FlowRuntimeLifecycleState = (typeof FLOW_RUNTIME_LIFECYCLE_STATES)[number];
export type FlowRuntimeAlignmentClassification =
  (typeof FLOW_RUNTIME_ALIGNMENT_CLASSIFICATIONS)[number];
export type FlowRuntimeModality = (typeof FLOW_RUNTIME_MODALITIES)[number];
export type FlowRuntimeDeferredChangeId = (typeof FLOW_RUNTIME_DEFERRED_CHANGE_IDS)[number];

export interface FlowRuntimeStateField {
  key: string;
  scope: FlowRuntimeStateScope;
  purpose: string;
  required: boolean;
}

export interface FlowRuntimePresentationBinding {
  presentationId: PresentationDefinition["presentationId"];
  sceneId: PresentationDefinition["sceneId"];
  pattern: FlowRuntimePresentationPattern;
  modes: readonly FlowRuntimeMode[];
  mobileCopy: FlowRuntimeCopyDensity;
  largerScreenCopy: FlowRuntimeCopyDensity;
}

export interface FlowRuntimeToolBoundary {
  canExecuteExternalActions: boolean;
  allowedToolIds: readonly string[];
  requiresConfirmationBeforeExternalAction: boolean;
}

export interface FlowRuntimePresentationContract {
  flowId: FlowDefinition["flowId"];
  flowVersion: FlowDefinition["version"];
  ownerSpecialistId: FlowDefinition["ownerSpecialistId"];
  lifecycle: {
    start: FlowLifecycleState;
    terminal: readonly FlowLifecycleState[];
    resumable: readonly FlowLifecycleState[];
  };
  state: readonly FlowRuntimeStateField[];
  presentation: readonly FlowRuntimePresentationBinding[];
  tools: FlowRuntimeToolBoundary;
  approvalGate: FlowRuntimeApprovalGate;
  interruptionKinds: readonly FlowRuntimeInterruptionKind[];
  notes: string;
}

/**
 * Compatibility alias for PR #1043 callers.
 *
 * Task 20 keeps the name available, but the shape is presentation-binding
 * metadata subordinate to the canonical Central-Orchestrator Flow contract.
 */
export type FlowRuntimeContract = FlowRuntimePresentationContract;

function hasDuplicateStrings(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function getFlowRuntimePresentationContractIssues(
  contract: FlowRuntimePresentationContract,
): string[] {
  const issues: string[] = [];
  const stateKeys = contract.state.map((field) => field.key);

  if (hasDuplicateStrings(stateKeys)) {
    issues.push("duplicate runtime state field keys");
  }

  for (const binding of contract.presentation) {
    if (!binding.presentationId.trim()) {
      issues.push("presentation binding must include a presentation ID");
    }
    if (!binding.sceneId.trim()) {
      issues.push("presentation binding must include a scene ID");
    }
    if (binding.modes.length === 0) {
      issues.push(`${binding.presentationId} must support at least one runtime mode`);
    }
    if (
      binding.pattern.startsWith("voice_orb") &&
      !binding.modes.includes("voice")
    ) {
      issues.push(`${binding.pattern} requires voice mode`);
    }
    if (
      binding.pattern === "touch_card_menu" &&
      !binding.modes.includes("touch")
    ) {
      issues.push("touch_card_menu requires touch mode");
    }
  }

  if (contract.tools.canExecuteExternalActions) {
    if (!contract.tools.requiresConfirmationBeforeExternalAction) {
      issues.push("external actions require confirmation before execution");
    }
    if (contract.approvalGate === "none") {
      issues.push("external actions require an approval gate");
    }
    if (contract.tools.allowedToolIds.length === 0) {
      issues.push("external actions require at least one allowed tool ID");
    }
  }

  if (hasDuplicateStrings(contract.tools.allowedToolIds)) {
    issues.push("duplicate allowed tool IDs");
  }

  return issues;
}

export function defineFlowRuntimePresentationContract(
  contract: FlowRuntimePresentationContract,
): FlowRuntimePresentationContract {
  return contract;
}

export function assertFlowRuntimePresentationContract(
  contract: FlowRuntimePresentationContract,
): FlowRuntimePresentationContract {
  const issues = getFlowRuntimePresentationContractIssues(contract);
  if (issues.length > 0) {
    throw new Error(`Invalid Flow runtime presentation contract: ${issues.join("; ")}`);
  }
  return contract;
}

export { getFlowRuntimePresentationContractIssues };

export const defineFlowRuntimeContract = defineFlowRuntimePresentationContract;
export const assertFlowRuntimeContract = assertFlowRuntimePresentationContract;
export const getFlowRuntimeContractIssues = getFlowRuntimePresentationContractIssues;

export const flowRuntimePresentationPatternSchema = z.enum(FLOW_RUNTIME_PRESENTATION_PATTERNS);
export const flowRuntimeApprovalGateSchema = z.enum(FLOW_RUNTIME_APPROVAL_GATES);
export const flowRuntimeInterruptionKindSchema = z.enum(FLOW_RUNTIME_INTERRUPTION_KINDS);
export const flowRuntimeLifecycleStateSchema = z.enum(FLOW_RUNTIME_LIFECYCLE_STATES);
export const flowRuntimeAlignmentClassificationSchema = z.enum(
  FLOW_RUNTIME_ALIGNMENT_CLASSIFICATIONS,
);
export const flowRuntimeModalitySchema = z.enum(FLOW_RUNTIME_MODALITIES);
export const flowRuntimeDeferredChangeIdSchema = z.enum(FLOW_RUNTIME_DEFERRED_CHANGE_IDS);
export const flowRuntimeTask1LifecycleStateSchema = z.enum(FLOW_LIFECYCLE_STATES);

export const FLOW_RUNTIME_TO_TASK1_LIFECYCLE_STATE_MAP = {
  idle: ["idle"],
  collecting: ["waiting_for_user"],
  confirming: ["active", "waiting_for_user"],
  active: ["initializing", "active", "waiting_for_tool"],
  interrupted: ["interrupted"],
  resumable: ["paused", "resuming"],
  complete: ["completed"],
  error: ["failed", "cancelled", "expired", "escalated"],
} as const satisfies Record<FlowRuntimeLifecycleState, readonly FlowLifecycleState[]>;

export const flowRuntimeLifecycleMappingSchema = z.object({
  idle: unique(flowRuntimeTask1LifecycleStateSchema, 1),
  collecting: unique(flowRuntimeTask1LifecycleStateSchema, 1),
  confirming: unique(flowRuntimeTask1LifecycleStateSchema, 1),
  active: unique(flowRuntimeTask1LifecycleStateSchema, 1),
  interrupted: unique(flowRuntimeTask1LifecycleStateSchema, 1),
  resumable: unique(flowRuntimeTask1LifecycleStateSchema, 1),
  complete: unique(flowRuntimeTask1LifecycleStateSchema, 1),
  error: unique(flowRuntimeTask1LifecycleStateSchema, 1),
}).strict();

export const flowRuntimeAuthorityPolicySchema = z.object({
  activeFlowAuthority: z.literal("central_orchestrator"),
  routeSelectionAuthority: z.literal("central_orchestrator"),
  lifecycleTransitionAuthority: z.literal("central_orchestrator"),
  specialistAuthority: z.literal("proposal_only"),
  channelAdapterAuthority: z.literal("channel_adapter"),
  finalResponseAuthority: z.literal("central_orchestrator"),
  toolAuthorizationAuthority: z.literal("central_orchestrator"),
  presentationAuthority: z.literal("projection_only"),
}).strict();

export const flowRuntimeModalityPolicySchema = z.object({
  supportedModalities: unique(flowRuntimeModalitySchema, 3),
  answerSemantics: z.literal("modality_normalized"),
  voiceTouchTextParityRequired: z.literal(true),
  independentModalityFlowIdsAllowed: z.literal(false),
  independentModalityStateAllowed: z.literal(false),
}).strict().superRefine((value, context) => {
  for (const modality of FLOW_RUNTIME_MODALITIES) {
    if (!value.supportedModalities.includes(modality)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `missing required modality ${modality}`,
        path: ["supportedModalities"],
      });
    }
  }
});

export const flowRuntimePresentationAttachmentSchema = z.object({
  presentationRegistryRole: z.literal("projection_only"),
  frontendRole: z.literal("render_only"),
  staleScenePolicy: z.literal("reject"),
  attachedPresentationIds: unique(stableIdSchema),
  duplicateSceneFieldPolicy: z.literal("reject"),
  copyDensityAuthority: z.literal("presentation_registry"),
}).strict();

export const canonicalFlowRuntimeContractSchema = z.object({
  contractId: z.literal("vyva.flow_runtime.central_orchestrator_contract"),
  version: semverSchema,
  runtimeActivation: z.literal("not_approved"),
  lifecycleStates: unique(flowRuntimeLifecycleStateSchema, FLOW_RUNTIME_LIFECYCLE_STATES.length),
  task1StateMapping: flowRuntimeLifecycleMappingSchema,
  authority: flowRuntimeAuthorityPolicySchema,
  modality: flowRuntimeModalityPolicySchema,
  presentationAttachment: flowRuntimePresentationAttachmentSchema,
  persistedStateAuthority: z.literal("postgres_structured_truth"),
  semanticMemoryAuthority: z.literal("optional_non_authoritative_mem0"),
  deferredChanges: unique(flowRuntimeDeferredChangeIdSchema),
  notes: boundedTextSchema,
}).strict().superRefine((value, context) => {
  if (value.lifecycleStates.length !== FLOW_RUNTIME_LIFECYCLE_STATES.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "canonical lifecycle must contain exactly the approved Task 20 states",
      path: ["lifecycleStates"],
    });
  }
  for (const state of FLOW_RUNTIME_LIFECYCLE_STATES) {
    if (!value.lifecycleStates.includes(state)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `missing lifecycle state ${state}`,
        path: ["lifecycleStates"],
      });
    }
    const actualTask1States = value.task1StateMapping[state];
    const expectedTask1States = FLOW_RUNTIME_TO_TASK1_LIFECYCLE_STATE_MAP[state];
    if (
      actualTask1States.length !== expectedTask1States.length ||
      expectedTask1States.some(
        (expectedState, index) => actualTask1States[index] !== expectedState,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `lifecycle mapping for ${state} must match the frozen Task 20 to Task 1 mapping`,
        path: ["task1StateMapping", state],
      });
    }
  }
});

export const CANONICAL_FLOW_RUNTIME_CONTRACT = canonicalFlowRuntimeContractSchema.parse({
  contractId: "vyva.flow_runtime.central_orchestrator_contract",
  version: "1.0.0",
  runtimeActivation: "not_approved",
  lifecycleStates: FLOW_RUNTIME_LIFECYCLE_STATES,
  task1StateMapping: FLOW_RUNTIME_TO_TASK1_LIFECYCLE_STATE_MAP,
  authority: {
    activeFlowAuthority: "central_orchestrator",
    routeSelectionAuthority: "central_orchestrator",
    lifecycleTransitionAuthority: "central_orchestrator",
    specialistAuthority: "proposal_only",
    channelAdapterAuthority: "channel_adapter",
    finalResponseAuthority: "central_orchestrator",
    toolAuthorizationAuthority: "central_orchestrator",
    presentationAuthority: "projection_only",
  },
  modality: {
    supportedModalities: FLOW_RUNTIME_MODALITIES,
    answerSemantics: "modality_normalized",
    voiceTouchTextParityRequired: true,
    independentModalityFlowIdsAllowed: false,
    independentModalityStateAllowed: false,
  },
  presentationAttachment: {
    presentationRegistryRole: "projection_only",
    frontendRole: "render_only",
    staleScenePolicy: "reject",
    attachedPresentationIds: [],
    duplicateSceneFieldPolicy: "reject",
    copyDensityAuthority: "presentation_registry",
  },
  persistedStateAuthority: "postgres_structured_truth",
  semanticMemoryAuthority: "optional_non_authoritative_mem0",
  deferredChanges: FLOW_RUNTIME_DEFERRED_CHANGE_IDS,
  notes:
    "Canonical Task 20 architecture contract. User intent enters the Central Orchestrator, " +
    "which owns one authoritative active Flow, optional Specialist proposals, presentation " +
    "projection, final response, lifecycle, interruption/resume and tool authorization. " +
    "The Task 20 error state is an exception or exit classification; recovery still requires " +
    "explicit Task 1 transition revalidation where the frozen Flow-state contract allows it.",
});

export const flowRuntimeAlignmentRecordSchema = z.object({
  flowName: z.string().min(1).max(160),
  flowId: stableIdSchema,
  flowVersion: semverSchema,
  owner: namespaceIdSchema,
  voiceBehavior: boundedTextSchema,
  touchBehavior: boundedTextSchema,
  presentationIds: unique(stableIdSchema),
  persistedState: z.enum(["none", "documented", "partial", "implemented", "conflict"]),
  temporaryState: z.enum(["none", "ui_only", "documented", "unclear", "conflict"]),
  toolPermissions: z.enum(["none", "proposal_only", "authorized", "unclear", "conflict"]),
  confirmationGates: unique(flowRuntimeApprovalGateSchema),
  interruptions: unique(flowRuntimeInterruptionKindSchema),
  terminalStates: unique(flowRuntimeLifecycleStateSchema, 1),
  classification: flowRuntimeAlignmentClassificationSchema,
  notes: boundedTextSchema.optional(),
}).strict();

export const parallelFlowTaskContractSchema = z.object({
  flowName: z.string().min(1).max(160),
  flowId: stableIdSchema,
  flowVersion: semverSchema,
  owner: namespaceIdSchema,
  voiceBehavior: boundedTextSchema,
  touchBehavior: boundedTextSchema,
  presentationIds: unique(stableIdSchema),
  persistedState: boundedTextSchema,
  temporaryState: boundedTextSchema,
  toolPermissions: boundedTextSchema,
  confirmationGates: unique(flowRuntimeApprovalGateSchema),
  interruptions: unique(flowRuntimeInterruptionKindSchema),
  terminalStates: unique(flowRuntimeLifecycleStateSchema, 1),
  runtimeActivation: z.literal("not_approved"),
}).strict();

export type CanonicalFlowRuntimeContract = z.infer<typeof canonicalFlowRuntimeContractSchema>;
export type FlowRuntimeAlignmentRecord = z.infer<typeof flowRuntimeAlignmentRecordSchema>;
export type ParallelFlowTaskContract = z.infer<typeof parallelFlowTaskContractSchema>;

export function parseCanonicalFlowRuntimeContract(
  input: unknown,
): CanonicalFlowRuntimeContract {
  return canonicalFlowRuntimeContractSchema.parse(input);
}

export function parseFlowRuntimeAlignmentRecord(input: unknown): FlowRuntimeAlignmentRecord {
  return flowRuntimeAlignmentRecordSchema.parse(input);
}

export function parseParallelFlowTaskContract(input: unknown): ParallelFlowTaskContract {
  return parallelFlowTaskContractSchema.parse(input);
}
