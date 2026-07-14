import type { GuidedFlowRef } from "@/guidedActions/flowCatalog";
import type {
  GuidedActionAnswerValue,
  GuidedActionAnswers,
} from "@/guidedActions/useGuidedAction";

export type ConciergeHandoffFlowRef = Extract<
  GuidedFlowRef,
  | "concierge.paperwork_help"
  | "concierge.provider_comparison"
  | "concierge.company_document_review"
>;

type LocaleCopy = { en: string; es: string };

type HandoffFlowCopy = {
  routeTitle: LocaleCopy;
  routeDetail: LocaleCopy;
  primaryLabel: LocaleCopy;
  secondaryLabel: LocaleCopy;
  intro: LocaleCopy;
  slotLabels: Record<string, LocaleCopy>;
  valueLabels: Record<string, LocaleCopy>;
  guardrail: LocaleCopy;
};

export const CONCIERGE_HANDOFF_FLOW_REFS: ConciergeHandoffFlowRef[] = [
  "concierge.paperwork_help",
  "concierge.provider_comparison",
  "concierge.company_document_review",
];

const HANDOFF_COPY: Record<ConciergeHandoffFlowRef, HandoffFlowCopy> = {
  "concierge.paperwork_help": {
    routeTitle: { en: "Paperwork plan", es: "Plan de papeleo" },
    routeDetail: {
      en: "Forms, letters, documents, bills, and admin tasks. VYVA prepares the next step before anything is sent.",
      es: "Formularios, cartas, documentos, facturas y tramites. VYVA prepara el siguiente paso antes de enviar nada.",
    },
    primaryLabel: { en: "Prepare paperwork request", es: "Preparar tramite" },
    secondaryLabel: { en: "Use chat instead", es: "Usar chat" },
    intro: {
      en: "Help me with this paperwork or admin task.",
      es: "Ayudame con este papeleo o tramite.",
    },
    slotLabels: {
      task: { en: "Task", es: "Tramite" },
      document_status: { en: "What I have", es: "Lo que tengo" },
      deadline: { en: "Timing", es: "Plazo" },
      next_step: { en: "Next step", es: "Siguiente paso" },
    },
    valueLabels: {
      government_form: { en: "Government form", es: "Formulario oficial" },
      health_insurance_admin: {
        en: "Health or insurance admin",
        es: "Salud o seguro",
      },
      letter_or_document: { en: "Letter or document", es: "Carta o documento" },
      bill_or_invoice: { en: "Bill or invoice", es: "Factura o recibo" },
      application: { en: "Application", es: "Solicitud" },
      have_document: {
        en: "I have the document",
        es: "Tengo el documento",
      },
      need_form: { en: "Need the form", es: "Necesito el formulario" },
      need_draft: { en: "Need a draft", es: "Necesito un borrador" },
      only_question: { en: "Just a question", es: "Solo una pregunta" },
      today: { en: "Today", es: "Hoy" },
      this_week: { en: "This week", es: "Esta semana" },
      specific_date: { en: "Specific date", es: "Fecha concreta" },
      no_deadline: { en: "No deadline", es: "Sin plazo" },
      explain: { en: "Explain it", es: "Explicarlo" },
      checklist: { en: "Checklist", es: "Lista de pasos" },
      draft_message: { en: "Draft email/message", es: "Borrador de mensaje" },
      fill_form: { en: "Prepare form", es: "Preparar formulario" },
      prepare_call: { en: "Prepare call", es: "Preparar llamada" },
    },
    guardrail: {
      en: "Do not call, email, upload, submit, apply, pay, or share personal data without my final confirmation.",
      es: "No llamar, enviar email, subir, presentar, solicitar, pagar ni compartir datos personales sin mi confirmacion final.",
    },
  },
  "concierge.provider_comparison": {
    routeTitle: { en: "Compare providers", es: "Comparar proveedores" },
    routeDetail: {
      en: "Compare trust, cost, distance, terms, and fit before anyone is contacted.",
      es: "Comparar confianza, coste, distancia, condiciones y encaje antes de contactar.",
    },
    primaryLabel: { en: "Compare options", es: "Comparar opciones" },
    secondaryLabel: { en: "Use chat instead", es: "Usar chat" },
    intro: {
      en: "Help me compare providers, services, or deals neutrally.",
      es: "Ayudame a comparar proveedores, servicios u ofertas de forma neutral.",
    },
    slotLabels: {
      category: { en: "Category", es: "Categoria" },
      goal: { en: "Priorities", es: "Prioridades" },
      current_provider: { en: "Provider path", es: "Ruta de proveedor" },
      next_step: { en: "Next step", es: "Siguiente paso" },
    },
    valueLabels: {
      health_provider: { en: "Health provider", es: "Proveedor de salud" },
      home_service: { en: "Home service", es: "Servicio en casa" },
      residence: { en: "Residence or care", es: "Residencia o cuidado" },
      insurance_or_deal: { en: "Insurance or deal", es: "Seguro u oferta" },
      local_business: { en: "Local business", es: "Negocio local" },
      lowest_cost: { en: "Lower cost", es: "Menor coste" },
      most_trusted: { en: "Most trusted", es: "Mas fiable" },
      closest: { en: "Closest", es: "Mas cercano" },
      accessibility: { en: "Accessibility", es: "Accesibilidad" },
      availability: { en: "Availability", es: "Disponibilidad" },
      safest_terms: { en: "Safer terms", es: "Condiciones seguras" },
      saved_provider: { en: "Use saved provider", es: "Usar proveedor guardado" },
      named_provider: { en: "Named provider", es: "Proveedor indicado" },
      find_new: { en: "Find options", es: "Buscar opciones" },
      not_sure: { en: "Not sure", es: "No estoy seguro" },
      compare_options: { en: "Compare options", es: "Comparar opciones" },
      review_one: { en: "Review one option", es: "Revisar una opcion" },
      prepare_call_email: {
        en: "Prepare call/email",
        es: "Preparar llamada/email",
      },
      watch_changes: { en: "Watch changes", es: "Vigilar cambios" },
    },
    guardrail: {
      en: "VYVA does not receive commissions or promote providers. Do not call, email, book, buy, switch, or share data without my final confirmation.",
      es: "VYVA no recibe comisiones ni promociona proveedores. No llamar, enviar email, reservar, comprar, cambiar ni compartir datos sin mi confirmacion final.",
    },
  },
  "concierge.company_document_review": {
    routeTitle: { en: "Safe review", es: "Revision segura" },
    routeDetail: {
      en: "Check messages, companies, documents, and offers before replying or sharing data.",
      es: "Revisar mensajes, empresas, documentos y ofertas antes de responder o compartir datos.",
    },
    primaryLabel: { en: "Prepare safe review", es: "Preparar revision segura" },
    secondaryLabel: { en: "Use chat instead", es: "Usar chat" },
    intro: {
      en: "Help me review this safely before I reply or share anything.",
      es: "Ayudame a revisar esto de forma segura antes de responder o compartir nada.",
    },
    slotLabels: {
      item_type: { en: "Item", es: "Elemento" },
      concern: { en: "Concern", es: "Preocupacion" },
      source: { en: "Source", es: "Origen" },
      next_step: { en: "Next step", es: "Siguiente paso" },
    },
    valueLabels: {
      suspicious_message: { en: "Suspicious message", es: "Mensaje sospechoso" },
      company_offer: { en: "Company or offer", es: "Empresa u oferta" },
      contract_policy: { en: "Contract or policy", es: "Contrato o poliza" },
      bill_invoice: { en: "Bill or invoice", es: "Factura o recibo" },
      official_document: { en: "Official document", es: "Documento oficial" },
      scam_risk: { en: "Scam risk", es: "Riesgo de estafa" },
      price_terms: { en: "Price or terms", es: "Precio o condiciones" },
      deadline: { en: "Deadline", es: "Plazo" },
      documents_needed: {
        en: "Documents needed",
        es: "Documentos necesarios",
      },
      identity_data: { en: "Personal data", es: "Datos personales" },
      not_sure: { en: "Not sure", es: "No estoy seguro" },
      email_sms: { en: "Email or SMS", es: "Email o SMS" },
      paper_letter: { en: "Paper letter", es: "Carta en papel" },
      phone_call: { en: "Phone call", es: "Llamada" },
      website_form: { en: "Website or form", es: "Web o formulario" },
      uploaded_document: { en: "Document/photo", es: "Documento/foto" },
      spoken_summary: { en: "Spoken summary", es: "Resumen hablado" },
      summarize_risks: { en: "Summarize risks", es: "Resumir riesgos" },
      draft_reply: { en: "Draft reply", es: "Borrador de respuesta" },
      compare_company: { en: "Compare company", es: "Comparar empresa" },
      prepare_trusted_contact: {
        en: "Ask trusted contact",
        es: "Consultar contacto de confianza",
      },
      prepare_form_application: {
        en: "Prepare form/application",
        es: "Preparar formulario/solicitud",
      },
    },
    guardrail: {
      en: "Do not reply, call back, click links, upload documents, apply, pay, or share personal data without my final confirmation.",
      es: "No responder, devolver llamadas, abrir enlaces, subir documentos, solicitar, pagar ni compartir datos personales sin mi confirmacion final.",
    },
  },
};

