import {
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
} from "./conciergeFlowRegistry";
import type {
  ConciergeExecutionActionType,
  ConciergeExecutionTask,
} from "./conciergeActionExecution";
import type {
  ConciergeProviderReplySnapshot,
  ConciergeProviderTaskStatus,
} from "./conciergeProviderReplies";

export const CONCIERGE_CANVAS_STATES = [
  "collecting",
  "ready_to_review",
  "awaiting_confirmation",
  "in_progress",
  "needs_user_input",
  "completed",
  "failed",
] as const;

export type ConciergeCanvasState = typeof CONCIERGE_CANVAS_STATES[number];

export type ConciergeCanvasActionLabel =
  | "Add detail"
  | "Review"
  | "Confirm"
  | "Continue"
  | "Respond"
  | "Save"
  | "Try another way";

export type ConciergeCanvasFlowKind =
  | "ride"
  | "home_service"
  | "otc_pharmacy"
  | "shopping"
  | "provider_reply"
  | "other";

export type ConciergeCanvasStatusInput = {
  status?: string | null;
  useCase?: string | null;
  flowReference?: ConciergeFlowReference | string | null;
  executionTask?: Partial<ConciergeExecutionTask> | null;
  actionType?: ConciergeExecutionActionType | string | null;
  hasMissingDetails?: boolean;
  hasReviewSummary?: boolean;
  reviewPresented?: boolean;
  providerReply?: Pick<ConciergeProviderReplySnapshot, "status" | "followUpRequiresConfirmation"> | null;
  providerReplyStatus?: ConciergeProviderTaskStatus | string | null;
  waitingForProvider?: boolean;
  missionStatus?: string | null;
  reconfirmationRequired?: boolean;
};

export type ConciergeCanvasStateSummary = {
  state: ConciergeCanvasState;
  flowKind: ConciergeCanvasFlowKind;
  primaryActionLabel: ConciergeCanvasActionLabel;
  safeExternalActionAllowed: boolean;
  requiresUserConfirmationBeforeExternalAction: boolean;
  reason: string;
};

export type ConciergeCanvasExplainabilityContext = {
  missingDetailLabel?: string | null;
  providerName?: string | null;
  channelLabel?: string | null;
};

export type ConciergeCanvasExplainability = {
  stateLabel: string;
  stateExplanation: string;
  primaryActionLabel: string;
  safetyRule: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown): string {
  return text(value).toLowerCase();
}

export function conciergeCanvasFlowKind(input: Pick<ConciergeCanvasStatusInput, "flowReference" | "useCase" | "actionType">): ConciergeCanvasFlowKind {
  const flowReference = text(input.flowReference);
  const useCase = normalized(input.useCase);
  const actionType = normalized(input.actionType);

  if (flowReference === CONCIERGE_FLOW_REFERENCES.transportBooking || useCase === "book_ride") return "ride";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.homeService || useCase === "home_service") return "home_service";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.otcPharmacy || useCase === "order_medicine") return "otc_pharmacy";
  if (
    flowReference === CONCIERGE_FLOW_REFERENCES.shoppingSupport
    || actionType === "shopping_request"
    || ["shopping_request", "find_offers", "order_food"].includes(useCase)
  ) return "shopping";
  if (useCase === "provider_reply" || actionType === "provider_reply") return "provider_reply";

  return "other";
}

export function conciergeCanvasPrimaryActionLabel(state: ConciergeCanvasState): ConciergeCanvasActionLabel {
  switch (state) {
    case "collecting": return "Add detail";
    case "ready_to_review": return "Review";
    case "awaiting_confirmation": return "Confirm";
    case "in_progress": return "Continue";
    case "needs_user_input": return "Respond";
    case "completed": return "Save";
    case "failed": return "Try another way";
  }
}

export function conciergeCanvasPrimaryActionDisplayLabel(state: ConciergeCanvasState, isSpanish = false): string {
  if (isSpanish) {
    switch (state) {
      case "collecting": return "Anadir dato";
      case "ready_to_review": return "Revisar";
      case "awaiting_confirmation": return "Confirmar";
      case "in_progress": return "Continuar";
      case "needs_user_input": return "Responder";
      case "completed": return "Guardar";
      case "failed": return "Probar otra forma";
    }
  }
  return conciergeCanvasPrimaryActionLabel(state);
}

