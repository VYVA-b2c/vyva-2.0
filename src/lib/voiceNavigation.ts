import type { TranscriptEntry } from "@/hooks/useVyvaVoice";

export const VYVA_VOICE_USER_MESSAGE_EVENT = "vyva:voice-user-message";
export const VYVA_VOICE_APP_ACTION_EVENT = "vyva:voice-app-action";
export const VYVA_VOICE_APP_ACTION_RESULT_EVENT = "vyva:voice-app-action-result";
export const VYVA_VOICE_SPECIALIST_TRANSFER_EVENT = "vyva:voice-specialist-transfer";

export type VoiceUserMessageDetail = {
  text: string;
  transcriptEntry: TranscriptEntry;
};

export type VoiceAppActionDomain =
  | "meds"
  | "health"
  | "safety"
  | "concierge"
  | "brain_coach"
  | "social"
  | "reports";

export type VoiceAppAction = {
  id: string;
  domain: VoiceAppActionDomain;
  route: string;
  title: string;
  summary: string;
  cue: string;
  sourceText: string;
  priority: "high" | "medium" | "low";
  extractedSubject?: string;
  feedbackReason: string;
};

export type VoiceAppActionResult = {
  action: "accepted" | "dismissed" | "completed";
  actionId?: string;
  domain?: VoiceAppActionDomain;
  title?: string;
  reason?: string;
  evidence?: string;
  source?: string;
};

export type VoiceSpecialistTransferDomain = VoiceAppActionDomain | "doctor" | "companion";

export type VoiceSpecialistTransferRequest = {
  domain: VoiceSpecialistTransferDomain;
  reason: string;
  evidence?: string;
  contextHint?: string;
  route?: string;
  agentSlug?: string;
  autoStart?: boolean;
};

export function emitVoiceUserMessage(detail: VoiceUserMessageDetail) {
  window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, { detail }));
}

export function emitVoiceAppAction(action: VoiceAppAction) {
  window.dispatchEvent(new CustomEvent<VoiceAppAction>(VYVA_VOICE_APP_ACTION_EVENT, { detail: action }));
}

export function emitVoiceAppActionResult(result: VoiceAppActionResult) {
  window.dispatchEvent(new CustomEvent<VoiceAppActionResult>(VYVA_VOICE_APP_ACTION_RESULT_EVENT, { detail: result }));
}

export function emitVoiceSpecialistTransfer(request: VoiceSpecialistTransferRequest) {
  window.dispatchEvent(new CustomEvent<VoiceSpecialistTransferRequest>(VYVA_VOICE_SPECIALIST_TRANSFER_EVENT, { detail: request }));
}

function normalizeIntentText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, patterns: Array<string | RegExp>) {
  return patterns.some((pattern) =>
    typeof pattern === "string" ? text.includes(pattern) : pattern.test(text),
  );
}

function medicationSubject(text: string) {
  const known = [
    "paracetamol",
    "ibuprofen",
    "aspirin",
    "metformin",
    "lisinopril",
  ];
  return known.find((item) => text.includes(item));
}

function createAction(input: Omit<VoiceAppAction, "sourceText">, sourceText: string): VoiceAppAction {
  return { ...input, sourceText };
}

type VoiceActionTemplate = Omit<VoiceAppAction, "sourceText">;

