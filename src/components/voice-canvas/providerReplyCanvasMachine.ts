export type ProviderReplyCanvasStep =
  | "listening"
  | "context"
  | "reply"
  | "scheduledFor"
  | "details"
  | "review"
  | "saving"
  | "saved"
  | "completing"
  | "completed"
  | "blocked"
  | "cancelled";

export interface ProviderReplyCanvasDraft {
  replyIntentId: string;
  replyIntentLabel: string;
  providerReply: string;
  scheduledFor: string;
  notes: string;
}

export interface ProviderReplyIntent {
  id: string;
  label: string;
  description?: string;
  subtitle?: string;
  providerType?: string;
  purposeLabel?: string;
  confidenceLabel?: string;
  reviewReminder?: string;
  draftOnlyLabel?: string;
  boundaryLabel?: string;
  recommended?: boolean;
  urgent?: boolean;
  voiceAliases?: string[];
}

export interface ProviderReplyCanvasState {
  step: ProviderReplyCanvasStep;
  draft: ProviderReplyCanvasDraft;
  requestId: number;
  revision: number;
  savedSummary?: string;
  resultReference?: string;
  errorMessage?: string;
  retryTarget?: "context" | "reply" | "scheduledFor" | "review" | "saved";
}

export type ProviderReplyCanvasEvent =
  | { type: "START" }
  | { type: "CHOOSE_INTENT"; intent: ProviderReplyIntent; blockedMessage?: string }
  | { type: "CONTINUE_CONTEXT"; requiresIntent?: boolean }
  | { type: "CHANGE_REPLY"; value: string }
  | { type: "CONTINUE_REPLY"; requiresScheduledFor: boolean }
  | { type: "CHANGE_SCHEDULED_FOR"; value: string }
  | { type: "CONTINUE_SCHEDULED_FOR" }
  | { type: "CHANGE_NOTES"; value: string }
  | { type: "CONTINUE_DETAILS" }
  | { type: "BACK" }
  | { type: "CANCEL" }
  | { type: "SAVE_REPLY" }
  | { type: "SAVE_RESOLVE"; requestId: number; summary?: string; reference?: string }
  | { type: "SAVE_REJECT"; requestId: number; message?: string }
  | { type: "COMPLETE" }
  | { type: "COMPLETE_RESOLVE"; requestId: number; reference?: string }
  | { type: "COMPLETE_REJECT"; requestId: number; message?: string }
  | { type: "INVALID_REQUIRED_INFO"; message: string; retryTarget: "context" | "reply" | "scheduledFor" }
  | { type: "RETRY" }
  | { type: "EDIT" };

export const emptyProviderReplyDraft: ProviderReplyCanvasDraft = {
  replyIntentId: "",
  replyIntentLabel: "",
  providerReply: "",
  scheduledFor: "",
  notes: "",
};

export const initialProviderReplyCanvasState: ProviderReplyCanvasState = {
  step: "listening",
  draft: emptyProviderReplyDraft,
  requestId: 0,
  revision: 0,
};

export function isValidProviderReplyScheduledFor(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && !Number.isNaN(new Date(trimmed).getTime());
}

