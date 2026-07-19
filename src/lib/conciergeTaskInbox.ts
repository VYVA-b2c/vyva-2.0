import type { ConciergeTaskDraft } from "../../shared/conciergeTaskDrafts";
import {
  conciergeProviderReplySnapshot,
  type ConciergeProviderTaskStatus,
} from "../../shared/conciergeProviderReplies";
import { parseConciergeProviderReplyDecisionHistory } from "../../shared/conciergeProviderReplyResolution";
import {
  conciergeTaskInboxItemPath,
  conciergeTaskResumePath,
  type ConciergeTaskInboxSource,
} from "../../shared/conciergeTaskLinks";
import {
  coerceConciergeTaskEntry,
  conciergeTaskEntrySummary,
  conciergeTaskEntryTitle,
} from "@/lib/conciergeTaskNavigation";
import { apiFetch } from "@/lib/queryClient";
import {
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
} from "../../shared/conciergeFlowRegistry";

export type ConciergeTaskInboxGroup = "needs_you" | "waiting" | "completed";

export type ConciergeTaskContinuationFlow =
  | "ride"
  | "appointment"
  | "home_service"
  | "refill"
  | "shopping"
  | "provider_reply"
  | "provider_contact"
  | "document"
  | "safety_check"
  | "future";

export type ConciergeTaskContinuationState =
  | "draft"
  | "waiting"
  | "needs_info"
  | "ready_to_confirm"
  | "completed"
  | "blocked";

export type ConciergeTaskContinuation = {
  flow: ConciergeTaskContinuationFlow;
  flowLabel: string;
  state: ConciergeTaskContinuationState;
  stateLabel: string;
  sceneLabel: string;
  helperText: string;
  actionLabel: string;
  stale: boolean;
};

export type ConciergeTaskPendingItem = {
  id: string;
  use_case: string;
  provider_name: string | null;
  provider_phone?: string | null;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  status: "pending" | "calling" | "completed" | "failed" | "cancelled" | string;
  language?: string | null;
  confirmed_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  task_path?: string | null;
};

export type ConciergeTaskCompletedSession = {
  id: string;
  pending_id: string | null;
  use_case: string;
  provider_name: string | null;
  outcome: string | null;
  outcome_payload: Record<string, unknown> | null;
  outcome_summary: string | null;
  completed_at: string | null;
};

export type ConciergeTaskInboxDetail = {
  label: string;
  value: string;
};

export type ConciergeTaskInboxItem = {
  key: string;
  source: ConciergeTaskInboxSource;
  id: string;
  draftId: string | null;
  pendingId: string | null;
  group: ConciergeTaskInboxGroup;
  title: string;
  summary: string;
  statusLabel: string;
  providerName: string | null;
  updatedAt: string | null;
  detailPath: string;
  resumePath: string;
  primaryActionLabel: string;
  reply: string | null;
  decisionSummary: string | null;
  outcomeSummary: string | null;
  missingInformation: string[];
  actionPayload: Record<string, unknown> | null;
  details: ConciergeTaskInboxDetail[];
  completedTemplate: ConciergeTaskCompletedSession | null;
  continuation: ConciergeTaskContinuation;
};

export type ConciergeTaskInbox = Record<ConciergeTaskInboxGroup, ConciergeTaskInboxItem[]>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function payloadText(payload: Record<string, unknown> | null | undefined, keys: string[]): string {
  const value = record(payload);
  for (const key of keys) {
    const result = text(value[key]);
    if (result) return result;
  }
  return "";
}

function timestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpired(value: string | null | undefined, nowMs: number): boolean {
  const expiresAt = timestamp(value);
  return expiresAt > 0 && expiresAt <= nowMs;
}

function localized(pair: [string, string], isSpanish: boolean): string {
  return pair[isSpanish ? 1 : 0];
}

function humanizeStep(value: string): string {
  const words = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Details";
}

function flowReferenceFromPayload(
  payload: Record<string, unknown> | null | undefined,
): ConciergeFlowReference | null {
  const flowReference = payloadText(payload, ["flow_reference"]);
  return Object.values(CONCIERGE_FLOW_REFERENCES).includes(flowReference as ConciergeFlowReference)
    ? flowReference as ConciergeFlowReference
    : null;
}