function localized(copy: LocaleCopy, isSpanish: boolean) {
  return isSpanish ? copy.es : copy.en;
}

function answerValues(value: GuidedActionAnswerValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function valueLabel(
  copy: HandoffFlowCopy,
  value: string,
  isSpanish: boolean,
) {
  const known = copy.valueLabels[value];
  return known ? localized(known, isSpanish) : value;
}

function slotSummary(
  copy: HandoffFlowCopy,
  slot: string,
  value: GuidedActionAnswerValue | undefined,
  isSpanish: boolean,
) {
  const values = answerValues(value);
  if (values.length === 0) return "";
  const label = copy.slotLabels[slot];
  const text = values.map((item) => valueLabel(copy, item, isSpanish)).join(", ");
  return `${label ? localized(label, isSpanish) : slot}: ${text}.`;
}

export function isConciergeHandoffFlow(
  ref: GuidedFlowRef | null | undefined,
): ref is ConciergeHandoffFlowRef {
  return CONCIERGE_HANDOFF_FLOW_REFS.includes(ref as ConciergeHandoffFlowRef);
}

export function conciergeHandoffRouteMeta(
  ref: ConciergeHandoffFlowRef,
  isSpanish: boolean,
) {
  const copy = HANDOFF_COPY[ref];
  return {
    title: localized(copy.routeTitle, isSpanish),
    detail: localized(copy.routeDetail, isSpanish),
    primaryLabel: localized(copy.primaryLabel, isSpanish),
    secondaryLabel: localized(copy.secondaryLabel, isSpanish),
  };
}

export function buildConciergeHandoffDetail(
  ref: ConciergeHandoffFlowRef,
  answers: GuidedActionAnswers,
  isSpanish: boolean,
) {
  const copy = HANDOFF_COPY[ref];
  const slots = Object.keys(copy.slotLabels);
  const details = slots
    .map((slot) => slotSummary(copy, slot, answers[slot], isSpanish))
    .filter(Boolean);
  return [
    localized(copy.intro, isSpanish),
    ...details,
    localized(copy.guardrail, isSpanish),
  ].join("\n");
}

export function conciergeHandoffConfirmationItems(
  ref: ConciergeHandoffFlowRef,
  answers: GuidedActionAnswers,
  isSpanish: boolean,
  hasSavedProvider: boolean,
) {
  const copy = HANDOFF_COPY[ref];
  const nextStep = answerValues(answers.next_step)
    .map((item) => valueLabel(copy, item, isSpanish))
    .join(", ");
  const wantsSavedProvider =
    ref === "concierge.provider_comparison" &&
    answerValues(answers.current_provider).includes("saved_provider");

  return [
    {
      label: isSpanish ? "Detalles capturados" : "Details captured",
      helper: isSpanish
        ? "VYVA usara solo esta informacion y lo que ya esta guardado en el perfil."
        : "VYVA will use only this information and facts already saved in the profile.",
    },
    wantsSavedProvider
      ? {
          label: hasSavedProvider
            ? isSpanish
              ? "Proveedor guardado disponible"
              : "Saved provider available"
            : isSpanish
              ? "Falta proveedor guardado"
              : "Saved provider missing",
          helper: hasSavedProvider
            ? isSpanish
              ? "Se revisara el proveedor guardado primero."
              : "The saved provider will be reviewed first."
            : isSpanish
              ? "Anade un proveedor o cambia a buscar opciones antes de continuar."
              : "Add a provider or choose find options before continuing.",
        }
      : null,
    {
      label: nextStep || (isSpanish ? "Siguiente paso seguro" : "Safe next step"),
      helper: localized(copy.guardrail, isSpanish),
    },
  ].filter(Boolean) as Array<{ label: string; helper?: string }>;
}

export function conciergeHandoffSearchQuery(
  ref: ConciergeHandoffFlowRef,
  answers: GuidedActionAnswers,
  isSpanish: boolean,
) {
  const copy = HANDOFF_COPY[ref];
  const slots =
    ref === "concierge.provider_comparison"
      ? ["category", "goal", "current_provider"]
      : ["item_type", "concern", "source"];
  return slots
    .flatMap((slot) => answerValues(answers[slot]))
    .map((value) => valueLabel(copy, value, isSpanish))
    .filter(Boolean)
    .join(" ");
}
