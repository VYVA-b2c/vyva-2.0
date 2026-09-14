import {
  isRestorableShoppingCanvasState,
  type ShoppingCanvasState,
} from "@/components/voice-canvas/shoppingCanvasMachine";
import {
  isRestorableRefillState,
  type RefillCanvasState,
} from "@/components/voice-canvas/refillCanvasMachine";
import {
  conciergeTaskInboxItemPath,
  type ConciergeTaskInboxSource,
} from "../../shared/conciergeTaskLinks";
import {
  buildLocalConciergeTaskContinuation,
  type ConciergeTaskInboxGroup,
  type ConciergeTaskInboxItem,
  type ConciergeTaskContinuationFlow,
  type ConciergeTaskContinuationState,
} from "./conciergeTaskInbox";

const LOCAL_SOURCE: ConciergeTaskInboxSource = "draft";
const SHOPPING_STORAGE_KEY = "vyva.shoppingDelivery.v1";
const REFILL_STORAGE_PREFIX = "vyva.refillCanvas.adherence.";

function currentSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function parseStoredJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

function localCanvasGroup(state: ConciergeTaskContinuationState): ConciergeTaskInboxGroup {
  if (state === "waiting") return "waiting";
  if (state === "completed") return "completed";
  return "needs_you";
}

function localCanvasItem(input: {
  id: string;
  title: string;
  summary: string;
  flow: ConciergeTaskContinuationFlow;
  step: string;
  resumePath: string;
  resumeCanvas: "shopping" | "refill";
  isSpanish: boolean;
  details?: Array<{ label: string; value: string }>;
}): ConciergeTaskInboxItem {
  const continuation = buildLocalConciergeTaskContinuation({
    flow: input.flow,
    step: input.step,
    isSpanish: input.isSpanish,
  });
  return {
    key: `${LOCAL_SOURCE}:${input.id}`,
    source: LOCAL_SOURCE,
    id: input.id,
    draftId: null,
    pendingId: null,
    group: localCanvasGroup(continuation.state),
    title: input.title,
    summary: input.summary,
    statusLabel: continuation.stateLabel,
    providerName: null,
    updatedAt: null,
    detailPath: conciergeTaskInboxItemPath(LOCAL_SOURCE, input.id),
    resumePath: input.resumePath,
    primaryActionLabel: continuation.actionLabel,
    reply: null,
    decisionSummary: null,
    outcomeSummary: null,
    missingInformation: [],
    actionPayload: {
      local_canvas_resume: true,
      resume_canvas: input.resumeCanvas,
    },
    details: input.details ?? [],
    completedTemplate: null,
    continuation,
  };
}

function shoppingSummary(state: ShoppingCanvasState, isSpanish: boolean): string {
  const itemCount = state.draft.items.length;
  if (itemCount > 0) {
    return isSpanish
      ? `${itemCount} producto${itemCount === 1 ? "" : "s"} guardado${itemCount === 1 ? "" : "s"}. Revisa antes de preparar cualquier solicitud.`
      : `${itemCount} item${itemCount === 1 ? "" : "s"} saved. Review before preparing any request.`;
  }
  return isSpanish
    ? "Una compra o entrega esta a medio preparar. Nada se ha pedido ni pagado."
    : "A shopping or delivery draft is in progress. Nothing has been ordered or paid.";
}

function shoppingItem(state: ShoppingCanvasState, isSpanish: boolean): ConciergeTaskInboxItem | null {
  if (state.step === "listening" || state.step === "cancelled") return null;
  return localCanvasItem({
    id: "local-canvas-shopping",
    title: isSpanish ? "Compra o entrega" : "Shopping or delivery",
    summary: shoppingSummary(state, isSpanish),
    flow: "shopping",
    step: state.step,
    resumePath: "/concierge/shopping",
    resumeCanvas: "shopping",
    isSpanish,
    details: [{
      label: isSpanish ? "Origen" : "Source",
      value: isSpanish ? "Guardado en este navegador" : "Saved in this browser",
    }],
  });
}

function refillStorageId(key: string): string {
  const suffix = key.slice(REFILL_STORAGE_PREFIX.length).trim() || "active";
  return suffix.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "active";
}

function refillSummary(state: RefillCanvasState, isSpanish: boolean): string {
  if (state.step === "urgent") {
    return isSpanish
      ? "Esta reposicion mostro ayuda urgente. VYVA no llamo ni envio mensajes."
      : "This refill showed urgent-help guidance. VYVA did not call or send messages.";
  }
  if (state.step === "blocked") {
    return isSpanish
      ? "La reposicion necesita revision antes de seguir."
      : "The refill needs review before continuing.";
  }
  return isSpanish
    ? "Una reposicion esta a medio preparar. Nada se ha solicitado ni aprobado."
    : "A refill draft is in progress. Nothing has been requested or approved.";
}

function refillItem(key: string, state: RefillCanvasState, isSpanish: boolean): ConciergeTaskInboxItem | null {
  if (state.step === "listening" || state.step === "cancelled") return null;
  return localCanvasItem({
    id: `local-canvas-refill-${refillStorageId(key)}`,
    title: isSpanish ? "Reposicion de medicamento" : "Medication refill",
    summary: refillSummary(state, isSpanish),
    flow: "refill",
    step: state.step,
    resumePath: "/meds/refills",
    isSpanish,
    details: [{
      label: isSpanish ? "Origen" : "Source",
      value: isSpanish ? "Informe de medicacion" : "Medication report",
    }],
  });
}

export function readLocalConciergeCanvasTaskItems(
  isSpanish: boolean,
  storage = currentSessionStorage(),
): ConciergeTaskInboxItem[] {
  if (!storage) return [];
  const items: ConciergeTaskInboxItem[] = [];

  const shoppingState = parseStoredJson(storage, SHOPPING_STORAGE_KEY);
  if (isRestorableShoppingCanvasState(shoppingState)) {
    const item = shoppingItem(shoppingState, isSpanish);
    if (item) items.push(item);
  }

  for (const key of storageKeys(storage).filter((value) => value.startsWith(REFILL_STORAGE_PREFIX)).sort()) {
    const refillState = parseStoredJson(storage, key);
    if (isRestorableRefillState(refillState)) {
      const item = refillItem(key, refillState, isSpanish);
      if (item) items.push(item);
    }
  }

  return items;
}
