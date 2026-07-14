export type ConciergeHandoffKind = "paperwork_admin" | "provider_deal_comparison" | "safe_review";

export type ConciergeHandoffAnswers = Record<string, string>;

export type ConciergeHandoffQuestion = {
  key: string;
  labelEn: string;
  labelEs: string;
  helperEn: string;
  helperEs: string;
  kind: "choice" | "text";
  placeholderEn?: string;
  placeholderEs?: string;
  options?: Array<{
    key: string;
    labelEn: string;
    labelEs: string;
  }>;
};

export type ConciergeHandoffConfirmationItem = {
  label: string;
  helper: string;
};

type ConciergeHandoffWorkflow = {
  kind: ConciergeHandoffKind;
  titleEn: string;
  titleEs: string;
  detailEn: string;
  detailEs: string;
  primaryEn: string;
  primaryEs: string;
  questions: ConciergeHandoffQuestion[];
};

const WORKFLOWS: Record<ConciergeHandoffKind, ConciergeHandoffWorkflow> = {
  paperwork_admin: {
    kind: "paperwork_admin",
    titleEn: "Paperwork help ready",
    titleEs: "Ayuda con tramites lista",
    detailEn: "VYVA gathers only the missing details, prepares the next step, and stops before any submission.",
    detailEs: "VYVA recoge solo lo que falta, prepara el siguiente paso y se detiene antes de enviar nada.",
    primaryEn: "Confirm and prepare",
    primaryEs: "Confirmar y preparar",
    questions: [
      {
        key: "task_type",
        labelEn: "What kind of help is this?",
        labelEs: "Que tipo de ayuda necesitas?",
        helperEn: "Choose the closest match. VYVA can adapt it later.",
        helperEs: "Elige lo mas parecido. VYVA puede ajustarlo despues.",
        kind: "choice",
        options: [
          { key: "form", labelEn: "Form", labelEs: "Formulario" },
          { key: "letter", labelEn: "Letter or email", labelEs: "Carta o email" },
          { key: "benefits", labelEn: "Benefits/admin", labelEs: "Ayuda administrativa" },
          { key: "bill", labelEn: "Bill or notice", labelEs: "Factura o aviso" },
          { key: "other", labelEn: "Not sure", labelEs: "No lo se" },
        ],
      },
      {
        key: "target",
        labelEn: "Which form, document, or office?",
        labelEs: "Que formulario, documento u oficina?",
        helperEn: "Add the name if you know it. Do not include sensitive numbers here.",
        helperEs: "Anade el nombre si lo sabes. No incluyas numeros sensibles aqui.",
        kind: "text",
        placeholderEn: "E.g. insurance claim, council form, tax notice",
        placeholderEs: "Ej. reclamacion de seguro, formulario municipal, aviso fiscal",
      },
      {
        key: "action_needed",
        labelEn: "What should VYVA prepare first?",
        labelEs: "Que debe preparar VYVA primero?",
        helperEn: "This is only preparation. You confirm before sending, uploading, or submitting.",
        helperEs: "Esto solo prepara. Confirmas antes de enviar, subir o presentar.",
        kind: "choice",
        options: [
          { key: "prepare_answers", labelEn: "Prepare answers", labelEs: "Preparar respuestas" },
          { key: "review_risks", labelEn: "Review risks", labelEs: "Revisar riesgos" },
          { key: "draft_message", labelEn: "Draft message", labelEs: "Redactar mensaje" },
          { key: "application_steps", labelEn: "Application steps", labelEs: "Pasos de solicitud" },
        ],
      },
    ],
  },
  provider_deal_comparison: {
    kind: "provider_deal_comparison",
    titleEn: "Comparison ready",
    titleEs: "Comparacion lista",
    detailEn: "VYVA compares trust, fit, price, and next steps before anyone is contacted.",
    detailEs: "VYVA compara confianza, ajuste, precio y proximos pasos antes de contactar con nadie.",
    primaryEn: "Confirm comparison",
    primaryEs: "Confirmar comparacion",
    questions: [
      {
        key: "comparison_type",
        labelEn: "What should be compared?",
        labelEs: "Que quieres comparar?",
        helperEn: "Pick the closest area so VYVA asks for only the useful details.",
        helperEs: "Elige el area mas cercana para que VYVA pida solo lo util.",
        kind: "choice",
        options: [
          { key: "medical_provider", labelEn: "Medical provider", labelEs: "Proveedor medico" },
          { key: "home_service", labelEn: "Home service", labelEs: "Servicio en casa" },
          { key: "care_residence", labelEn: "Care/residence", labelEs: "Cuidado/residencia" },
          { key: "deal", labelEn: "Deal or plan", labelEs: "Oferta o plan" },
        ],
      },
      {
        key: "provider_path",
        labelEn: "Where should VYVA start?",
        labelEs: "Por donde empieza VYVA?",
        helperEn: "Saved provider uses your profile. If none is saved, VYVA will guide setup first.",
        helperEs: "Proveedor guardado usa tu perfil. Si no hay, VYVA guia la configuracion primero.",
        kind: "choice",
        options: [
          { key: "saved_provider", labelEn: "Saved provider", labelEs: "Proveedor guardado" },
          { key: "find_options", labelEn: "Find options", labelEs: "Buscar opciones" },
          { key: "compare_names", labelEn: "I have names", labelEs: "Tengo nombres" },
        ],
      },
      {
        key: "priority",
        labelEn: "What matters most?",
        labelEs: "Que importa mas?",
        helperEn: "VYVA can still include the other factors in the comparison.",
        helperEs: "VYVA tambien puede incluir los otros factores en la comparacion.",
        kind: "choice",
        options: [
          { key: "trust", labelEn: "Trust", labelEs: "Confianza" },
          { key: "cost", labelEn: "Cost", labelEs: "Precio" },
          { key: "distance", labelEn: "Distance", labelEs: "Cercania" },
          { key: "speed", labelEn: "Soonest", labelEs: "Rapidez" },
          { key: "accessibility", labelEn: "Accessibility", labelEs: "Accesibilidad" },
        ],
      },
    ],
  },
  safe_review: {
    kind: "safe_review",
    titleEn: "Safe review ready",
    titleEs: "Revision segura lista",
    detailEn: "VYVA reviews documents, messages, companies, or links before you reply or share data.",
    detailEs: "VYVA revisa documentos, mensajes, empresas o enlaces antes de responder o compartir datos.",
    primaryEn: "Confirm safe review",
    primaryEs: "Confirmar revision",
    questions: [
      {
        key: "item_type",
        labelEn: "What should VYVA review?",
        labelEs: "Que debe revisar VYVA?",
        helperEn: "No upload is required yet. Start with the safest description.",
        helperEs: "No hace falta subir nada todavia. Empieza con la descripcion mas segura.",
        kind: "choice",
        options: [
          { key: "message", labelEn: "Message", labelEs: "Mensaje" },
          { key: "document", labelEn: "Document", labelEs: "Documento" },
          { key: "company", labelEn: "Company", labelEs: "Empresa" },
          { key: "contract", labelEn: "Contract", labelEs: "Contrato" },
          { key: "website", labelEn: "Website/link", labelEs: "Web/enlace" },
        ],
      },
      {
        key: "concern",
        labelEn: "What worries you?",
        labelEs: "Que te preocupa?",
        helperEn: "VYVA will check this first and flag anything else it notices.",
        helperEs: "VYVA revisara esto primero y marcara cualquier otra cosa que vea.",
        kind: "choice",
        options: [
          { key: "scam_risk", labelEn: "Scam risk", labelEs: "Riesgo de estafa" },
          { key: "charges", labelEn: "Fees or charges", labelEs: "Costes o cargos" },
          { key: "identity", labelEn: "Identity/data", labelEs: "Identidad/datos" },
          { key: "terms", labelEn: "Terms", labelEs: "Condiciones" },
          { key: "not_sure", labelEn: "Not sure", labelEs: "No lo se" },
        ],
      },
      {
        key: "desired_action",
        labelEn: "What should happen next?",
        labelEs: "Que debe pasar despues?",
        helperEn: "VYVA prepares a safe next step. You confirm before replying, uploading, or sharing data.",
        helperEs: "VYVA prepara un siguiente paso seguro. Confirmas antes de responder, subir o compartir datos.",
        kind: "choice",
        options: [
          { key: "summarize", labelEn: "Summarize", labelEs: "Resumir" },
          { key: "risk_check", labelEn: "Risk check", labelEs: "Revisar riesgos" },
          { key: "draft_questions", labelEn: "Draft questions", labelEs: "Preparar preguntas" },
          { key: "handoff_report", labelEn: "Prepare report", labelEs: "Preparar informe" },
        ],
      },
    ],
  },
};

