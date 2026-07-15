import { CONCIERGE_FLOW_REFERENCES } from "./conciergeFlowRegistry";

type LocaleKey = "en" | "es" | "de" | "fr" | "it" | "pt";

export type ConciergeGuidedDetailInputType = "text" | "textarea" | "select";

export interface ConciergeGuidedDetailOption {
  value: string;
  label: string;
}

export interface ConciergeGuidedDetailQuestion {
  key: string;
  payloadKey: string;
  label: string;
  prompt: string;
  placeholder: string;
  inputType: ConciergeGuidedDetailInputType;
  required: boolean;
  options?: ConciergeGuidedDetailOption[];
}

export interface ConciergeGuidedDetailCapture {
  title: string;
  helper: string;
  questions: ConciergeGuidedDetailQuestion[];
  answeredKeys: string[];
  missingRequiredKeys: string[];
  nextQuestion: ConciergeGuidedDetailQuestion | null;
  complete: boolean;
}

export interface ConciergeGuidedDetailTaskInput {
  useCase: string;
  payload?: Record<string, unknown> | null;
  providerName?: string | null;
  providerPhone?: string | null;
  locale?: string | null;
}

const FIELD_ALIASES: Record<string, string[]> = {
  destination_address: ["destination_address", "destination", "destination_name"],
  pickup_address: ["pickup_address", "pickup"],
  requested_time: ["requested_time", "time", "preferred_time", "scheduled_for"],
  mobility_needs: ["mobility_needs", "mobility_need", "mobility"],
  service_needed: ["service_needed", "problem_summary", "reason", "detail"],
  service_location: ["service_location", "location", "address", "home_address"],
  urgency: ["urgency"],
  item_text: ["item_text", "item", "items", "reviewed_item"],
  fulfillment_preference: ["fulfillment_preference", "preferred_delivery", "delivery_preference"],
  scam_subject: ["phone_number", "url", "company_name", "search_query", "reviewed_item", "user_detail"],
  scam_context: ["scam_context", "context", "notes", "review_summary", "criteria_notes"],
  recipient_email: ["recipient_email", "provider_email", "to_email", "email_to", "email"],
  message_body: ["message_body", "email_body", "draft_body", "message", "body", "draft_message"],
  document_purpose: ["document_purpose", "document_summary_request", "reason", "reviewed_item"],
};

function localeKey(locale?: string | null): LocaleKey {
  const code = locale?.split("-")[0]?.toLowerCase();
  return code === "es" || code === "de" || code === "fr" || code === "it" || code === "pt" ? code : "en";
}

function t(locale: LocaleKey, en: string, es: string): string {
  return locale === "es" ? es : en;
}

function clean(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => clean(entry))
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

export function guidedDetailValue(payload: Record<string, unknown> | null | undefined, key: string): string {
  const aliases = FIELD_ALIASES[key] ?? [key];
  for (const alias of aliases) {
    const value = clean(payload?.[alias]);
    if (value) return value;
  }
  return "";
}

function payloadString(payload: Record<string, unknown> | null | undefined, keys: string[]): string {
  for (const key of keys) {
    const value = clean(payload?.[key]);
    if (value) return value;
  }
  return "";
}

function actionId(payload: Record<string, unknown> | null | undefined): string {
  return payloadString(payload, ["show_vyva_action_id", "action_id"]).toLowerCase();
}

function flowReference(payload: Record<string, unknown> | null | undefined): string {
  return payloadString(payload, ["flow_reference"]).toUpperCase();
}

function option(value: string, label: string): ConciergeGuidedDetailOption {
  return { value, label };
}

function question(params: {
  key: string;
  payloadKey?: string;
  label: string;
  prompt: string;
  placeholder: string;
  inputType?: ConciergeGuidedDetailInputType;
  required?: boolean;
  options?: ConciergeGuidedDetailOption[];
}): ConciergeGuidedDetailQuestion {
  return {
    key: params.key,
    payloadKey: params.payloadKey ?? params.key,
    label: params.label,
    prompt: params.prompt,
    placeholder: params.placeholder,
    inputType: params.inputType ?? "text",
    required: params.required ?? true,
    ...(params.options ? { options: params.options } : {}),
  };
}