const APP_ACTION_TEMPLATES: Record<string, VoiceActionTemplate> = {
  meds_management: {
    id: "voice_meds_management",
    domain: "meds",
    route: "/meds",
    title: "Medication management",
    summary: "Opening the medication page for schedule, dose, refill, and routine support.",
    cue: "Use the medication profile and ask what part of the routine they want to review.",
    priority: "high",
    feedbackReason: "Agent requested medication management context.",
  },
  meds_inventory_report: {
    id: "voice_meds_inventory_report",
    domain: "meds",
    route: "/meds/adherence-report",
    title: "Medication check",
    summary: "Opening the medication report so VYVA can use adherence and stock context.",
    cue: "Review medication confirmations, missed doses, and practical next steps.",
    priority: "high",
    feedbackReason: "Agent requested medication stock, adherence, or refill context.",
  },
  vitals_review: {
    id: "voice_vitals_review",
    domain: "health",
    route: "/health/vitals",
    title: "Vitals review",
    summary: "Opening vitals so VYVA can use the latest scan and trend context.",
    cue: "Review the latest vitals context without diagnosing.",
    priority: "high",
    feedbackReason: "Agent requested vitals context.",
  },
  doctor_health_support: {
    id: "voice_doctor_health_support",
    domain: "health",
    route: "/health/doctor",
    title: "Doctor support",
    summary: "Opening doctor support so the conversation can use health profile context.",
    cue: "Use profile, GP, vitals, symptoms, and care context before asking repeat questions.",
    priority: "high",
    feedbackReason: "Agent requested doctor or health-support context.",
  },
  symptom_support: {
    id: "voice_symptom_support",
    domain: "health",
    route: "/health/symptom-check",
    title: "Symptom support",
    summary: "Opening symptom support so VYVA can help structure what is happening.",
    cue: "Ask one focused question at a time and stay away from diagnosis.",
    priority: "high",
    feedbackReason: "Agent requested symptom-support context.",
  },
  safety_support: {
    id: "voice_safety_support",
    domain: "safety",
    route: "/safe-home",
    title: "Safety support",
    summary: "Opening safety support for urgent help, falls, or immediate concerns.",
    cue: "Check immediate safety and whether emergency help or a caregiver is needed.",
    priority: "high",
    feedbackReason: "Agent requested safety support.",
  },
  scam_support: {
    id: "voice_scam_support",
    domain: "safety",
    route: "/scam-guard",
    title: "Scam support",
    summary: "Opening scam support so VYVA can help check the situation calmly.",
    cue: "Ask what happened and avoid asking for bank details.",
    priority: "high",
    feedbackReason: "Agent requested scam or fraud support.",
  },
  concierge_task: {
    id: "voice_concierge_task",
    domain: "concierge",
    route: "/concierge",
    title: "Concierge help",
    summary: "Opening Concierge for appointments, transport, shopping, reminders, or planning.",
    cue: "Turn the request into one practical next step and confirm before taking action.",
    priority: "medium",
    feedbackReason: "Agent requested concierge support.",
  },
  brain_activity: {
    id: "voice_brain_activity",
    domain: "brain_coach",
    route: "/activities",
    title: "Brain activities",
    summary: "Opening activities for games, practice, and friendly brain-coach support.",
    cue: "Offer a light activity and keep encouragement available.",
    priority: "medium",
    feedbackReason: "Agent requested brain-coach activity context.",
  },
  memory_game: {
    id: "voice_memory_game",
    domain: "brain_coach",
    route: "/memory-games",
    title: "Memory games",
    summary: "Opening memory games so the Brain Coach can keep the user company while playing.",
    cue: "Encourage the user and offer a gentle game choice.",
    priority: "medium",
    feedbackReason: "Agent requested memory game context.",
  },
  social_rooms: {
    id: "voice_social_rooms",
    domain: "social",
    route: "/social-rooms",
    title: "Social rooms",
    summary: "Opening social rooms so VYVA can suggest a warm connection around interests.",
    cue: "Use interests and recent social context to suggest one room or chat topic.",
    priority: "medium",
    feedbackReason: "Agent requested social or companion context.",
  },
  reports_history: {
    id: "voice_reports_history",
    domain: "reports",
    route: "/informes",
    title: "Reports",
    summary: "Opening reports so VYVA can reference previous scans and health summaries.",
    cue: "Use report history only when relevant to the user's question.",
    priority: "medium",
    feedbackReason: "Agent requested reports or history context.",
  },
};

const ROUTE_TO_TEMPLATE_KEY: Record<string, keyof typeof APP_ACTION_TEMPLATES> = {
  "/meds": "meds_management",
  "/meds/adherence-report": "meds_inventory_report",
  "/health": "doctor_health_support",
  "/health/doctor": "doctor_health_support",
  "/health/symptom-check": "symptom_support",
  "/health/vitals": "vitals_review",
  "/safe-home": "safety_support",
  "/scam-guard": "scam_support",
  "/concierge": "concierge_task",
  "/activities": "brain_activity",
  "/memory-games": "memory_game",
  "/social-rooms": "social_rooms",
  "/companions": "social_rooms",
  "/informes": "reports_history",
};

const ACTION_ID_TO_TEMPLATE_KEY = Object.fromEntries(
  Object.entries(APP_ACTION_TEMPLATES).map(([key, value]) => [value.id, key]),
) as Record<string, keyof typeof APP_ACTION_TEMPLATES>;

const DOMAIN_TO_TEMPLATE_KEY: Record<VoiceAppActionDomain, keyof typeof APP_ACTION_TEMPLATES> = {
  meds: "meds_management",
  health: "doctor_health_support",
  safety: "safety_support",
  concierge: "concierge_task",
  brain_coach: "brain_activity",
  social: "social_rooms",
  reports: "reports_history",
};

