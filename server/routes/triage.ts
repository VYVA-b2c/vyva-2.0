import { Router } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles } from "../../shared/schema.js";
import { genderInstruction, inferProfileGender, type GrammaticalGender } from "../lib/userPersonalization.js";
import { getMediSearchTriageContext, type MediSearchTriageContext } from "../services/medisearch.js";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";
import { evaluateTriageRules } from "../lib/triageRules.js";

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
  nextStepLabel?: string;
  nextStepLevel?: "emergency" | "doctor_today" | "doctor_24_48" | "monitor";
  triageReasons?: string[];
  watchSigns?: string[];
  profileConsiderations?: string[];
  vitalsNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
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
  heartDisease: boolean;
  afib: boolean;
  hypertension: boolean;
  bloodThinner: boolean;
  immunosuppressed: boolean;
  cognitiveConcern: boolean;
  kidneyDisease: boolean;
  strokeHistory: boolean;
  fallsFrailty: boolean;
  parkinsonMobility: boolean;
  osteoporosis: boolean;
  cancerActive: boolean;
  recentSurgery: boolean;
  utiHistory: boolean;
  liverDisease: boolean;
  depressionAnxiety: boolean;
  sedatingMedication: boolean;
  opioidMedication: boolean;
  diureticMedication: boolean;
  steroidMedication: boolean;
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
  "low_urine_swelling",
  "one_sided_weakness",
  "irregular_heartbeat",
  "hip_back_after_fall",
  "cannot_swallow",
  "fever_after_surgery",
  "calf_swelling_surgery",
  "urine_confusion",
  "liver_confusion_bleeding",
  "over_sedated",
  "opioid_breathing",
  "dehydration_diuretic",
  "severe_abdominal",
  "blood_vomit_stool",
  "rigid_belly",
  "cannot_pee",
  "fall_head_hit",
  "fall_cannot_stand",
  "allergic_swelling",
  "sudden_confusion",
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