function rideQuestions(lang: LocaleKey): ConciergeGuidedDetailQuestion[] {
  return [
    question({
      key: "destination_address",
      label: t(lang, "Destination", "Destino"),
      prompt: t(lang, "Where should the ride go?", "A donde debe ir el viaje?"),
      placeholder: t(lang, "Clinic, address, or place name", "Clinica, direccion o lugar"),
    }),
    question({
      key: "pickup_address",
      label: t(lang, "Pickup", "Recogida"),
      prompt: t(lang, "Where should the ride start?", "Desde donde debe salir?"),
      placeholder: t(lang, "Home, saved address, or another place", "Casa, direccion guardada u otro lugar"),
    }),
    question({
      key: "requested_time",
      label: t(lang, "Time", "Hora"),
      prompt: t(lang, "When should the pickup be?", "Cuando debe ser la recogida?"),
      placeholder: t(lang, "Today at 4pm, tomorrow morning...", "Hoy a las 16:00, manana por la manana..."),
    }),
    question({
      key: "mobility_needs",
      label: t(lang, "Mobility", "Movilidad"),
      prompt: t(lang, "Any mobility needs for the ride?", "Alguna necesidad de movilidad para el viaje?"),
      placeholder: t(lang, "Walker, wheelchair, help to the door, none", "Andador, silla de ruedas, ayuda en la puerta, ninguna"),
      required: false,
    }),
  ];
}

function homeServiceQuestions(lang: LocaleKey): ConciergeGuidedDetailQuestion[] {
  return [
    question({
      key: "service_needed",
      label: t(lang, "Issue", "Problema"),
      prompt: t(lang, "What home help is needed?", "Que ayuda en casa hace falta?"),
      placeholder: t(lang, "Loose rail, leak, cleaning, repair...", "Barandilla suelta, fuga, limpieza, reparacion..."),
    }),
    question({
      key: "service_location",
      label: t(lang, "Location", "Lugar"),
      prompt: t(lang, "Where is the issue?", "Donde esta el problema?"),
      placeholder: t(lang, "Bathroom, kitchen, saved home address...", "Bano, cocina, direccion de casa..."),
    }),
    question({
      key: "urgency",
      label: t(lang, "Urgency", "Urgencia"),
      prompt: t(lang, "How urgent is it?", "Que tan urgente es?"),
      placeholder: t(lang, "Today, this week, not urgent", "Hoy, esta semana, no urgente"),
      inputType: "select",
      options: [
        option("today", t(lang, "Today", "Hoy")),
        option("this_week", t(lang, "This week", "Esta semana")),
        option("not_urgent", t(lang, "Not urgent", "No urgente")),
      ],
    }),
    question({
      key: "requested_time",
      label: t(lang, "Preferred time", "Hora preferida"),
      prompt: t(lang, "When is a good time?", "Cuando seria buen momento?"),
      placeholder: t(lang, "Morning, afternoon, Friday...", "Manana, tarde, viernes..."),
    }),
  ];
}

function pharmacyQuestions(lang: LocaleKey): ConciergeGuidedDetailQuestion[] {
  return [
    question({
      key: "item_text",
      label: t(lang, "Item", "Producto"),
      prompt: t(lang, "Which non-prescription item is this about?", "Sobre que producto sin receta es?"),
      placeholder: t(lang, "Vitamin D, bandages, cough syrup...", "Vitamina D, vendas, jarabe para la tos..."),
    }),
    question({
      key: "fulfillment_preference",
      label: t(lang, "Pickup or delivery", "Recoger o entrega"),
      prompt: t(lang, "Do you prefer pickup or delivery?", "Prefieres recogerlo o entrega?"),
      placeholder: t(lang, "Pickup or delivery", "Recoger o entrega"),
      inputType: "select",
      options: [
        option("pickup", t(lang, "Pickup", "Recoger")),
        option("delivery", t(lang, "Delivery", "Entrega")),
      ],
    }),
    question({
      key: "requested_time",
      label: t(lang, "When", "Cuando"),
      prompt: t(lang, "When do you need it?", "Cuando lo necesitas?"),
      placeholder: t(lang, "Today, tomorrow, this week", "Hoy, manana, esta semana"),
    }),
  ];
}

function scamQuestions(lang: LocaleKey, payload: Record<string, unknown> | null | undefined): ConciergeGuidedDetailQuestion[] {
  const action = actionId(payload);
  const subjectLabel = action.includes("number")
    ? t(lang, "Phone number", "Numero")
    : action.includes("link")
      ? t(lang, "Link", "Enlace")
      : action.includes("company")
        ? t(lang, "Company", "Empresa")
        : t(lang, "Suspicious item", "Elemento sospechoso");
  const subjectPrompt = action.includes("number")
    ? t(lang, "What phone number should VYVA check?", "Que numero debe revisar VYVA?")
    : action.includes("link")
      ? t(lang, "What link should VYVA check?", "Que enlace debe revisar VYVA?")
      : action.includes("company")
        ? t(lang, "What company or seller should VYVA check?", "Que empresa o vendedor debe revisar VYVA?")
        : t(lang, "What should VYVA check?", "Que debe revisar VYVA?");

  return [
    question({
      key: "scam_subject",
      payloadKey: action.includes("number") ? "phone_number" : action.includes("link") ? "url" : action.includes("company") ? "company_name" : "reviewed_item",
      label: subjectLabel,
      prompt: subjectPrompt,
      placeholder: t(lang, "Paste or type it here", "Pegalo o escribelo aqui"),
    }),
    question({
      key: "scam_context",
      label: t(lang, "Context", "Contexto"),
      prompt: t(lang, "What happened around it?", "Que paso alrededor de esto?"),
      placeholder: t(lang, "Who sent it, what it asks for, whether anyone replied", "Quien lo envio, que pide, si alguien respondio"),
      inputType: "textarea",
    }),
  ];
}