export function conciergeHandoffWorkflow(kind: ConciergeHandoffKind): ConciergeHandoffWorkflow {
  return WORKFLOWS[kind];
}

export function conciergeHandoffTitle(kind: ConciergeHandoffKind, isSpanish: boolean): string {
  const workflow = WORKFLOWS[kind];
  return isSpanish ? workflow.titleEs : workflow.titleEn;
}

export function conciergeHandoffDetail(kind: ConciergeHandoffKind, isSpanish: boolean): string {
  const workflow = WORKFLOWS[kind];
  return isSpanish ? workflow.detailEs : workflow.detailEn;
}

export function conciergeHandoffPrimaryLabel(kind: ConciergeHandoffKind, isSpanish: boolean): string {
  const workflow = WORKFLOWS[kind];
  return isSpanish ? workflow.primaryEs : workflow.primaryEn;
}

export function conciergeHandoffQuestionText(question: ConciergeHandoffQuestion, isSpanish: boolean): string {
  return isSpanish ? question.labelEs : question.labelEn;
}

export function conciergeHandoffQuestionHelper(question: ConciergeHandoffQuestion, isSpanish: boolean): string {
  return isSpanish ? question.helperEs : question.helperEn;
}

export function conciergeHandoffOptionText(
  option: NonNullable<ConciergeHandoffQuestion["options"]>[number],
  isSpanish: boolean,
): string {
  return isSpanish ? option.labelEs : option.labelEn;
}

