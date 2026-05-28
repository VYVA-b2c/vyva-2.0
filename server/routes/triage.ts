import { Router } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles } from "../../shared/schema.js";
import { genderInstruction, inferProfileGender, type GrammaticalGender } from "../lib/userPersonalization.js";
import { getMediSearchTriageContext, type MediSearchTriageContext } from "../services/medisearch.js";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";

const router = Router();

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  cy: "Welsh",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
}

type TriageQuickReply = {
  id: string;
  label: string;
  value: string;
  icon: "heart" | "wind" | "thermometer" | "activity" | "alert" | "help";
  tone: "purple" | "red" | "blue" | "amber" | "green";
  kind: "symptom" | "red_flag" | "duration" | "severity" | "trend" | "support" | "free_text";
};

type TriageWizardContext = {
  mode?: "with_vitals" | "without_vitals";
  vitalsScanCompleted?: boolean;
  vitals?: { bpm?: number | null; respiratoryRate?: number | null };
  quickAnswers?: Array<{ id: string; label: string; value: string; kind?: string }>;
};

type WizardStage = "symptom" | "red_flag" | "duration" | "severity" | "trend" | "support" | "complete";

type TriageHealthMemory = {
  healthContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  latestVitals?: string;
  latestSymptomReport?: string;
};

type ProfileRiskFlags = {
  diabetes: boolean;
  copd: boolean;
  heartFailure: boolean;
  hypertension: boolean;
  bloodThinner: boolean;
  immunosuppressed: boolean;
  cognitiveConcern: boolean;
};

const CRITICAL_RED_FLAG_IDS = new Set([
  "chest_pain",
  "sudden_severe",
  "breath_rest",
  "blue_confused",
  "high_fever",
  "confused_fever",
  "stiff_neck",
  "fainted",
  "stroke_sign",
  "dizzy_chest",
  "cannot_stand",
  "new_severe",
  "low_sugar",
  "high_sugar_sick",
  "low_oxygen",
  "head_hit_blood_thinner",
  "unusual_bleeding",
  "very_high_bp",
  "immuno_fever",
  "new_confusion",
]);

const SAFETY_ACTION_IDS = new Set([
  "call_emergency",
  "contact_doctor",
  "make_report",
  "continue_questions",
]);

interface TriageRequestBody {
  messages?: ChatMessage[];
  vitals?: { bpm: number | null };
  locale?: string;
  wizard?: TriageWizardContext;
  healthMemory?: TriageHealthMemory;
}