function wizardContextText(wizard?: TriageWizardContext, healthMemory?: TriageHealthMemory): string {
  if (!wizard) return "";
  const stage = nextAdaptiveStage(wizard, healthMemory);

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
    `Current adaptive wizard stage: ${stage}.`,
    stage === "complete" ? "The app has enough structured answers. Produce the final TRIAGE_JSON summary now." : `Ask the ${stage} question only.`,
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
    risks.heartDisease ? "heart disease" : "",
    risks.afib ? "atrial fibrillation/irregular heartbeat" : "",
    risks.hypertension ? "high blood pressure/stroke risk" : "",
    risks.bloodThinner ? "blood thinner/bleeding risk" : "",
    risks.immunosuppressed ? "low immunity" : "",
    risks.cognitiveConcern ? "cognitive or confusion vulnerability" : "",
    risks.kidneyDisease ? "kidney disease/dehydration medication risk" : "",
    risks.strokeHistory ? "stroke/TIA history" : "",
    risks.fallsFrailty ? "falls or frailty risk" : "",
    risks.parkinsonMobility ? "Parkinson's/mobility/swallowing risk" : "",
    risks.osteoporosis ? "osteoporosis/fracture risk" : "",
    risks.cancerActive ? "active cancer or chemotherapy" : "",
    risks.recentSurgery ? "recent surgery or hospital stay" : "",
    risks.utiHistory ? "UTI/recurrent infection risk" : "",
    risks.liverDisease ? "liver disease/bleeding or confusion risk" : "",
    risks.depressionAnxiety ? "mood or anxiety vulnerability" : "",
    risks.sedatingMedication ? "sedating medication/fall risk" : "",
    risks.opioidMedication ? "opioid/breathing or oversedation risk" : "",
    risks.diureticMedication ? "diuretic/dehydration risk" : "",
    risks.steroidMedication ? "steroid/low immunity risk" : "",
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
    heartDisease: /\b(coronary|angina|heart attack|myocardial infarction|stent|bypass|ischemic heart|ischaemic heart|heart disease)\b/.test(haystack),
    afib: /\b(afib|a-fib|atrial fibrillation|irregular heartbeat|arrhythmia|palpitations)\b/.test(haystack),
    hypertension: /\b(hypertension|high blood pressure|blood pressure|amlodipine|lisinopril|losartan|atenolol|metoprolol)\b/.test(haystack),
    bloodThinner: /\b(warfarin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|anticoagulant|blood thinner|clopidogrel|plavix)\b/.test(haystack),
    immunosuppressed: /\b(immunosuppressed|immunocompromised|chemotherapy|transplant|prednisone|steroid|methotrexate|biologic|low immunity|neutropenia)\b/.test(haystack),
    cognitiveConcern: /\b(dementia|alzheimer|memory loss|cognitive impairment|confusion)\b/.test(haystack),
    kidneyDisease: /\b(kidney disease|ckd|renal|dialysis|eGFR|nephropathy|kidney failure)\b/i.test(haystack),
    strokeHistory: /\b(stroke|tia|mini stroke|cva|transient ischemic|transient ischaemic)\b/.test(haystack),
    fallsFrailty: /\b(fall risk|falls|frail|frailty|walker|walking aid|mobility aid|unsteady|balance problem)\b/.test(haystack),
    parkinsonMobility: /\b(parkinson|parkinson's|levodopa|carbidopa|freezing|tremor|swallowing trouble|dysphagia)\b/.test(haystack),
    osteoporosis: /\b(osteoporosis|osteopenia|fragility fracture|hip fracture|compression fracture)\b/.test(haystack),
    cancerActive: /\b(cancer|chemotherapy|radiotherapy|radiation therapy|oncology|tumou?r|malignan)\b/.test(haystack),
    recentSurgery: /\b(recent surgery|post[- ]?op|operation|hospital stay|discharged|wound|incision|surgical)\b/.test(haystack),
    utiHistory: /\b(uti|urinary tract infection|recurrent infection|bladder infection|cystitis)\b/.test(haystack),
    liverDisease: /\b(liver disease|cirrhosis|hepatitis|hepatic|jaundice|ascites)\b/.test(haystack),
    depressionAnxiety: /\b(depression|depressed|anxiety|panic|lonely|suicidal|self harm|self-harm)\b/.test(haystack),
    sedatingMedication: /\b(zolpidem|ambien|benzodiazepine|diazepam|lorazepam|alprazolam|clonazepam|sleeping pill|sedative|quetiapine|gabapentin|pregabalin)\b/.test(haystack),
    opioidMedication: /\b(opioid|morphine|oxycodone|hydrocodone|tramadol|fentanyl|codeine|buprenorphine)\b/.test(haystack),
    diureticMedication: /\b(furosemide|lasix|bumetanide|torsemide|spironolactone|hydrochlorothiazide|bendroflumethiazide|diuretic|water pill)\b/.test(haystack),
    steroidMedication: /\b(prednisone|prednisolone|dexamethasone|hydrocortisone|steroid)\b/.test(haystack),
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

function normalizeClue(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ");
}

function firstUserClue(messages: ChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content?.trim() ?? "";
}

function inferSymptomFromClue(rawClue: string, locale: string): TriageQuickReply | null {
  const clue = normalizeClue(rawClue);
  if (!clue) return null;

  if (/\b(breath|breathing|short of breath|air|wheeze|oxygen|spo2|blue lip|labios azul|respirar|aire|oxigeno|sibil)\b/.test(clue)) {
    return reply(locale, "breathing", "symptom", "Breathing", "Respirar", "I feel short of breath.", "Me falta el aire.", "wind", "blue");
  }
  if (/\b(confus|memory|not myself|disorient|delir|forget|confund|memoria|desorient)\b/.test(clue)) {
    return reply(locale, "confusion", "symptom", "Confusion", "Confusion", "I feel confused or not like myself.", "Tengo confusion o no me siento como siempre.", "alert", "red");
  }
  if (/\b(fall|fell|injur|hit|bump|bruise|caida|cai|golpe|herid|lesion)\b/.test(clue)) {
    return reply(locale, "fall", "symptom", "Fall or injury", "Caida o golpe", "I fell or hurt myself.", "Me cai o me hice dano.", "alert", "red");
  }
  if (/\b(urine|pee|peeing|bladder|burning when|uti|orina|orinar|pip[iy]|vejiga|ardor)\b/.test(clue)) {
    return reply(locale, "urinary", "symptom", "Urine problem", "Problema de orina", "I have a urine problem.", "Tengo problema de orina.", "help", "blue");
  }
  if (/\b(skin|rash|wound|cut|redness|swelling|pus|itch|piel|erupcion|roncha|herida|rojez|hinch|picor)\b/.test(clue)) {
    return reply(locale, "skin", "symptom", "Skin or wound", "Piel o herida", "I have a skin or wound problem.", "Tengo problema de piel o herida.", "help", "amber");
  }
  if (/\b(stomach|belly|abdomen|bowel|diarrhea|vomit|nausea|constipat|barriga|estomago|vientre|diarrea|vomit|nausea|estren)\b/.test(clue)) {
    return reply(locale, "stomach", "symptom", "Stomach or bowel", "Estomago o intestino", "I have stomach or bowel trouble.", "Tengo problema de estomago o intestino.", "activity", "amber");
  }
  if (/\b(fever|temperature|chills|hot|fiebre|temperatura|escalofrio|caliente)\b/.test(clue)) {
    return reply(locale, "fever", "symptom", "Fever", "Fiebre", "I have a fever.", "Tengo fiebre.", "thermometer", "amber");
  }
  if (/\b(dizz|vertigo|lightheaded|faint|mareo|maread|vertigo|desmay)\b/.test(clue)) {
    return reply(locale, "dizzy", "symptom", "Dizzy", "Mareo", "I feel dizzy.", "Me siento mareada o mareado.", "activity", "amber");
  }
  if (/\b(tired|weak|fatigue|exhaust|sleepy|cansad|debil|fatiga|agotad|sueno)\b/.test(clue)) {
    return reply(locale, "tired", "symptom", "Very tired", "Muy cansancio", "I feel very tired.", "Me siento muy cansada o cansado.", "activity", "purple");
  }
  if (/\b(pain|ache|headache|migraine|chest|back|joint|dolor|cabeza|migrana|pecho|espalda|articul)\b/.test(clue)) {
    return reply(locale, "pain", "symptom", "Pain", "Dolor", "I have pain.", "Tengo dolor.", "heart", "red");
  }

  return reply(locale, "other", "symptom", "Something else", "Otra cosa", "Something else is bothering me.", "Me pasa otra cosa.", "help", "purple");
}

function inferRedFlagFromClue(rawClue: string, symptomId: string | undefined, locale: string): TriageQuickReply | null {
  const clue = normalizeClue(rawClue);
  if (!clue) return null;

  if (/\b(blue lip|blue lips|labios azul|cyanotic|confused and.*breath|breath.*confus)\b/.test(clue)) {
    return reply(locale, "blue_confused", "red_flag", "Confused or blue lips", "Confusion o labios azules", "I feel blue-lipped, confused, or very unwell.", "Tengo labios azulados, confusion o me siento muy mal.", "alert", "red");
  }
  if (/\b(chest pain|pressure in chest|dolor.*pecho|presion.*pecho)\b/.test(clue)) {
    return reply(locale, "chest_pain", "red_flag", "Chest pain", "Dolor en pecho", "I have chest pain.", "Tengo dolor en el pecho.", "alert", "red");
  }
  if (/\b(worst headache|worst pain|sudden severe|thunderclap|dolor.*repentino|dolor.*muy fuerte|peor dolor)\b/.test(clue)) {
    return reply(locale, "sudden_severe", "red_flag", "Sudden or severe", "Repentino o fuerte", "The pain is sudden or severe.", "El dolor es repentino o fuerte.", "alert", "red");
  }
  if (/\b(faint|fainted|passed out|desmaye|desmayo|perdi.*conocimiento)\b/.test(clue)) {
    return reply(locale, "fainted", "red_flag", "Fainted", "Desmayo", "I fainted or nearly fainted.", "Me desmaye o casi me desmayo.", "alert", "red");
  }
  if (/\b(one side|face droop|slurred|speech trouble|weakness.*side|un lado|cara caida|habla|dificultad.*hablar)\b/.test(clue)) {
    return reply(locale, "stroke_sign", "red_flag", "Weak on one side", "Debilidad en un lado", "I have weakness on one side, face droop, or trouble speaking.", "Tengo debilidad en un lado, cara caida o dificultad para hablar.", "alert", "red");
  }
  if (/\b(cannot stand|cant stand|cannot walk|cant walk|no puedo levantar|no puedo caminar)\b/.test(clue)) {
    return reply(locale, symptomId === "fall" ? "fall_cannot_stand" : "cannot_stand", "red_flag", "Cannot stand", "No puedo estar de pie", "I feel too weak to stand or walk safely.", "Me siento demasiado debil para estar de pie o caminar.", "alert", "red");
  }
  if (/\b(face.*swelling|throat.*swelling|tongue.*swelling|lip.*swelling|hinch.*cara|hinch.*garganta|hinch.*lengua|hinch.*labio)\b/.test(clue)) {
    return reply(locale, "allergic_swelling", "red_flag", "Face or throat swelling", "Cara o garganta hinchada", "My face, lips, tongue, or throat is swelling.", "Se hincha mi cara, labios, lengua o garganta.", "alert", "red");
  }

  return null;
}

function wizardWithInferredClue(
  wizard: TriageWizardContext | undefined,
  messages: ChatMessage[],
  locale: string,
): TriageWizardContext | undefined {
  const answers = wizard?.quickAnswers ?? [];
  if (answers.some((answer) => answer.kind === "symptom")) return wizard;

  const clue = firstUserClue(messages);
  const symptom = inferSymptomFromClue(clue, locale);
  if (!symptom) return wizard;

  const redFlag = inferRedFlagFromClue(clue, symptom.id, locale);
  const inferredAnswers = [
    { id: symptom.id, label: symptom.label, value: symptom.value, kind: symptom.kind },
    redFlag ? { id: redFlag.id, label: redFlag.label, value: redFlag.value, kind: redFlag.kind } : null,
  ].filter(Boolean) as NonNullable<TriageWizardContext["quickAnswers"]>;

  return {
    ...wizard,
    quickAnswers: [...inferredAnswers, ...answers],
  };
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

function selectedSymptomId(wizard: TriageWizardContext | undefined) {
  return firstAnswerKind(wizard, "symptom")?.id;
}

function selectedSafetyAnswer(wizard: TriageWizardContext | undefined) {
  if (hasAnswer(wizard, Array.from(SAFETY_ACTION_IDS))) return null;
  return selectedAnswers(wizard).find((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
}

function hasKind(wizard: TriageWizardContext | undefined, kind: string) {
  return selectedAnswers(wizard).some((answer) => answer.kind === kind);
}

function shouldCompleteFromRules(wizard: TriageWizardContext | undefined, healthMemory?: TriageHealthMemory) {
  const answers = selectedAnswers(wizard);
  if (!answers.some((answer) => answer.kind === "red_flag")) return false;
  const ids = new Set(answers.map((answer) => answer.id));
  const symptomId = selectedSymptomId(wizard);
  const risks = profileRiskFlags(healthMemory);
  const hasCriticalRedFlag = answers.some((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));

  if (hasCriticalRedFlag) return true;

  if (symptomId === "breathing") {
    if (ids.has("strong")) return true;
    if (ids.has("walking_only") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
    if (ids.has("no_red_flag") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "pain") {
    if (ids.has("after_fall") && hasKind(wizard, "severity")) return true;
    if (ids.has("strong") && ids.has("worse")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "dizzy") {
    if ((ids.has("strong") || ids.has("worse") || ids.has("new_symptoms")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "fever") {
    if ((risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && hasKind(wizard, "duration")) return true;
    if ((ids.has("strong") || ids.has("week_plus") || ids.has("worse") || ids.has("new_symptoms")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "tired") {
    if ((ids.has("not_drinking") || ids.has("strong") || ids.has("worse")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (["stomach", "urinary", "skin", "confusion"].includes(symptomId ?? "")) {
    if ((ids.has("strong") || ids.has("worse") || ids.has("new_symptoms")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "fall") {
    if (hasKind(wizard, "severity")) return true;
  }

  return hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend");
}

function nextAdaptiveStage(wizard: TriageWizardContext | undefined, healthMemory?: TriageHealthMemory): WizardStage {
  const answers = selectedAnswers(wizard);
  if (!answers.some((answer) => answer.kind === "symptom")) return "symptom";
  if (!answers.some((answer) => answer.kind === "red_flag")) return "red_flag";
  if (shouldCompleteFromRules(wizard, healthMemory)) return "complete";

  const ids = new Set(answers.map((answer) => answer.id));
  const symptomId = selectedSymptomId(wizard);

  if (symptomId === "breathing") {
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
    if (!hasKind(wizard, "duration")) return "duration";
  }

  if (symptomId === "pain") {
    if (!hasKind(wizard, "severity")) return "severity";
    if ((ids.has("after_fall") || ids.has("strong")) && !hasKind(wizard, "trend")) return "trend";
    if (!hasKind(wizard, "duration")) return "duration";
    if (!hasKind(wizard, "trend")) return "trend";
  }

  if (symptomId === "dizzy") {
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
    if (!hasKind(wizard, "duration")) return "duration";
  }

  if (symptomId === "fever") {
    if (!hasKind(wizard, "duration")) return "duration";
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
  }

  if (symptomId === "tired") {
    if ((ids.has("not_drinking") || ids.has("new_severe")) && !hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "duration")) return "duration";
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
  }

  if (symptomId === "fall") {
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
    if (!hasKind(wizard, "duration")) return "duration";
  }

  if (symptomId === "confusion") {
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
    if (!hasKind(wizard, "duration")) return "duration";
  }

  if (!hasKind(wizard, "severity")) return "severity";
  if (!hasKind(wizard, "duration")) return "duration";
  if (!hasKind(wizard, "trend")) return "trend";
  return "complete";
}

function wizardStageLabel(stage: WizardStage, locale: string) {
  const labels: Record<WizardStage, { en: string; es: string }> = {
    symptom: { en: "Choose symptom", es: "Elige sintoma" },
    red_flag: { en: "Safety check", es: "Chequeo de seguridad" },
    duration: { en: "When it started", es: "Cuando empezo" },
    severity: { en: "How it feels", es: "Como se siente" },
    trend: { en: "What changed", es: "Que cambio" },
    support: { en: "Next step", es: "Siguiente paso" },
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

  if (risks.diabetes && ["dizzy", "tired", "fever", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
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

  if (risks.heartFailure && ["breathing", "tired", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "swelling_weight_gain", "red_flag", "Swelling or weight gain", "Hinchazon o peso subio", "My legs are more swollen or my weight went up quickly.", "Mis piernas estan mas hinchadas o subi de peso rapido.", "heart", "amber"),
    );
  }

  if ((risks.heartDisease || risks.afib) && ["pain", "breathing", "dizzy", "tired", "fall", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "irregular_heartbeat", "red_flag", "Irregular heartbeat", "Latido irregular", "I have chest pressure, palpitations, fainting, or breathlessness.", "Tengo presion en el pecho, palpitaciones, desmayo o falta de aire.", "heart", "red"),
    );
  }

  if (risks.hypertension && ["pain", "dizzy", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "very_high_bp", "red_flag", "Very high blood pressure", "Presion muy alta", "My blood pressure is very high or I have weakness or speech trouble.", "Tengo la presion muy alta o debilidad o dificultad para hablar.", "alert", "red"),
    );
  }

  if (risks.strokeHistory && ["pain", "dizzy", "tired", "fall", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "one_sided_weakness", "red_flag", "Weakness or speech trouble", "Debilidad o habla rara", "I have face droop, one-sided weakness, vision change, or speech trouble.", "Tengo cara caida, debilidad en un lado, cambio de vision o dificultad para hablar.", "alert", "red"),
    );
  }

  if (risks.bloodThinner && ["pain", "dizzy", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "head_hit_blood_thinner", "red_flag", "Hit my head", "Golpe en la cabeza", "I hit my head or fell while taking a blood thinner.", "Me golpee la cabeza o cai tomando anticoagulante.", "alert", "red"),
      reply(locale, "unusual_bleeding", "red_flag", "Unusual bleeding", "Sangrado raro", "I have unusual bleeding, black stool, or a large bruise.", "Tengo sangrado raro, heces negras o moreton grande.", "alert", "red"),
    );
  }

  if ((risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "fever") {
    replies.push(
      reply(locale, "immuno_fever", "red_flag", "Fever with low immunity", "Fiebre con defensas bajas", "I have fever and low immunity or cancer treatment.", "Tengo fiebre y defensas bajas o tratamiento contra cancer.", "alert", "red"),
    );
  }

  if (risks.cognitiveConcern && ["fever", "dizzy", "tired", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "new_confusion", "red_flag", "New confusion", "Confusion nueva", "I feel newly confused or not like myself.", "Tengo confusion nueva o no me siento como siempre.", "alert", "red"),
    );
  }

  if (risks.kidneyDisease && ["fever", "dizzy", "tired", "urinary", "stomach", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "low_urine_swelling", "red_flag", "Low urine or swelling", "Poca orina o hinchazon", "I am passing much less urine, very swollen, or very dehydrated.", "Orino mucho menos, estoy muy hinchado o muy deshidratado.", "alert", "red"),
    );
  }

  if ((risks.fallsFrailty || risks.osteoporosis) && ["pain", "dizzy", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "hip_back_after_fall", "red_flag", "Fall with hip or back pain", "Caida con dolor cadera", "I fell and now have hip or back pain, or trouble standing.", "Me cai y ahora tengo dolor de cadera o espalda, o me cuesta estar de pie.", "alert", "red"),
    );
  }

  if (risks.parkinsonMobility && ["breathing", "tired", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "cannot_swallow", "red_flag", "Trouble swallowing", "Dificultad al tragar", "I am choking, coughing with food, or cannot swallow safely.", "Me atraganto, toso al comer o no puedo tragar con seguridad.", "alert", "red"),
    );
  }

  if (risks.recentSurgery && ["fever", "breathing", "pain", "skin", "fall", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "fever_after_surgery", "red_flag", "Fever after surgery", "Fiebre tras cirugia", "I have fever, redness, swelling, or drainage near a wound.", "Tengo fiebre, enrojecimiento, hinchazon o secrecion cerca de una herida.", "alert", "red"),
      reply(locale, "calf_swelling_surgery", "red_flag", "Calf swelling", "Pantorrilla hinchada", "One calf is swollen or painful, or I am newly short of breath.", "Una pantorrilla esta hinchada o duele, o tengo nueva falta de aire.", "alert", "red"),
    );
  }

  if (risks.utiHistory && ["fever", "dizzy", "tired", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "urine_confusion", "red_flag", "Urine change or confusion", "Orina o confusion", "I have burning urine, fever, new confusion, or new weakness.", "Tengo ardor al orinar, fiebre, confusion nueva o debilidad nueva.", "alert", "red"),
    );
  }

  if (risks.liverDisease && ["dizzy", "tired", "pain", "stomach", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "liver_confusion_bleeding", "red_flag", "Confusion or bleeding", "Confusion o sangrado", "I have new confusion, black stool, vomiting blood, or yellow skin.", "Tengo confusion nueva, heces negras, vomito sangre o piel amarilla.", "alert", "red"),
    );
  }

  if (risks.sedatingMedication && ["dizzy", "tired", "fall", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "over_sedated", "red_flag", "Very sleepy or unsteady", "Mucho sueno o inestable", "I am very sleepy, confused, or more unsteady than usual.", "Tengo mucho sueno, confusion o estoy mas inestable de lo normal.", "alert", "amber"),
    );
  }

  if (risks.opioidMedication && ["breathing", "tired", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "opioid_breathing", "red_flag", "Slow breathing", "Respiracion lenta", "I am very sleepy or breathing slower than usual.", "Tengo mucho sueno o respiro mas lento de lo normal.", "alert", "red"),
    );
  }

  if ((risks.diureticMedication || risks.kidneyDisease) && ["dizzy", "tired", "urinary", "confusion", "other"].includes(symptomId ?? "")) {
    replies.push(
      reply(locale, "dehydration_diuretic", "red_flag", "Dehydration signs", "Senales de deshidratacion", "I am dizzy standing, very thirsty, or passing little urine.", "Me mareo al estar de pie, tengo mucha sed o orino poco.", "alert", "amber"),
    );
  }

  return replies;
}

function quickRepliesFor(wizard: TriageWizardContext | undefined, locale: string, healthMemory?: TriageHealthMemory): TriageQuickReply[] {
  const stage = nextAdaptiveStage(wizard, healthMemory);
  const answers = selectedAnswers(wizard);
  const symptom = firstAnswerKind(wizard, "symptom");
  const risks = profileRiskFlags(healthMemory);

  if (stage === "complete") return [];

  if (stage === "symptom") {
    return [
      reply(locale, "pain", "symptom", "Pain", "Dolor", "I have pain.", "Tengo dolor.", "heart", "red"),
      reply(locale, "breathing", "symptom", "Breathing", "Respirar", "I feel short of breath.", "Me falta el aire.", "wind", "blue"),
      reply(locale, "fever", "symptom", "Fever", "Fiebre", "I have a fever.", "Tengo fiebre.", "thermometer", "amber"),
      reply(locale, "dizzy", "symptom", "Dizzy", "Mareo", "I feel dizzy.", "Me siento mareada o mareado.", "activity", "amber"),
      reply(locale, "tired", "symptom", "Very tired", "Muy cansancio", "I feel very tired.", "Me siento muy cansada o cansado.", "activity", "purple"),
      reply(locale, "stomach", "symptom", "Stomach or bowel", "Estomago o intestino", "I have stomach or bowel trouble.", "Tengo problema de estomago o intestino.", "activity", "amber"),
      reply(locale, "urinary", "symptom", "Urine problem", "Problema de orina", "I have a urine problem.", "Tengo problema de orina.", "help", "blue"),
      reply(locale, "fall", "symptom", "Fall or injury", "Caida o golpe", "I fell or hurt myself.", "Me cai o me hice dano.", "alert", "red"),
      reply(locale, "skin", "symptom", "Skin or wound", "Piel o herida", "I have a skin or wound problem.", "Tengo problema de piel o herida.", "help", "amber"),
      reply(locale, "confusion", "symptom", "Confusion", "Confusion", "I feel confused or not like myself.", "Tengo confusion o no me siento como siempre.", "alert", "red"),
      reply(locale, "other", "symptom", "Something else", "Otra cosa", "Something else is bothering me.", "Me pasa otra cosa.", "help", "purple"),
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
    if (symptom.id === "stomach") {
      const baseReplies = [
        reply(locale, "severe_abdominal", "red_flag", "Severe belly pain", "Dolor fuerte barriga", "I have severe belly pain.", "Tengo dolor fuerte de barriga.", "alert", "red"),
        reply(locale, "blood_vomit_stool", "red_flag", "Blood or black stool", "Sangre o heces negras", "I vomited blood or have black or bloody stool.", "Vomito sangre o tengo heces negras o con sangre.", "alert", "red"),
        reply(locale, "rigid_belly", "red_flag", "Hard swollen belly", "Barriga dura hinchada", "My belly is hard, swollen, or very tender.", "Mi barriga esta dura, hinchada o muy sensible.", "alert", "red"),
        reply(locale, "no_red_flag", "red_flag", "None of these", "Nada de esto", "None of these apply.", "Nada de esto aplica.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    if (symptom.id === "urinary") {
      const baseReplies = [
        reply(locale, "urine_fever_back", "red_flag", "Fever or back pain", "Fiebre o dolor espalda", "I have fever, back/flank pain, or shaking chills.", "Tengo fiebre, dolor de espalda/lado o escalofrios fuertes.", "alert", "red"),
        reply(locale, "cannot_pee", "red_flag", "Cannot pass urine", "No puedo orinar", "I cannot pass urine or have severe lower belly pain.", "No puedo orinar o tengo dolor fuerte bajo vientre.", "alert", "red"),
        reply(locale, "blood_in_urine", "red_flag", "Blood in urine", "Sangre en orina", "There is blood in my urine.", "Hay sangre en mi orina.", "alert", "amber"),
        reply(locale, "no_red_flag", "red_flag", "Burning only", "Solo ardor", "It is mainly burning or needing to go often.", "Es sobre todo ardor o ganas frecuentes.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    if (symptom.id === "fall") {
      const baseReplies = [
        reply(locale, "fall_head_hit", "red_flag", "Hit head", "Golpe en cabeza", "I hit my head, fainted, or feel confused.", "Me golpee la cabeza, me desmaye o tengo confusion.", "alert", "red"),
        reply(locale, "fall_cannot_stand", "red_flag", "Cannot stand", "No puedo levantarme", "I cannot stand, walk, or use the injured part.", "No puedo estar de pie, caminar o usar la parte lesionada.", "alert", "red"),
        reply(locale, "hip_back_after_fall", "red_flag", "Hip or back pain", "Dolor cadera/espalda", "I have hip, back, or severe pain after the fall.", "Tengo dolor de cadera, espalda o dolor fuerte tras la caida.", "alert", "red"),
        reply(locale, "no_red_flag", "red_flag", "Small bruise", "Moreton pequeno", "It seems like a small bruise or mild soreness.", "Parece moreton pequeno o dolor leve.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    if (symptom.id === "skin") {
      const baseReplies = [
        reply(locale, "wound_spreading", "red_flag", "Spreading redness", "Rojez se extiende", "Redness, swelling, warmth, or pus is spreading.", "Rojez, hinchazon, calor o pus se esta extendiendo.", "alert", "red"),
        reply(locale, "allergic_swelling", "red_flag", "Face or throat swelling", "Cara o garganta hinchada", "My face, lips, tongue, or throat is swelling.", "Se hincha mi cara, labios, lengua o garganta.", "alert", "red"),
        reply(locale, "fever_after_surgery", "red_flag", "Fever with wound", "Fiebre con herida", "I have fever or feel very unwell with a wound.", "Tengo fiebre o me siento muy mal con una herida.", "alert", "red"),
        reply(locale, "no_red_flag", "red_flag", "Small skin issue", "Problema pequeno", "It is small and not spreading.", "Es pequeno y no se extiende.", "help", "green"),
      ];
      return withProfileReplies(baseReplies, profileRedFlagReplies(locale, symptom.id, risks));
    }
    if (symptom.id === "confusion") {
      const baseReplies = [
        reply(locale, "sudden_confusion", "red_flag", "Sudden confusion", "Confusion repentina", "The confusion is sudden or much worse than usual.", "La confusion es repentina o mucho peor de lo normal.", "alert", "red"),
        reply(locale, "stroke_sign", "red_flag", "Weakness or speech", "Debilidad o habla", "I have weakness on one side, face droop, or trouble speaking.", "Tengo debilidad en un lado, cara caida o dificultad para hablar.", "alert", "red"),
        reply(locale, "urine_confusion", "red_flag", "Fever or urine change", "Fiebre u orina", "I have fever, burning urine, new weakness, or low urine.", "Tengo fiebre, ardor al orinar, debilidad nueva o poca orina.", "alert", "red"),
        reply(locale, "no_red_flag", "red_flag", "Mild forgetfulness", "Olvido leve", "It is mild forgetfulness and not sudden.", "Es olvido leve y no repentino.", "help", "green"),
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
    const symptomId = selectedSymptomId(wizard);
    if (symptomId === "pain") {
      return [
        reply(locale, "today", "duration", "Started today", "Empezo hoy", "The pain started today.", "El dolor empezo hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "2-3 days", "2-3 dias", "The pain has been there for two or three days.", "El dolor lleva dos o tres dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "A week+", "Una semana+", "The pain has lasted a week or more.", "El dolor lleva una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when the pain started.", "No se cuando empezo el dolor.", "help", "purple"),
      ];
    }
    if (symptomId === "fever") {
      return [
        reply(locale, "today", "duration", "Started today", "Empezo hoy", "It started today.", "Empezo hoy.", "thermometer", "amber"),
        reply(locale, "few_days", "duration", "2-3 days", "2-3 dias", "It has been going on for two or three days.", "Lleva dos o tres dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "A week+", "Una semana+", "It has been going on for a week or more.", "Lleva una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    if (symptomId === "breathing") {
      return [
        reply(locale, "today", "duration", "New today", "Nuevo hoy", "It started today.", "Empezo hoy.", "wind", "amber"),
        reply(locale, "few_days", "duration", "Few days", "Pocos dias", "It has been going on for two or three days.", "Lleva dos o tres dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "Longer", "Mas tiempo", "It has been going on for a week or more.", "Lleva una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    if (symptomId === "dizzy") {
      return [
        reply(locale, "today", "duration", "Started today", "Empezo hoy", "The dizziness started today.", "El mareo empezo hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "Few days", "Pocos dias", "The dizziness has been there for a few days.", "El mareo lleva pocos dias.", "activity", "purple"),
        reply(locale, "keeps_returning", "duration", "Keeps returning", "Vuelve a pasar", "The dizziness keeps coming back.", "El mareo vuelve a pasar.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    if (symptomId === "tired") {
      return [
        reply(locale, "today", "duration", "Today", "Hoy", "The tiredness or weakness started today.", "El cansancio o debilidad empezo hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "Few days", "Pocos dias", "It has been going on for a few days.", "Lleva pocos dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "A week+", "Una semana+", "It has lasted a week or more.", "Lleva una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    if (symptomId === "stomach") {
      return [
        reply(locale, "today", "duration", "Today", "Hoy", "The stomach or bowel problem started today.", "El problema de estomago o intestino empezo hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "Few days", "Pocos dias", "It has been going on for a few days.", "Lleva pocos dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "A week+", "Una semana+", "It has lasted a week or more.", "Lleva una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    if (symptomId === "urinary") {
      return [
        reply(locale, "today", "duration", "Today", "Hoy", "The urine problem started today.", "El problema de orina empezo hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "Few days", "Pocos dias", "It has been going on for a few days.", "Lleva pocos dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "A week+", "Una semana+", "It has lasted a week or more.", "Lleva una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    if (symptomId === "fall") {
      return [
        reply(locale, "today", "duration", "Today", "Hoy", "The fall or injury happened today.", "La caida o golpe fue hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "Few days ago", "Hace pocos dias", "It happened a few days ago.", "Paso hace pocos dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "A week+", "Una semana+", "It happened a week or more ago.", "Paso hace una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it happened.", "No se cuando paso.", "help", "purple"),
      ];
    }
    if (symptomId === "skin") {
      return [
        reply(locale, "today", "duration", "Today", "Hoy", "The skin or wound problem started today.", "El problema de piel o herida empezo hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "Few days", "Pocos dias", "It has been there for a few days.", "Lleva pocos dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "A week+", "Una semana+", "It has been there for a week or more.", "Lleva una semana o mas.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    if (symptomId === "confusion") {
      return [
        reply(locale, "today", "duration", "Today", "Hoy", "The confusion or change started today.", "La confusion o cambio empezo hoy.", "activity", "amber"),
        reply(locale, "few_days", "duration", "Few days", "Pocos dias", "It has been going on for a few days.", "Lleva pocos dias.", "activity", "purple"),
        reply(locale, "week_plus", "duration", "Longer", "Mas tiempo", "It has been going on longer.", "Lleva mas tiempo.", "activity", "blue"),
        reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
      ];
    }
    return [
      reply(locale, "today", "duration", "Started today", "Empezo hoy", "This started today.", "Esto empezo hoy.", "activity", "amber"),
      reply(locale, "few_days", "duration", "Few days", "Pocos dias", "This has been going on for a few days.", "Esto lleva pocos dias.", "activity", "purple"),
      reply(locale, "week_plus", "duration", "Longer", "Mas tiempo", "This has been going on longer.", "Esto lleva mas tiempo.", "activity", "blue"),
      reply(locale, "not_sure_duration", "duration", "Not sure", "No se", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ];
  }

  if (stage === "severity") {
    const symptomId = selectedSymptomId(wizard);
    if (symptomId === "pain") {
      return [
        reply(locale, "mild", "severity", "Mild ache", "Dolor leve", "The pain is mild.", "El dolor es leve.", "activity", "green"),
        reply(locale, "moderate", "severity", "Hard to ignore", "Cuesta ignorarlo", "The pain is hard to ignore.", "El dolor cuesta ignorarlo.", "alert", "amber"),
        reply(locale, "strong", "severity", "Strong pain", "Dolor fuerte", "The pain is strong.", "El dolor es fuerte.", "heart", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
      ];
    }
    if (symptomId === "breathing") {
      return [
        reply(locale, "mild", "severity", "Mild", "Leve", "It feels mild.", "Se siente leve.", "activity", "green"),
        reply(locale, "moderate", "severity", "Limits walking", "Limita caminar", "It limits my walking or normal activity.", "Limita caminar o actividad normal.", "wind", "amber"),
        reply(locale, "strong", "severity", "Hard to speak", "Cuesta hablar", "It is hard to speak full sentences.", "Me cuesta hablar frases completas.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
      ];
    }
    if (symptomId === "fever") {
      return [
        reply(locale, "mild", "severity", "Low fever", "Fiebre baja", "It feels mild.", "Se siente leve.", "thermometer", "green"),
        reply(locale, "moderate", "severity", "Feverish", "Con fiebre", "It feels moderate.", "Se siente moderado.", "thermometer", "amber"),
        reply(locale, "strong", "severity", "Very unwell", "Muy mal", "I feel very unwell.", "Me siento muy mal.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
      ];
    }
    if (symptomId === "dizzy") {
      return [
        reply(locale, "mild", "severity", "Lightheaded", "Aturdido", "I feel lightheaded.", "Me siento aturdido.", "activity", "green"),
        reply(locale, "moderate", "severity", "Unsteady walking", "Camino inestable", "I feel unsteady when walking.", "Camino con inestabilidad.", "activity", "amber"),
        reply(locale, "strong", "severity", "Need to sit", "Necesito sentarme", "I need to sit or lie down.", "Necesito sentarme o acostarme.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
      ];
    }
    if (symptomId === "tired") {
      return [
        reply(locale, "mild", "severity", "Low energy", "Poca energia", "I have low energy.", "Tengo poca energia.", "activity", "green"),
        reply(locale, "moderate", "severity", "Limits my day", "Limita mi dia", "It is hard to do my usual things.", "Me cuesta hacer mis cosas normales.", "activity", "amber"),
        reply(locale, "strong", "severity", "Very weak", "Muy debil", "I feel very weak.", "Me siento muy debil.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
      ];
    }
    if (symptomId === "stomach") {
      return [
        reply(locale, "mild", "severity", "Mild discomfort", "Molestia leve", "It is mild discomfort.", "Es molestia leve.", "activity", "green"),
        reply(locale, "moderate", "severity", "Bothers me", "Me molesta", "It is bothering me.", "Me molesta.", "alert", "amber"),
        reply(locale, "strong", "severity", "Strong pain or vomiting", "Dolor fuerte o vomitos", "I have strong pain, vomiting, or diarrhea.", "Tengo dolor fuerte, vomitos o diarrea.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
      ];
    }
    if (symptomId === "urinary") {
      return [
        reply(locale, "mild", "severity", "Mild burning", "Ardor leve", "It is mild burning or going often.", "Es ardor leve o voy seguido.", "activity", "green"),
        reply(locale, "moderate", "severity", "Painful", "Doloroso", "It is painful or uncomfortable.", "Es doloroso o incomodo.", "alert", "amber"),
        reply(locale, "strong", "severity", "Very painful", "Muy doloroso", "It is very painful or I feel unwell.", "Es muy doloroso o me siento mal.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
      ];
    }
    if (symptomId === "fall") {
      return [
        reply(locale, "mild", "severity", "Mild soreness", "Dolor leve", "It is mild soreness.", "Es dolor leve.", "activity", "green"),
        reply(locale, "moderate", "severity", "Pain using it", "Duele al usarlo", "It hurts when I move or use it.", "Duele al moverlo o usarlo.", "alert", "amber"),
        reply(locale, "strong", "severity", "Cannot use it", "No puedo usarlo", "I cannot use the injured part normally.", "No puedo usar la parte lesionada normal.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how bad it is.", "No se que tan grave es.", "help", "purple"),
      ];
    }
    if (symptomId === "skin") {
      return [
        reply(locale, "mild", "severity", "Small area", "Area pequena", "It is a small area.", "Es un area pequena.", "activity", "green"),
        reply(locale, "moderate", "severity", "Painful or warm", "Duele o caliente", "It is painful, warm, or swollen.", "Duele, esta caliente o hinchado.", "alert", "amber"),
        reply(locale, "strong", "severity", "Spreading fast", "Se extiende rapido", "It is spreading or getting much worse.", "Se extiende o empeora mucho.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how bad it is.", "No se que tan grave es.", "help", "purple"),
      ];
    }
    if (symptomId === "confusion") {
      return [
        reply(locale, "mild", "severity", "Mild forgetfulness", "Olvido leve", "It is mild forgetfulness.", "Es olvido leve.", "activity", "green"),
        reply(locale, "moderate", "severity", "Not myself", "No soy yo", "I am not acting like myself.", "No actuo como siempre.", "alert", "amber"),
        reply(locale, "strong", "severity", "Very confused", "Muy confundido", "I am very confused or unsafe alone.", "Tengo mucha confusion o no estoy seguro solo.", "alert", "red"),
        reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how bad it is.", "No se que tan grave es.", "help", "purple"),
      ];
    }
    return [
      reply(locale, "mild", "severity", "Mild", "Leve", "It feels mild.", "Se siente leve.", "activity", "green"),
      reply(locale, "moderate", "severity", "Bothers me", "Me molesta", "It is bothering me.", "Me molesta.", "alert", "amber"),
      reply(locale, "strong", "severity", "Feels serious", "Parece serio", "It feels serious.", "Parece serio.", "heart", "red"),
      reply(locale, "not_sure_severity", "severity", "Not sure", "No se", "I am not sure how strong it is.", "No se que tan fuerte es.", "help", "purple"),
    ];
  }

  if (stage === "trend") {
    const symptomId = selectedSymptomId(wizard);
    if (symptomId === "breathing") {
      return [
        reply(locale, "better", "trend", "Breathing easier", "Respiro mejor", "My breathing is getting easier.", "Respiro mejor.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "My breathing feels about the same.", "Mi respiracion esta igual.", "help", "blue"),
        reply(locale, "worse", "trend", "Harder to breathe", "Cuesta mas respirar", "It is getting harder to breathe.", "Cada vez cuesta mas respirar.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "fever") {
      return [
        reply(locale, "better", "trend", "Coming down", "Esta bajando", "The fever is coming down.", "La fiebre esta bajando.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "The fever feels about the same.", "La fiebre esta igual.", "help", "blue"),
        reply(locale, "worse", "trend", "Higher or worse", "Mas alta o peor", "The fever is higher or I feel worse.", "La fiebre esta mas alta o me siento peor.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "dizzy") {
      return [
        reply(locale, "better", "trend", "Better sitting", "Mejor sentado", "It is better when I sit or rest.", "Mejora cuando me siento o descanso.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "The dizziness feels about the same.", "El mareo esta igual.", "help", "blue"),
        reply(locale, "worse", "trend", "More dizzy", "Mas mareo", "The dizziness is getting worse.", "El mareo esta empeorando.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "tired") {
      return [
        reply(locale, "better", "trend", "More energy", "Mas energia", "I have a bit more energy.", "Tengo algo mas de energia.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "My energy feels about the same.", "Mi energia esta igual.", "help", "blue"),
        reply(locale, "worse", "trend", "Weaker", "Mas debil", "I am feeling weaker.", "Me siento mas debil.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "pain") {
      return [
        reply(locale, "better", "trend", "Pain easing", "Dolor baja", "The pain is easing.", "El dolor esta bajando.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "The pain feels about the same.", "El dolor esta igual.", "help", "blue"),
        reply(locale, "worse", "trend", "Pain worse", "Dolor peor", "The pain is getting worse.", "El dolor esta empeorando.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "stomach") {
      return [
        reply(locale, "better", "trend", "Settling", "Mejora", "It is settling down.", "Esta mejorando.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "It feels about the same.", "Se siente igual.", "help", "blue"),
        reply(locale, "worse", "trend", "Worse", "Peor", "It is getting worse.", "Esta empeorando.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "urinary") {
      return [
        reply(locale, "better", "trend", "Easing", "Mejora", "It is easing.", "Esta mejorando.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "It feels about the same.", "Se siente igual.", "help", "blue"),
        reply(locale, "worse", "trend", "Worse", "Peor", "It is getting worse.", "Esta empeorando.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "fall") {
      return [
        reply(locale, "better", "trend", "Moving better", "Me muevo mejor", "I can move better now.", "Me puedo mover mejor ahora.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "It feels about the same.", "Se siente igual.", "help", "blue"),
        reply(locale, "worse", "trend", "More pain", "Mas dolor", "Pain or swelling is getting worse.", "Dolor o hinchazon esta empeorando.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "skin") {
      return [
        reply(locale, "better", "trend", "Improving", "Mejora", "It is improving.", "Esta mejorando.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "It looks about the same.", "Se ve igual.", "help", "blue"),
        reply(locale, "worse", "trend", "Spreading", "Se extiende", "It is spreading or more painful.", "Se extiende o duele mas.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    if (symptomId === "confusion") {
      return [
        reply(locale, "better", "trend", "Clearer now", "Mas claro ahora", "I feel clearer now.", "Me siento mas claro ahora.", "activity", "green"),
        reply(locale, "same", "trend", "Same", "Igual", "It feels about the same.", "Se siente igual.", "help", "blue"),
        reply(locale, "worse", "trend", "More confused", "Mas confusion", "The confusion is getting worse.", "La confusion esta empeorando.", "alert", "red"),
        reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
      ];
    }
    return [
      reply(locale, "better", "trend", "Better", "Mejor", "It is getting better.", "Esta mejorando.", "activity", "green"),
      reply(locale, "same", "trend", "Same", "Igual", "It feels about the same.", "Se siente igual.", "help", "blue"),
      reply(locale, "worse", "trend", "Worse", "Peor", "It is getting worse.", "Esta empeorando.", "alert", "red"),
      reply(locale, "new_symptoms", "trend", "New symptoms", "Nuevos sintomas", "New symptoms have appeared.", "alert", "amber"),
    ];
  }

  return [];
}

function safetyMessage(locale: string, warningLabel: string) {
  return text(
    locale,
    `${warningLabel} can be an emergency warning sign. If this is happening now, call emergency services now or ask someone nearby to help you. Do not drive yourself.`,
    `${warningLabel} puede ser una senal de emergencia. Si esto esta pasando ahora, llama a emergencias ahora o pide ayuda a alguien cercano. No conduzcas.`,
  );
}

function safetyRecommendation(locale: string) {
  return text(
    locale,
    "Call emergency services now if this is happening now. Ask someone nearby to stay with you and do not drive yourself.",
    "Llama a emergencias ahora si esto esta pasando ahora. Pide a alguien cercano que se quede contigo y no conduzcas.",
  );
}

function safetyQuickReplies(locale: string): TriageQuickReply[] {
  return [
    reply(locale, "call_emergency", "support", "Call emergency", "Llamar emergencias", "I will call emergency services now.", "Llamare a emergencias ahora.", "alert", "red"),
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

Use this evidence actively:
- Let it shape the next safety question when it names red flags relevant to this symptom.
- Reflect its concrete red flags in watchSigns when a final summary is produced.
- Do not cite it as a diagnosis. Do not mention article titles to the senior unless the app surfaces them separately.
Ask one simple question at a time.`;
}

function cleanEvidenceSummary(answer: string) {
  return answer
    .replace(/\s+/g, " ")
    .replace(/[*#`]/g, "")
    .trim()
    .slice(0, 260);
}

function evidenceSummaryFor(context?: MediSearchTriageContext | null) {
  if (!context?.answer) return "";
  return cleanEvidenceSummary(context.answer);
}

function evidenceSourcesFor(context?: MediSearchTriageContext | null) {
  return context?.articles.slice(0, 3).map((article) => ({
    title: article.title,
    url: article.url,
    year: article.year,
    journal: article.journal,
  })) ?? [];
}

function triageQuestionMatrixText() {
  return `

SYMPTOM AND PROFILE QUESTION MATRIX:
- Pain/headache: ask about chest pain, sudden/severe onset, fall/injury, head hit, one-sided weakness, vision change, or speech trouble.
- Breathing: ask about breathlessness at rest, blue lips, confusion, low oxygen, increased oxygen need, chest pressure, or one-sided calf swelling after surgery.
- Fever: ask about very high fever, confusion/very sleepy, stiff neck, new rash, low immunity/cancer treatment, surgery wound changes, urine symptoms, or low urine/dehydration.
- Dizziness: ask about fainting, nearly fainting, one-sided weakness, speech trouble, chest pain, irregular heartbeat, dehydration, low sugar, sedating medication, or falls.
- Very tired/weak: ask about low sugar, infection signs, low urine/dehydration, new confusion, slow breathing/opioids, swelling/heart failure, or inability to stand/walk safely.
- Stomach/bowel: ask about severe belly pain, blood vomit, black/bloody stool, hard swollen belly, vomiting/diarrhea, dehydration, and constipation with severe pain.
- Urine problem: ask about fever, back/flank pain, shaking chills, unable to pass urine, blood in urine, burning, frequency, low urine, and new confusion.
- Fall/injury: ask about head hit, fainting, confusion, blood thinners, hip/back pain, cannot stand/walk, cannot use the injured part, or severe pain.
- Skin/wound: ask about spreading redness, warmth, swelling, pus, fever, surgical wound changes, face/lip/tongue/throat swelling, and low immunity.
- Confusion/memory change: ask if sudden, much worse than usual, with weakness/speech trouble, fever, urine change, low sugar, dehydration, sedatives/opioids, or unsafe alone.
- Something else/free text: first ask the user to name the main symptom in a few words; then choose the closest pattern above. If unclear, ask general safety checks: cannot stand, not drinking/eating, new/severe, new confusion, chest pain, or breathing trouble.
- Later questions must stay symptom-specific. Pain asks pain timing, strength, and whether pain is easing or worsening. Breathing asks whether breathing is easier or harder. Fever asks whether temperature/feverish feeling is coming down or getting worse. Dizziness asks standing/walking safety and whether rest helps. Tired/weak asks daily function, hydration, and whether weakness is improving or worsening. Stomach asks vomiting/diarrhea/pain pattern. Urine asks burning/frequency/retention. Falls ask ability to stand/use the injured part. Skin asks spreading/warmth/pus. Confusion asks suddenness and safety. Free text should be classified first, then follow the nearest path.

PROFILE-SPECIFIC SAFETY CHECKS:
- Diabetes or glucose medication: check shaky/sweaty/confused/very weak, high sugar with sickness/thirst/drowsiness, missed insulin, vomiting, or infection signs.
- Kidney disease or diuretics: check low urine, dehydration, dizziness standing, swelling, sudden weight gain, or medication safety.
- COPD/asthma/oxygen support: check low oxygen, needing more oxygen than usual, breathless at rest, blue lips, or confusion.
- Heart failure: check breathlessness, swelling, fast weight gain, chest pressure, or needing to sit upright to breathe.
- Heart disease or AFib: check chest pressure, palpitations, fainting, irregular heartbeat, or breathlessness.
- Hypertension or stroke/TIA history: check severe headache with weakness, speech trouble, face droop, vision change, or very high blood pressure.
- Blood thinners: check head hit/fall, unusual bleeding, black stool, vomiting blood, large bruises, or new severe headache.
- Low immunity, steroids, cancer, or chemotherapy: treat fever, chills, wound changes, or feeling suddenly very unwell as higher priority.
- Dementia/cognitive concern: check new confusion, behavior change, weakness, dehydration, infection signs, or not acting like usual.
- Parkinson's/mobility/swallowing risk: check choking, coughing with food, trouble swallowing, falls, freezing, or missed Parkinson's medication timing.
- Osteoporosis/frailty/falls: check fall with hip/back pain, cannot stand, new severe pain, or head hit.
- Recent surgery/hospital stay: check fever, wound redness/drainage, calf swelling/pain, chest pain, or new breathlessness.
- UTI/recurrent infection history: check burning urine, fever, new confusion, new weakness, low urine, or back/flank pain.
- Liver disease: check confusion, yellow skin, black stool, vomiting blood, belly swelling, or unusual bleeding.
- Sedatives/opioids: check very sleepy, confused, unsteady, slow breathing, or hard to wake.
- Depression/anxiety: check panic-like symptoms, sleep/appetite change, isolation, and any thoughts of self-harm if mood distress is prominent.

Do not use one symptom's wording for another symptom. For example, fever does not "build up" like pain; ask fever warning signs instead.`;
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

  return `You are VYVA, a warm and caring medical triage assistant helping an elderly person understand their symptoms. Your role is to ask clear, simple questions and provide helpful wording.

The app has a deterministic senior triage protocol engine. That protocol is the safety authority. You may enrich wording from MEDISEARCH EVIDENCE CONTEXT, HEALTH MEMORY, and the conversation, but do not downgrade urgency, soften red flags, or override protocol-driven next steps.

IMPORTANT: Respond entirely in ${language}.
${genderInstruction(gender)}${vitalsContext}${wizardContextText(wizard, healthMemory)}${healthMemoryText(healthMemory)}${medisearchContextText(medisearchContext)}${triageQuestionMatrixText()}

CONVERSATION FLOW:
1. The app is a senior-friendly wizard. Match the current wizard stage and ask only one very simple question.
2. If there is no symptom category yet, ask what feels wrong today.
3. After a symptom category, ask the most relevant red-flag question first using the SYMPTOM AND PROFILE QUESTION MATRIX. If the reply buttons cover several warning signs, ask a broad matching question like "Do any of these warning signs apply?" instead of naming only one option.
4. Adapt concern level to HEALTH MEMORY. Be more cautious for diabetes, kidney disease, COPD/oxygen use, heart failure, heart disease/AFib, high blood pressure, stroke/TIA history, blood thinners, low immunity/cancer treatment, liver disease, recent surgery, falls/frailty, Parkinson's, osteoporosis, high-risk medications, and new confusion.
5. After the safety check, follow the adaptive wizard stage supplied by the app. Ask the single next question that matches the quick reply choices. You may finish once the app stage is complete, even if fewer than 5 questions were needed.
6. Avoid repeating questions already answered in WIZARD CONTEXT.
7. After gathering sufficient information, gently wrap up. Some high-signal paths need fewer questions.
8. On your FINAL turn, you MUST end your message with this exact JSON block (replace values appropriately):

TRIAGE_JSON_START
{"done":true,"summary":{"chiefComplaint":"<one-line description>","symptoms":["<symptom 1>","<symptom 2>"],"urgency":"<urgent|routine|monitor>","nextStepLabel":"<plain next step>","nextStepLevel":"<emergency|doctor_today|doctor_24_48|monitor>","triageReasons":["<plain reason 1>","<plain reason 2>"],"recommendations":["<step 1>","<step 2>","<step 3>","<step 4>"],"watchSigns":["<specific sign 1>","<specific sign 2>","<specific sign 3>"],"profileConsiderations":["<profile factor considered, if any>"],"vitalsNotes":["<vitals note, if any>"],"disclaimer":"This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious."}}
TRIAGE_JSON_END

Urgency definitions:
- "urgent": symptoms that warrant same-day or next-day GP attention (e.g. chest pain, difficulty breathing, high fever)
- "routine": symptoms that should be discussed at the next GP appointment (e.g. mild ongoing pain, fatigue)
- "monitor": symptoms that are likely self-limiting and can be monitored at home (e.g. mild cold, minor ache)

Outcome rules:
- Always include nextStepLabel and nextStepLevel.
- Always include triageReasons: 1-3 plain reasons why this next step was chosen.
- Always include 2-3 symptom-specific watchSigns.
- If MEDISEARCH EVIDENCE CONTEXT is present, use its red flags and follow-up topics to make watchSigns and recommendations more specific.
- The deterministic protocol may raise or replace your urgency after you respond. Write recommendations that remain safe if the protocol escalates the next step.
- Include profileConsiderations only when HEALTH MEMORY changed what you considered.
- Include vitalsNotes when a vitals scan exists.

STYLE RULES:
- Write like a calm health form, not a chat conversation
- Use simple, kind, non-alarming language suitable for older adults
- Ask one direct question, ideally under 14 words
- Do not start with apologies like "I'm sorry to hear that"
- Do not explain the wizard or mention the buttons
- Never use medical jargon
- Prefer plain words: "sudden", "strong", "today", "getting worse"
- Do NOT produce the JSON block until the app stage is complete, unless an emergency safety alert is present`;
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

function urgencyRank(urgency: TriageSummary["urgency"]) {
  if (urgency === "urgent") return 3;
  if (urgency === "routine") return 2;
  return 1;
}

function maxUrgency(
  current: TriageSummary["urgency"],
  floor: TriageSummary["urgency"],
): TriageSummary["urgency"] {
  return urgencyRank(current) >= urgencyRank(floor) ? current : floor;
}

function prependRecommendation(recommendations: string[], recommendation: string) {
  const alreadyPresent = recommendations.some((item) => item.toLowerCase() === recommendation.toLowerCase());
  return alreadyPresent ? recommendations : [recommendation, ...recommendations].slice(0, 5);
}

function symptomLabel(locale: string, symptomId: string | undefined) {
  const labels: Record<string, { en: string; es: string }> = {
    pain: { en: "pain or headache", es: "dolor o dolor de cabeza" },
    breathing: { en: "breathing", es: "respiracion" },
    fever: { en: "fever", es: "fiebre" },
    dizzy: { en: "dizziness", es: "mareo" },
    tired: { en: "tiredness or weakness", es: "cansancio o debilidad" },
    stomach: { en: "stomach or bowel trouble", es: "problema de estomago o intestino" },
    urinary: { en: "urine problem", es: "problema de orina" },
    fall: { en: "fall or injury", es: "caida o golpe" },
    skin: { en: "skin or wound problem", es: "problema de piel o herida" },
    confusion: { en: "confusion or memory change", es: "confusion o cambio de memoria" },
    other: { en: "symptoms", es: "sintomas" },
  };
  const label = labels[symptomId ?? "other"] ?? labels.other;
  return text(locale, label.en, label.es);
}

function watchSignsFor(locale: string, symptomId: string | undefined): string[] {
  if (symptomId === "breathing") {
    return [
      text(locale, "Breathing becomes difficult at rest.", "La respiracion cuesta incluso en reposo."),
      text(locale, "Blue lips, confusion, fainting, or chest pressure appears.", "Aparecen labios azules, confusion, desmayo o presion en el pecho."),
      text(locale, "Oxygen is lower than usual, if you measure it.", "El oxigeno esta mas bajo de lo habitual, si lo mides."),
    ];
  }
  if (symptomId === "fever") {
    return [
      text(locale, "Confusion, extreme sleepiness, stiff neck, or new rash appears.", "Aparece confusion, mucho sueno, cuello rigido o erupcion nueva."),
      text(locale, "Fever stays high or you feel suddenly much worse.", "La fiebre sigue alta o te sientes mucho peor de repente."),
      text(locale, "You cannot drink, pass very little urine, or feel very weak.", "No puedes beber, orinas muy poco o te sientes muy debil."),
    ];
  }
  if (symptomId === "dizzy") {
    return [
      text(locale, "You faint or nearly faint.", "Te desmayas o casi te desmayas."),
      text(locale, "Weakness on one side, speech trouble, chest pain, or breathing trouble appears.", "Aparece debilidad en un lado, dificultad al hablar, dolor de pecho o falta de aire."),
      text(locale, "Dizziness gets worse when standing or you cannot walk safely.", "El mareo empeora al levantarte o no puedes caminar con seguridad."),
    ];
  }
  if (symptomId === "pain") {
    return [
      text(locale, "Pain becomes sudden, severe, or very unusual for you.", "El dolor se vuelve repentino, fuerte o muy raro para ti."),
      text(locale, "Weakness, speech trouble, vision change, confusion, or fainting appears.", "Aparece debilidad, dificultad al hablar, cambio de vision, confusion o desmayo."),
      text(locale, "Pain follows a fall, head hit, or chest pressure.", "El dolor aparece tras una caida, golpe en la cabeza o presion en el pecho."),
    ];
  }
  if (symptomId === "tired") {
    return [
      text(locale, "You cannot stand, walk safely, or care for yourself.", "No puedes estar de pie, caminar con seguridad o cuidarte."),
      text(locale, "New confusion, fever, chest pain, breathing trouble, or fainting appears.", "Aparece confusion nueva, fiebre, dolor de pecho, falta de aire o desmayo."),
      text(locale, "You are not drinking, pass very little urine, or feel much weaker.", "No estas bebiendo, orinas muy poco o te sientes mucho mas debil."),
    ];
  }
  if (symptomId === "stomach") {
    return [
      text(locale, "Belly pain becomes severe, constant, hard, or swollen.", "El dolor de barriga se vuelve fuerte, constante, dura o hinchada."),
      text(locale, "Vomiting blood, black stool, bloody stool, or fainting appears.", "Aparece vomito con sangre, heces negras, sangre en heces o desmayo."),
      text(locale, "You cannot keep fluids down or pass very little urine.", "No puedes retener liquidos u orinas muy poco."),
    ];
  }
  if (symptomId === "urinary") {
    return [
      text(locale, "Fever, shaking chills, back/flank pain, or new confusion appears.", "Aparece fiebre, escalofrios fuertes, dolor de espalda/lado o confusion nueva."),
      text(locale, "You cannot pass urine or have strong lower belly pain.", "No puedes orinar o tienes dolor fuerte bajo vientre."),
      text(locale, "Blood in urine, weakness, or feeling suddenly worse appears.", "Aparece sangre en orina, debilidad o empeoras de repente."),
    ];
  }
  if (symptomId === "fall") {
    return [
      text(locale, "Head hit, confusion, fainting, severe headache, or vomiting appears.", "Aparece golpe en cabeza, confusion, desmayo, dolor de cabeza fuerte o vomitos."),
      text(locale, "You cannot stand, walk, or use the injured part.", "No puedes estar de pie, caminar o usar la parte lesionada."),
      text(locale, "Hip, back, chest pain, or swelling gets worse.", "Empeora dolor de cadera, espalda, pecho o hinchazon."),
    ];
  }
  if (symptomId === "skin") {
    return [
      text(locale, "Redness, warmth, swelling, or pus spreads.", "Rojez, calor, hinchazon o pus se extiende."),
      text(locale, "Fever, severe pain, red streaks, or feeling very unwell appears.", "Aparece fiebre, dolor fuerte, lineas rojas o te sientes muy mal."),
      text(locale, "Face, lip, tongue, or throat swelling appears.", "Aparece hinchazon de cara, labios, lengua o garganta."),
    ];
  }
  if (symptomId === "confusion") {
    return [
      text(locale, "Confusion is sudden, worse, or you are unsafe alone.", "La confusion es repentina, empeora o no estas seguro solo."),
      text(locale, "Weakness, speech trouble, face droop, fever, or fainting appears.", "Aparece debilidad, habla rara, cara caida, fiebre o desmayo."),
      text(locale, "Urine change, dehydration, low sugar signs, or slow breathing appears.", "Aparece cambio de orina, deshidratacion, senales de azucar baja o respiracion lenta."),
    ];
  }
  return [
    text(locale, "Symptoms get worse or new symptoms appear.", "Los sintomas empeoran o aparecen sintomas nuevos."),
    text(locale, "You feel unsafe, confused, faint, or very weak.", "Te sientes inseguro, con confusion, desmayo o mucha debilidad."),
    text(locale, "Breathing trouble, chest pain, or severe pain appears.", "Aparece falta de aire, dolor de pecho o dolor fuerte."),
  ];
}

function profileConsiderationsFor(locale: string, risks: ProfileRiskFlags, symptomId: string | undefined): string[] {
  const notes = [
    risks.bloodThinner && ["pain", "dizzy", "other"].includes(symptomId ?? "")
      ? text(locale, "Blood thinner in profile: falls, head hits, unusual bleeding, or severe headache need extra caution.", "Anticoagulante en el perfil: caidas, golpes en la cabeza, sangrado raro o dolor de cabeza fuerte requieren mas cuidado.")
      : "",
    risks.diabetes && ["dizzy", "tired", "fever", "urinary", "confusion", "other"].includes(symptomId ?? "")
      ? text(locale, "Diabetes or glucose medicine in profile: sugar changes can make weakness, dizziness, or infection feel different.", "Diabetes o medicacion de azucar en el perfil: cambios de azucar pueden cambiar debilidad, mareo o infeccion.")
      : "",
    (risks.copd || risks.heartFailure) && ["breathing", "tired", "fall", "other"].includes(symptomId ?? "")
      ? text(locale, "Breathing or heart condition in profile: shortness of breath should be watched more closely.", "Condicion respiratoria o cardiaca en el perfil: la falta de aire debe vigilarse mas de cerca.")
      : "",
    (risks.strokeHistory || risks.hypertension) && ["pain", "dizzy", "confusion", "other"].includes(symptomId ?? "")
      ? text(locale, "Blood pressure or stroke history in profile: weakness, speech trouble, or vision change matters more.", "Presion alta o antecedente de ictus en el perfil: debilidad, habla rara o cambio de vision importa mas.")
      : "",
    (risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "fever"
      ? text(locale, "Low immunity risk in profile: fever should be handled more cautiously.", "Riesgo de defensas bajas en el perfil: la fiebre debe manejarse con mas cautela.")
      : "",
    (risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "skin"
      ? text(locale, "Low immunity risk in profile: skin or wound changes should be watched more closely.", "Riesgo de defensas bajas en el perfil: cambios en piel o herida deben vigilarse mas de cerca.")
      : "",
    risks.cognitiveConcern
      ? text(locale, "Memory or confusion risk in profile: new confusion should be treated as important.", "Riesgo de memoria o confusion en el perfil: la confusion nueva debe tratarse como importante.")
      : "",
  ].filter(Boolean);
  return notes.slice(0, 2);
}

function vitalsNotesFor(locale: string, wizard: TriageWizardContext | undefined): string[] {
  const bpm = wizard?.vitals?.bpm;
  const rr = wizard?.vitals?.respiratoryRate;
  const notes: string[] = [];
  if (typeof bpm === "number" && (bpm >= 110 || bpm <= 50)) {
    notes.push(text(locale, `Pulse from scan was ${bpm} bpm, so the report includes it for the doctor.`, `El pulso del escaneo fue ${bpm} lpm, asi que el informe lo incluye para el medico.`));
  } else if (typeof bpm === "number") {
    notes.push(text(locale, `Pulse from scan was ${bpm} bpm.`, `El pulso del escaneo fue ${bpm} lpm.`));
  }
  if (typeof rr === "number" && (rr >= 24 || rr <= 10)) {
    notes.push(text(locale, `Breathing rate from scan was ${rr}/min, which should be shared with a clinician.`, `La respiracion del escaneo fue ${rr}/min, y conviene compartirla con un clinico.`));
  } else if (typeof rr === "number") {
    notes.push(text(locale, `Breathing rate from scan was ${rr}/min.`, `La respiracion del escaneo fue ${rr}/min.`));
  }
  return notes.slice(0, 2);
}

function nextStepFor(
  locale: string,
  summary: TriageSummary,
  wizard: TriageWizardContext | undefined,
): Pick<TriageSummary, "nextStepLabel" | "nextStepLevel"> {
  const answers = selectedAnswers(wizard);
  const ids = new Set(answers.map((answer) => answer.id));
  const hasCriticalRedFlag = answers.some((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));

  if (hasCriticalRedFlag) {
    return {
      nextStepLevel: "emergency",
      nextStepLabel: text(locale, "Call emergency services now", "Llama a emergencias ahora"),
    };
  }
  if (summary.urgency === "urgent" || (ids.has("strong") && ids.has("worse")) || ids.has("new_symptoms")) {
    return {
      nextStepLevel: "doctor_today",
      nextStepLabel: text(locale, "Talk to a doctor today", "Habla con un medico hoy"),
    };
  }
  if (summary.urgency === "routine" || ids.has("strong") || ids.has("worse")) {
    return {
      nextStepLevel: "doctor_24_48",
      nextStepLabel: text(locale, "Talk to a doctor within 24-48 hours", "Habla con un medico en 24-48 horas"),
    };
  }
  return {
    nextStepLevel: "monitor",
    nextStepLabel: text(locale, "Monitor at home, with doctor access ready", "Vigila en casa, con medico disponible"),
  };
}

function applyTriageSafetyFloor(
  summary: TriageSummary,
  wizard: TriageWizardContext | undefined,
  locale: string,
  healthMemory?: TriageHealthMemory,
): TriageSummary {
  const answers = selectedAnswers(wizard);
  const ids = new Set(answers.map((answer) => answer.id));
  const symptom = selectedSymptomId(wizard);
  const hasCriticalRedFlag = answers.some((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
  const risks = profileRiskFlags(healthMemory);
  const abnormalPulse = typeof wizard?.vitals?.bpm === "number" && (wizard.vitals.bpm >= 110 || wizard.vitals.bpm <= 50);
  const abnormalBreathingRate = typeof wizard?.vitals?.respiratoryRate === "number" && (wizard.vitals.respiratoryRate >= 24 || wizard.vitals.respiratoryRate <= 10);
  const ruleDecision = evaluateTriageRules({
    locale,
    symptomId: symptom,
    answerIds: ids,
    risks,
    hasCriticalRedFlag,
    abnormalPulse,
    abnormalBreathingRate,
  });
  const baseSummary = {
    ...summary,
    symptoms: summary.symptoms?.length ? summary.symptoms : [symptomLabel(locale, symptom)],
    urgency: ruleDecision.urgency,
    triageReasons: [
      ...ruleDecision.reasons,
      ...(summary.triageReasons ?? []),
    ].filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index).slice(0, 3),
    watchSigns: ruleDecision.watchSigns.length ? ruleDecision.watchSigns : summary.watchSigns?.length ? summary.watchSigns : watchSignsFor(locale, symptom),
    profileConsiderations: [
      ...(summary.profileConsiderations ?? []),
      ...profileConsiderationsFor(locale, risks, symptom),
      ...ruleDecision.profileConsiderations,
    ].slice(0, 3),
    vitalsNotes: [
      ...(summary.vitalsNotes ?? []),
      ...vitalsNotesFor(locale, wizard),
    ].slice(0, 3),
    recommendations: [
      ...ruleDecision.recommendations,
      ...(summary.recommendations ?? []),
    ].filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index).slice(0, 5),
  };
  const nextStep = {
    nextStepLevel: ruleDecision.level,
    nextStepLabel: ruleDecision.nextStepLabel,
  } satisfies Pick<TriageSummary, "nextStepLabel" | "nextStepLevel">;

  return {
    ...baseSummary,
    ...nextStep,
  };
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
  const effectiveWizard = wizardWithInferredClue(wizard, validMessages, normalizedLocale);

  const safetyAnswer = selectedSafetyAnswer(effectiveWizard);
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
          wizard: effectiveWizard,
        })
      : null;

    const systemContent = buildSystemPrompt(language, vitals?.bpm ?? null, gender, effectiveWizard, medisearchContext, healthMemory);

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
    const safeSummary = summary ? applyTriageSafetyFloor(summary, effectiveWizard, normalizedLocale, healthMemory) : null;
    const evidenceSources = evidenceSourcesFor(medisearchContext);
    const evidenceSummary = evidenceSummaryFor(medisearchContext);
    const summaryWithEvidence = safeSummary
      ? {
          ...safeSummary,
          evidenceSummary: evidenceSummary || undefined,
          evidenceSources: evidenceSources.length ? evidenceSources : undefined,
        }
      : null;

    const stage = nextAdaptiveStage(effectiveWizard, healthMemory);
    return res.json({
      role: "assistant",
      content,
      done: summaryWithEvidence != null,
      summary: summaryWithEvidence ?? undefined,
      quickReplies: summaryWithEvidence ? [] : quickRepliesFor(effectiveWizard, normalizedLocale, healthMemory),
      wizardStage: stage,
      wizardStageLabel: wizardStageLabel(stage, normalizedLocale),
      evidenceSources,
    });
  } catch (err) {
    console.error("[triage] OpenAI error:", err);
    return res.status(500).json({ error: "Failed to process triage request" });
  }
});

export default router;
