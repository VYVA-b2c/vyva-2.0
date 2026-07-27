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
import { normalizeHomeServiceType } from "../../shared/serviceIntake";

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
export const VYVA_VOICE_HOME_INTENT_EVENT = "vyva:voice-home-intent";

export type VoiceUserMessageDetail = {
  text: string;
  transcriptEntry: TranscriptEntry;
};

export type VoiceHomeIntent = "health" | "mind" | "community" | "concierge";

export function isVoiceHomeIntent(value: unknown): value is VoiceHomeIntent {
  return value === "health"
    || value === "mind"
    || value === "community"
    || value === "concierge";
}

export type VoiceHomeIntentTransition =
  | { kind: "home_layer"; layer: "health" }
  | { kind: "route"; route: "/mind-memory" | "/social-rooms" | "/concierge" };

const VOICE_HOME_INTENT_TRANSITIONS: Record<VoiceHomeIntent, VoiceHomeIntentTransition> = {
  health: { kind: "home_layer", layer: "health" },
  mind: { kind: "route", route: "/mind-memory" },
  community: { kind: "route", route: "/social-rooms" },
  concierge: { kind: "route", route: "/concierge" },
};

export function transitionForVoiceHomeIntent(intent: VoiceHomeIntent): VoiceHomeIntentTransition {
  return VOICE_HOME_INTENT_TRANSITIONS[intent];
}

export function toolResultForVoiceHomeIntent(intent: VoiceHomeIntent) {
  if (intent === "health") return "Showing the Health choices.";

  const labels: Record<Exclude<VoiceHomeIntent, "health">, string> = {
    mind: "Mind",
    community: "Community",
    concierge: "Concierge",
  };
  return `Opening ${labels[intent]}.`;
}

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
  appEntrypoint?: string;
};

export function emitVoiceUserMessage(detail: VoiceUserMessageDetail) {
  window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, { detail }));
}