async function getRequestGender(req: Request): Promise<GrammaticalGender> {
  const userId = req.user?.id;
  if (!userId) return "neutral";
  const rows = await db
    .select({ full_name: profiles.full_name, data_sharing_consent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const profile = rows[0];
  return inferProfileGender(profile?.data_sharing_consent, profile?.full_name ?? "");
}

function wizardContextText(wizard?: TriageWizardContext): string {
  if (!wizard) return "";

  const lines = [
    wizard.mode === "with_vitals"
      ? "The user chose to begin with a vitals scan."
      : wizard.mode === "without_vitals"
        ? "The user chose to skip the vitals scan and answer questions directly."
        : "",
    wizard.vitalsScanCompleted ? "The vitals scan step has been completed." : "",
    typeof wizard.vitals?.respiratoryRate === "number" ? `Estimated respiratory rate: ${wizard.vitals.respiratoryRate} breaths per minute.` : "",
    wizard.quickAnswers?.length
      ? `Structured quick answers tapped so far: ${wizard.quickAnswers.map((answer) => `${answer.label} (${answer.value})`).join("; ")}.`
      : "",
  ].filter(Boolean);

  return lines.length ? `\n\nWIZARD CONTEXT:\n${lines.join("\n")}` : "";
}

function healthMemoryText(memory?: TriageHealthMemory): string {
  if (!memory) return "";
  const risks = profileRiskFlags(memory);
  const riskLabels = [
    risks.diabetes ? "diabetes or glucose medication" : "",
    risks.copd ? "COPD/asthma/oxygen support" : "",
    risks.heartFailure ? "heart failure/fluid risk" : "",
    risks.hypertension ? "high blood pressure/stroke risk" : "",
    risks.bloodThinner ? "blood thinner/bleeding risk" : "",
    risks.immunosuppressed ? "low immunity" : "",
    risks.cognitiveConcern ? "cognitive or confusion vulnerability" : "",
  ].filter(Boolean);
  const lines = [
    memory.healthContext ? `Health profile summary: ${memory.healthContext}` : "",
    memory.conditions ? `Known conditions: ${memory.conditions}` : "",
    memory.allergies ? `Known allergies: ${memory.allergies}` : "",
    memory.medications ? `Current medications: ${memory.medications}` : "",
    memory.latestVitals ? `Latest vitals: ${memory.latestVitals}` : "",
    memory.latestSymptomReport ? `Latest symptom report: ${memory.latestSymptomReport}` : "",
    riskLabels.length ? `Deterministic profile flags: ${riskLabels.join(", ")}` : "",
  ].filter(Boolean);

  return lines.length
    ? `\n\nHEALTH MEMORY:\n${lines.join("\n")}\nUse this only to avoid repeated questions and ask more relevant follow-ups. Do not assume it is complete or current.`
    : "";
}

function profileRiskFlags(memory?: TriageHealthMemory): ProfileRiskFlags {
  const haystack = [
    memory?.healthContext,
    memory?.conditions,
    memory?.allergies,
    memory?.medications,
    memory?.latestVitals,
    memory?.latestSymptomReport,
  ].filter(Boolean).join(" ").toLowerCase();

  return {
    diabetes: /\b(diabetes|diabetic|insulin|metformin|glucose|blood sugar|cgm)\b/.test(haystack),
    copd: /\b(copd|emphysema|chronic bronchitis|oxygen therapy|home oxygen|asthma)\b/.test(haystack),
    heartFailure: /\b(chf|heart failure|congestive|fluid retention|furosemide|diuretic)\b/.test(haystack),
    hypertension: /\b(hypertension|high blood pressure|blood pressure|amlodipine|lisinopril|losartan|atenolol|metoprolol)\b/.test(haystack),
    bloodThinner: /\b(warfarin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|anticoagulant|blood thinner|clopidogrel|plavix)\b/.test(haystack),
    immunosuppressed: /\b(immunosuppressed|immunocompromised|chemotherapy|transplant|prednisone|steroid|methotrexate|biologic)\b/.test(haystack),
    cognitiveConcern: /\b(dementia|alzheimer|memory loss|cognitive impairment|confusion)\b/.test(haystack),
  };
}

function isSpanishLocale(locale: string) {
  return locale === "es";
}

function text(locale: string, english: string, spanish: string) {
  return isSpanishLocale(locale) ? spanish : english;
}

function reply(
  locale: string,
  id: string,
  kind: TriageQuickReply["kind"],
  labelEn: string,
  labelEs: string,
  valueEn: string,
  valueEs: string,
  icon: TriageQuickReply["icon"],
  tone: TriageQuickReply["tone"],
): TriageQuickReply {
  return { id, kind, label: text(locale, labelEn, labelEs), value: text(locale, valueEn, valueEs), icon, tone };
}

function selectedAnswers(wizard?: TriageWizardContext) {
  return wizard?.quickAnswers ?? [];
}

function hasAnswer(wizard: TriageWizardContext | undefined, ids: string[]) {
  return selectedAnswers(wizard).some((answer) => ids.includes(answer.id));
}

function firstAnswerKind(wizard: TriageWizardContext | undefined, kind: string) {
  return selectedAnswers(wizard).find((answer) => answer.kind === kind);
}

function selectedSafetyAnswer(wizard: TriageWizardContext | undefined) {
  if (hasAnswer(wizard, Array.from(SAFETY_ACTION_IDS))) return null;
  return selectedAnswers(wizard).find((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
}

function wizardStage(wizard?: TriageWizardContext): WizardStage {
  const answers = selectedAnswers(wizard);
  if (!answers.some((answer) => answer.kind === "symptom")) return "symptom";
  if (!answers.some((answer) => answer.kind === "red_flag")) return "red_flag";
  if (!answers.some((answer) => answer.kind === "duration")) return "duration";
  if (!answers.some((answer) => answer.kind === "severity")) return "severity";
  if (!answers.some((answer) => answer.kind === "trend")) return "trend";
  if (!answers.some((answer) => answer.kind === "support")) return "support";
  return "complete";
}

function wizardStageLabel(stage: WizardStage, locale: string) {
  const labels: Record<WizardStage, { en: string; es: string }> = {
    symptom: { en: "Question 1 of 6", es: "Pregunta 1 de 6" },
    red_flag: { en: "Question 2 of 6", es: "Pregunta 2 de 6" },
    duration: { en: "Question 3 of 6", es: "Pregunta 3 de 6" },
    severity: { en: "Question 4 of 6", es: "Pregunta 4 de 6" },
    trend: { en: "Question 5 of 6", es: "Pregunta 5 de 6" },
    support: { en: "Question 6 of 6", es: "Pregunta 6 de 6" },
    complete: { en: "Summary", es: "Resumen" },
  };
  return text(locale, labels[stage].en, labels[stage].es);
}

function uniqueReplies(replies: TriageQuickReply[]) {
  return [...new Map(replies.map((reply) => [reply.id, reply])).values()];
}

function withProfileReplies(
  baseReplies: TriageQuickReply[],
  profileReplies: TriageQuickReply[],
  maxCount = 6,
) {
  return uniqueReplies([...profileReplies, ...baseReplies]).slice(0, maxCount);
}

function profileRedFlagReplies(
  locale: string,
  symptomId: string | undefined,
  risks: ProfileRiskFlags,
): TriageQuickReply[] {
  const replies: TriageQuickReply[] = [];

  if (risks.diabetes && ["dizzy", "tired", "fever", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "low_sugar", "red_flag", "Low sugar signs", "Senales de azucar baja", "I feel shaky, sweaty, confused, or very weak.", "Tengo temblor, sudor, confusion o mucha debilidad.", "alert", "red"),
      reply(locale, "high_sugar_sick", "red_flag", "High sugar and sick", "Azucar alta y malestar", "My sugar is high and I feel sick, thirsty, or drowsy.", "Tengo azucar alta y malestar, mucha sed o sueno.", "alert", "red"),
    );
  }

  if (risks.copd && symptomId === "breathing") {
    replies.push(
      reply(locale, "low_oxygen", "red_flag", "Low oxygen", "Oxigeno bajo", "My oxygen is low or I need more oxygen than usual.", "Tengo oxigeno bajo o necesito mas oxigeno de lo normal.", "wind", "red"),
    );
  }

  if (risks.heartFailure && ["breathing", "tired", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "swelling_weight_gain", "red_flag", "Swelling or weight gain", "Hinchazon o peso subio", "My legs are more swollen or my weight went up quickly.", "heart", "amber"),
    );
  }

  if (risks.hypertension && ["pain", "dizzy", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "very_high_bp", "red_flag", "Very high blood pressure", "Presion muy alta", "My blood pressure is very high or I have weakness or speech trouble.", "Tengo la presion muy alta o debilidad o dificultad para hablar.", "alert", "red"),
    );
  }

  if (risks.bloodThinner && ["pain", "dizzy", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "head_hit_blood_thinner", "red_flag", "Hit my head", "Golpe en la cabeza", "I hit my head or fell while taking a blood thinner.", "Me golpee la cabeza o cai tomando anticoagulante.", "alert", "red"),
      reply(locale, "unusual_bleeding", "red_flag", "Unusual bleeding", "Sangrado raro", "I have unusual bleeding, black stool, or a large bruise.", "Tengo sangrado raro, heces negras o moreton grande.", "alert", "red"),
    );
  }

  if (risks.immunosuppressed && symptomId === "fever") {
    replies.push(
      reply(locale, "immuno_fever", "red_flag", "Fever with low immunity", "Fiebre con defensas bajas", "I have fever and low immunity or cancer treatment.", "Tengo fiebre y defensas bajas o tratamiento contra cancer.", "alert", "red"),
    );
  }

  if (risks.cognitiveConcern && ["fever", "dizzy", "tired", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "new_confusion", "red_flag", "New confusion", "Confusion nueva", "I feel newly confused or not like myself.", "Tengo confusion nueva o no me siento como siempre.", "alert", "red"),
    );
  }

  return replies;
}

