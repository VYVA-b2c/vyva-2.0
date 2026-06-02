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
  const isSpanish = language.toLowerCase().startsWith("es");
  const safeSummary = medicationSummary.trim() || (isSpanish ? "mis medicamentos" : "my medications");
  const safeContext = context.trim();
  return {
    conciergePrefill: {
      kind: "appointment",
      message: isSpanish
        ? `Ayudame a programar una revision de medicacion para: ${safeSummary}. Contexto: ${safeContext}. Pideme confirmacion antes de reservar.`
        : `Help me schedule a medication review appointment for: ${safeSummary}. Context: ${safeContext}. Ask me to confirm before booking.`,
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