export function providerReplyCanvasReducer(
  state: ProviderReplyCanvasState,
  event: ProviderReplyCanvasEvent,
): ProviderReplyCanvasState {
  switch (event.type) {
    case "START":
      return state.step === "listening" || state.step === "cancelled"
        ? { ...state, step: "context", errorMessage: undefined }
        : state;
    case "CHOOSE_INTENT":
      if (state.step !== "context") return state;
      if (event.intent.urgent) {
        return {
          ...state,
          step: "blocked",
          errorMessage: event.blockedMessage,
          retryTarget: "context",
        };
      }
      return {
        ...state,
        draft: {
          ...state.draft,
          replyIntentId: event.intent.id,
          replyIntentLabel: event.intent.label,
        },
      };
    case "CONTINUE_CONTEXT":
      return state.step === "context" &&
        (!event.requiresIntent || (state.draft.replyIntentId ?? "").trim())
        ? { ...state, step: "reply" }
        : state;
    case "CHANGE_REPLY":
      return state.step === "reply" || state.step === "review"
        ? { ...state, draft: { ...state.draft, providerReply: event.value } }
        : state;
    case "CONTINUE_REPLY":
      return state.step === "reply" && state.draft.providerReply.trim()
        ? { ...state, step: event.requiresScheduledFor ? "scheduledFor" : "details" }
        : state;
    case "CHANGE_SCHEDULED_FOR":
      return state.step === "scheduledFor" || state.step === "review"
        ? { ...state, draft: { ...state.draft, scheduledFor: event.value } }
        : state;
    case "CONTINUE_SCHEDULED_FOR":
      return state.step === "scheduledFor" &&
        isValidProviderReplyScheduledFor(state.draft.scheduledFor)
        ? { ...state, step: "details" }
        : state;
    case "CHANGE_NOTES":
      return state.step === "details" || state.step === "review"
        ? { ...state, draft: { ...state.draft, notes: event.value } }
        : state;
    case "CONTINUE_DETAILS":
      return state.step === "details" ? { ...state, step: "review" } : state;
    case "BACK":
      if (state.step === "context") return { ...state, step: "listening" };
      if (state.step === "reply") return { ...state, step: "context" };
      if (state.step === "scheduledFor") return { ...state, step: "reply" };
      if (state.step === "details") {
        return {
          ...state,
          step: state.draft.scheduledFor ? "scheduledFor" : "reply",
        };
      }
      if (state.step === "review") {
        return {
          ...state,
          step: state.draft.scheduledFor ? "details" : "details",
        };
      }
      return state;
    case "CANCEL":
      return ["saving", "saved", "completing", "completed"].includes(state.step)
        ? state
        : { ...state, step: "cancelled" };
    case "SAVE_REPLY":
      return state.step === "review" && state.draft.providerReply.trim()
        ? {
            ...state,
            step: "saving",
            requestId: state.requestId + 1,
            errorMessage: undefined,
            retryTarget: undefined,
          }
        : state;
    case "SAVE_RESOLVE":
      return state.step === "saving" && event.requestId === state.requestId
        ? {
            ...state,
            step: "saved",
            savedSummary: event.summary,
            resultReference: event.reference,
          }
        : state;
    case "SAVE_REJECT":
      return state.step === "saving" && event.requestId === state.requestId
        ? {
            ...state,
            step: "blocked",
            errorMessage: event.message,
            retryTarget: "review",
          }
        : state;
    case "COMPLETE":
      return state.step === "saved"
        ? {
            ...state,
            step: "completing",
            requestId: state.requestId + 1,
            errorMessage: undefined,
            retryTarget: undefined,
          }
        : state;
    case "COMPLETE_RESOLVE":
      return state.step === "completing" && event.requestId === state.requestId
        ? {
            ...state,
            step: "completed",
            resultReference: event.reference ?? state.resultReference,
          }
        : state;
    case "COMPLETE_REJECT":
      return state.step === "completing" && event.requestId === state.requestId
        ? {
            ...state,
            step: "blocked",
            errorMessage: event.message,
            retryTarget: "saved",
          }
        : state;
    case "INVALID_REQUIRED_INFO":
      return state.step === "reply" || state.step === "scheduledFor"
        ? {
            ...state,
            step: "blocked",
            errorMessage: event.message,
            retryTarget: event.retryTarget,
          }
        : state;
    case "RETRY":
      return state.step === "blocked"
        ? {
            ...state,
            step: state.retryTarget ?? "review",
            errorMessage: undefined,
          }
        : state;
    case "EDIT":
      return state.step === "saved"
        ? {
            ...state,
            step: "reply",
            revision: state.revision + 1,
            savedSummary: undefined,
          }
        : state;
  }
}

export function isRestorableProviderReplyCanvasState(
  value: unknown,
): value is ProviderReplyCanvasState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ProviderReplyCanvasState>;
  const draft = state.draft as Partial<ProviderReplyCanvasDraft> | undefined;
  return (
    typeof state.requestId === "number" &&
    typeof state.revision === "number" &&
    typeof state.step === "string" &&
    !!draft &&
    (typeof draft.replyIntentId === "string" || draft.replyIntentId === undefined) &&
    (typeof draft.replyIntentLabel === "string" || draft.replyIntentLabel === undefined) &&
    typeof draft.providerReply === "string" &&
    typeof draft.scheduledFor === "string" &&
    typeof draft.notes === "string" &&
    [
      "listening",
      "context",
      "reply",
      "scheduledFor",
      "details",
      "review",
      "saved",
      "blocked",
      "cancelled",
    ].includes(state.step)
  );
}