function quickRepliesFor(wizard: TriageWizardContext | undefined, locale: string, healthMemory?: TriageHealthMemory): TriageQuickReply[] {
  const stage = wizardStage(wizard);
  const answers = selectedAnswers(wizard);
  const symptom = firstAnswerKind(wizard, "symptom");
  const risks = profileRiskFlags(healthMemory);

  if (stage === "symptom") {
    return [
      reply(locale, "pain", "symptom", "Pain", "Dolor", "I have pain.", "Tengo dolor.", "heart", "red"),
      reply(locale, "breathing", "symptom", "Breathing", "Respirar", "I feel short of breath.", "Me falta el aire.", "wind", "blue"),
      reply(locale, "fever", "symptom", "Fever", "Fiebre", "I have a fever.", "Tengo fiebre.", "thermometer", "amber"),
      reply(locale, "dizzy", "symptom", "Dizzy", "Mareo", "I feel dizzy.", "Me siento mareada o mareado.", "activity", "amber"),
      reply(locale, "tired", "symptom", "Very tired", "Muy cansancio", "I feel very tired.", "Me siento muy cansada o cansado.", "activity", "purple"),
      reply(locale, "other", "free_text", "Other", "Otra cosa", "Something else is bothering me.", "Me pasa otra cosa.", "help", "purple"),
    ];
  }

  if (stage === "red_flag") {
    if (!symptom) return quickRepliesFor(undefined, locale, healthMemory);

    if (symptom.id === "pain") {
      const baseReplies = [
        reply(locale, "chest_pain", "red_flag", "Chest pain", "Dolor en pecho", "I have chest pain.", "Tengo dolor en el pecho.", "alert", "red"),
        reply(locale, "sudden_severe", "red_flag", "Sudden or severe", "Repentino o fuerte", "The pain is sudden or severe.", "El dolor es repentino o fuerte.", "alert", "red"),
        reply(locale, "after_fall", "red_flag", "After a fall", "Tras caida", "It started after a fall or injury.", "Empezo despues de una caida o golpe.", "activity", "amber"),
        reply(locale, "no_red_flag", "red_flag", "None of these", "Nada de esto", "None of these apply.", "Nada de esto aplica.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    if (symptom.id === "breathing") {
      const baseReplies = [
        reply(locale, "breath_rest", "red_flag", "Even resting", "Incluso en reposo", "I am short of breath even while resting.", "Me falta el aire incluso en reposo.", "wind", "red"),
        reply(locale, "blue_confused", "red_flag", "Confused or blue lips", "Confusion o labios azules", "I feel blue-lipped, confused, or very unwell.", "Tengo labios azulados, confusion o me siento muy mal.", "alert", "red"),
        reply(locale, "walking_only", "red_flag", "Only when walking", "Solo al caminar", "It mostly happens when I walk.", "Me pasa sobre todo al caminar.", "activity", "amber"),
        reply(locale, "no_red_flag", "red_flag", "Mild now", "Leve ahora", "It is mild right now.", "Ahora es leve.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    if (symptom.id === "fever") {
      const baseReplies = [
        reply(locale, "high_fever", "red_flag", "Very high fever", "Fiebre muy alta", "My temperature is very high.", "Tengo la temperatura muy alta.", "thermometer", "red"),
        reply(locale, "confused_fever", "red_flag", "Confused or very sleepy", "Confusion o mucho sueno", "I feel confused, very drowsy, or hard to wake.", "Tengo confusion, mucho sueno o cuesta despertarme.", "alert", "red"),
        reply(locale, "stiff_neck", "red_flag", "Stiff neck", "Cuello rigido", "I have a stiff neck or a new rash.", "Tengo el cuello rigido o una erupcion nueva.", "alert", "red"),
        reply(locale, "no_red_flag", "red_flag", "None of these", "Nada de esto", "None of these apply.", "Nada de esto aplica.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    if (symptom.id === "dizzy") {
      const baseReplies = [
        reply(locale, "fainted", "red_flag", "Fainted", "Desmayo", "I fainted or nearly fainted.", "Me desmaye o casi me desmayo.", "alert", "red"),
        reply(locale, "stroke_sign", "red_flag", "Weak on one side", "Debilidad en un lado", "I have weakness on one side, face droop, or trouble speaking.", "Tengo debilidad en un lado, cara caida o dificultad para hablar.", "alert", "red"),
        reply(locale, "dizzy_chest", "red_flag", "With chest pain", "Con dolor pecho", "I also have chest pain or trouble breathing.", "Tambien tengo dolor de pecho o falta de aire.", "heart", "red"),
        reply(locale, "no_red_flag", "red_flag", "Mild now", "Leve ahora", "It is mild right now.", "Ahora es leve.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    const baseReplies = [
      reply(locale, "cannot_stand", "red_flag", "Cannot stand", "No puedo estar de pie", "I feel too weak to stand or walk safely.", "Me siento demasiado debil para estar de pie o caminar.", "alert", "red"),
      reply(locale, "not_drinking", "red_flag", "Not drinking", "No bebo", "I am not drinking or eating normally.", "No estoy bebiendo o comiendo normal.", "alert", "amber"),
      reply(locale, "new_severe", "red_flag", "New/severe", "Nuevo fuerte", "This is new or much worse than usual.", "Esto es nuevo o mucho peor de lo normal.", "activity", "amber"),
      reply(locale, "no_red_flag", "red_flag", "None of these", "Nada de esto", "None of these apply.", "Nada de esto aplica.", "help", "green"),
    ];
    return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom?.id, risks));
  }

  if (stage === "duration") {
    return [
      reply(locale, "today", "duration", "Today", "Hoy", "It started today.", "Empezo hoy.", "activity", "amber"),
      reply(locale, "few_days", "duration", "2-3 days", "2-3 dias", "It has been going on for two or three days.", "Lleva dos o tres dias.", "activity", "purple"),
      reply(locale, "week_plus", "duration", "A week+", "Una semana+", "It has been going on for a week or more.", "Lleva una semana o mas.", "activity", "blue"),
      reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ];
  }

  if (stage === "severity") {
    return [
      reply(locale, "mild", "severity", "Mild", "Leve", "It feels mild.", "Se siente leve.", "activity", "green"),
      reply(locale, "moderate", "severity", "Medium", "Medio", "It feels moderate.", "Se siente moderado.", "alert", "amber"),
      reply(locale, "strong", "severity", "Strong", "Fuerte", "It feels strong.", "Se siente fuerte.", "heart", "red"),
      reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
    ];
  }

  if (stage === "trend") {
    return [
      reply(locale, "better", "trend", "Better", "Mejor", "It is getting better.", "Esta mejorando.", "activity", "green"),
      reply(locale, "same", "trend", "Same", "Igual", "It feels about the same.", "Se siente igual.", "help", "blue"),
      reply(locale, "worse", "trend", "Worse", "Peor", "It is getting worse.", "Esta empeorando.", "alert", "red"),
      reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "alert", "amber"),
    ];
  }

  if (stage === "support") {
    return [
      reply(locale, "doctor_help", "support", "Help me decide", "Ayudame a decidir", "I would like help deciding whether to contact a doctor.", "Quiero ayuda para decidir si contactar a un medico.", "heart", "red"),
      reply(locale, "watch_home", "support", "What to watch", "Que vigilar", "I want to know what to watch at home.", "Quiero saber que vigilar en casa.", "activity", "green"),
      reply(locale, "share_report", "support", "Make a report", "Crear informe", "Please make a clear report I can share.", "Por favor crea un informe claro para compartir.", "help", "purple"),
      reply(locale, "not_sure_support", "support", "Not sure", "No se", "I am not sure what I need.", "No se que necesito.", "help", "amber"),
    ];
  }

  return [
    reply(locale, "yes", "support", "Yes", "Si", "Yes.", "Si.", "heart", "green"),
    reply(locale, "no", "support", "No", "No", "No.", "No.", "alert", "red"),
    reply(locale, "not_sure", "support", "Not sure", "No se", "I am not sure.", "No estoy segura o seguro.", "help", "purple"),
  ];
}

function safetyMessage(locale: string, warningLabel: string) {
  return text(
    locale,
    `${warningLabel} can be a warning sign. If this feels severe, sudden, or unsafe, please call emergency services now or ask someone nearby to help you. Would you like help making the next step?`,
    `${warningLabel} puede ser una senal de alerta. Si se siente fuerte, repentino o inseguro, llama a emergencias ahora o pide ayuda a alguien cercano. Quieres ayuda con el siguiente paso?`,
  );
}

function safetyRecommendation(locale: string) {
  return text(
    locale,
    "Call emergency services now if this is severe, sudden, or you feel unsafe. Otherwise, contact a doctor or trusted caregiver today.",
    "Llama a emergencias ahora si es fuerte, repentino o no te sientes seguro. Si no, contacta hoy con un medico o cuidador de confianza.",
  );
}

function safetyQuickReplies(locale: string): TriageQuickReply[] {
  return [
    reply(locale, "call_emergency", "support", "Call emergency", "Llamar emergencias", "I will call emergency services if this feels severe or sudden.", "Llamare a emergencias si se siente fuerte o repentino.", "alert", "red"),
    reply(locale, "contact_doctor", "support", "Call doctor", "Llamar medico", "I want to contact my doctor or clinic today.", "Quiero contactar hoy con mi medico o clinica.", "heart", "amber"),
    reply(locale, "make_report", "support", "Make report", "Crear informe", "Please make a clear report I can share.", "Por favor crea un informe claro para compartir.", "help", "purple"),
    reply(locale, "continue_questions", "support", "Keep asking", "Seguir preguntas", "I understand. Please keep asking simple questions.", "Entiendo. Sigue haciendo preguntas simples.", "activity", "blue"),
  ];
}

function medisearchContextText(context?: MediSearchTriageContext | null): string {
  if (!context) return "";
  const sourceLines = context.articles
    .slice(0, 3)
    .map((article, index) => `${index + 1}. ${article.title ?? "Medical source"}${article.year ? ` (${article.year})` : ""}${article.tldr ? `: ${article.tldr}` : ""}`);
  return `\n\nMEDISEARCH EVIDENCE CONTEXT:
${context.answer ? `Summary: ${context.answer.slice(0, 1200)}` : ""}
${context.followups.length ? `Suggested follow-up topics: ${context.followups.slice(0, 4).join("; ")}` : ""}
${sourceLines.length ? `Sources:\n${sourceLines.join("\n")}` : ""}

Use this evidence as background only. Do not cite it as a diagnosis. Ask one simple question at a time.`;
}

function buildSystemPrompt(
  language: string,
  bpm: number | null,
  gender: GrammaticalGender,
  wizard?: TriageWizardContext,
  medisearchContext?: MediSearchTriageContext | null,
  healthMemory?: TriageHealthMemory,
): string {
  const vitalsContext = bpm != null
    ? `\n\nThe user has just completed a vitals scan. Their estimated heart rate is ${bpm} bpm. Reference this gently if relevant.`
    : "";

  return `You are VYVA, a warm and caring medical triage assistant helping an elderly person understand their symptoms. Your role is to ask clear, simple questions and provide a helpful triage summary.

IMPORTANT: Respond entirely in ${language}.
${genderInstruction(gender)}${vitalsContext}${wizardContextText(wizard)}${healthMemoryText(healthMemory)}${medisearchContextText(medisearchContext)}

CONVERSATION FLOW:
1. The app is a senior-friendly wizard. Match the current wizard stage and ask only one very simple question.
2. If there is no symptom category yet, ask what feels wrong today.
3. After a symptom category, ask the most relevant red-flag question first. If a red flag is present, calmly recommend urgent help while still collecting enough summary detail.
4. Adapt concern level to HEALTH MEMORY. Diabetes, COPD/oxygen use, heart failure, high blood pressure, blood thinners, low immunity, and new confusion should make you more cautious.
5. Then ask duration, severity, whether it is getting better/worse, and what help the user wants.
6. Avoid repeating questions already answered in WIZARD CONTEXT.
7. After gathering sufficient information (typically 4-6 user answers), gently wrap up.
8. On your FINAL turn, you MUST end your message with this exact JSON block (replace values appropriately):

TRIAGE_JSON_START
{"done":true,"summary":{"chiefComplaint":"<one-line description>","symptoms":["<symptom 1>","<symptom 2>"],"urgency":"<urgent|routine|monitor>","recommendations":["<step 1>","<step 2>","<step 3>","<step 4>"],"disclaimer":"This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious."}}
TRIAGE_JSON_END

Urgency definitions:
- "urgent": symptoms that warrant same-day or next-day GP attention (e.g. chest pain, difficulty breathing, high fever)
- "routine": symptoms that should be discussed at the next GP appointment (e.g. mild ongoing pain, fatigue)
- "monitor": symptoms that are likely self-limiting and can be monitored at home (e.g. mild cold, minor ache)

STYLE RULES:
- Write like a calm health form, not a chat conversation
- Use simple, kind, non-alarming language suitable for older adults
- Ask one direct question, ideally under 14 words
- Do not start with apologies like "I'm sorry to hear that"
- Do not explain the wizard or mention the buttons
- Never use medical jargon
- Prefer plain words: "sudden", "strong", "today", "getting worse"
- Do NOT produce the JSON block before the 4th user message`;
}

function extractTriageJson(text: string): { content: string; summary: TriageSummary | null } {
  const startMarker = "TRIAGE_JSON_START";
  const endMarker = "TRIAGE_JSON_END";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { content: text.trim(), summary: null };
  }

  const beforeJson = text.slice(0, startIdx).trim();
  const jsonStr = text.slice(startIdx + startMarker.length, endIdx).trim();

  try {
    const parsed = JSON.parse(jsonStr) as { done: boolean; summary: TriageSummary };
    if (parsed.done && parsed.summary) {
      return { content: beforeJson, summary: parsed.summary };
    }
  } catch {
    console.warn("[triage] Failed to parse JSON block:", jsonStr.slice(0, 200));
  }

  return { content: text.trim(), summary: null };
}

router.get("/context", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const variables = await getDoctorMedicalProfileVariables(userId);
    const memory: TriageHealthMemory = {
      healthContext: String(variables.health_profile_summary || variables.health_context || ""),
      conditions: String(variables.health_conditions || ""),
      allergies: String(variables.allergies || ""),
      medications: String(variables.medications || ""),
      latestVitals: String(variables.latest_vitals_scan || ""),
      latestSymptomReport: String(variables.latest_symptom_report || ""),
    };
    const usedItems = [
      memory.latestVitals ? "Latest vitals" : "",
      memory.medications ? "Medications" : "",
      memory.allergies ? "Allergies" : "",
      memory.conditions ? "Conditions" : "",
      memory.latestSymptomReport ? "Recent symptoms" : "",
    ].filter(Boolean);

    return res.json({ memory, usedItems });
  } catch (err) {
    console.error("[triage/context]", err);
    return res.status(500).json({ error: "Failed to load triage context" });
  }
});

router.post("/message", async (req: Request, res: Response) => {
  const { messages = [], vitals, locale = "en", wizard, healthMemory } = req.body as TriageRequestBody;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }

  const normalizedLocale = typeof locale === "string"
    ? locale.split("-")[0].toLowerCase()
    : "en";
  const language = LOCALE_TO_LANGUAGE[normalizedLocale] ?? "English";
  const gender = await getRequestGender(req).catch(() => "neutral" as const);

  const validMessages: ChatMessage[] = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);

  const safetyAnswer = selectedSafetyAnswer(wizard);
  if (safetyAnswer) {
    return res.json({
      role: "assistant",
      content: safetyMessage(normalizedLocale, safetyAnswer.label),
      done: false,
      urgent: true,
      safetyAlert: {
        id: safetyAnswer.id,
        label: safetyAnswer.label,
        recommendation: safetyRecommendation(normalizedLocale),
      },
      quickReplies: safetyQuickReplies(normalizedLocale),
      wizardStage: "support",
      wizardStageLabel: wizardStageLabel("support", normalizedLocale),
      evidenceSources: [],
    });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return res.status(503).json({ error: "AI service not configured" });
  }

  try {
    const client = new OpenAI({ apiKey });
    const latestUserMessage = [...validMessages].reverse().find((message) => message.role === "user")?.content ?? "";
    const medisearchContext = latestUserMessage
      ? await getMediSearchTriageContext({
          symptomText: latestUserMessage,
          locale: normalizedLocale,
          wizard,
        })
      : null;

    const systemContent = buildSystemPrompt(language, vitals?.bpm ?? null, gender, wizard, medisearchContext, healthMemory);

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...validMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      temperature: 0.65,
      max_tokens: 600,
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() ?? "";
    const { content, summary } = extractTriageJson(rawContent);

    return res.json({
      role: "assistant",
      content,
      done: summary != null,
      summary: summary ?? undefined,
      quickReplies: summary ? [] : quickRepliesFor(wizard, normalizedLocale, healthMemory),
      wizardStage: wizardStage(wizard),
      wizardStageLabel: wizardStageLabel(wizardStage(wizard), normalizedLocale),
      evidenceSources: medisearchContext?.articles.slice(0, 3).map((article) => ({
        title: article.title,
        url: article.url,
        year: article.year,
        journal: article.journal,
      })) ?? [],
    });
  } catch (err) {
    console.error("[triage] OpenAI error:", err);
    return res.status(500).json({ error: "Failed to process triage request" });
  }
});

export default router;