function continuationFlowFor(input: {
  draft: ConciergeTaskDraft | null;
  pending: ConciergeTaskPendingItem | null;
  completed?: ConciergeTaskCompletedSession | null;
  payload: Record<string, unknown> | null | undefined;
}): ConciergeTaskContinuationFlow {
  const { draft, pending, completed, payload } = input;
  const snapshot = conciergeProviderReplySnapshot(payload);
  if (
    snapshot?.reply
    || payload?.provider_reply_resolution
    || payload?.provider_reply_decisions
    || payloadText(payload, ["provider_reply_status", "provider_task_status"])
  ) {
    return "provider_reply";
  }

  const flowReference = flowReferenceFromPayload(payload);
  if (flowReference === CONCIERGE_FLOW_REFERENCES.transportBooking) return "ride";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.medicalAppointment) return "appointment";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.homeService) return "home_service";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.otcPharmacy) return "refill";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.shoppingSupport) return "shopping";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.careNavigation) return "provider_contact";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.insuranceAdmin) return "document";
  if (
    flowReference === CONCIERGE_FLOW_REFERENCES.scamCheck
    || flowReference === CONCIERGE_FLOW_REFERENCES.safeHomeSupport
  ) return "safety_check";

  const useCase = pending?.use_case ?? completed?.use_case ?? "";
  const appointmentType = payloadText(payload, ["appointment_type"]);
  if (draft?.kind === "transport" || useCase === "book_ride") return "ride";
  if (draft?.kind === "appointment" || useCase === "book_appointment") return "appointment";
  if (draft?.kind === "home_service" || useCase === "home_service" || appointmentType === "home-service") return "home_service";
  if (draft?.kind === "otc_pharmacy" || useCase === "order_medicine") return "refill";
  if (useCase === "shopping_request" || useCase === "find_offers") return "shopping";
  if (draft?.kind === "provider_contact" || useCase === "find_provider") return "provider_contact";
  if (draft?.kind === "document" || ["admin_task", "paperwork", "send_message"].includes(useCase)) return "document";
  if (draft?.kind === "scam_review" || useCase === "scam_check") return "safety_check";
  return "future";
}

function flowLabel(flow: ConciergeTaskContinuationFlow, isSpanish: boolean): string {
  const labels: Record<ConciergeTaskContinuationFlow, [string, string]> = {
    ride: ["Ride Canvas", "Canvas de transporte"],
    appointment: ["Appointment Canvas", "Canvas de citas"],
    home_service: ["Home service Canvas", "Canvas del hogar"],
    refill: ["Refill Canvas", "Canvas de farmacia"],
    shopping: ["Shopping Canvas", "Canvas de compras"],
    provider_reply: ["Provider reply", "Respuesta del proveedor"],
    provider_contact: ["Provider search", "Busqueda de proveedor"],
    document: ["Document task", "Tarea de documentos"],
    safety_check: ["Safety check", "Revision de seguridad"],
    future: ["Concierge task", "Tarea de Concierge"],
  };
  return localized(labels[flow], isSpanish);
}

function continuationStateLabel(
  state: ConciergeTaskContinuationState,
  isSpanish: boolean,
  stale: boolean,
): string {
  if (stale) return isSpanish ? "Necesita actualizarse" : "Needs refresh";
  const labels: Record<ConciergeTaskContinuationState, [string, string]> = {
    draft: ["Draft", "Borrador"],
    waiting: ["Waiting", "Esperando"],
    needs_info: ["Needs information", "Necesita datos"],
    ready_to_confirm: ["Ready to confirm", "Lista para confirmar"],
    completed: ["Completed", "Completada"],
    blocked: ["Needs review", "Necesita revision"],
  };
  return localized(labels[state], isSpanish);
}

function continuationActionLabel(input: {
  state: ConciergeTaskContinuationState;
  providerStatus: ConciergeProviderTaskStatus | null;
  stale: boolean;
  isSpanish: boolean;
}): string {
  const { state, providerStatus, stale, isSpanish } = input;
  if (stale) return isSpanish ? "Revisar con cuidado" : "Review safely";
  if (providerStatus === "action_needed") return isSpanish ? "Responder" : "Respond";
  if (providerStatus === "reply_received") return isSpanish ? "Revisar respuesta" : "Review reply";
  if (state === "completed") return isSpanish ? "Usar de nuevo" : "Use again";
  if (state === "waiting") return isSpanish ? "Ver estado" : "View status";
  if (state === "needs_info") return isSpanish ? "Agregar datos" : "Add information";
  if (state === "ready_to_confirm") return isSpanish ? "Revisar y confirmar" : "Review and confirm";
  if (state === "blocked") return isSpanish ? "Revisar tarea" : "Review task";
  return isSpanish ? "Continuar" : "Continue";
}

