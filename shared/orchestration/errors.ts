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

