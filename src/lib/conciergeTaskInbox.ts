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
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";

export type ConciergeTaskInboxGroup = "needs_you" | "waiting" | "completed";

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
  details: ConciergeTaskInboxDetail[];
  completedTemplate: ConciergeTaskCompletedSession | null;
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
  if (action === "mark_complete") return isSpanish ? "Marcaste esta tarea como completada." : "You marked this task complete.";

  const resolution = conciergeProviderReplySnapshot(payload)?.resolution;
  if (resolution?.decision?.action === "confirm") return isSpanish ? "Elegiste confirmar la propuesta." : "You chose to confirm the offer.";
  if (resolution?.decision?.action === "answer_provider") return isSpanish ? "Elegiste responder al proveedor." : "You chose to answer the provider.";
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
}): ConciergeTaskInboxItem {
  const { draft, pending, isSpanish } = input;
  const payload = pending?.action_payload ?? null;
  const snapshot = conciergeProviderReplySnapshot(payload);
  const group = pending ? groupForPending(pending, snapshot?.status ?? null) : "needs_you";
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
    primaryActionLabel: primaryActionCopy(group, snapshot?.status ?? null, isSpanish),
    reply: snapshot?.reply || null,
    decisionSummary: decisionCopy(payload, isSpanish),
    outcomeSummary: null,
    missingInformation: snapshot?.resolution?.missingInformation ?? [],
    details: detailsFor(providerName, payload, updatedAt, isSpanish),
    completedTemplate: null,
  };
}

function completedItem(
  session: ConciergeTaskCompletedSession,
  isSpanish: boolean,
): ConciergeTaskInboxItem {
  const payload = session.outcome_payload;
  const snapshot = conciergeProviderReplySnapshot(payload, { completed: true });
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
    primaryActionLabel: primaryActionCopy("completed", "done", isSpanish),
    reply: snapshot?.reply || null,
    decisionSummary: decisionCopy(payload, isSpanish),
    outcomeSummary,
    missingInformation: [],
    details: detailsFor(providerName, payload, session.completed_at, isSpanish),
    completedTemplate: session,
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
}): ConciergeTaskInbox {
  const isSpanish = input.isSpanish ?? false;
  const pendingById = new Map(input.pending.map((item) => [item.id, item]));
  const linkedPendingIds = new Set<string>();
  const activeItems = input.drafts.map((draft) => {
    const pending = draft.linked_pending_id ? pendingById.get(draft.linked_pending_id) ?? null : null;
    if (pending) linkedPendingIds.add(pending.id);
    return activeItem({ draft, pending, isSpanish });
  });
  for (const pending of input.pending) {
    if (!linkedPendingIds.has(pending.id)) activeItems.push(activeItem({ draft: null, pending, isSpanish }));
  }

  return {
    needs_you: activeItems.filter((item) => item.group === "needs_you").sort(sortNewest),
    waiting: activeItems.filter((item) => item.group === "waiting").sort(sortNewest),
    completed: input.completed
      .filter((session) => session.outcome === "completed" || Boolean(session.completed_at))
      .map((session) => completedItem(session, isSpanish))
      .sort(sortNewest),
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