function continuationHelperText(input: {
  state: ConciergeTaskContinuationState;
  flow: ConciergeTaskContinuationFlow;
  stale: boolean;
  isSpanish: boolean;
}): string {
  const { state, flow, stale, isSpanish } = input;
  if (stale) {
    return isSpanish
      ? "Revisa los datos antes de continuar. Nada se hara sin una confirmacion nueva."
      : "Review the details before continuing. Nothing happens without a fresh confirmation.";
  }
  if (state === "waiting") {
    return isSpanish
      ? "VYVA esta esperando el siguiente estado o respuesta."
      : "VYVA is waiting for the next status or reply.";
  }
  if (state === "needs_info") {
    return flow === "provider_reply"
      ? (isSpanish ? "El proveedor necesita una respuesta antes de seguir." : "The provider needs a reply before this can continue.")
      : (isSpanish ? "Agrega los datos que faltan antes de revisar." : "Add the missing details before review.");
  }
  if (state === "ready_to_confirm") {
    return isSpanish
      ? "Revisa el resumen. La accion externa sigue bloqueada hasta que confirmes."
      : "Review the summary. The external action stays blocked until you confirm.";
  }
  if (state === "completed") {
    return isSpanish
      ? "El resultado quedo guardado en el historial."
      : "The result is saved in history.";
  }
  if (state === "blocked") {
    return isSpanish
      ? "Esta tarea necesita revision antes de continuar."
      : "This task needs review before it can continue.";
  }
  return isSpanish
    ? "Puedes continuar desde donde lo dejaste."
    : "You can continue from where you left off.";
}

function sceneLabelForStep(
  step: string | null | undefined,
  stage: string | null | undefined,
  isSpanish: boolean,
): string {
  const normalized = (step || stage || "details").trim();
  const labels: Record<string, [string, string]> = {
    listening: ["Start", "Inicio"],
    details: ["Details", "Detalles"],
    place: ["Saved place or new address", "Lugar guardado o nueva direccion"],
    pickup: ["Pickup place", "Lugar de recogida"],
    pickup_custom: ["Pickup address", "Direccion de recogida"],
    address: ["Address", "Direccion"],
    location: ["Saved place or new address", "Lugar guardado o nueva direccion"],
    location_custom: ["Address", "Direccion"],
    locationEntry: ["Address", "Direccion"],
    dateTime: ["Date and time", "Fecha y hora"],
    time: ["Date and time", "Fecha y hora"],
    time_custom: ["Custom time", "Hora personalizada"],
    provider: ["Provider", "Proveedor"],
    providerEntry: ["New provider", "Nuevo proveedor"],
    reason: ["Reason", "Motivo"],
    coverage: ["Coverage", "Cobertura"],
    service: ["Service", "Servicio"],
    description: ["Description", "Descripcion"],
    urgency: ["Urgency", "Urgencia"],
    access: ["Access notes", "Notas de acceso"],
    retailer: ["Saved store or new store", "Tienda guardada o nueva tienda"],
    retailerEntry: ["New store", "Nueva tienda"],
    itemName: ["Item", "Producto"],
    itemQuantity: ["Quantity", "Cantidad"],
    moreItems: ["More items", "Mas productos"],
    fulfillment: ["Delivery or pickup", "Entrega o recogida"],
    substitutions: ["Substitutions", "Sustituciones"],
    estimate: ["Estimate", "Estimacion"],
    cost: ["Cost", "Costo"],
    fees: ["Fees", "Comisiones"],
    medication: ["Medication", "Medicamento"],
    medicationEntry: ["Medication name", "Nombre del medicamento"],
    strength: ["Strength", "Dosis"],
    safety: ["Safety check", "Revision de seguridad"],
    quantity: ["Quantity", "Cantidad"],
    notes: ["Notes", "Notas"],
    contact: ["Contact method", "Metodo de contacto"],
    context: ["Context", "Contexto"],
    reply: ["Reply", "Respuesta"],
    scheduledFor: ["Date and time", "Fecha y hora"],
    review: ["Review", "Revisar"],
    option_review: ["Review choice", "Revisar opcion"],
    pending_confirm: ["Final confirmation", "Confirmacion final"],
    waiting: ["Waiting", "Esperando"],
    searching: ["Searching", "Buscando"],
    contacting: ["Contacting", "Contactando"],
    saving: ["Saving", "Guardando"],
    saved: ["Saved result", "Resultado guardado"],
    completed: ["Completed", "Completada"],
    blocked: ["Blocked", "Bloqueada"],
    error: ["Needs attention", "Necesita atencion"],
    cancelled: ["Cancelled", "Cancelada"],
  };
  return localized(labels[normalized] ?? [humanizeStep(normalized), humanizeStep(normalized)], isSpanish);
}