const SPECIALIST_TO_TEMPLATE_KEY: Record<VoiceSpecialistTransferDomain, keyof typeof APP_ACTION_TEMPLATES> = {
  meds: "meds_management",
  health: "doctor_health_support",
  doctor: "doctor_health_support",
  safety: "safety_support",
  concierge: "concierge_task",
  brain_coach: "brain_activity",
  social: "social_rooms",
  companion: "social_rooms",
  reports: "reports_history",
};

export const VOICE_SPECIALIST_AGENT_SLUGS: Partial<Record<VoiceSpecialistTransferDomain, string>> = {
  meds: "meds",
  health: "health",
  doctor: "doctor",
  safety: "safety",
  concierge: "concierge",
  brain_coach: "brain-coach",
  social: "companion",
  companion: "companion",
};

function stringParam(parameters: Record<string, unknown>, key: string) {
  const value = parameters[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoute(route: string) {
  const trimmed = route.trim();
  if (!trimmed.startsWith("/")) return "";
  return trimmed.replace(/\/+$/, "") || "/";
}

export function isVoiceAppActionDomain(value: string): value is VoiceAppActionDomain {
  return value in DOMAIN_TO_TEMPLATE_KEY;
}

export function isVoiceSpecialistTransferDomain(value: string): value is VoiceSpecialistTransferDomain {
  return value in SPECIALIST_TO_TEMPLATE_KEY;
}

function actionFromTemplate(
  templateKey: keyof typeof APP_ACTION_TEMPLATES,
  sourceText: string,
  overrides: Partial<Pick<VoiceAppAction, "id" | "title" | "summary" | "cue" | "priority" | "extractedSubject" | "feedbackReason">> = {},
) {
  const template = APP_ACTION_TEMPLATES[templateKey];
  return createAction({
    ...template,
    ...overrides,
  }, sourceText || overrides.feedbackReason || template.feedbackReason);
}

export function actionForVoiceToolCall(parameters: Record<string, unknown>): VoiceAppAction | null {
  const sourceText = stringParam(parameters, "source_text")
    || stringParam(parameters, "evidence")
    || stringParam(parameters, "reason")
    || "ElevenLabs tool call";
  const rawRoute = normalizeRoute(stringParam(parameters, "route"));
  const rawActionId = stringParam(parameters, "action_id");
  const rawActionType = stringParam(parameters, "action_type");
  const rawDomain = stringParam(parameters, "domain");
  const templateKey =
    (rawActionType && rawActionType in APP_ACTION_TEMPLATES ? rawActionType : undefined)
    || (rawActionId && rawActionId in APP_ACTION_TEMPLATES ? rawActionId : undefined)
    || (rawActionId ? ACTION_ID_TO_TEMPLATE_KEY[rawActionId] : undefined)
    || (rawRoute ? ROUTE_TO_TEMPLATE_KEY[rawRoute] : undefined)
    || (isVoiceAppActionDomain(rawDomain) ? DOMAIN_TO_TEMPLATE_KEY[rawDomain] : undefined);

  if (!templateKey) return null;

  const title = stringParam(parameters, "title");
  const summary = stringParam(parameters, "summary");
  const cue = stringParam(parameters, "cue");
  const reason = stringParam(parameters, "reason");
  const subject = stringParam(parameters, "subject") || stringParam(parameters, "extracted_subject");
  const priorityParam = stringParam(parameters, "priority");
  const priority = priorityParam === "high" || priorityParam === "medium" || priorityParam === "low"
    ? priorityParam
    : undefined;

  return actionFromTemplate(templateKey, sourceText, {
    ...(rawActionId && !(rawActionId in APP_ACTION_TEMPLATES) ? { id: rawActionId } : {}),
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    ...(cue ? { cue } : {}),
    ...(priority ? { priority } : {}),
    ...(subject ? { extractedSubject: subject } : {}),
    ...(reason ? { feedbackReason: reason } : {}),
  });
}

export function actionForSpecialistTransfer(request: VoiceSpecialistTransferRequest): VoiceAppAction {
  const templateKey = request.route
    ? ROUTE_TO_TEMPLATE_KEY[normalizeRoute(request.route)] ?? SPECIALIST_TO_TEMPLATE_KEY[request.domain]
    : SPECIALIST_TO_TEMPLATE_KEY[request.domain];

  const template = APP_ACTION_TEMPLATES[templateKey];
  return actionFromTemplate(templateKey, request.evidence || request.reason, {
    id: `voice_transfer_${request.domain}`,
    title: template.title,
    summary: `Opening ${template.title.toLowerCase()} for specialist support.`,
    cue: request.contextHint || request.reason || template.cue,
    feedbackReason: request.reason || `Agent requested transfer to ${request.domain}.`,
    priority: request.domain === "safety" ? "high" : template.priority,
  });
}

export function specialistTransferFromToolCall(parameters: Record<string, unknown>): VoiceSpecialistTransferRequest | null {
  const rawDomain = stringParam(parameters, "domain").replace("-", "_");
  if (!isVoiceSpecialistTransferDomain(rawDomain)) return null;

  const reason = stringParam(parameters, "reason")
    || stringParam(parameters, "evidence")
    || `Transfer requested to ${rawDomain}.`;
  const autoStartParam = parameters.auto_start;

  return {
    domain: rawDomain,
    reason,
    evidence: stringParam(parameters, "evidence"),
    contextHint: stringParam(parameters, "context_hint") || reason,
    route: normalizeRoute(stringParam(parameters, "route")) || undefined,
    agentSlug: stringParam(parameters, "agent_slug") || VOICE_SPECIALIST_AGENT_SLUGS[rawDomain],
    autoStart: typeof autoStartParam === "boolean" ? autoStartParam : true,
  };
}

export function actionForVoiceUtterance(text: string): VoiceAppAction | null {
  const normalized = normalizeIntentText(text);
  if (!normalized) return null;

  const mentionsMedication = hasAny(normalized, [
    "medication",
    "medicine",
    "meds",
    "pill",
    "tablet",
    "dose",
    "prescription",
    "paracetamol",
    "ibuprofen",
    "aspirin",
    "metformin",
    "lisinopril",
    "medicacion",
    "medicina",
    "pastilla",
    "receta",
  ]);
  const subject = medicationSubject(normalized);

  if (mentionsMedication && hasAny(normalized, [
    "report",
    "inventory",
    "stock",
    "adherence",
    "missed",
    "taken",
    "buy",
    "need to buy",
    "do we need",
    "informe",
    "inventario",
    "comprar",
    "faltan",
    "tomado",
  ])) {
    return createAction({
      id: "voice_meds_inventory_report",
      domain: "meds",
      route: "/meds/adherence-report",
      title: subject ? `${subject} check` : "Medication check",
      summary: "Opening the medication report so VYVA can use adherence and stock context.",
      cue: subject
        ? `Review whether ${subject} needs attention.`
        : "Review medication confirmations, missed doses, and practical next steps.",
      priority: "high",
      extractedSubject: subject,
      feedbackReason: "User asked about medicine stock, buying, adherence, or missed/taken medication.",
    }, text);
  }

  if (mentionsMedication) {
    return createAction({
      id: "voice_meds_management",
      domain: "meds",
      route: "/meds",
      title: "Medication management",
      summary: "Opening the medication page for schedule, dose, refill, and routine support.",
      cue: "Use the medication profile and ask what part of the routine they want to review.",
      priority: "high",
      extractedSubject: subject,
      feedbackReason: "User raised medication, dose, prescription, or pill routine.",
    }, text);
  }

  if (hasAny(normalized, ["chest pain", "cant breathe", "can't breathe", "fallen", "fall", "emergency", "sos", "scam", "fraud", "estafa", "emergencia"])) {
    const isScam = hasAny(normalized, ["scam", "fraud", "estafa"]);
    return createAction({
      id: isScam ? "voice_scam_support" : "voice_safety_support",
      domain: "safety",
      route: isScam ? "/scam-guard" : "/safe-home",
      title: isScam ? "Scam support" : "Safety support",
      summary: isScam
        ? "Opening scam support so VYVA can help check the situation calmly."
        : "Opening safety support for urgent help, falls, or immediate concerns.",
      cue: isScam
        ? "Ask what happened and avoid asking for bank details."
        : "Check immediate safety and whether emergency help or a caregiver is needed.",
      priority: "high",
      feedbackReason: "User mentioned safety, fall, emergency, scam, or fraud language.",
    }, text);
  }

  if (hasAny(normalized, ["vitals", "blood pressure", "heart rate", "signos", "presion", "pulso"])) {
    return createAction({
      id: "voice_vitals_review",
      domain: "health",
      route: "/health/vitals",
      title: "Vitals review",
      summary: "Opening vitals so VYVA can use the latest scan and trend context.",
      cue: "Review the latest vitals context without diagnosing.",
      priority: "high",
      feedbackReason: "User mentioned vitals, blood pressure, heart rate, or pulse.",
    }, text);
  }

  if (hasAny(normalized, ["book gp", "book doctor", "gp appointment", "doctor appointment", "book appointment", "cita con", "pedir cita"])) {
    return createAction({
      id: "voice_book_health_appointment",
      domain: "concierge",
      route: "/concierge",
      title: "Appointment help",
      summary: "Opening Concierge to help plan, book, remind, or prepare for an appointment.",
      cue: "Offer help with booking, questions, reminders, transport, or provider contact.",
      priority: "high",
      feedbackReason: "User asked to book or arrange a GP/doctor appointment.",
    }, text);
  }

  if (hasAny(normalized, ["doctor", "gp", "medical", "symptom", "dizzy", "pain", "allergy", "allergies", "health", "medico", "sintoma", "alergia", "salud"])) {
    const doctorRoute = hasAny(normalized, ["doctor", "gp", "medico"]);
    return createAction({
      id: doctorRoute ? "voice_doctor_health_support" : "voice_symptom_support",
      domain: "health",
      route: doctorRoute ? "/health/doctor" : "/health/symptom-check",
      title: doctorRoute ? "Doctor support" : "Symptom support",
      summary: doctorRoute
        ? "Opening doctor support so the conversation can use health profile context."
        : "Opening symptom support so VYVA can help structure what is happening.",
      cue: doctorRoute
        ? "Use profile, GP, vitals, symptoms, and care context before asking repeat questions."
        : "Ask one focused question at a time and stay away from diagnosis.",
      priority: "high",
      feedbackReason: "User raised a health, symptom, doctor, allergy, or pain topic.",
    }, text);
  }

  if (hasAny(normalized, ["report", "reports", "history", "scan", "informe", "informes", "historial"])) {
    return createAction({
      id: "voice_reports_history",
      domain: "reports",
      route: "/informes",
      title: "Reports",
      summary: "Opening reports so VYVA can reference previous scans and health summaries.",
      cue: "Use report history only when relevant to the user's question.",
      priority: "medium",
      feedbackReason: "User asked for reports, history, scans, or summaries.",
    }, text);
  }

  if (hasAny(normalized, ["appointment", "book", "taxi", "shopping", "groceries", "delivery", "weather", "concierge", "cita", "compras", "taxi"])) {
    return createAction({
      id: "voice_concierge_task",
      domain: "concierge",
      route: "/concierge",
      title: "Concierge help",
      summary: "Opening Concierge for appointments, transport, shopping, reminders, or planning.",
      cue: "Turn the request into one practical next step and confirm before taking action.",
      priority: "medium",
      feedbackReason: "User asked for logistics, shopping, booking, weather, or reminder help.",
    }, text);
  }

  if (hasAny(normalized, ["memory game", "test my memory", "memoria", "juego de memoria"])) {
    return createAction({
      id: "voice_memory_game",
      domain: "brain_coach",
      route: "/memory-games",
      title: "Memory games",
      summary: "Opening memory games so the Brain Coach can keep the user company while playing.",
      cue: "Encourage the user and offer a gentle game choice.",
      priority: "medium",
      feedbackReason: "User asked for a memory game or memory practice.",
    }, text);
  }

  if (hasAny(normalized, ["brain", "activity", "activities", "exercise", "quiz", "game", "juego", "actividad"])) {
    return createAction({
      id: "voice_brain_activity",
      domain: "brain_coach",
      route: "/activities",
      title: "Brain activities",
      summary: "Opening activities for games, practice, and friendly brain-coach support.",
      cue: "Offer a light activity and keep encouragement available.",
      priority: "medium",
      feedbackReason: "User asked for an activity, game, quiz, or brain exercise.",
    }, text);
  }

  if (hasAny(normalized, ["social", "room", "community", "chat with people", "friends", "sala", "comunidad", "amigos"])) {
    return createAction({
      id: "voice_social_rooms",
      domain: "social",
      route: "/social-rooms",
      title: "Social rooms",
      summary: "Opening social rooms so VYVA can suggest a warm connection around interests.",
      cue: "Use interests and recent social context to suggest one room or chat topic.",
      priority: "medium",
      feedbackReason: "User asked about social rooms, community, friends, or chat.",
    }, text);
  }

  return null;
}

export function routeForVoiceUtterance(text: string): string | null {
  return actionForVoiceUtterance(text)?.route ?? null;
}