export function conciergeCanvasStateLabel(state: ConciergeCanvasState, isSpanish = false): string {
  if (isSpanish) {
    switch (state) {
      case "collecting": return "Faltan datos";
      case "ready_to_review": return "Listo para revisar";
      case "awaiting_confirmation": return "Esperando confirmacion";
      case "in_progress": return "En curso";
      case "needs_user_input": return "Necesita respuesta";
      case "completed": return "Completado";
      case "failed": return "Revisar alternativa";
    }
  }

  switch (state) {
    case "collecting": return "Add detail";
    case "ready_to_review": return "Ready to review";
    case "awaiting_confirmation": return "Confirm first";
    case "in_progress": return "In progress";
    case "needs_user_input": return "Needs input";
    case "completed": return "Completed";
    case "failed": return "Try another way";
  }
}

function flowSubject(flowKind: ConciergeCanvasFlowKind, isSpanish: boolean): string {
  if (isSpanish) {
    switch (flowKind) {
      case "ride": return "el viaje";
      case "home_service": return "el servicio";
      case "otc_pharmacy": return "el pedido";
      case "shopping": return "la compra";
      case "provider_reply": return "la respuesta";
      case "other": return "la tarea";
    }
  }

  switch (flowKind) {
    case "ride": return "the ride";
    case "home_service": return "the service";
    case "otc_pharmacy": return "the order";
    case "shopping": return "the purchase";
    case "provider_reply": return "the reply";
    case "other": return "the task";
  }
}

function normalizeExplainabilityInput(
  input: ConciergeCanvasState | ConciergeCanvasStateSummary,
): ConciergeCanvasStateSummary {
  if (typeof input !== "string") return input;
  return {
    state: input,
    flowKind: "other",
    primaryActionLabel: conciergeCanvasPrimaryActionLabel(input),
    safeExternalActionAllowed: false,
    requiresUserConfirmationBeforeExternalAction: input !== "completed",
    reason: "state_only",
  };
}

export function conciergeCanvasExplainability(
  input: ConciergeCanvasState | ConciergeCanvasStateSummary,
  isSpanish = false,
  context: ConciergeCanvasExplainabilityContext = {},
): ConciergeCanvasExplainability {
  const summary = normalizeExplainabilityInput(input);
  const subject = flowSubject(summary.flowKind, isSpanish);
  const provider = text(context.providerName);
  const channel = text(context.channelLabel);
  const missing = text(context.missingDetailLabel);

  let stateExplanation: string;
  if (isSpanish) {
    switch (summary.state) {
      case "collecting":
        stateExplanation = missing
          ? `VYVA necesita ${missing} para preparar ${subject}.`
          : `VYVA necesita un dato mas para preparar ${subject}.`;
        break;
      case "ready_to_review":
        stateExplanation = `Revisa el resumen antes de que VYVA avance con ${subject}.`;
        break;
      case "awaiting_confirmation":
        stateExplanation = `Confirma solo si quieres que VYVA avance con ${subject}.`;
        break;
      case "in_progress":
        stateExplanation = provider
          ? `VYVA esta esperando a ${provider}.`
          : channel
            ? `VYVA esta usando ${channel} para avanzar.`
            : `VYVA esta avanzando con ${subject}.`;
        break;
      case "needs_user_input":
        stateExplanation = provider
          ? `${provider} necesita una respuesta tuya.`
          : "VYVA necesita tu decision para continuar.";
        break;
      case "completed":
        stateExplanation = `El resultado de ${subject} esta guardado para consultarlo o reutilizarlo.`;
        break;
      case "failed":
        stateExplanation = `Esta opcion no funciono; VYVA puede probar otra forma.`;
        break;
    }
  } else {
    switch (summary.state) {
      case "collecting":
        stateExplanation = missing
          ? `VYVA needs ${missing} to prepare ${subject}.`
          : `VYVA needs one more detail to prepare ${subject}.`;
        break;
      case "ready_to_review":
        stateExplanation = `Check the summary before VYVA moves ahead with ${subject}.`;
        break;
      case "awaiting_confirmation":
        stateExplanation = `Confirm only if you want VYVA to move ahead with ${subject}.`;
        break;
      case "in_progress":
        stateExplanation = provider
          ? `VYVA is waiting on ${provider}.`
          : channel
            ? `VYVA is using ${channel} to move this forward.`
            : `VYVA is moving ahead with ${subject}.`;
        break;
      case "needs_user_input":
        stateExplanation = provider
          ? `${provider} needs a decision from you.`
          : "VYVA needs your decision to continue.";
        break;
      case "completed":
        stateExplanation = `The result for ${subject} is saved so you can review or reuse it.`;
        break;
      case "failed":
        stateExplanation = "This option did not work; VYVA can try another way.";
        break;
    }
  }

  return {
    stateLabel: conciergeCanvasStateLabel(summary.state, isSpanish),
    stateExplanation,
    primaryActionLabel: conciergeCanvasPrimaryActionDisplayLabel(summary.state, isSpanish),
    safetyRule: isSpanish
      ? "Nada se llama, envia, reserva ni comparte antes de tu confirmacion."
      : "Nothing is called, sent, booked, or shared before you confirm.",
  };
}