function continuationStateFromDraft(
  draft: ConciergeTaskDraft,
  stale: boolean,
): ConciergeTaskContinuationState {
  if (stale || draft.status === "deleted") return "blocked";
  if (draft.status === "completed") return "completed";
  const step = text(draft.progress_payload.canvasStep);
  const normalized = step || draft.stage;
  if (["review", "option_review", "pending_confirm"].includes(normalized)) return "ready_to_confirm";
  if (["waiting", "searching", "contacting", "saving", "completing"].includes(normalized)) return "waiting";
  if (["blocked", "error", "emergency", "urgent", "cancelled"].includes(normalized)) return "blocked";
  return "draft";
}

function continuationStateFromPending(input: {
  item: ConciergeTaskPendingItem;
  providerStatus: ConciergeProviderTaskStatus | null;
  stale: boolean;
}): ConciergeTaskContinuationState {
  const { item, providerStatus, stale } = input;
  if (stale) return "blocked";
  const status = item.status.toLowerCase();
  const providerReplyStatus = payloadText(item.action_payload, ["provider_reply_status"]).toLowerCase();
  const providerTaskStatus = payloadText(item.action_payload, ["provider_task_status"]).toLowerCase();
  const missionStatus = payloadText(item.action_payload, ["mission_status", "current_step", "status"]).toLowerCase();
  const handoffStatus = payloadText(item.action_payload, ["live_handoff_status", "provider_follow_up_status"]).toLowerCase();
  const lifecycleStatus = payloadText(item.action_payload, ["lifecycle_status"]).toLowerCase();

  if (
    status === "completed"
    || providerStatus === "done"
    || providerTaskStatus === "done"
    || missionStatus === "completed"
    || handoffStatus === "completed"
    || lifecycleStatus === "done"
  ) return "completed";

  if (
    status === "failed"
    || status === "cancelled"
    || missionStatus === "failed"
    || missionStatus === "cancelled"
    || handoffStatus === "failed"
    || handoffStatus === "cancelled"
    || lifecycleStatus === "failed"
    || lifecycleStatus === "cancelled"
  ) return "blocked";

  if (
    providerStatus === "action_needed"
    || providerTaskStatus === "action_needed"
    || providerReplyStatus === "needs_more_info"
    || handoffStatus === "needs_human_help"
    || lifecycleStatus === "needs_info"
  ) return "needs_info";

  if (
    providerStatus === "reply_received"
    || providerTaskStatus === "reply_received"
    || providerReplyStatus === "confirmed"
    || handoffStatus === "ready"
    || item.action_payload?.confirmation_required_before_contact === true
  ) return "ready_to_confirm";

  if (
    providerStatus === "waiting"
    || status === "calling"
    || item.action_payload?.waiting_for_provider === true
    || missionStatus.includes("awaiting_provider")
    || handoffStatus === "waiting"
    || handoffStatus === "sent_or_called"
    || lifecycleStatus === "in_progress"
    || lifecycleStatus === "confirmed"
  ) return "waiting";

  return "ready_to_confirm";
}