export function nextMissingHandoffQuestion(
  kind: ConciergeHandoffKind,
  answers: ConciergeHandoffAnswers,
): ConciergeHandoffQuestion | null {
  return WORKFLOWS[kind].questions.find((question) => !answers[question.key]?.trim()) ?? null;
}

function labelForAnswer(kind: ConciergeHandoffKind, key: string, value: string, isSpanish: boolean): string {
  const question = WORKFLOWS[kind].questions.find((item) => item.key === key);
  const option = question?.options?.find((item) => item.key === value);
  if (option) return conciergeHandoffOptionText(option, isSpanish);
  if (value === "not_sure") return isSpanish ? "No lo se" : "Not sure";
  return value;
}

export function buildConciergeHandoffHighlights(
  kind: ConciergeHandoffKind,
  answers: ConciergeHandoffAnswers,
  isSpanish: boolean,
) {
  return WORKFLOWS[kind].questions
    .filter((question) => answers[question.key]?.trim())
    .map((question) => ({
      label: conciergeHandoffQuestionText(question, isSpanish).replace(/[?¿]/g, ""),
      value: labelForAnswer(kind, question.key, answers[question.key], isSpanish),
    }));
}

export function buildConciergeHandoffMessage(params: {
  kind: ConciergeHandoffKind;
  answers: ConciergeHandoffAnswers;
  originalMessage: string;
  isSpanish: boolean;
  savedProviderName?: string;
}) {
  const { kind, answers, originalMessage, isSpanish, savedProviderName } = params;
  const workflow = WORKFLOWS[kind];
  const lines = workflow.questions
    .filter((question) => answers[question.key]?.trim())
    .map((question) => {
      const label = conciergeHandoffQuestionText(question, isSpanish).replace(/[?¿]/g, "");
      return `${label}: ${labelForAnswer(kind, question.key, answers[question.key], isSpanish)}`;
    });

  const savedProviderLine = savedProviderName && answers.provider_path === "saved_provider"
    ? (isSpanish ? `Proveedor guardado: ${savedProviderName}` : `Saved provider: ${savedProviderName}`)
    : "";

  return [
    originalMessage.trim(),
    lines.length > 0
      ? `${isSpanish ? "Detalles recogidos" : "Collected details"}:\n${[...lines, savedProviderLine].filter(Boolean).join("\n")}`
      : "",
    isSpanish
      ? "Pregunta solo por lo que falte. Usa datos ya guardados en mi perfil cuando sea seguro."
      : "Ask only for anything still missing. Use facts already saved in my profile where safe.",
    isSpanish
      ? "Antes de llamar, enviar email, rellenar formularios, solicitar una cita, subir documentos, comprar o compartir datos, preparame un resumen y espera mi confirmacion final."
      : "Before calling, emailing, filling forms, requesting an appointment, uploading documents, purchasing, or sharing data, prepare a summary and wait for my final confirmation.",
  ].filter(Boolean).join("\n\n");
}

export function buildConciergeHandoffConfirmationItems(params: {
  kind: ConciergeHandoffKind;
  answers: ConciergeHandoffAnswers;
  isSpanish: boolean;
  savedProviderName?: string;
  needsProviderSetup?: boolean;
}): ConciergeHandoffConfirmationItem[] {
  const { kind, answers, isSpanish, savedProviderName, needsProviderSetup } = params;
  const items: ConciergeHandoffConfirmationItem[] = [
    {
      label: isSpanish ? "Detalles necesarios recogidos" : "Needed details collected",
      helper: isSpanish
        ? "VYVA continuara solo con lo que falta, no repetira datos ya guardados."
        : "VYVA continues with only what is missing and will not repeat saved profile facts.",
    },
  ];

  if (kind === "provider_deal_comparison" && answers.provider_path === "saved_provider") {
    items.push({
      label: savedProviderName
        ? (isSpanish ? `Usar ${savedProviderName}` : `Use ${savedProviderName}`)
        : (isSpanish ? "Proveedor guardado pendiente" : "Saved provider needed"),
      helper: needsProviderSetup
        ? (isSpanish ? "Anade un proveedor guardado antes de continuar con esta ruta." : "Add a saved provider before continuing on this path.")
        : (isSpanish ? "VYVA empezara con el proveedor guardado en tu perfil." : "VYVA starts with the provider saved in your profile."),
    });
  }

  items.push(
    {
      label: isSpanish ? "Solo preparar el siguiente paso" : "Prepare the next step only",
      helper: isSpanish
        ? "Esto no reserva, compra, envia, sube ni comparte nada todavia."
        : "This does not book, purchase, send, upload, or share anything yet.",
    },
    {
      label: isSpanish ? "Confirmacion final obligatoria" : "Final confirmation required",
      helper: isSpanish
        ? "Cualquier llamada, email, formulario, solicitud, compra o datos compartidos necesita tu aprobacion final."
        : "Any call, email, form, application, purchase, or shared data requires your final approval.",
    },
  );

  return items;
}
