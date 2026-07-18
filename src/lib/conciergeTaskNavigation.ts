export const NEW_CONCIERGE_TASK_ID = "new";

export type ConciergeTaskEntryKind =
  | "document"
  | "appointment"
  | "home_service"
  | "provider_contact"
  | "scam_review"
  | "transport"
  | "otc_pharmacy";

export type ConciergeTaskStage = "details" | "review" | "confirmation";

export type ConciergeTaskEntry = {
  kind: ConciergeTaskEntryKind;
  documentKind?: "insurance-letter" | "claim" | "government-form" | "call-email";
  appointmentKind?: "medical" | "personal-care" | "government";
  providerSearchMode?:
    | "personal-care"
    | "specialist"
    | "residence"
    | "care"
    | "transport"
    | "pharmacy"
    | "home-service"
    | "shopping-seller";
  query?: string;
};

const TASK_ENTRY_KINDS = new Set<ConciergeTaskEntryKind>([
  "document",
  "appointment",
  "home_service",
  "provider_contact",
  "scam_review",
  "transport",
  "otc_pharmacy",
]);

const DOCUMENT_KINDS = new Set<NonNullable<ConciergeTaskEntry["documentKind"]>>([
  "insurance-letter",
  "claim",
  "government-form",
  "call-email",
]);

const APPOINTMENT_KINDS = new Set<NonNullable<ConciergeTaskEntry["appointmentKind"]>>([
  "medical",
  "personal-care",
  "government",
]);

const PROVIDER_SEARCH_MODES = new Set<NonNullable<ConciergeTaskEntry["providerSearchMode"]>>([
  "personal-care",
  "specialist",
  "residence",
  "care",
  "transport",
  "pharmacy",
  "home-service",
  "shopping-seller",
]);

export function conciergeTaskPath(taskId = NEW_CONCIERGE_TASK_ID): string {
  const normalizedId = taskId.trim() || NEW_CONCIERGE_TASK_ID;
  return `/concierge/task/${encodeURIComponent(normalizedId)}`;
}

export function coerceConciergeTaskEntry(value: unknown): ConciergeTaskEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.kind !== "string" || !TASK_ENTRY_KINDS.has(candidate.kind as ConciergeTaskEntryKind)) {
    return null;
  }

  const entry: ConciergeTaskEntry = { kind: candidate.kind as ConciergeTaskEntryKind };
  if (typeof candidate.documentKind === "string" && DOCUMENT_KINDS.has(candidate.documentKind as NonNullable<ConciergeTaskEntry["documentKind"]>)) {
    entry.documentKind = candidate.documentKind as NonNullable<ConciergeTaskEntry["documentKind"]>;
  }
  if (typeof candidate.appointmentKind === "string" && APPOINTMENT_KINDS.has(candidate.appointmentKind as NonNullable<ConciergeTaskEntry["appointmentKind"]>)) {
    entry.appointmentKind = candidate.appointmentKind as NonNullable<ConciergeTaskEntry["appointmentKind"]>;
  }
  if (typeof candidate.providerSearchMode === "string" && PROVIDER_SEARCH_MODES.has(candidate.providerSearchMode as NonNullable<ConciergeTaskEntry["providerSearchMode"]>)) {
    entry.providerSearchMode = candidate.providerSearchMode as NonNullable<ConciergeTaskEntry["providerSearchMode"]>;
  }
  if (typeof candidate.query === "string" && candidate.query.trim()) {
    entry.query = candidate.query.trim();
  }
  return entry;
}

export function conciergeTaskEntryTitle(entry: ConciergeTaskEntry | null, isSpanish: boolean): string {
  switch (entry?.kind) {
    case "document":
      return isSpanish ? "Ayuda con documentos" : "Document help";
    case "appointment":
      return isSpanish ? "Preparar una cita" : "Prepare an appointment";
    case "home_service":
      return isSpanish ? "Servicio para el hogar" : "Home service";
    case "provider_contact":
      return isSpanish ? "Elegir un proveedor" : "Choose a provider";
    case "scam_review":
      return isSpanish ? "Revisar algo sospechoso" : "Review something suspicious";
    case "transport":
      return isSpanish ? "Preparar transporte" : "Prepare transport";
    case "otc_pharmacy":
      return isSpanish ? "Ayuda de farmacia" : "Pharmacy help";
    default:
      return isSpanish ? "Tarea de Concierge" : "Concierge task";
  }
}

export function conciergeTaskEntrySummary(entry: ConciergeTaskEntry | null, isSpanish: boolean): string {
  switch (entry?.kind) {
    case "document":
      return isSpanish ? "Reune solo los datos que faltan antes de revisar el formulario." : "Add only the missing details before reviewing the form.";
    case "appointment":
      return isSpanish ? "Revisa el profesional, el motivo y el horario antes de confirmar." : "Review the provider, reason, and timing before confirming.";
    case "home_service":
      return isSpanish ? "Describe el trabajo y revisa el proveedor antes de contactar." : "Describe the job and review the provider before contact.";
    case "provider_contact":
      return isSpanish ? "Compara opciones y elige una antes de contactar." : "Compare options and choose one before contact.";
    case "scam_review":
      return isSpanish ? "Comparte solo lo necesario para revisar el riesgo." : "Share only what is needed to review the risk.";
    case "transport":
      return isSpanish ? "Revisa la ruta y la opcion antes de reservar." : "Review the route and option before booking.";
    case "otc_pharmacy":
      return isSpanish ? "Revisa el producto y la farmacia antes de contactar o comprar." : "Review the item and pharmacy before contact or purchase.";
    default:
      return isSpanish ? "Revisa esta tarea y decide el siguiente paso." : "Review this task and choose the next step.";
  }
}