function continuationStateFromStep(step: string, stale: boolean): ConciergeTaskContinuationState {
  if (stale) return "blocked";
  const normalized = text(step);
  if (["review", "option_review", "pending_confirm"].includes(normalized)) return "ready_to_confirm";
  if (["waiting", "searching", "contacting", "saving", "completing"].includes(normalized)) return "waiting";
  if (["blocked", "error", "emergency", "urgent", "cancelled"].includes(normalized)) return "blocked";
  return "draft";
}

export function buildLocalConciergeTaskContinuation(input: {
  flow: ConciergeTaskContinuationFlow;
  step: string;
  isSpanish: boolean;
  stale?: boolean;
}): ConciergeTaskContinuation {
  const stale = input.stale ?? false;
  const state = continuationStateFromStep(input.step, stale);
  return {
    flow: input.flow,
    flowLabel: flowLabel(input.flow, input.isSpanish),
    state,
    stateLabel: continuationStateLabel(state, input.isSpanish, stale),
    sceneLabel: sceneLabelForStep(input.step, null, input.isSpanish),
    helperText: continuationHelperText({ state, flow: input.flow, stale, isSpanish: input.isSpanish }),
    actionLabel: continuationActionLabel({ state, providerStatus: null, stale, isSpanish: input.isSpanish }),
    stale,
  };
}

function buildContinuation(input: {
  draft: ConciergeTaskDraft | null;
  pending: ConciergeTaskPendingItem | null;
  completed?: ConciergeTaskCompletedSession | null;
  payload: Record<string, unknown> | null | undefined;
  providerStatus: ConciergeProviderTaskStatus | null;
  stale: boolean;
  isSpanish: boolean;
}): ConciergeTaskContinuation {
  const { draft, pending, completed, payload, providerStatus, stale, isSpanish } = input;
  const flow = continuationFlowFor({ draft, pending, completed, payload });
  const state = completed
    ? "completed"
    : pending
      ? continuationStateFromPending({ item: pending, providerStatus, stale })
      : draft
        ? continuationStateFromDraft(draft, stale)
        : "draft";
  const canvasStep = draft ? text(draft.progress_payload.canvasStep) : "";
  const sceneLabel = completed
    ? sceneLabelForStep("completed", null, isSpanish)
    : pending
      ? sceneLabelForStep(
        providerStatus === "action_needed"
          ? "reply"
          : providerStatus === "reply_received"
            ? "review"
            : state,
        null,
        isSpanish,
      )
      : sceneLabelForStep(canvasStep, draft?.stage ?? null, isSpanish);

  return {
    flow,
    flowLabel: flowLabel(flow, isSpanish),
    state,
    stateLabel: continuationStateLabel(state, isSpanish, stale),
    sceneLabel,
    helperText: continuationHelperText({ state, flow, stale, isSpanish }),
    actionLabel: continuationActionLabel({ state, providerStatus, stale, isSpanish }),
    stale,
  };
}

function titleForUseCase(
  useCase: string,
  payload: Record<string, unknown> | null | undefined,
  isSpanish: boolean,
): string {
  const flowReference = payloadText(payload, ["flow_reference"]);
  const appointmentType = payloadText(payload, ["appointment_type"]);
  if (useCase === "home_service" || appointmentType === "home-service") {
    return isSpanish ? "Servicio para el hogar" : "Home service";
  }
  if (flowReference === CONCIERGE_FLOW_REFERENCES.careNavigation) {
    return isSpanish ? "Opciones de cuidado" : "Care options";
  }
  const labels: Record<string, [string, string]> = {
    book_ride: ["Prepare transport", "Preparar transporte"],
    order_medicine: ["Pharmacy help", "Ayuda de farmacia"],
    book_appointment: ["Prepare an appointment", "Preparar una cita"],
    find_provider: ["Choose a provider", "Elegir un proveedor"],
    admin_task: ["Document help", "Ayuda con documentos"],
    paperwork: ["Document help", "Ayuda con documentos"],
    scam_check: ["Review something suspicious", "Revisar algo sospechoso"],
    send_message: ["Provider message", "Mensaje al proveedor"],
    shopping_request: ["Shopping help", "Ayuda con compras"],
  };
  const label = labels[useCase];
  if (label) return label[isSpanish ? 1 : 0];
  const fallback = useCase.replace(/_/g, " ").trim();
  return fallback ? fallback[0].toUpperCase() + fallback.slice(1) : (isSpanish ? "Tarea de Concierge" : "Concierge task");
}