function providerReplyNeedsUserInput(input: ConciergeCanvasStatusInput): boolean {
  const replyStatus = input.providerReply?.status ?? input.providerReplyStatus;
  return replyStatus === "reply_received"
    || replyStatus === "action_needed"
    || input.providerReply?.followUpRequiresConfirmation === true
    || input.reconfirmationRequired === true;
}

export function deriveConciergeCanvasState(input: ConciergeCanvasStatusInput): ConciergeCanvasStateSummary {
  const task = input.executionTask;
  const status = normalized(input.status);
  const lifecycleStatus = normalized(task?.lifecycle_status);
  const missionStatus = normalized(input.missionStatus);
  const flowKind = conciergeCanvasFlowKind({
    flowReference: input.flowReference ?? task?.flow_reference,
    useCase: input.useCase,
    actionType: input.actionType ?? task?.action_type,
  });
  const userConfirmed = task?.user_confirmed === true;
  const channelAllowsExternalAction = task?.channel_readiness?.external_action_allowed === true;
  const externalActionAllowed = task?.external_action_allowed === true && channelAllowsExternalAction;

  let state: ConciergeCanvasState;
  let reason: string;

  if (status === "failed" || lifecycleStatus === "failed") {
    state = "failed";
    reason = "task_failed";
  } else if (status === "completed" || status === "done" || lifecycleStatus === "done") {
    state = "completed";
    reason = "task_completed";
  } else if (providerReplyNeedsUserInput(input)) {
    state = "needs_user_input";
    reason = "provider_reply_or_reconfirmation";
  } else if (
    status === "calling"
    || lifecycleStatus === "in_progress"
    || input.waitingForProvider === true
    || missionStatus.includes("awaiting_provider")
    || missionStatus.includes("contacting")
  ) {
    state = "in_progress";
    reason = "external_step_in_progress";
  } else if (
    input.hasMissingDetails === true
    || lifecycleStatus === "needs_info"
    || (Array.isArray(task?.missing_requirements) && task.missing_requirements.length > 0)
  ) {
    state = "collecting";
    reason = "missing_details";
  } else if (!userConfirmed && input.reviewPresented === true) {
    state = "awaiting_confirmation";
    reason = "review_presented_without_confirmation";
  } else if (!userConfirmed) {
    state = "ready_to_review";
    reason = "ready_for_review";
  } else {
    state = "in_progress";
    reason = "confirmed_ready_to_execute";
  }

  return {
    state,
    flowKind,
    primaryActionLabel: conciergeCanvasPrimaryActionLabel(state),
    safeExternalActionAllowed: state === "in_progress" && userConfirmed && externalActionAllowed,
    requiresUserConfirmationBeforeExternalAction: !userConfirmed,
    reason,
  };
}
