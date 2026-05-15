import type { TranscriptEntry } from "@/hooks/useVyvaVoice";

export const VYVA_VOICE_USER_MESSAGE_EVENT = "vyva:voice-user-message";
export const VYVA_VOICE_APP_ACTION_EVENT = "vyva:voice-app-action";

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

export function emitVoiceUserMessage(detail: VoiceUserMessageDetail) {
  window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, { detail }));
}

export function emitVoiceAppAction(action: VoiceAppAction) {
  window.dispatchEvent(new CustomEvent<VoiceAppAction>(VYVA_VOICE_APP_ACTION_EVENT, { detail: action }));
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