function groupForPending(
  item: ConciergeTaskPendingItem,
  providerStatus: ConciergeProviderTaskStatus | null,
): ConciergeTaskInboxGroup {
  if (providerStatus === "waiting") return "waiting";
  if (providerStatus === "reply_received" || providerStatus === "action_needed") return "needs_you";
  const missionStatus = payloadText(item.action_payload, ["mission_status", "current_step"]).toLowerCase();
  const handoffStatus = payloadText(item.action_payload, ["live_handoff_status", "provider_follow_up_status"]).toLowerCase();
  if (
    item.status === "calling"
    || item.action_payload?.waiting_for_provider === true
    || missionStatus.includes("awaiting_provider")
    || handoffStatus === "waiting"
    || handoffStatus === "sent_or_called"
  ) {
    return "waiting";
  }
  return "needs_you";
}

function statusCopy(
  group: ConciergeTaskInboxGroup,
  providerStatus: ConciergeProviderTaskStatus | null,
  isSpanish: boolean,
): string {
  if (group === "completed") return isSpanish ? "Completada" : "Completed";
  if (providerStatus === "action_needed") return isSpanish ? "Necesita tu respuesta" : "Needs your reply";
  if (providerStatus === "reply_received") return isSpanish ? "Respuesta recibida" : "Reply received";
  if (group === "waiting") return isSpanish ? "Esperando respuesta" : "Waiting for reply";
  return isSpanish ? "Necesita tu atencion" : "Needs your attention";
}

function primaryActionCopy(
  group: ConciergeTaskInboxGroup,
  providerStatus: ConciergeProviderTaskStatus | null,
  isSpanish: boolean,
): string {
  if (group === "completed") return isSpanish ? "Usar de nuevo" : "Use again";
  if (providerStatus === "action_needed") return isSpanish ? "Responder" : "Respond";
  if (providerStatus === "reply_received") return isSpanish ? "Revisar respuesta" : "Review reply";
  if (group === "waiting") return isSpanish ? "Ver estado" : "View status";
  return isSpanish ? "Continuar" : "Continue";
}

function decisionCopy(
  payload: Record<string, unknown> | null | undefined,
  isSpanish: boolean,
): string | null {
  const history = parseConciergeProviderReplyDecisionHistory(payload?.provider_reply_decisions);
  const latest = history.at(-1);
  if (latest?.summary) return latest.summary;
  const action = latest?.action;
  if (action === "confirm") return isSpanish ? "Elegiste confirmar la propuesta." : "You chose to confirm the offer.";
  if (action === "answer_provider") return isSpanish ? "Elegiste responder al proveedor." : "You chose to answer the provider.";
  if (action === "decline") return isSpanish ? "Elegiste rechazar la propuesta." : "You chose to decline the offer.";
  if (action === "request_alternatives") return isSpanish ? "Pediste otra opcion." : "You asked for another option.";
  if (action === "mark_complete") return isSpanish ? "Marcaste esta tarea como completada." : "You marked this task complete.";

  const resolution = conciergeProviderReplySnapshot(payload)?.resolution;
  if (resolution?.decision?.action === "confirm") return isSpanish ? "Elegiste confirmar la propuesta." : "You chose to confirm the offer.";
  if (resolution?.decision?.action === "answer_provider") return isSpanish ? "Elegiste responder al proveedor." : "You chose to answer the provider.";
  if (resolution?.decision?.action === "decline") return isSpanish ? "Elegiste rechazar la propuesta." : "You chose to decline the offer.";
  if (resolution?.decision?.action === "request_alternatives") return isSpanish ? "Pediste otra opcion." : "You asked for another option.";
  if (resolution?.decision?.action === "mark_complete") return isSpanish ? "Marcaste esta tarea como completada." : "You marked this task complete.";
  return null;
}

