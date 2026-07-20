import { CONCIERGE_FLOW_REFERENCES } from "./conciergeFlowRegistry";

export type ConciergeConfirmationReceiptInput = {
  useCase?: string | null;
  providerName?: string | null;
  outcome?: string | null;
  outcomeSummary?: string | null;
  completedAt?: string | null;
  payload?: Record<string, unknown> | null;
};

export type ConciergeConfirmationReceiptDetail = {
  key: string;
  label: string;
  value: string;
};

export type ConciergeConfirmationReceipt = {
  flowLabel: string;
  whatVyvaDid: string;
  subjectLabel: string;
  subjectValue: string;
  statusLabel: string;
  nextStep: string;
  details: ConciergeConfirmationReceiptDetail[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function payloadString(payload: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!payload) return "";
  for (const key of keys) {
    const value = text(payload[key]);
    if (value) return value;
  }
  return "";
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, "_");
}

function flowLabel(input: ConciergeConfirmationReceiptInput, isSpanish: boolean): string {
  const payload = input.payload;
  const flowReference = payloadString(payload, ["flow_reference"]);
  if (flowReference === CONCIERGE_FLOW_REFERENCES.transportBooking || input.useCase === "book_ride") return isSpanish ? "Viaje" : "Ride";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.homeService || input.useCase === "home_service" || payload?.appointment_type === "home-service") return isSpanish ? "Servicio en casa" : "Home service";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.otcPharmacy || input.useCase === "order_medicine") return isSpanish ? "Farmacia OTC" : "OTC pharmacy";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.shoppingSupport || input.useCase === "shopping_request") return isSpanish ? "Compra" : "Shopping";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.medicalAppointment || input.useCase === "book_appointment") return isSpanish ? "Cita" : "Appointment";
  if (flowReference === CONCIERGE_FLOW_REFERENCES.safeHomeSupport) return isSpanish ? "Casa segura" : "Safe home";
  if (input.useCase === "provider_reply") return isSpanish ? "Respuesta de proveedor" : "Provider reply";
  if (input.useCase === "admin_task" || input.useCase === "paperwork" || input.useCase === "insurance_admin") return isSpanish ? "Gestion" : "Admin help";
  return isSpanish ? "Tarea" : "Task";
}

function outcomeKind(input: ConciergeConfirmationReceiptInput): string {
  const payload = input.payload;
  return normalized(payloadString(payload, [
    "call_outcome",
    "provider_reply_status",
    "form_outcome",
    "email_outcome",
    "whatsapp_outcome",
    "live_handoff_outcome",
    "contact_handoff_status",
    "provider_follow_up_status",
  ]) || input.outcome || "completed");
}

function statusLabel(kind: string, isSpanish: boolean): string {
  switch (kind) {
    case "confirmed":
    case "provider_confirmed":
      return isSpanish ? "Confirmado" : "Confirmed";
    case "sent":
    case "email_sent":
    case "whatsapp_sent":
    case "sent_or_called":
      return isSpanish ? "Enviado" : "Sent";
    case "submitted":
    case "form_submitted":
      return isSpanish ? "Enviado" : "Submitted";
    case "waiting":
    case "awaiting_provider":
    case "awaiting_reply":
      return isSpanish ? "Esperando respuesta" : "Waiting for reply";
    case "no_answer":
      return isSpanish ? "Sin respuesta" : "No answer";
    case "needs_info":
    case "needs_more_info":
    case "needs_user_input":
      return isSpanish ? "Necesita tu respuesta" : "Needs your reply";
    case "unavailable":
    case "cant_fulfil":
    case "failed":
    case "error":
      return isSpanish ? "Necesita otra opcion" : "Needs another option";
    case "cancelled":
    case "user_cancelled":
      return isSpanish ? "Cancelado" : "Cancelled";
    case "completed":
    default:
      return isSpanish ? "Completado" : "Completed";
  }
}

function whatVyvaDid(input: ConciergeConfirmationReceiptInput, kind: string, isSpanish: boolean): string {
  const summary = text(input.outcomeSummary);
  const payload = input.payload;
  if (summary) return summary;
  if (payloadString(payload, ["email_outcome"])) return isSpanish ? "VYVA registro el envio del email." : "VYVA recorded the email that was sent.";
  if (payloadString(payload, ["whatsapp_outcome"])) return isSpanish ? "VYVA registro el WhatsApp enviado." : "VYVA recorded the WhatsApp that was sent.";
  if (payloadString(payload, ["call_outcome"])) return isSpanish ? "VYVA registro el resultado de la llamada." : "VYVA recorded the call outcome.";
  if (payloadString(payload, ["form_outcome"])) return isSpanish ? "VYVA registro el formulario." : "VYVA recorded the form step.";
  if (payloadString(payload, ["provider_reply"])) return isSpanish ? "VYVA guardo la respuesta del proveedor." : "VYVA saved the provider reply.";
  if (payloadString(payload, ["booking_reference", "reference", "pharmacy_reference"])) return isSpanish ? "VYVA guardo la referencia." : "VYVA saved the reference.";
  if (kind === "no_answer") return isSpanish ? "VYVA intento contactar y no hubo respuesta." : "VYVA tried to contact them and there was no answer.";
  if (kind === "unavailable" || kind === "cant_fulfil") return isSpanish ? "VYVA guardo que esta opcion no esta disponible." : "VYVA saved that this option is not available.";
  return isSpanish ? "VYVA guardo esta gestion." : "VYVA saved this task.";
}

