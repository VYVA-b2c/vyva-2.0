import type { TranscriptEntry } from "@/hooks/useVyvaVoice";

export const VYVA_VOICE_USER_MESSAGE_EVENT = "vyva:voice-user-message";

export type VoiceUserMessageDetail = {
  text: string;
  transcriptEntry: TranscriptEntry;
};

export function emitVoiceUserMessage(detail: VoiceUserMessageDetail) {
  window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, { detail }));
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

export function routeForVoiceUtterance(text: string): string | null {
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
    return "/meds/adherence-report";
  }

  if (mentionsMedication) return "/meds";

  if (hasAny(normalized, ["chest pain", "cant breathe", "can't breathe", "fallen", "fall", "emergency", "sos", "scam", "fraud", "estafa", "emergencia"])) {
    return hasAny(normalized, ["scam", "fraud", "estafa"]) ? "/scam-guard" : "/safe-home";
  }

  if (hasAny(normalized, ["doctor", "gp", "medical", "symptom", "dizzy", "pain", "allergy", "allergies", "health", "medico", "sintoma", "alergia", "salud"])) {
    return hasAny(normalized, ["doctor", "gp", "medico"]) ? "/health/doctor" : "/health/symptom-check";
  }

  if (hasAny(normalized, ["vitals", "blood pressure", "heart rate", "signos", "presion", "pulso"])) {
    return "/health/vitals";
  }

  if (hasAny(normalized, ["report", "reports", "history", "scan", "informe", "informes", "historial"])) {
    return "/informes";
  }

  if (hasAny(normalized, ["appointment", "book", "taxi", "shopping", "groceries", "delivery", "weather", "concierge", "cita", "compras", "taxi"])) {
    return "/concierge";
  }

  if (hasAny(normalized, ["memory game", "brain", "activity", "activities", "exercise", "quiz", "game", "memoria", "juego", "actividad"])) {
    return "/activities";
  }

  if (hasAny(normalized, ["social", "room", "community", "chat with people", "friends", "sala", "comunidad", "amigos"])) {
    return "/social-rooms";
  }

  return null;
}