function uniqueDetails(details: ConciergeTaskInboxDetail[]): ConciergeTaskInboxDetail[] {
  const seen = new Set<string>();
  return details.filter((detail) => {
    const key = `${detail.label}:${detail.value}`;
    if (!detail.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detailsFor(
  providerName: string | null,
  payload: Record<string, unknown> | null | undefined,
  updatedAt: string | null,
  isSpanish: boolean,
): ConciergeTaskInboxDetail[] {
  const snapshot = conciergeProviderReplySnapshot(payload);
  const resolution = snapshot?.resolution;
  return uniqueDetails([
    ...(providerName ? [{ label: isSpanish ? "Proveedor" : "Provider", value: providerName }] : []),
    ...(resolution?.dateTime ? [{ label: isSpanish ? "Fecha u hora" : "Date or time", value: resolution.dateTime }] : []),
    ...(resolution?.price ? [{ label: isSpanish ? "Precio" : "Price", value: resolution.price }] : []),
    ...(resolution?.referenceNumber ? [{ label: isSpanish ? "Referencia" : "Reference", value: resolution.referenceNumber }] : []),
    ...(updatedAt ? [{ label: isSpanish ? "Ultima actualizacion" : "Last updated", value: updatedAt }] : []),
  ]);
}

function activeItem(input: {
  draft: ConciergeTaskDraft | null;
  pending: ConciergeTaskPendingItem | null;
  isSpanish: boolean;
  nowMs: number;
}): ConciergeTaskInboxItem {
  const { draft, pending, isSpanish, nowMs } = input;
  const payload = pending?.action_payload ?? null;
  const snapshot = conciergeProviderReplySnapshot(payload);
  const stale = isExpired(pending?.expires_at, nowMs);
  const continuation = buildContinuation({
    draft,
    pending,
    payload,
    providerStatus: snapshot?.status ?? null,
    stale,
    isSpanish,
  });
  const legacyGroup = pending ? groupForPending(pending, snapshot?.status ?? null) : "needs_you";
  const group = continuation.state === "waiting"
    ? "waiting"
    : continuation.state === "completed"
      ? "completed"
      : continuation.stale
        ? "needs_you"
        : legacyGroup;
  const entry = coerceConciergeTaskEntry(draft?.entry_payload);
  const source: ConciergeTaskInboxSource = pending ? "pending" : "draft";
  const id = pending?.id ?? draft!.id;
  const updatedAt = pending?.updated_at
    || pending?.confirmed_at
    || draft?.updated_at
    || draft?.created_at
    || null;
  const title = draft
    ? conciergeTaskEntryTitle(entry, isSpanish)
    : titleForUseCase(pending!.use_case, payload, isSpanish);
  const fallbackSummary = draft
    ? conciergeTaskEntrySummary(entry, isSpanish)
    : pending!.action_summary;
  const summary = snapshot?.summary || fallbackSummary || statusCopy(group, snapshot?.status ?? null, isSpanish);
  const providerName = pending?.provider_name?.trim()
    || payloadText(payload, ["provider_name", "pharmacy_name"])
    || null;

  return {
    key: `${source}:${id}`,
    source,
    id,
    draftId: draft?.id ?? null,
    pendingId: pending?.id ?? draft?.linked_pending_id ?? null,
    group,
    title,
    summary,
    statusLabel: statusCopy(group, snapshot?.status ?? null, isSpanish),
    providerName,
    updatedAt,
    detailPath: conciergeTaskInboxItemPath(source, id),
    resumePath: conciergeTaskResumePath(draft?.id ?? pending!.id),
    primaryActionLabel: continuation.actionLabel || primaryActionCopy(group, snapshot?.status ?? null, isSpanish),
    reply: snapshot?.reply || null,
    decisionSummary: decisionCopy(payload, isSpanish),
    outcomeSummary: null,
    missingInformation: snapshot?.resolution?.missingInformation ?? [],
    actionPayload: payload,
    details: detailsFor(providerName, payload, updatedAt, isSpanish),
    completedTemplate: null,
    continuation,
  };
}

function completedItem(
  session: ConciergeTaskCompletedSession,
  isSpanish: boolean,
): ConciergeTaskInboxItem {
  const payload = session.outcome_payload;
  const snapshot = conciergeProviderReplySnapshot(payload, { completed: true });
  const continuation = buildContinuation({
    draft: null,
    pending: null,
    completed: session,
    payload,
    providerStatus: snapshot?.status ?? "done",
    stale: false,
    isSpanish,
  });
  const providerName = session.provider_name?.trim()
    || payloadText(payload, ["provider_name", "pharmacy_name"])
    || null;
  const outcomeSummary = session.outcome_summary?.trim()
    || snapshot?.summary
    || (isSpanish ? "Tarea completada por VYVA." : "Task completed by VYVA.");

  return {
    key: `completed:${session.id}`,
    source: "completed",
    id: session.id,
    draftId: null,
    pendingId: session.pending_id,
    group: "completed",
    title: titleForUseCase(session.use_case, payload, isSpanish),
    summary: outcomeSummary,
    statusLabel: statusCopy("completed", "done", isSpanish),
    providerName,
    updatedAt: session.completed_at,
    detailPath: conciergeTaskInboxItemPath("completed", session.id),
    resumePath: "/concierge",
    primaryActionLabel: continuation.actionLabel || primaryActionCopy("completed", "done", isSpanish),
    reply: snapshot?.reply || null,
    decisionSummary: decisionCopy(payload, isSpanish),
    outcomeSummary,
    missingInformation: [],
    actionPayload: payload,
    details: detailsFor(providerName, payload, session.completed_at, isSpanish),
    completedTemplate: session,
    continuation,
  };
}

function sortNewest(left: ConciergeTaskInboxItem, right: ConciergeTaskInboxItem): number {
  return timestamp(right.updatedAt) - timestamp(left.updatedAt);
}

export function buildConciergeTaskInbox(input: {
  drafts: ConciergeTaskDraft[];
  pending: ConciergeTaskPendingItem[];
  completed: ConciergeTaskCompletedSession[];
  isSpanish?: boolean;
  now?: Date | number | string;
}): ConciergeTaskInbox {
  const isSpanish = input.isSpanish ?? false;
  const nowMs = input.now instanceof Date
    ? input.now.getTime()
    : typeof input.now === "number"
      ? input.now
      : typeof input.now === "string"
        ? Date.parse(input.now)
        : Date.now();
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const pendingById = new Map(input.pending.map((item) => [item.id, item]));
  const linkedPendingIds = new Set<string>();
  const activeItems = input.drafts.map((draft) => {
    const pending = draft.linked_pending_id ? pendingById.get(draft.linked_pending_id) ?? null : null;
    if (pending) linkedPendingIds.add(pending.id);
    return activeItem({ draft, pending, isSpanish, nowMs: safeNowMs });
  });
  for (const pending of input.pending) {
    if (!linkedPendingIds.has(pending.id)) activeItems.push(activeItem({ draft: null, pending, isSpanish, nowMs: safeNowMs }));
  }

  return {
    needs_you: activeItems.filter((item) => item.group === "needs_you").sort(sortNewest),
    waiting: activeItems.filter((item) => item.group === "waiting").sort(sortNewest),
    completed: [
      ...activeItems.filter((item) => item.group === "completed"),
      ...input.completed
        .filter((session) => session.outcome === "completed" || Boolean(session.completed_at))
        .map((session) => completedItem(session, isSpanish)),
    ].sort(sortNewest),
  };
}

export function conciergeTaskInboxItems(inbox: ConciergeTaskInbox): ConciergeTaskInboxItem[] {
  return [...inbox.needs_you, ...inbox.waiting, ...inbox.completed];
}

export function findConciergeTaskInboxItem(
  inbox: ConciergeTaskInbox,
  source: ConciergeTaskInboxSource,
  id: string,
): ConciergeTaskInboxItem | null {
  const items = conciergeTaskInboxItems(inbox);
  return items.find((item) => item.source === source && item.id === id)
    || (source === "pending" ? items.find((item) => item.pendingId === id) : null)
    || null;
}

export async function fetchConciergeTaskPendingItems(): Promise<ConciergeTaskPendingItem[]> {
  const response = await apiFetch("/api/concierge/actions/pending");
  if (!response.ok) throw new Error(`Concierge pending tasks request failed: ${response.status}`);
  return ((await response.json()) as { items?: ConciergeTaskPendingItem[] }).items ?? [];
}

export async function fetchConciergeTaskCompletedSessions(): Promise<ConciergeTaskCompletedSession[]> {
  const response = await apiFetch("/api/concierge/actions/sessions");
  if (!response.ok) throw new Error(`Concierge completed tasks request failed: ${response.status}`);
  return ((await response.json()) as { items?: ConciergeTaskCompletedSession[] }).items ?? [];
}