export function emitVoiceHomeIntent(intent: VoiceHomeIntent) {
  window.dispatchEvent(new CustomEvent<VoiceHomeIntent>(VYVA_VOICE_HOME_INTENT_EVENT, { detail: intent }));
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

export function homeIntentForVoiceUtterance(text: string): VoiceHomeIntent | null {
  const normalized = normalizeIntentText(text)
    .replace(/[!?.,;:]+/g, "")
    .trim();
  const specificHealthSignals = [
    /\b(?:symptom|pain|fever|dizzy|blood pressure|pulse|oxygen|temperature|weight|glucose|doctor|appointment|medication|medicine|pill|dose)\b/,
    /\b(?:sintoma|dolor|fiebre|mareo|presion|tension|pulso|oxigeno|temperatura|peso|glucosa|medico|doctor|cita|medicacion|medicina|pastilla|dosis)\b/,
    /\b(?:symptome|douleur|fievre|vertige|tension|pouls|oxygene|temperature|poids|glycemie|medecin|rendez-vous|medicament|dose)\b/,
    /\b(?:symptom|schmerz|fieber|schwindel|blutdruck|puls|sauerstoff|temperatur|gewicht|glukose|arzt|termin|medikament|tablette|dosis)\b/,
    /\b(?:sintomo|dolore|febbre|vertigine|pressione|polso|ossigeno|temperatura|peso|glucosio|medico|appuntamento|medicina|farmaco|pillola|dose)\b/,
    /\b(?:sintoma|dor|febre|tontura|pressao|pulso|oxigenio|temperatura|peso|glicose|medico|consulta|medicamento|remedio|comprimido|dose)\b/,
  ];

  if (specificHealthSignals.some((pattern) => pattern.test(normalized))) return null;

  const broadHealthRequests = [
    /^(?:(?:open|show|go to|take me to)\s+)?(?:my\s+)?health(?:\s+(?:page|menu|options|section|help|support))?$/,
    /^(?:could|can|would)\s+you\s+(?:open|show)\s+(?:me\s+)?(?:my\s+)?health(?:\s+(?:page|menu|options|section))?$/,
    /^(?:i\s+(?:need|want|would like)\s+)?(?:some\s+)?(?:help|support)\s+with\s+(?:my\s+)?health$/,
    /^(?:i\s+(?:need|want|would like)\s+)?health\s+(?:help|support)$/,
    /^(?:(?:abre|muestra|ve a|llevame a)\s+)?(?:mi\s+)?salud(?:\s+(?:pagina|menu|opciones|seccion|ayuda|apoyo))?$/,
    /^(?:muestra|muestrame|ensena|ensename|abre)\s+(?:las\s+)?(?:opciones|pagina|seccion|menu)\s+de\s+(?:mi\s+)?salud$/,
    /^(?:quiero|necesito|me gustaria)?\s*(?:ayuda|apoyo)\s+(?:con|para)\s+mi\s+salud$/,
    /^(?:(?:offne|zeige|gehe zu)\s+)?(?:meine\s+)?gesundheit(?:\s+(?:seite|menu|optionen|bereich|hilfe|unterstutzung))?$/,
    /^(?:ich\s+(?:brauche|mochte)\s+)?(?:hilfe|unterstutzung)\s+(?:fur|bei)\s+(?:meine[r]?\s+)?gesundheit$/,
    /^(?:(?:ouvre|affiche|va a)\s+)?(?:ma\s+)?sante(?:\s+(?:page|menu|options|rubrique|aide|soutien))?$/,
    /^(?:je\s+(?:veux|voudrais|souhaite)\s+)?(?:de l[' ]?)?(?:aide|soutien)\s+(?:pour|avec)\s+ma\s+sante$/,
    /^(?:(?:apri|mostra|vai a)\s+)?(?:la\s+mia\s+)?salute(?:\s+(?:pagina|menu|opzioni|sezione|aiuto|supporto))?$/,
    /^(?:voglio|vorrei|ho bisogno di)?\s*(?:aiuto|supporto)\s+(?:con|per)\s+la\s+mia\s+salute$/,
    /^(?:(?:abre|mostra|va para)\s+)?(?:a\s+minha\s+|minha\s+)?saude(?:\s+(?:pagina|menu|opcoes|secao|ajuda|apoio))?$/,
    /^(?:quero|preciso de|gostaria de)?\s*(?:ajuda|apoio)\s+(?:com|para)\s+a\s+minha\s+saude$/,
  ];

  if (broadHealthRequests.some((pattern) => pattern.test(normalized))) return "health";

  const broadPillarRequests: Array<[VoiceHomeIntent, RegExp[]]> = [
    ["mind", [
      /^(?:(?:open|show|go to|take me to)\s+)?(?:my\s+)?(?:mind|brain|cognitive)(?:\s+(?:page|menu|options|section|activities|exercises))?$/,
      /^(?:(?:abre|muestra|ve a|llevame a)\s+)?(?:mi\s+)?(?:mente|cerebro)(?:\s+(?:pagina|menu|opciones|seccion|actividades|ejercicios))?$/,
      /^(?:(?:ouvre|affiche|va a)\s+)?(?:mon\s+)?(?:cerveau|cognition)(?:\s+(?:page|menu|options|rubrique|activites|exercices))?$/,
      /^(?:(?:offne|zeige|gehe zu)\s+)?(?:mein\s+)?(?:gehirn|gedachtnis)(?:\s+(?:seite|menu|optionen|bereich|ubungen))?$/,
      /^(?:(?:apri|mostra|vai a)\s+)?(?:la\s+mia\s+)?(?:mente|memoria)(?:\s+(?:pagina|menu|opzioni|sezione|attivita|esercizi))?$/,
      /^(?:(?:abre|mostra|va para)\s+)?(?:a\s+minha\s+|minha\s+)?(?:mente|memoria)(?:\s+(?:pagina|menu|opcoes|secao|atividades|exercicios))?$/,
    ]],
    ["community", [
      /^(?:(?:open|show|go to|take me to)\s+)?(?:my\s+)?(?:community|social)(?:\s+(?:page|menu|options|section|rooms))?$/,
      /^(?:(?:abre|muestra|ve a|llevame a)\s+)?(?:mi\s+)?comunidad(?:\s+(?:pagina|menu|opciones|seccion|salas))?$/,
      /^(?:(?:ouvre|affiche|va a)\s+)?(?:ma\s+)?communaute(?:\s+(?:page|menu|options|rubrique|salons))?$/,
      /^(?:(?:offne|zeige|gehe zu)\s+)?(?:meine\s+)?gemeinschaft(?:\s+(?:seite|menu|optionen|bereich|raume))?$/,
      /^(?:(?:apri|mostra|vai a)\s+)?(?:la\s+mia\s+)?comunita(?:\s+(?:pagina|menu|opzioni|sezione|stanze))?$/,
      /^(?:(?:abre|mostra|va para)\s+)?(?:a\s+minha\s+|minha\s+)?comunidade(?:\s+(?:pagina|menu|opcoes|secao|salas))?$/,
    ]],
    ["concierge", [
      /^(?:(?:open|show|go to|take me to)\s+)?(?:my\s+)?concierge(?:\s+(?:page|menu|options|section|services))?$/,
      /^(?:(?:abre|muestra|ve a|llevame a)\s+)?(?:mi\s+)?concierge(?:\s+(?:pagina|menu|opciones|seccion|servicios))?$/,
      /^(?:(?:ouvre|affiche|va a)\s+)?(?:mon\s+)?concierge(?:\s+(?:page|menu|options|rubrique|services))?$/,
      /^(?:(?:offne|zeige|gehe zu)\s+)?(?:mein\s+)?concierge(?:\s+(?:seite|menu|optionen|bereich|dienste))?$/,
      /^(?:(?:apri|mostra|vai a)\s+)?(?:il\s+mio\s+)?concierge(?:\s+(?:pagina|menu|opzioni|sezione|servizi))?$/,
      /^(?:(?:abre|mostra|va para)\s+)?(?:o\s+meu\s+|meu\s+)?concierge(?:\s+(?:pagina|menu|opcoes|secao|servicos))?$/,
    ]],
  ];

  return broadPillarRequests.find(([, patterns]) => patterns.some((pattern) => pattern.test(normalized)))?.[0] ?? null;
}

export function homeIntentForVoiceToolCall(parameters: Record<string, unknown>): VoiceHomeIntent | null {
  const domain = (
    stringParam(parameters, "domain")
    || stringParam(parameters, "pillar")
  ).replace(/-/g, "_");
  const actionType = stringParam(parameters, "action_type");
  const actionId = stringParam(parameters, "action_id");
  const route = normalizeVoiceActionRoute(stringParam(parameters, "route"));

  if (!actionType && !actionId && (!route || route === "/")) {
    if (domain === "health") return "health";
    if (["brain", "mind", "cognitive", "brain_coach"].includes(domain)) return "mind";
    if (["social", "community"].includes(domain)) return "community";
    if (domain === "concierge") return "concierge";
  }

  return null;
}

const VOICE_NON_ACTIONABLE_FILLERS = new Set([
  "ah",
  "eh",
  "er",
  "hm",
  "hmm",
  "mm",
  "mmm",
  "oh",
  "uh",
  "um",
]);

export function isActionableVoiceText(text: string) {
  const normalized = normalizeIntentText(text);
  if (!normalized) return false;

  const meaningfulCharacters = normalized.replace(/[^\p{L}\p{N}]+/gu, "");
  if (meaningfulCharacters.length < 2) return false;
  if (VOICE_NON_ACTIONABLE_FILLERS.has(meaningfulCharacters)) return false;

  return true;
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

function homeServiceSubject(text: string) {
  const serviceType = normalizeHomeServiceType(text);
  if (serviceType !== "other") return serviceType;
  if (hasAny(text, ["home service", "home repair", "repair at home", "servicio en casa", "reparacion en casa"])) return "handyman";
  return "";
}

function firstMatchedValue(text: string, options: Array<[string, Array<string | RegExp>]>) {
  return options.find(([, patterns]) => hasAny(text, patterns))?.[0] ?? "";
}

function vitalTypeFromText(text: string) {
  return firstMatchedValue(text, [
    ["blood_pressure", ["blood pressure", "presion", "tension"]],
    ["heart_rate", ["heart rate", "pulse", "pulso"]],
    ["oxygen", ["oxygen", "spo2", "saturation", "saturacion"]],
    ["temperature", ["temperature", "fever", "temperatura", "fiebre"]],
    ["weight", ["weight", "peso"]],
    ["glucose", ["glucose", "blood sugar", "azucar"]],
  ]);
}

function shoppingCategoryFromText(text: string) {
  if (hasAny(text, ["grocery", "groceries", "supermarket", "food", "meal", "comida", "compra", "supermercado"])) return "groceries";
  if (hasAny(text, ["pharmacy", "pharmacist", "farmacia"])) return "pharmacy_basics";
  if (hasAny(text, ["walker", "cane", "mobility", "wheelchair", "baston", "andador", "silla de ruedas"])) return "mobility_aids";
  if (hasAny(text, ["household", "home", "cleaning", "hogar", "limpieza"])) return "household";
  return "safe_home";
}

function mobilityNeedsFromText(text: string) {
  const needs = [
    hasAny(text, ["wheelchair", "silla de ruedas"]) ? "wheelchair" : "",
    hasAny(text, ["walker", "andador"]) ? "walker" : "",
    hasAny(text, ["cane", "baston"]) ? "cane" : "",
    hasAny(text, ["help getting in", "help getting out", "ayuda para subir", "ayuda para bajar"]) ? "door assistance" : "",
  ].filter(Boolean);
  return needs.join(", ");
}

function timeHintFromText(text: string) {
  if (hasAny(text, ["tomorrow morning", "manana por la manana"])) return "tomorrow morning";
  if (hasAny(text, ["tomorrow afternoon", "manana por la tarde"])) return "tomorrow afternoon";
  if (hasAny(text, ["tomorrow", "manana"])) return "tomorrow";
  if (hasAny(text, ["tonight", "esta noche"])) return "tonight";
  if (hasAny(text, ["today", "hoy"])) return "today";
  if (hasAny(text, ["now", "right now", "ahora"])) return "now";
  return "";
}

function rideDestinationFromText(text: string) {
  const match = text.match(/\b(?:ride|taxi|cab|transport|uber|lift|take me|pick me up|llevarme|recogerme)\s+(?:to|towards|at|a|al|hasta)\s+(?:the\s+|el\s+|la\s+)?(.+?)(?:\s+(?:tomorrow|manana|today|hoy|tonight|esta noche|now|ahora|morning|afternoon|evening|night|por la manana|por la tarde|at|around)\b|$)/i)
    || text.match(/\b(?:to|towards|at|al|hasta)\s+(?:the\s+|el\s+|la\s+)?(.+?)(?:\s+(?:tomorrow|manana|today|hoy|tonight|esta noche|now|ahora|morning|afternoon|evening|night|por la manana|por la tarde|at|around)\b|$)/i);
  const destination = match?.[1]
    ?.replace(/\b(?:please|thanks|thank you|por favor|gracias)\b.*$/i, "")
    .replace(/^(?:the|a|an|el|la)\s+/i, "")
    .trim();
  return destination && destination.length > 1 ? destination : "";
}

function payloadWithDefinedValues(payload: VoiceAppAction["payload"]) {
  const cleanPayload: VoiceAppAction["payload"] = {};
  Object.entries(payload ?? {}).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) cleanPayload[key] = value.trim();
    if (typeof value === "number" || typeof value === "boolean") cleanPayload[key] = value;
  });
  return Object.keys(cleanPayload).length ? cleanPayload : undefined;
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

function normalizedToolDomain(domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (["brain", "mind", "cognitive", "braincoach", "brain_coach"].includes(normalized)) return "brain_coach";
  if (["companion", "social_companion"].includes(normalized)) return "social";
  return domain.trim();
}

function shouldUseInferredToolAction(action: VoiceAppAction | null, route: string, domain: string) {
  if (!action) return false;
  if (!route && !domain) return true;
  if (!route && domain) return action.domain === domain;
  if (route === action.route) return true;
  if (domain && action.domain === domain) return true;
  if (route === "/concierge" && action.domain === "concierge") return true;
  if (["/mind-memory", "/activities", "/brain", "/mind", "/cognitive"].includes(route) && action.domain === "brain_coach") return true;
  return false;
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
  const rawDomain = normalizedToolDomain(stringParam(parameters, "domain"));
  const inferredAction = !rawActionType && !rawActionId && isActionableVoiceText(sourceText)
    ? actionForVoiceUtterance(sourceText)
    : null;
  const inferredActionType = shouldUseInferredToolAction(inferredAction, rawRoute, rawDomain)
    ? inferredAction?.actionType
    : undefined;
  const entry = voiceActionEntryForLookup({
    actionType: inferredActionType || rawActionType,
    actionId: rawActionId,
    route: rawRoute,
    domain: rawDomain,
  });

  if (!entry) return null;

  const title = stringParam(parameters, "title");
  const summary = stringParam(parameters, "summary");
  const cue = stringParam(parameters, "cue");
  const reason = stringParam(parameters, "reason");
  const subject = stringParam(parameters, "subject") || stringParam(parameters, "extracted_subject") || inferredAction?.extractedSubject || "";
  const priorityParam = stringParam(parameters, "priority");
  const priority = priorityParam === "high" || priorityParam === "medium" || priorityParam === "low"
    ? priorityParam
    : undefined;
  const toolPayload = payloadFromParameters(parameters);
  const payload = payloadWithDefinedValues({
    ...(inferredAction?.payload ?? {}),
    ...(toolPayload ?? {}),
  });

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
  if (!isActionableVoiceText(text)) return null;

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
    "refill",
    "renew",
    "running out",
    "run out",
    "need more",
    "more medicine",
    "more medication",
    "reponer",
    "renovar",
    "necesito mas",
    "me queda poco",
  ])) {
    return actionFromRegistry("meds.refill_request", text, {
      title: subject ? `${subject} refill` : "Medication refill",
      cue: subject
        ? `Check whether ${subject} needs a refill and confirm before contacting anyone.`
        : "Clarify which medication needs a refill and confirm before contacting anyone.",
      extractedSubject: subject,
      feedbackReason: "User asked for a medication refill or more medicine.",
      payload: payloadWithDefinedValues({
        ...(subject ? { medication_name: subject } : {}),
        supply_concern: "refill_request",
      }),
    });
  }

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

  if (hasAny(normalized, ["vitals", "blood pressure", "heart rate", "oxygen", "temperature", "signos", "presion", "pulso", "temperatura"])) {
    const vitalType = vitalTypeFromText(normalized);
    const isCapture = hasAny(normalized, [
      "measure",
      "record",
      "capture",
      "add",
      "take my",
      "take a",
      "medir",
      "registrar",
      "anadir",
      "tomar",
    ]);
    return actionFromRegistry(isCapture ? "health.vitals_capture" : "health.vitals_review", text, {
      feedbackReason: isCapture
        ? "User asked to measure, record, or add vitals."
        : "User mentioned vitals, blood pressure, heart rate, or pulse.",
      payload: payloadWithDefinedValues({
        ...(vitalType ? { vital_type: vitalType } : {}),
        capture_mode: isCapture ? "guided" : "",
      }),
    });
  }

  if (hasAny(normalized, ["daily check", "check in", "check-in", "how i feel", "how i'm feeling", "como me siento", "revision diaria"])) {
    return actionFromRegistry("health.daily_checkin", text, {
      feedbackReason: "User asked for a daily check-in or how-they-feel review.",
    });
  }

  if (hasAny(normalized, ["ride", "taxi", "cab", "transport", "uber", "lift", "take me", "pick me up", "transporte", "llevarme", "recogerme"])) {
    const time = timeHintFromText(normalized);
    const destination = rideDestinationFromText(normalized);
    const mobilityNeeds = mobilityNeedsFromText(normalized);
    return actionFromRegistry("concierge.ride_booking", text, {
      feedbackReason: "User asked to arrange transport or book a ride.",
      payload: payloadWithDefinedValues({
        task_type: "ride",
        destination,
        time,
        mobility_needs: mobilityNeeds,
      }),
    });
  }

  if (hasAny(normalized, [
    "order groceries",
    "order grocery",
    "place an order",
    "make an order",
    "grocery order",
    "food order",
    "delivery order",
    "pedido",
    "pedir compra",
    "encargar compra",
  ])) {
    const category = shoppingCategoryFromText(normalized);
    return actionFromRegistry("concierge.order_request", text, {
      feedbackReason: "User asked to prepare an order request.",
      payload: payloadWithDefinedValues({
        items: category === "groceries" ? "groceries" : "",
        category,
        delivery_time: timeHintFromText(normalized),
      }),
    });
  }

  if (hasAny(normalized, ["remind me", "set a reminder", "set reminder", "schedule reminder", "reminder tomorrow", "recuerdame", "recordarme", "pon un recordatorio"])) {
    const time = timeHintFromText(normalized);
    return actionFromRegistry("concierge.reminder", text, {
      feedbackReason: "User asked to set a reminder or scheduled support.",
      payload: payloadWithDefinedValues({
        reminder_text: text.trim(),
        reminder_time: time,
      }),
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

  if (hasAny(normalized, ["shopping", "groceries", "supermarket", "choose product", "product choice", "what should i buy", "compras", "compra", "supermercado", "que compro", "que deberia comprar"])) {
    return actionFromRegistry("concierge.shopping", text, {
      feedbackReason: "User asked for shopping or product-choice help.",
      payload: payloadWithDefinedValues({
        category: shoppingCategoryFromText(normalized),
        need: text.trim(),
      }),
    });
  }

  const homeService = homeServiceSubject(normalized);
  if (
    homeService
    || hasAny(normalized, [
      "plumber",
      "electrician",
      "locksmith",
      "cleaner",
      "blocked drain",
      "no hot water",
      "power outage",
      "sparks",
      "burning smell",
      "fontanero",
      "electricista",
      "cerrajero",
      "limpieza",
      "sin agua caliente",
      "sin luz",
    ])
  ) {
    const serviceType = homeService || normalizeHomeServiceType(normalized);
    return actionFromRegistry("concierge.home_service", text, {
      title: "Home service help",
      feedbackReason: "User asked for a trusted home-service provider.",
      payload: {
        intake_origin: "voice",
        task_type: "home_service",
        service_type: serviceType,
      },
    });
  }

  if (hasAny(normalized, ["appointment", "book", "delivery", "weather", "concierge", "cita"])) {
    return actionFromRegistry("concierge.task", text, {
      feedbackReason: "User asked for logistics, shopping, booking, weather, or reminder help.",
    });
  }

  if (hasAny(normalized, ["memory game", "test my memory", "memoria", "juego de memoria"])) {
    return actionFromRegistry("brain.memory_game", text, {
      feedbackReason: "User asked for a memory game or memory practice.",
    });
  }

  if (hasAny(normalized, ["relax", "breathe", "breathing", "calm", "relaj", "respirar", "calma"])) {
    return actionFromRegistry("brain.relax_breathe", text, {
      feedbackReason: "User asked for relaxation, breathing, or calm support.",
    });
  }

  if (hasAny(normalized, ["focus", "attention", "concentrate", "concentracion", "atencion"])) {
    return actionFromRegistry("brain.focus", text, {
      feedbackReason: "User asked for focus or attention support.",
    });
  }

  if (hasAny(normalized, ["learn", "teach me", "learning", "aprender", "ensenar"])) {
    return actionFromRegistry("brain.learn", text, {
      feedbackReason: "User asked to learn something.",
    });
  }

  if (hasAny(normalized, ["senses", "sensory", "smell", "sound", "listen closely", "sentidos", "sensorial", "olfato", "sonido"])) {
    return actionFromRegistry("brain.senses", text, {
      feedbackReason: "User asked for senses or sensory practice.",
    });
  }

  if (hasAny(normalized, ["brain", "cognitive", "cognition", "mind exercise", "mental exercise", "brain exercise", "activity", "activities", "exercise", "quiz", "game", "juego", "actividad"])) {
    return actionFromRegistry("brain.activity", text, {
      feedbackReason: "User asked for an activity, game, quiz, or brain exercise.",
    });
  }

  if (hasAny(normalized, ["talk to someone", "someone to talk", "keep me company", "i feel lonely", "companion", "companionship", "hablar con alguien", "me siento solo", "companero", "compania"])) {
    return actionFromRegistry("social.companion_chat", text, {
      feedbackReason: "User asked for private companionship or someone to talk to.",
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
