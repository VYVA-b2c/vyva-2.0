import { FLOW_LIFECYCLE_STATES, type FlowLifecycleState } from "./flowState";
import type { FlowDefinition } from "./flowCatalogue";
import type { PresentationDefinition } from "./presentationRegistry";

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

export type FlowRuntimePresentationPattern =
  (typeof FLOW_RUNTIME_PRESENTATION_PATTERNS)[number];
export type FlowRuntimeApprovalGate =
  (typeof FLOW_RUNTIME_APPROVAL_GATES)[number];
export type FlowRuntimeInterruptionKind =
  (typeof FLOW_RUNTIME_INTERRUPTION_KINDS)[number];
export type FlowRuntimeMode = "voice" | "touch" | "text" | "telephone";
export type FlowRuntimeStateScope = "persisted" | "transient";
export type FlowRuntimeCopyDensity = "heading_only" | "brief_helper" | "full";

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

export interface FlowRuntimeContract {
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
  approvalGates: readonly FlowRuntimeApprovalGate[];
  toolBoundary: FlowRuntimeToolBoundary;
  interruptionPolicy: {
    supported: readonly FlowRuntimeInterruptionKind[];
    resumesAfterInterruption: boolean;
    terminalInterruptions: readonly FlowRuntimeInterruptionKind[];
  };
}

export function defineFlowRuntimeContract<T extends FlowRuntimeContract>(contract: T): T {
  return contract;
}

export function getFlowRuntimeContractIssues(contract: FlowRuntimeContract): string[] {
  const issues: string[] = [];
  const lifecycleStates = new Set<string>(FLOW_LIFECYCLE_STATES);
  const stateKeys = new Set<string>();

  if (!contract.flowId) issues.push("flowId is required");
  if (!contract.flowVersion) issues.push("flowVersion is required");
  if (!contract.ownerSpecialistId) issues.push("ownerSpecialistId is required");

  if (!lifecycleStates.has(contract.lifecycle.start)) {
    issues.push(`${contract.flowId}: unknown start lifecycle state`);
  }

  for (const state of [...contract.lifecycle.terminal, ...contract.lifecycle.resumable]) {
    if (!lifecycleStates.has(state)) {
      issues.push(`${contract.flowId}: unknown lifecycle state ${state}`);
    }
  }

  for (const field of contract.state) {
    if (!field.key.trim()) issues.push(`${contract.flowId}: state field key is required`);
    if (stateKeys.has(field.key)) {
      issues.push(`${contract.flowId}: duplicate state field ${field.key}`);
    }
    stateKeys.add(field.key);
  }

  for (const binding of contract.presentation) {
    if (!binding.presentationId.trim()) {
      issues.push(`${contract.flowId}: presentationId is required`);
    }
    if (!binding.sceneId.trim()) {
      issues.push(`${contract.flowId}: sceneId is required`);
    }
    if (binding.modes.length === 0) {
      issues.push(`${contract.flowId}: presentation ${binding.presentationId} needs at least one mode`);
    }
    if (binding.pattern.startsWith("voice_orb") && !binding.modes.includes("voice")) {
      issues.push(`${contract.flowId}: ${binding.pattern} must support voice mode`);
    }
    if (binding.pattern === "touch_card_menu" && !binding.modes.includes("touch")) {
      issues.push(`${contract.flowId}: touch_card_menu must support touch mode`);
    }
  }

  if (
    contract.toolBoundary.canExecuteExternalActions &&
    !contract.toolBoundary.requiresConfirmationBeforeExternalAction
  ) {
    issues.push(`${contract.flowId}: external actions require confirmation`);
  }

  if (
    contract.toolBoundary.canExecuteExternalActions &&
    !contract.approvalGates.some((gate) => (
      gate === "user_confirmation" ||
      gate === "caregiver_approval" ||
      gate === "operator_handoff"
    ))
  ) {
    issues.push(`${contract.flowId}: external actions need an approval gate`);
  }

  return issues;
}

export function assertFlowRuntimeContract(contract: FlowRuntimeContract): FlowRuntimeContract {
  const issues = getFlowRuntimeContractIssues(contract);
  if (issues.length > 0) {
    throw new Error(`Invalid Flow runtime contract:\n${issues.join("\n")}`);
  }
  return contract;
}
