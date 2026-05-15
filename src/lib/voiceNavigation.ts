import type { TranscriptEntry } from "@/hooks/useVyvaVoice";
import {
  buildVoiceAppAction,
  isVoiceAppActionDomain,
  isVoiceSpecialistTransferDomain,
  normalizeVoiceActionRoute,
  VOICE_SPECIALIST_AGENT_SLUGS,
  voiceActionEntryForLookup,
  voiceActionEntryForSpecialistTransfer,
  voiceActionRegistryEntries,
} from "@/lib/voiceActionRegistry";

export {
  isVoiceAppActionDomain,
  isVoiceSpecialistTransferDomain,
  VOICE_SPECIALIST_AGENT_SLUGS,
  voiceActionRegistryEntries,
};

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
  actionType?: string;
  domain: VoiceAppActionDomain;
  route: string;
  title: string;
  summary: string;
  cue: string;
  sourceText: string;
  priority: "high" | "medium" | "low";
  extractedSubject?: string;
  feedbackReason: string;
  payload?: Record<string, string | number | boolean>;
  requiredPayloadKeys?: readonly string[];
  optionalPayloadKeys?: readonly string[];
  safetyLevel?: "routine" | "sensitive" | "medical" | "urgent";
  requiresConfirmation?: boolean;
  completion?: {
    mode: "manual" | "route_landed";
    doneLabel: string;
    routeLandedDelayMs?: number;
    expiresAfterMs: number;
  };
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

function actionFromRegistry(
  actionType: string,
  sourceText: string,
  overrides: Partial<Pick<VoiceAppAction, "id" | "title" | "summary" | "cue" | "priority" | "extractedSubject" | "feedbackReason" | "payload">> = {},
) {
  const entry = voiceActionEntryForLookup({ actionType });
  if (!entry) {
    return createAction({
      id: overrides.id ?? actionType,
      domain: "social",
      route: "/",
      title: overrides.title ?? "VYVA",
      summary: overrides.summary ?? "Opening VYVA context.",
      cue: overrides.cue ?? "",
      priority: overrides.priority ?? "low",
      feedbackReason: overrides.feedbackReason ?? "Voice action registry entry was missing.",
    }, sourceText);
  }
  return buildVoiceAppAction(entry, sourceText, overrides);
}

function stringParam(parameters: Record<string, unknown>, key: string) {
  const value = parameters[key];
  return typeof value === "string" ? value.trim() : "";
}

const TOOL_PAYLOAD_RESERVED_KEYS = new Set([
  "action_id",
  "action_type",
  "domain",
  "route",
  "title",
  "summary",
  "cue",
  "reason",
  "evidence",
  "source_text",
  "priority",
  "subject",
  "extracted_subject",
]);

function payloadFromParameters(parameters: Record<string, unknown>) {
  const payload: VoiceAppAction["payload"] = {};
  Object.entries(parameters).forEach(([key, value]) => {
    if (TOOL_PAYLOAD_RESERVED_KEYS.has(key)) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      payload[key] = value;
    }
  });
  return Object.keys(payload).length ? payload : undefined;
}

export function actionForVoiceToolCall(parameters: Record<string, unknown>): VoiceAppAction | null {
  const sourceText = stringParam(parameters, "source_text")
    || stringParam(parameters, "evidence")
    || stringParam(parameters, "reason")
    || "ElevenLabs tool call";
  const rawRoute = normalizeVoiceActionRoute(stringParam(parameters, "route"));
  const rawActionId = stringParam(parameters, "action_id");
  const rawActionType = stringParam(parameters, "action_type");
  const rawDomain = stringParam(parameters, "domain");
  const entry = voiceActionEntryForLookup({
    actionType: rawActionType,
    actionId: rawActionId,
    route: rawRoute,
    domain: rawDomain,
  });

  if (!entry) return null;

  const title = stringParam(parameters, "title");
  const summary = stringParam(parameters, "summary");
  const cue = stringParam(parameters, "cue");
  const reason = stringParam(parameters, "reason");
  const subject = stringParam(parameters, "subject") || stringParam(parameters, "extracted_subject");
  const priorityParam = stringParam(parameters, "priority");
  const priority = priorityParam === "high" || priorityParam === "medium" || priorityParam === "low"
    ? priorityParam
    : undefined;
  const payload = payloadFromParameters(parameters);

  return buildVoiceAppAction(entry, sourceText, {
    ...(rawActionId && rawActionId !== entry.id ? { id: rawActionId } : {}),
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    ...(cue ? { cue } : {}),
    ...(priority ? { priority } : {}),
    ...(subject ? { extractedSubject: subject } : {}),
    ...(reason ? { feedbackReason: reason } : {}),
    ...(payload ? { payload } : {}),
  });
}