function documentQuestions(lang: LocaleKey): ConciergeGuidedDetailQuestion[] {
  return [
    question({
      key: "recipient_email",
      label: t(lang, "Recipient", "Destinatario"),
      prompt: t(lang, "Who should receive the draft, if anything is sent?", "Quien debe recibir el borrador, si se envia algo?"),
      placeholder: t(lang, "Email or organization", "Email u organizacion"),
    }),
    question({
      key: "document_purpose",
      label: t(lang, "Purpose", "Objetivo"),
      prompt: t(lang, "What should VYVA help with?", "Con que debe ayudar VYVA?"),
      placeholder: t(lang, "Summarize, reply, ask a question, prepare a call", "Resumen, respuesta, pregunta, preparar llamada"),
    }),
    question({
      key: "message_body",
      label: t(lang, "Message", "Mensaje"),
      prompt: t(lang, "What should the draft say?", "Que debe decir el borrador?"),
      placeholder: t(lang, "Short message or key points", "Mensaje corto o puntos clave"),
      inputType: "textarea",
    }),
  ];
}

function providerDealQuestions(lang: LocaleKey): ConciergeGuidedDetailQuestion[] {
  return [
    question({
      key: "scam_subject",
      payloadKey: "search_query",
      label: t(lang, "Provider or offer", "Proveedor u oferta"),
      prompt: t(lang, "What should VYVA compare or check?", "Que debe comparar o revisar VYVA?"),
      placeholder: t(lang, "Company, service, link, or offer", "Empresa, servicio, enlace u oferta"),
    }),
    question({
      key: "scam_context",
      payloadKey: "criteria_notes",
      label: t(lang, "Criteria", "Criterios"),
      prompt: t(lang, "What matters most?", "Que importa mas?"),
      placeholder: t(lang, "Price, proximity, reputation, access", "Precio, cercania, reputacion, acceso"),
      inputType: "textarea",
    }),
  ];
}

function questionsForTask(input: ConciergeGuidedDetailTaskInput, lang: LocaleKey): ConciergeGuidedDetailQuestion[] {
  const payload = input.payload ?? {};
  const flow = flowReference(payload);
  const action = actionId(payload);

  if (input.useCase === "book_ride" || flow === CONCIERGE_FLOW_REFERENCES.transportBooking) return rideQuestions(lang);
  if (input.useCase === "order_medicine" || flow === CONCIERGE_FLOW_REFERENCES.otcPharmacy) return pharmacyQuestions(lang);
  if (input.useCase === "home_service" || flow === CONCIERGE_FLOW_REFERENCES.homeService) return homeServiceQuestions(lang);
  if (input.useCase === "scam_check" || flow === CONCIERGE_FLOW_REFERENCES.scamCheck) {
    if (action.includes("forward_email")) return documentQuestions(lang);
    return scamQuestions(lang, payload);
  }
  if (
    input.useCase === "paperwork" ||
    input.useCase === "admin_task" ||
    input.useCase === "send_message" ||
    input.useCase === "insurance_admin" ||
    flow === CONCIERGE_FLOW_REFERENCES.insuranceAdmin
  ) return documentQuestions(lang);
  if (input.useCase === "find_provider" || input.useCase === "find_offers" || input.useCase === "shopping_request" || flow === CONCIERGE_FLOW_REFERENCES.shoppingSupport) {
    return providerDealQuestions(lang);
  }
  return [];
}

export function buildConciergeGuidedDetailCapture(input: ConciergeGuidedDetailTaskInput): ConciergeGuidedDetailCapture | null {
  const lang = localeKey(input.locale);
  const questions = questionsForTask(input, lang);
  if (!questions.length) return null;

  const payload = input.payload ?? {};
  const answeredKeys = questions
    .filter((entry) => guidedDetailValue(payload, entry.key))
    .map((entry) => entry.key);
  const missingRequiredKeys = questions
    .filter((entry) => entry.required && !guidedDetailValue(payload, entry.key))
    .map((entry) => entry.key);
  const nextQuestion = questions.find((entry) => entry.required && !guidedDetailValue(payload, entry.key))
    ?? questions.find((entry) => !guidedDetailValue(payload, entry.key))
    ?? null;

  return {
    title: t(lang, "Add the missing detail", "Anadir el dato que falta"),
    helper: t(lang, "VYVA asks one thing at a time, then saves it here.", "VYVA pregunta una cosa a la vez y la guarda aqui."),
    questions,
    answeredKeys,
    missingRequiredKeys,
    nextQuestion,
    complete: missingRequiredKeys.length === 0,
  };
}