function subject(input: ConciergeConfirmationReceiptInput, isSpanish: boolean): { label: string; value: string } {
  const payload = input.payload;
  const provider = text(input.providerName) || payloadString(payload, ["provider_name", "pharmacy_name", "recipient_name"]);
  const destination = payloadString(payload, ["destination_address", "destination", "dropoff_address"]);
  const item = payloadString(payload, ["item_text", "shopping_need", "items", "offer_name", "deal_name"]);
  const appointment = payloadString(payload, ["appointment_reason", "appointment_type", "service_type"]);
  const document = payloadString(payload, ["document_name", "form_name", "subject", "email_subject"]);
  if (provider) return { label: isSpanish ? "Con quien" : "With", value: provider };
  if (destination) return { label: isSpanish ? "Destino" : "Destination", value: destination };
  if (item) return { label: isSpanish ? "Sobre" : "About", value: item };
  if (appointment) return { label: isSpanish ? "Sobre" : "About", value: appointment };
  if (document) return { label: isSpanish ? "Sobre" : "About", value: document };
  return { label: isSpanish ? "Gestion" : "Task", value: flowLabel(input, isSpanish) };
}

function nextStep(kind: string, isSpanish: boolean): string {
  switch (kind) {
    case "waiting":
    case "awaiting_provider":
    case "awaiting_reply":
      return isSpanish ? "VYVA mantiene esto guardado mientras esperas respuesta." : "VYVA keeps this saved while you wait for a reply.";
    case "no_answer":
      return isSpanish ? "Puedes pedir a VYVA que lo intente de nuevo o probar otra opcion." : "You can ask VYVA to try again or choose another option.";
    case "needs_info":
    case "needs_more_info":
    case "needs_user_input":
      return isSpanish ? "Revisa lo que falta y responde cuando estes listo." : "Review what is missing and respond when ready.";
    case "unavailable":
    case "cant_fulfil":
    case "failed":
    case "error":
      return isSpanish ? "Puedes comparar otra opcion antes de contactar a alguien." : "You can compare another option before contacting anyone.";
    case "cancelled":
    case "user_cancelled":
      return isSpanish ? "No se requiere accion. Puedes reutilizarlo mas tarde." : "No action is needed. You can reuse this later.";
    default:
      return isSpanish ? "Puedes revisar el recibo, reutilizarlo o preguntar a VYVA." : "You can review this receipt, reuse it, or ask VYVA a question.";
  }
}

function detail(labelEn: string, labelEs: string, value: string, key: string, isSpanish: boolean): ConciergeConfirmationReceiptDetail | null {
  return value ? { key, label: isSpanish ? labelEs : labelEn, value } : null;
}

export function buildConciergeConfirmationReceipt(
  input: ConciergeConfirmationReceiptInput,
  isSpanish = false,
): ConciergeConfirmationReceipt {
  const payload = input.payload;
  const kind = outcomeKind(input);
  const primarySubject = subject(input, isSpanish);
  const details = [
    detail("Provider", "Proveedor", text(input.providerName) || payloadString(payload, ["provider_name", "pharmacy_name", "recipient_name"]), "provider", isSpanish),
    detail("Destination", "Destino", payloadString(payload, ["destination_address", "destination", "dropoff_address"]), "destination", isSpanish),
    detail("Pickup", "Recogida", payloadString(payload, ["pickup_address", "start_location"]), "pickup", isSpanish),
    detail("Time", "Hora", payloadString(payload, ["scheduled_for", "requested_time"]), "time", isSpanish),
    detail("Item", "Articulo", payloadString(payload, ["item_text", "shopping_need", "items"]), "item", isSpanish),
    detail("Service", "Servicio", payloadString(payload, ["service_type", "appointment_type", "appointment_reason"]), "service", isSpanish),
    detail("Cost", "Coste", payloadString(payload, ["price_estimate", "cost_estimate", "estimated_cost"]), "cost", isSpanish),
    detail("Reference", "Referencia", payloadString(payload, ["booking_reference", "pharmacy_reference", "reference", "provider_message_id"]), "reference", isSpanish),
    detail("Phone", "Telefono", payloadString(payload, ["provider_phone", "phone", "contact_phone"]), "phone", isSpanish),
    detail("Email", "Email", payloadString(payload, ["recipient_email", "provider_email", "email"]), "email", isSpanish),
    detail("WhatsApp", "WhatsApp", payloadString(payload, ["recipient_whatsapp", "provider_whatsapp", "whatsapp"]), "whatsapp", isSpanish),
  ].filter((entry): entry is ConciergeConfirmationReceiptDetail => Boolean(entry));

  return {
    flowLabel: flowLabel(input, isSpanish),
    whatVyvaDid: whatVyvaDid(input, kind, isSpanish),
    subjectLabel: primarySubject.label,
    subjectValue: primarySubject.value,
    statusLabel: statusLabel(kind, isSpanish),
    nextStep: nextStep(kind, isSpanish),
    details,
  };
}