export function actionForSpecialistTransfer(request: VoiceSpecialistTransferRequest): VoiceAppAction {
  const entry = voiceActionEntryForSpecialistTransfer(request.domain, request.route);

  return buildVoiceAppAction(entry, request.evidence || request.reason, {
    id: `voice_transfer_${request.domain}`,
    title: entry.title,
    summary: `Opening ${entry.title.toLowerCase()} for specialist support.`,
    cue: request.contextHint || request.reason || entry.cue,
    feedbackReason: request.reason || `Agent requested transfer to ${request.domain}.`,
    priority: request.domain === "safety" ? "high" : entry.priority,
    payload: {
      transfer_domain: request.domain,
      ...(request.agentSlug ? { agent_slug: request.agentSlug } : {}),
    },
  });
}

export function specialistTransferFromToolCall(parameters: Record<string, unknown>): VoiceSpecialistTransferRequest | null {
  const rawDomain = stringParam(parameters, "domain").replace(/-/g, "_");
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
    route: normalizeVoiceActionRoute(stringParam(parameters, "route")) || undefined,
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
    return actionFromRegistry("meds.inventory_report", text, {
      title: subject ? `${subject} check` : "Medication check",
      cue: subject
        ? `Review whether ${subject} needs attention.`
        : "Review medication confirmations, missed doses, and practical next steps.",
      extractedSubject: subject,
      feedbackReason: "User asked about medicine stock, buying, adherence, or missed/taken medication.",
      payload: subject ? { medication_name: subject } : undefined,
    });
  }

  if (mentionsMedication) {
    return actionFromRegistry("meds.management", text, {
      extractedSubject: subject,
      feedbackReason: "User raised medication, dose, prescription, or pill routine.",
      payload: subject ? { medication_name: subject } : undefined,
    });
  }

  if (hasAny(normalized, ["chest pain", "cant breathe", "can't breathe", "fallen", "fall", "emergency", "sos", "scam", "fraud", "estafa", "emergencia"])) {
    const isScam = hasAny(normalized, ["scam", "fraud", "estafa"]);
    return actionFromRegistry(isScam ? "safety.scam_support" : "safety.support", text, {
      feedbackReason: "User mentioned safety, fall, emergency, scam, or fraud language.",
    });
  }

  if (hasAny(normalized, ["vitals", "blood pressure", "heart rate", "signos", "presion", "pulso"])) {
    return actionFromRegistry("health.vitals_review", text, {
      feedbackReason: "User mentioned vitals, blood pressure, heart rate, or pulse.",
    });
  }

  if (hasAny(normalized, ["book gp", "book doctor", "gp appointment", "doctor appointment", "book appointment", "cita con", "pedir cita"])) {
    return actionFromRegistry("concierge.appointment_help", text, {
      feedbackReason: "User asked to book or arrange a GP/doctor appointment.",
      payload: { task_type: "appointment" },
    });
  }

  if (hasAny(normalized, ["doctor", "gp", "medical", "symptom", "dizzy", "pain", "allergy", "allergies", "health", "medico", "sintoma", "alergia", "salud"])) {
    const doctorRoute = hasAny(normalized, ["doctor", "gp", "medico"]);
    return actionFromRegistry(doctorRoute ? "health.doctor_support" : "health.symptom_support", text, {
      feedbackReason: "User raised a health, symptom, doctor, allergy, or pain topic.",
    });
  }

  if (hasAny(normalized, ["report", "reports", "history", "scan", "informe", "informes", "historial"])) {
    return actionFromRegistry("reports.history", text, {
      feedbackReason: "User asked for reports, history, scans, or summaries.",
    });
  }

  if (hasAny(normalized, ["appointment", "book", "taxi", "shopping", "groceries", "delivery", "weather", "concierge", "cita", "compras", "taxi"])) {
    return actionFromRegistry("concierge.task", text, {
      feedbackReason: "User asked for logistics, shopping, booking, weather, or reminder help.",
    });
  }

  if (hasAny(normalized, ["memory game", "test my memory", "memoria", "juego de memoria"])) {
    return actionFromRegistry("brain.memory_game", text, {
      feedbackReason: "User asked for a memory game or memory practice.",
    });
  }

  if (hasAny(normalized, ["brain", "activity", "activities", "exercise", "quiz", "game", "juego", "actividad"])) {
    return actionFromRegistry("brain.activity", text, {
      feedbackReason: "User asked for an activity, game, quiz, or brain exercise.",
    });
  }

  if (hasAny(normalized, ["social", "room", "community", "chat with people", "friends", "sala", "comunidad", "amigos"])) {
    return actionFromRegistry("social.rooms", text, {
      feedbackReason: "User asked about social rooms, community, friends, or chat.",
    });
  }

  return null;
}

export function routeForVoiceUtterance(text: string): string | null {
  return actionForVoiceUtterance(text)?.route ?? null;
}
