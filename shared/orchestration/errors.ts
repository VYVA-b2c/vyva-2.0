export const ORCHESTRATION_CONTRACT_ERROR_CODES = [
  "STALE_QUESTION",
  "STALE_SCENE",
  "STALE_FLOW_VERSION",
  "INVALID_MODALITY",
  "OPTION_NOT_ALLOWED",
  "ANSWER_ID_NOT_ALLOWED",
  "ANSWER_ID_REQUIRED",
  "INVALID_VALUE",
  "INVALID_ASSET_REFERENCE",
  "INVALID_MIME_TYPE",
  "UNEXPECTED_EXPECTED_INPUT",
  "MISSING_EXPECTED_INPUT",
  "INVALID_STATE_TRANSITION",
  "INVALID_EVENT_SOURCE",
  "INVALID_EVENT_MODALITY",
  "INVALID_EVENT_TRIGGER",
  "INVALID_EVENT_PAYLOAD",
  "MISSING_INTERRUPTED_STATE",
  "MISSING_PENDING_TOOL",
  "TERMINAL_STATE_HAS_EXPECTED_INPUT",
  "IDLE_STATE_HAS_ACTIVE_FLOW_DATA",
  "SPECIALIST_REQUEST_INVALID",
  "SPECIALIST_RESPONSE_INVALID",
  "REQUEST_ID_MISMATCH",
  "SPECIALIST_ID_MISMATCH",
  "EMERGENCY_CHECK_REQUIRED",
  "RESPONSE_STATUS_INVARIANT_FAILED",
  "TOOL_NOT_AVAILABLE",
  "TOOL_CONFIRMATION_CANNOT_BE_WEAKENED",
  "TOOL_CONSENT_NOT_ALLOWED",
  "TOOL_IDEMPOTENCY_REQUIRED",
  "INVALID_MEMORY_PROPOSAL",
  "DIRECT_EXECUTION_NOT_ALLOWED",
  "ESCALATION_PROPOSAL_INVALID",
  "FLOW_UPDATE_INVALID",
  "FLOW_PATCH_INVALID",
  "FOLLOWUP_INVALID",
  "HIDDEN_REASONING_NOT_ALLOWED",
] as const;

export type OrchestrationContractErrorCode =
  typeof ORCHESTRATION_CONTRACT_ERROR_CODES[number];

const SAFE_ERROR_MESSAGES: Record<OrchestrationContractErrorCode, string> = {
  STALE_QUESTION: "The answer does not match the active question.",
  STALE_SCENE: "The answer does not match the active scene.",
  STALE_FLOW_VERSION: "The answer does not match the active flow version.",
  INVALID_MODALITY: "The submitted modality is not allowed.",
  OPTION_NOT_ALLOWED: "The submitted option is not allowed.",
  ANSWER_ID_NOT_ALLOWED: "An answer ID is not allowed for this input.",
  ANSWER_ID_REQUIRED: "An answer ID is required for this input.",
  INVALID_VALUE: "The submitted value is invalid.",
  INVALID_ASSET_REFERENCE: "The asset reference is invalid.",
  INVALID_MIME_TYPE: "The asset content type is not allowed.",
  UNEXPECTED_EXPECTED_INPUT: "Expected input is not allowed in this state.",
  MISSING_EXPECTED_INPUT: "Expected input is required in this state.",
  INVALID_STATE_TRANSITION: "The flow state transition is not allowed.",
  INVALID_EVENT_SOURCE: "The event source is not allowed for this event type.",
  INVALID_EVENT_MODALITY: "The event modality is not allowed for this event type.",
  INVALID_EVENT_TRIGGER: "The event trigger is not allowed for this event type.",
  INVALID_EVENT_PAYLOAD: "The event payload is invalid for this event type.",
  MISSING_INTERRUPTED_STATE: "Interrupted flow state requires resume metadata.",
  MISSING_PENDING_TOOL: "Waiting-for-tool state requires pending-tool metadata.",
  TERMINAL_STATE_HAS_EXPECTED_INPUT: "A terminal flow state cannot retain expected input.",
  IDLE_STATE_HAS_ACTIVE_FLOW_DATA: "An idle flow cannot retain active-flow data.",
  SPECIALIST_REQUEST_INVALID: "The specialist request is invalid.",
  SPECIALIST_RESPONSE_INVALID: "The specialist response is invalid.",
  REQUEST_ID_MISMATCH: "The specialist response request identifier does not match.",
  SPECIALIST_ID_MISMATCH: "The specialist response specialist identifier does not match.",
  EMERGENCY_CHECK_REQUIRED: "A deterministic emergency check is required before specialist invocation.",
  RESPONSE_STATUS_INVARIANT_FAILED: "The specialist response does not satisfy its status requirements.",
  TOOL_NOT_AVAILABLE: "The specialist proposed a tool that is not available for this request.",
  TOOL_CONFIRMATION_CANNOT_BE_WEAKENED: "The specialist cannot weaken the tool confirmation requirement.",
  TOOL_CONSENT_NOT_ALLOWED: "Consent does not permit the proposed tool call.",
  TOOL_IDEMPOTENCY_REQUIRED: "The proposed tool call requires an idempotency key.",
  INVALID_MEMORY_PROPOSAL: "The specialist memory proposal is invalid.",
  DIRECT_EXECUTION_NOT_ALLOWED: "Specialists may propose actions but may not execute them directly.",
  ESCALATION_PROPOSAL_INVALID: "The specialist escalation proposal is invalid.",
  FLOW_UPDATE_INVALID: "The specialist flow-state update is invalid.",
  FLOW_PATCH_INVALID: "The specialist domain-state patch is invalid.",
  FOLLOWUP_INVALID: "The specialist follow-up recommendation is invalid.",
  HIDDEN_REASONING_NOT_ALLOWED: "Hidden reasoning must not cross the specialist boundary.",
};

export class OrchestrationContractError extends Error {
  readonly code: OrchestrationContractErrorCode;

  constructor(code: OrchestrationContractErrorCode) {
    super(SAFE_ERROR_MESSAGES[code]);
    this.name = "OrchestrationContractError";
    this.code = code;
  }
}

export function contractError(code: OrchestrationContractErrorCode): never {
  throw new OrchestrationContractError(code);
}
