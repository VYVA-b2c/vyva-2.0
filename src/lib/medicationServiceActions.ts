import type { ShoppingPriority } from "../../shared/shopping";

type MedicationShoppingState = {
  shoppingPrefill: {
    needText: string;
    category: "pharmacy_basics";
    priorities: ShoppingPriority[];
  };
};

type MedicationConciergeSource = "medication_support" | "adherence_report";

type MedicationConciergeState = {
  conciergePrefill: {
    kind: "appointment" | "ride";
    message: string;
    source: MedicationConciergeSource;
  };
};

export type MedicationDoctorActionKind = "call_gp" | "email_gp" | "doctor_help";

export function medicationDoctorActionKinds({
  hasGpPhone,
  hasGpEmail,
}: {
  hasGpPhone: boolean;
  hasGpEmail: boolean;
}): MedicationDoctorActionKind[] {
  return [
    ...(hasGpPhone ? ["call_gp" as const] : []),
    ...(hasGpEmail ? ["email_gp" as const] : []),
    "doctor_help",
  ];
}

export function medicationListSummary(names: string[], fallback = "my medications") {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (!clean.length) return fallback;
  return clean.join(", ");
}

export function medicationRefillShoppingState(medicationSummary: string, language = "en"): MedicationShoppingState {
  const isSpanish = language.toLowerCase().startsWith("es");
  return {
    shoppingPrefill: {
      needText: isSpanish
        ? `Ayudame a preparar reposicion o entrega segura de farmacia para: ${medicationSummary}. Antes de pedir o pagar, confirma conmigo.`
        : `Help me prepare a safe refill or pharmacy delivery for: ${medicationSummary}. Ask me to confirm before any order or checkout.`,
      category: "pharmacy_basics",
      priorities: ["safety", "delivery", "simplicity"],
    },
  };
}

export function medicationReviewAppointmentState(
  medicationSummary: string,
  context: string,
  language = "en",
  source: MedicationConciergeSource = "medication_support",
): MedicationConciergeState {
  const code = language.toLowerCase().split("-")[0];
  const copy: Record<string, { fallback: string; message: (summary: string, detail: string) => string }> = {
    en: {
      fallback: "my medications",
      message: (summary, detail) => `Help me schedule a medication review appointment for: ${summary}. Context: ${detail}. Ask me to confirm before booking.`,
    },
    es: {
      fallback: "mis medicamentos",
      message: (summary, detail) => `Ayudame a programar una revision de medicacion para: ${summary}. Contexto: ${detail}. Pideme confirmacion antes de reservar.`,
    },
    fr: {
      fallback: "mes medicaments",
      message: (summary, detail) => `Aidez-moi a preparer un rendez-vous de suivi des medicaments pour: ${summary}. Contexte: ${detail}. Demandez ma confirmation avant toute reservation.`,
    },
    de: {
      fallback: "meine Medikamente",
      message: (summary, detail) => `Helfen Sie mir, einen Termin zur Medikamentenpruefung vorzubereiten fuer: ${summary}. Kontext: ${detail}. Bitten Sie vor einer Buchung um meine Bestaetigung.`,
    },
    it: {
      fallback: "i miei medicinali",
      message: (summary, detail) => `Aiutami a preparare un appuntamento per la revisione dei medicinali: ${summary}. Contesto: ${detail}. Chiedi la mia conferma prima di prenotare.`,
    },
    pt: {
      fallback: "os meus medicamentos",
      message: (summary, detail) => `Ajude-me a preparar uma consulta de revisao da medicacao para: ${summary}. Contexto: ${detail}. Peca a minha confirmacao antes de marcar.`,
    },
  };
  const localized = copy[code] ?? copy.en;
  const safeSummary = medicationSummary.trim() || localized.fallback;
  const safeContext = context.trim();
  return {
    conciergePrefill: {
      kind: "appointment",
      message: localized.message(safeSummary, safeContext),
      source,
    },
  };
}

export function medicationReviewRideState(
  medicationSummary: string,
  context: string,
  language = "en",
  source: MedicationConciergeSource = "medication_support",
): MedicationConciergeState {
  const isSpanish = language.toLowerCase().startsWith("es");
  const safeSummary = medicationSummary.trim() || (isSpanish ? "mis medicamentos" : "my medications");
  const safeContext = context.trim();
  return {
    conciergePrefill: {
      kind: "ride",
      message: isSpanish
        ? `Ayudame a reservar transporte para una cita o recogida relacionada con mi medicacion: ${safeSummary}. Contexto: ${safeContext}. Pideme confirmacion antes de reservar.`
        : `Help me book transport for a medication appointment or pharmacy pickup: ${safeSummary}. Context: ${safeContext}. Ask me to confirm before booking.`,
      source,
    },
  };
}

export function medicationDoctorContext(input: {
  medicationSummary: string;
  totalScheduledDoseCount: number;
  totalTakenDoseCount: number;
  totalRemainingDoseCount: number;
  language?: string;
}) {
  const isSpanish = input.language?.toLowerCase().startsWith("es");
  const title = isSpanish ? "Resumen de medicacion VYVA" : "VYVA medication summary";
  const schedule = isSpanish ? "Tomas de hoy" : "Today's doses";
  const remaining = isSpanish ? "Pendientes" : "Still due";
  return [
    title,
    `${isSpanish ? "Medicacion" : "Medication"}: ${input.medicationSummary}`,
    `${schedule}: ${input.totalTakenDoseCount}/${input.totalScheduledDoseCount}`,
    `${remaining}: ${input.totalRemainingDoseCount}`,
  ].join("\n");
}

export function medicationDoctorMailto(email: string | undefined | null, body: string, language: string) {
  const raw = email?.trim();
  if (!raw) return "";
  const subject = language.toLowerCase().startsWith("es") ? "Resumen de medicacion VYVA" : "VYVA medication summary";
  return `mailto:${raw}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
