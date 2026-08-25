import { PREVENTION_CONTENT_LIBRARY, type PreventionContentEntry, type PreventionContentRoute } from "./longevityContentLibrary.js";

export type PreventionFocus = "Heart" | "Falls" | "Diabetes" | "Medicine" | "Follow-up" | "Plan";

export type PreventionConfidence = "strong" | "moderate" | "limited";

export type PreventionSignal = {
  id: string;
  label: string;
  detail?: string;
  category: "profile" | "vitals" | "medicine" | "symptom" | "safety";
  strength: "high" | "medium" | "low";
  route?: string;
};

export type PreventionInsight = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "alert" | "caution" | "steady";
  route?: string;
};

export type PreventionAction = {
  id: string;
  label: string;
  detail: string;
  route: string;
  priority: "primary" | "secondary";
  mode?: "navigate" | "voice";
};

export type PreventionShoppingPrefill = {
  needText: string;
  category: "groceries" | "pharmacy_basics" | "household" | "mobility_aids" | "safe_home" | string;
  priorities: string[];
  constraints?: string[];
  packageId?: string;
  sourceRecommendation?: string;
};

export type PreventionGuidanceAction = {
  id: string;
  label: string;
  detail: string;
  route: string;
  priority: "primary" | "secondary";
  mode?: "navigate" | "voice";
  shoppingPrefill?: PreventionShoppingPrefill;
};

export type PreventionRecipeSuggestion = {
  id: string;
  title: string;
  prepTimeLabel: string;
  whyItFits: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  shoppingPrefill: PreventionShoppingPrefill;
};

export type PreventionActionSheet = {
  title: string;
  summary: string;
  primaryAction: PreventionGuidanceAction;
  secondaryActions: PreventionGuidanceAction[];
  recipes?: PreventionRecipeSuggestion[];
  safetyNote?: string;
};

export type PreventionGuidanceItem = {
  id: "eat" | "move" | "do" | "avoid";
  label: string;
  headline: string;
  detail: string;
  chips: string[];
  tone: "food" | "movement" | "action" | "avoid";
  actionSheet?: PreventionActionSheet;
};

export type PreventionActionStep = "Eat" | "Move" | "Calm" | "Check" | "Protect" | "Home" | "Medicine" | "Review" | "Plan" | "Sleep" | "NEXT STEP" | "WATCH FOR" | "RIGHT NOW" | "IF NEEDED";

export type PreventionActionTone = "food" | "movement" | "check" | "support" | "medicine";

export type PreventionFeedbackValue = "shown" | "done" | "too_hard" | "remind";

export type PreventionBarrier =
  | "physical"
  | "cooking"
  | "no_ingredients"
  | "confusing"
  | "not_interested"
  | "needs_help";

export type PreventionLoopFeedbackEvent = {
  actionId: string;
  title?: string;
  step?: PreventionActionStep;
  tone?: PreventionActionTone;
  focus?: PreventionFocus;
  feedback: PreventionFeedbackValue;
  barrier?: PreventionBarrier;
  date?: string;
  savedAt?: string;
};

export type PreventionLoopContext = {
  clientHour?: number;
  recentFeedback?: PreventionLoopFeedbackEvent[];
  dismissedFollowUpIds?: string[];
};

export type PreventionTimeOfDay = "morning" | "afternoon" | "evening" | "night";

export type PreventionWeeklySummary = {
  headline: string;
  detail: string;
  bullets: string[];
  doctorSummary: string;
  caregiverSummary: string;
};

export type PreventionRankingMeta = {
  timeOfDay: PreventionTimeOfDay;
  rankingReasons: string[];
};

export type PreventionDailyAction = {
  id: string;
  step: PreventionActionStep;
  title: string;
  detail: string;
  chips?: string[];
  why: string;
  evidenceLabel: string;
  tone: PreventionActionTone;
  actionSheet: PreventionActionSheet;
  feedbackOptions: Array<{
    id: "done" | "too_hard" | "remind" | "ask_vyva";
    label: string;
  }>;
};

export type PreventionLearning = {
  title: string;
  detail: string;
  askPrompt: string;
};

export type PreventionMedication = {
  medicationName: string;
  dosage?: string | null;
  frequency?: string | null;
  scheduledTimes?: string[] | null;
};

export type PreventionAdherence = {
  scheduledToday: number;
  takenToday: number;
  missedOrLate30: number;
};

export type PreventionVitalReading = {
  signalType?: string | null;
  metricType?: string | null;
  value?: string | number | null;
  unit?: string | null;
  recordedAt?: string | Date | null;
};

export type PreventionVitalsAnalysis = {
  safetyStatus?: string | null;
  riskTier?: string | null;
  riskScore?: number | null;
  patternLabels?: string[] | null;
  seniorMessage?: string | null;
  recommendedAction?: string | null;
  analysedAt?: string | Date | null;
};

export type PreventionSymptomReport = {
  id?: string | null;
  chiefComplaint?: string | null;
  urgency?: string | null;
  nextStepLabel?: string | null;
  nextStepLevel?: string | null;
  watchSigns?: string[] | null;
  createdAt?: string | Date | null;
};

export type PreventionMedicationSafetySignal = {
  signalType?: string | null;
  severity?: string | null;
  title?: string | null;
  summary?: string | null;
  medicationName?: string | null;
  detectedAt?: string | Date | null;
};

export type PreventionFocusInput = {
  now?: Date;
  conditions?: string[];
  dietaryPreferences?: string[];
  dietaryNotes?: string | null;
  allergies?: string[];
  noKnownAllergies?: boolean;
  mobilityLevel?: string | null;
  livingSituation?: string | null;
  activeMedications?: PreventionMedication[];
  adherence?: PreventionAdherence;
  latestVitals?: PreventionVitalReading | null;
  recentVitals?: PreventionVitalReading[];
  latestVitalsAnalysis?: PreventionVitalsAnalysis | null;
  latestSymptomReport?: PreventionSymptomReport | null;
  medicationSafetySignals?: PreventionMedicationSafetySignal[];
  loopContext?: PreventionLoopContext;
};

export type PreventionFocusResult = {
  focus: PreventionFocus;
  headline: string;
  why: string[];
  todayAction: string;
  helpSigns: string[];
  primaryRoute: string;
  secondaryRoute?: string;
  confidence: PreventionConfidence;
  signals: PreventionSignal[];
  insights: PreventionInsight[];
  actions: PreventionAction[];
  guidance: PreventionGuidanceItem[];
  dailyActions: PreventionDailyAction[];
  learning: PreventionLearning;
  personalizationSummary: string[];
  profileSignals: string[];
  weeklySummary: PreventionWeeklySummary;
  ranking: PreventionRankingMeta;
  doctorNote: string;
  followUp?: {
    reportId?: string | null;
    reportedAt?: string | null;
    subject: string;
    topic: string;
  };
  generatedAt: string;
};

type FocusCandidate = {
  focus: PreventionFocus;
  score: number;
  priority: number;
  headline: string;
  why: string[];
  todayAction: string;
  helpSigns: string[];
  primaryRoute: string;
  secondaryRoute?: string;
  signals: PreventionSignal[];
  insights: PreventionInsight[];
  actions: PreventionAction[];
  doctorNote: string;
};

const HEART_TERMS = [
  "heart",
  "cardiac",
  "hypertension",
  "high blood pressure",
  "blood pressure",
  "stroke",
  "atrial fibrillation",
  "afib",
  "angina",
];

const DIABETES_TERMS = [
  "diabetes",
  "diabetic",
  "glucose",
  "blood sugar",
  "insulin",
  "metformin",
  "glyburide",
  "gliclazide",
];

const FALL_TERMS = [
  "fall",
  "falls",
  "frail",
  "unsteady",
  "dizziness",
  "dizzy",
  "balance",
  "parkinson",
  "osteoporosis",
];

const SEDATING_MED_TERMS = [
  "diazepam",
  "lorazepam",
  "alprazolam",
  "zolpidem",
  "zopiclone",
  "amitriptyline",
  "quetiapine",
  "gabapentin",
  "pregabalin",
  "codeine",
  "tramadol",
  "morphine",
  "oxycodone",
];

const BLOOD_THINNER_TERMS = [
  "warfarin",
  "apixaban",
  "rivaroxaban",
  "dabigatran",
  "edoxaban",
  "clopidogrel",
];

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function compactText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function allContext(input: PreventionFocusInput): string[] {
  const conditions = input.conditions ?? [];
  const meds = input.activeMedications ?? [];
  const vitals = [input.latestVitals, ...(input.recentVitals ?? [])].filter(Boolean) as PreventionVitalReading[];
  const analysis = input.latestVitalsAnalysis;
  const symptom = input.latestSymptomReport;
  const safetySignals = input.medicationSafetySignals ?? [];

  return [
    ...conditions,
    input.mobilityLevel,
    input.livingSituation,
    ...meds.flatMap((med) => [med.medicationName, med.dosage, med.frequency]),
    ...vitals.flatMap((reading) => [reading.signalType, reading.metricType, reading.value, reading.unit]),
    analysis?.safetyStatus,
    analysis?.riskTier,
    analysis?.recommendedAction,
    ...(analysis?.patternLabels ?? []),
    analysis?.seniorMessage,
    symptom?.chiefComplaint,
    symptom?.urgency,
    symptom?.nextStepLabel,
    symptom?.nextStepLevel,
    ...(symptom?.watchSigns ?? []),
    ...safetySignals.flatMap((signal) => [signal.signalType, signal.severity, signal.title, signal.summary, signal.medicationName]),
  ].map(compactText).filter(Boolean);
}

function includesAny(values: string[], terms: string[]): boolean {
  const text = values.map(normalize).join(" | ");
  return terms.some((term) => text.includes(term));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalize(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function firstReasons(values: string[], fallback: string): string[] {
  const reasons = unique(values.map(compactText).filter(Boolean));
  return (reasons.length ? reasons : [fallback]).slice(0, 2);
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function readings(input: PreventionFocusInput): PreventionVitalReading[] {
  return [input.latestVitals, ...(input.recentVitals ?? [])]
    .filter(Boolean) as PreventionVitalReading[];
}

function readingMatches(reading: PreventionVitalReading, terms: string[]): boolean {
  return includesAny(
    [reading.signalType, reading.metricType, reading.value, reading.unit].map(compactText),
    terms,
  );
}

function hasHighBloodPressure(input: PreventionFocusInput): boolean {
  for (const reading of readings(input)) {
    const signal = normalize(reading.signalType ?? reading.metricType);
    const value = String(reading.value ?? "");
    if (signal.includes("bp") || signal.includes("blood_pressure") || signal.includes("pressure") || value.includes("/")) {
      const parts = value.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
      if (parts.length >= 2 && (parts[0] >= 140 || parts[1] >= 90)) return true;
      if ((signal.includes("systolic") || signal === "bp") && parts[0] >= 140) return true;
      if (signal.includes("diastolic") && parts[0] >= 90) return true;
    }
  }
  return false;
}

function hasHighGlucose(input: PreventionFocusInput): boolean {
  for (const reading of readings(input)) {
    if (!readingMatches(reading, ["glucose", "blood sugar"])) continue;
    const value = numberValue(reading.value);
    if (value != null && value >= 180) return true;
  }
  const analysisText = [
    input.latestVitalsAnalysis?.seniorMessage,
    input.latestVitalsAnalysis?.recommendedAction,
    ...(input.latestVitalsAnalysis?.patternLabels ?? []),
  ].map(compactText);
  return includesAny(analysisText, ["high glucose", "glucose high", "blood sugar high"]);
}

function vitalsNeedFollowUp(input: PreventionFocusInput): boolean {
  const analysis = input.latestVitalsAnalysis;
  if (!analysis) return false;
  return includesAny(
    [
      analysis.safetyStatus,
      analysis.riskTier,
      analysis.recommendedAction,
      analysis.seniorMessage,
      ...(analysis.patternLabels ?? []),
    ].map(compactText),
    ["contact_doctor", "doctor", "urgent", "notify", "needs_review", "review", "risk", "higher"],
  );
}

function symptomAgeDays(input: PreventionFocusInput): number | null {
  const raw = input.latestSymptomReport?.createdAt;
  if (!raw) return null;
  const created = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(created.getTime())) return null;
  const now = input.now ?? new Date();
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
}

function isoDateOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function symptomReportRoute(input: PreventionFocusInput): string {
  const id = input.latestSymptomReport?.id;
  return id ? `/informes/${id}` : "/informes";
}

function symptomReportSubject(input: PreventionFocusInput): string {
  return compactText(input.latestSymptomReport?.chiefComplaint) || "your latest symptoms";
}

function titleCaseWords(value: string): string {
  return compactText(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.length <= 2 ? word.toLowerCase() : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function conditionContextLabel(input: PreventionFocusInput): string {
  const conditions = input.conditions ?? [];
  if (includesAny(conditions, ["hypertension", "high blood pressure", "blood pressure"])) return "blood pressure";
  if (includesAny(conditions, ["diabetes", "glucose", "blood sugar"])) return "diabetes";
  if (includesAny(conditions, ["heart", "cardiac", "afib", "atrial fibrillation"])) return "heart context";
  if (includesAny(conditions, ["kidney", "renal"])) return "kidney context";
  if (bloodPressureLabel(input)) return "blood pressure";
  if (glucoseLabel(input)) return "blood sugar";
  const condition = compactText(input.conditions?.[0]);
  if (condition) return titleCaseWords(condition).replace(/^Type 2 Diabetes$/i, "diabetes");
  if (input.activeMedications?.length) return "medicines";
  if (latestReadingLabel(input)) return "recent readings";
  if (compactText(input.mobilityLevel)) return "mobility";
  return "your profile";
}

function conditionDetailLabel(input: PreventionFocusInput, fallbackLabel: string): string {
  const condition = compactText(input.conditions?.[0]);
  const normalized = normalize(condition);
  if (normalized.includes("hypertension") || normalized.includes("blood pressure")) return "hypertension";
  if (normalized.includes("type 2 diabetes")) return "type 2 diabetes";
  if (normalized.includes("diabetes")) return "diabetes";
  if (condition) return titleCaseWords(condition);
  return fallbackLabel === "your profile" ? "" : fallbackLabel;
}

function followUpTopic(input: PreventionFocusInput): string {
  const subject = symptomReportSubject(input);
  const normalized = normalize(subject);
  if (includesAny([normalized], ["urinating", "urination", "urine", "uti", "bladder", "burning"])) return "urinary pain";
  if (includesAny([normalized], ["chest"])) return "chest symptoms";
  if (includesAny([normalized], ["breath", "shortness of breath", "wheezing"])) return "breathing symptoms";
  if (includesAny([normalized], ["dizz", "lightheaded", "faint"])) return "dizziness";
  if (includesAny([normalized], ["weakness"])) return "weakness";
  if (includesAny([normalized], ["fall", "balance"])) return "balance concern";
  if (includesAny([normalized], ["stomach", "nausea", "vomit", "diarrhea", "bowel"])) return "stomach symptoms";
  if (includesAny([normalized], ["back pain", "side pain"])) return "back or side pain";
  const cleaned = compactText(subject)
    .replace(/^pain when\s+/i, "")
    .replace(/^possible\s+/i, "")
    .split(" ")
    .slice(0, 4)
    .join(" ");
  return normalize(cleaned) === "your latest symptoms" ? "today's symptoms" : (cleaned || "today's symptoms");
}

function followUpProfileDetail(input: PreventionFocusInput): string {
  const contextLabel = conditionContextLabel(input);
  const conditionLabel = conditionDetailLabel(input, contextLabel);
  const medication = compactText(input.activeMedications?.[0]?.medicationName);
  const hasMoreMeds = (input.activeMedications?.length ?? 0) > 1;
  const reading = latestReadingLabel(input);
  const parts = unique([
    conditionLabel,
    medication ? (hasMoreMeds ? `${medication} and other medicines` : medication) : (input.activeMedications?.length ? "medicines" : ""),
    reading ?? "",
    compactText(input.mobilityLevel) ? "mobility" : "",
  ].filter(Boolean));
  if (!parts.length) return "your saved profile";
  if (parts.length === 1) return `${parts[0]} and your saved profile`;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function followUpWatchSigns(input: PreventionFocusInput): string[] {
  const savedSigns = unique((input.latestSymptomReport?.watchSigns ?? []).map(compactText).filter(Boolean)).slice(0, 3);
  if (savedSigns.length) return savedSigns;
  const topic = followUpTopic(input);
  const normalized = normalize(topic);
  if (normalized.includes("urinary")) return ["Fever or chills", "Worsening back pain", "Blood in urine"];
  if (normalized.includes("dizziness")) return ["Fainting", "New weakness", "Confusion"];
  if (normalized.includes("breathing")) return ["Breathing gets harder", "Chest tightness", "Blue lips"];
  if (normalized.includes("chest")) return ["Chest pain", "Shortness of breath", "New weakness"];
  if (normalized.includes("stomach")) return ["Blood in stool", "Repeated vomiting", "Severe belly pain"];
  if (normalized.includes("balance")) return ["New fall", "Head injury", "Sudden weakness"];
  return ["Sudden change", "New weakness", "Feeling much worse"];
}

function shortWatchSignLabel(sign: string): string {
  const normalized = normalize(sign);
  if (normalized.includes("fever") || normalized.includes("chills")) return "fever";
  if (normalized.includes("worsening back") || normalized.includes("worse back")) return "back pain worse";
  if (normalized.includes("back pain") || normalized.includes("side pain")) return "back pain";
  if (normalized.includes("blood in urine")) return "blood";
  if (normalized.includes("faint")) return "fainting";
  if (normalized.includes("worse") && normalized.includes("dizz")) return "dizziness worse";
  if (normalized.includes("dizz")) return "dizziness";
  if (normalized.includes("shortness of breath")) return "shortness of breath";
  if (normalized.includes("breathing")) return "breathing changes";
  if (normalized.includes("weakness")) return "new weakness";
  return compactText(sign).replace(/\.$/, "").toLowerCase();
}

function followUpWatchTitle(signs: string[]): string {
  const normalized = unique(signs.map(shortWatchSignLabel).filter(Boolean)).map((sign) => sign.toLowerCase());
  if (!normalized.length) return "Watch what changes";
  if (normalized.length === 1) return `Watch ${normalized[0]}`;
  if (normalized.length === 2) return `Watch ${normalized[0]} or ${normalized[1]}`;
  return `Watch ${normalized[0]}, ${normalized[1]}, or ${normalized[2]}`;
}

function shortWatchChipLabel(sign: string): string {
  const normalized = normalize(sign);
  if (normalized.includes("fever") || normalized.includes("chills")) return "Fever";
  if (normalized.includes("worsening back") || normalized.includes("worse back")) return "Back pain worse";
  if (normalized.includes("back pain") || normalized.includes("side pain")) return "Back pain";
  if (normalized.includes("blood in urine")) return "Blood";
  if (normalized.includes("faint")) return "Fainting";
  if (normalized.includes("worse") && normalized.includes("dizz")) return "Dizziness worse";
  if (normalized.includes("dizz")) return "Dizziness";
  if (normalized.includes("confusion")) return "Confusion";
  if (normalized.includes("weakness")) return "New weakness";
  if (normalized.includes("breath")) return "Breathing";
  if (normalized.includes("chest")) return "Chest";
  return titleCaseWords(sign);
}

function followUpPatternChips(input: PreventionFocusInput): string[] {
  const topic = titleCaseWords(followUpTopic(input));
  const contextLabel = conditionDetailLabel(input, conditionContextLabel(input));
  const medication = compactText(input.activeMedications?.[0]?.medicationName);
  const reading = latestReadingLabel(input);
  return unique([topic, contextLabel, medication, reading ?? ""].filter(Boolean)).slice(0, 4);
}

function followUpWatchChips(signs: string[]): string[] {
  return unique(signs.map(shortWatchChipLabel).filter(Boolean)).slice(0, 3);
}

function followUpMemoryChips(input: PreventionFocusInput): string[] {
  const medication = compactText(input.activeMedications?.[0]?.medicationName);
  const reading = latestReadingLabel(input);
  return unique(["Timing", reading ? reading.replace(/\s+\d.*$/, "") || "Reading" : "Symptoms", medication].filter(Boolean)).slice(0, 3);
}

function followUpSummaryTitle(input: PreventionFocusInput): string {
  const medication = compactText(input.activeMedications?.[0]?.medicationName);
  if (medication && (input.activeMedications?.length ?? 0) === 1) return `${medication} note`;
  const hasMedicineContext = Boolean(input.activeMedications?.length);
  const hasReadingContext = Boolean(latestReadingLabel(input));
  if (hasMedicineContext) return "Medicine note";
  if (hasReadingContext) return "Reading note";
  return `${titleCaseWords(followUpTopic(input))} note`;
}

function confidenceFor(score: number, focus: PreventionFocus): PreventionConfidence {
  if (focus === "Plan") return "limited";
  if (score >= 100) return "strong";
  if (score >= 55) return "moderate";
  return "limited";
}

function signal(id: string, label: string, category: PreventionSignal["category"], strength: PreventionSignal["strength"], route?: string, detail?: string): PreventionSignal {
  return { id, label, category, strength, route, detail };
}

function insight(
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: PreventionInsight["tone"],
  route?: string,
): PreventionInsight {
  return { id, label, value, detail, tone, route };
}

function action(
  id: string,
  label: string,
  detail: string,
  route: string,
  priority: PreventionAction["priority"] = "secondary",
  mode: PreventionAction["mode"] = "navigate",
): PreventionAction {
  return { id, label, detail, route, priority, mode };
}

function readingNumberText(value: unknown): string {
  const parsed = numberValue(value);
  if (parsed == null) return compactText(value);
  return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(1)));
}

function bloodPressureLabel(input: PreventionFocusInput): string | null {
  const allReadings = readings(input);
  for (const reading of allReadings) {
    const value = compactText(reading.value);
    if (value.includes("/") || normalize(reading.signalType ?? reading.metricType).includes("bp")) {
      const numbers = value.match(/\d+(?:\.\d+)?/g);
      if (numbers && numbers.length >= 2) return `BP ${numbers[0]}/${numbers[1]}`;
    }
  }
  const systolic = allReadings.find((reading) => normalize(reading.signalType ?? reading.metricType).includes("systolic"));
  const diastolic = allReadings.find((reading) => normalize(reading.signalType ?? reading.metricType).includes("diastolic"));
  if (systolic && diastolic) return `BP ${readingNumberText(systolic.value)}/${readingNumberText(diastolic.value)}`;
  if (systolic) return `BP ${readingNumberText(systolic.value)}`;
  return null;
}

function glucoseLabel(input: PreventionFocusInput): string | null {
  const reading = readings(input).find((candidate) => readingMatches(candidate, ["glucose", "blood sugar"]));
  return reading ? `Glucose ${readingNumberText(reading.value)}` : null;
}

function latestReadingLabel(input: PreventionFocusInput): string | null {
  const bp = bloodPressureLabel(input);
  if (bp) return bp;
  const glucose = glucoseLabel(input);
  if (glucose) return glucose;
  const reading = readings(input)[0];
  if (!reading) return null;
  const signal = normalize(reading.signalType ?? reading.metricType);
  if (signal.includes("heart") || signal.includes("hr") || signal.includes("pulse")) return `Pulse ${readingNumberText(reading.value)}`;
  if (signal.includes("respiratory")) return `Breathing ${readingNumberText(reading.value)}`;
  return compactText(reading.value) || null;
}

function profileSignalsFor(input: PreventionFocusInput, focus: PreventionFocus): string[] {
  const conditions = (input.conditions ?? []).slice(0, 2);
  const mobility = compactText(input.mobilityLevel);
  const meds = input.activeMedications?.length ? `${input.activeMedications.length} medicines` : "";
  const latest = latestReadingLabel(input) ?? "";
  const focusLabel = focus === "Plan" ? "" : `${focus} focus`;
  return unique([focusLabel, ...conditions, mobility, meds, latest].filter(Boolean)).slice(0, 4);
}

function profileInsight(input: PreventionFocusInput, focus: PreventionFocus): PreventionInsight {
  const conditions = input.conditions ?? [];
  const value = conditions[0] ?? (input.mobilityLevel ? compactText(input.mobilityLevel) : "Health profile");
  const detail = conditions.length
    ? "Used from your saved health profile."
    : "Using the profile details available today.";
  const tone: PreventionInsight["tone"] = focus === "Plan" ? "steady" : "caution";
  return insight("profile-context", "Profile", value, detail, tone);
}

function medicationInsight(input: PreventionFocusInput, detail: string): PreventionInsight | null {
  const count = input.activeMedications?.length ?? 0;
  if (!count) return null;
  return insight(
    "medicine-context",
    "Medicines",
    `${count} active`,
    detail,
    "caution",
    "/meds",
  );
}

function compactDoctorNote(parts: string[]): string {
  return firstReasons(parts, "Review today's prevention focus with VYVA.").join(" ");
}

function guidance(
  id: PreventionGuidanceItem["id"],
  label: string,
  headline: string,
  detail: string,
  chips: string[],
  tone: PreventionGuidanceItem["tone"],
): PreventionGuidanceItem {
  return { id, label, headline, detail, chips: chips.slice(0, 3), tone };
}

function guidanceAction(
  id: string,
  label: string,
  detail: string,
  route: string,
  priority: PreventionGuidanceAction["priority"] = "secondary",
  mode: PreventionGuidanceAction["mode"] = "navigate",
  shoppingPrefill?: PreventionShoppingPrefill,
): PreventionGuidanceAction {
  return { id, label, detail, route, priority, mode, shoppingPrefill };
}

function dietContext(input: PreventionFocusInput): string[] {
  return unique([
    ...(input.dietaryPreferences ?? []),
    input.dietaryNotes ?? "",
  ].map(compactText).filter(Boolean));
}

function allergyContext(input: PreventionFocusInput): string[] {
  return unique((input.allergies ?? []).map(compactText).filter(Boolean));
}

function foodSafetyNote(input: PreventionFocusInput): string {
  const allergies = allergyContext(input);
  const diet = dietContext(input);
  if (allergies.length) {
    return `Avoid saved allergies: ${allergies.slice(0, 3).join(", ")}. Check ingredients before ordering.`;
  }
  if (input.noKnownAllergies) {
    return diet.length
      ? `Uses your diet notes where possible: ${diet.slice(0, 2).join(", ")}.`
      : "No saved food allergies. Check ingredients still fit you.";
  }
  return diet.length
    ? `Uses your diet notes where possible: ${diet.slice(0, 2).join(", ")}. Check ingredients fit you.`
    : "Check ingredients fit your diet and allergies.";
}

function shoppingPrefill(
  input: PreventionFocusInput,
  needText: string,
  sourceRecommendation: string,
  extraConstraints: string[] = [],
  packageId = "easy_meals",
): PreventionShoppingPrefill {
  const allergies = allergyContext(input);
  const diet = dietContext(input);
  return {
    needText,
    category: "groceries",
    priorities: ["diet", "simplicity", "delivery"],
    constraints: unique([
      ...extraConstraints,
      ...diet,
      allergies.length ? `avoid saved allergies: ${allergies.slice(0, 4).join(", ")}` : "check ingredients for allergies",
      "confirm before ordering",
    ]),
    packageId,
    sourceRecommendation,
  };
}

function recipe(
  input: PreventionFocusInput,
  id: string,
  title: string,
  prepTimeLabel: string,
  whyItFits: string,
  ingredients: string[],
  steps: string[],
  tags: string[],
  constraints: string[],
): PreventionRecipeSuggestion {
  return {
    id,
    title,
    prepTimeLabel,
    whyItFits,
    ingredients,
    steps,
    tags,
    shoppingPrefill: shoppingPrefill(
      input,
      `Ingredients for ${title}: ${ingredients.join(", ")}. Keep preparation simple and do not order without my confirmation.`,
      `VYVA suggested ${title} from today's prevention plan.`,
      constraints,
    ),
  };
}

function recipesForFocus(input: PreventionFocusInput, focus: PreventionFocus): PreventionRecipeSuggestion[] {
  if (focus === "Heart") {
    return [
      recipe(
        input,
        "heart-lemon-chicken",
        "Lemon chicken with vegetables",
        "25 min",
        "Fresh lemon, herbs, and vegetables add flavour without leaning on salt.",
        ["chicken breast or tofu", "frozen mixed vegetables", "lemon", "olive oil", "garlic or herbs"],
        ["Cook chicken or tofu gently.", "Add vegetables and lemon.", "Serve with fruit or plain yogurt if wanted."],
        ["Low salt", "Protein", "Easy dinner"],
        ["low salt", "no salty sauces", "fresh or frozen vegetables"],
      ),
      recipe(
        input,
        "heart-white-bean-soup",
        "White bean vegetable soup",
        "20 min",
        "Beans and vegetables make a filling, lower-salt meal when rinsed and seasoned with herbs.",
        ["low-salt beans", "carrots", "spinach", "low-salt stock", "herbs"],
        ["Rinse beans.", "Simmer with vegetables and stock.", "Taste with herbs or lemon."],
        ["Low salt", "Fibre", "Soft food"],
        ["low salt", "low-salt stock", "rinse canned beans"],
      ),
      recipe(
        input,
        "heart-oat-berries",
        "Oat bowl with berries",
        "10 min",
        "A simple breakfast with fibre and fruit, without salty packaged foods.",
        ["plain oats", "berries", "plain yogurt or milk", "cinnamon"],
        ["Warm oats with milk or water.", "Top with berries.", "Add cinnamon instead of sugar or salt."],
        ["Breakfast", "Low salt", "Fibre"],
        ["plain oats", "no added salt", "lower sugar"],
      ),
    ];
  }

  if (focus === "Diabetes") {
    return [
      recipe(
        input,
        "diabetes-egg-veg",
        "Egg and vegetable plate",
        "15 min",
        "Protein and vegetables first can make the meal steadier.",
        ["eggs or tofu", "spinach", "tomatoes", "wholegrain toast"],
        ["Cook eggs or tofu.", "Add vegetables.", "Keep the toast portion modest."],
        ["Protein", "Veg first", "Steady meal"],
        ["diabetic diet", "lower sugar", "wholegrain"],
      ),
      recipe(
        input,
        "diabetes-chicken-beans",
        "Chicken and bean bowl",
        "20 min",
        "Protein, beans, and vegetables make a slower, more filling plate.",
        ["chicken or tofu", "beans", "salad vegetables", "plain yogurt"],
        ["Warm the protein and beans.", "Add salad vegetables.", "Use plain yogurt as a simple topping."],
        ["Protein", "Fibre", "Slow carb"],
        ["diabetic diet", "lower sugar", "avoid sugary sauces"],
      ),
      recipe(
        input,
        "diabetes-yogurt-berries",
        "Plain yogurt with berries",
        "5 min",
        "A quick snack that avoids sugary drinks and sweets.",
        ["plain yogurt", "berries", "nuts or seeds if safe"],
        ["Spoon yogurt into a bowl.", "Add berries.", "Add nuts or seeds only if they fit your diet."],
        ["Snack", "Lower sugar", "Quick"],
        ["plain yogurt", "lower sugar", "check nuts for allergies"],
      ),
    ];
  }

  if (focus === "Falls") {
    return [
      recipe(
        input,
        "falls-yogurt-fruit",
        "Protein yogurt and soft fruit",
        "5 min",
        "Easy protein and fluid-rich fruit support strength with little preparation.",
        ["plain protein yogurt", "soft fruit", "oats"],
        ["Add fruit to yogurt.", "Sprinkle oats if wanted.", "Keep water nearby."],
        ["Protein", "Easy prep", "Soft"],
        ["easy to open", "protein", "soft foods"],
      ),
      recipe(
        input,
        "falls-tuna-bean-toast",
        "Tuna or bean toast",
        "10 min",
        "A small protein meal that does not require heavy cooking.",
        ["tuna or beans", "wholegrain toast", "cucumber", "olive oil"],
        ["Toast bread.", "Top with tuna or mashed beans.", "Add cucumber on the side."],
        ["Protein", "Simple", "Strength"],
        ["easy preparation", "protein", "no heavy groceries"],
      ),
      recipe(
        input,
        "falls-ready-soup",
        "Ready soup plus extra protein",
        "10 min",
        "A warm meal can be safer on low-energy days when lifting and cooking feel hard.",
        ["lower-salt soup", "beans or shredded chicken", "soft bread"],
        ["Warm soup.", "Add beans or chicken.", "Sit down before eating."],
        ["Warm meal", "Protein", "Low effort"],
        ["lower salt", "easy to open", "simple preparation"],
      ),
    ];
  }

  if (focus === "Medicine") {
    return [
      recipe(
        input,
        "medicine-regular-breakfast",
        "Regular breakfast plate",
        "10 min",
        "A familiar meal can make medicine routines easier to remember.",
        ["plain toast", "egg or yogurt", "fruit", "water"],
        ["Set food and water together.", "Eat your usual breakfast.", "Use the medicine page to confirm doses."],
        ["Routine", "Water", "Simple"],
        ["simple breakfast", "easy to prepare", "check medicine food instructions"],
      ),
      recipe(
        input,
        "medicine-soft-lunch",
        "Soft lunch bowl",
        "15 min",
        "Easy food and water nearby can support a steady day without changing medicines.",
        ["soup", "beans or chicken", "soft fruit", "water"],
        ["Warm the soup.", "Add protein if wanted.", "Keep water next to medicines."],
        ["Soft food", "Routine", "Hydration"],
        ["easy to open", "simple preparation", "check with pharmacist if unsure"],
      ),
      recipe(
        input,
        "medicine-snack-tray",
        "Snack tray with water",
        "5 min",
        "A small tray can keep food, water, and routine cues visible.",
        ["crackers", "cheese or yogurt", "fruit", "water"],
        ["Put items on one tray.", "Place it where you sit.", "Review medicines separately in VYVA."],
        ["Visible cue", "Snack", "Water"],
        ["easy to open", "simple snack", "check ingredients"],
      ),
    ];
  }

  if (focus === "Follow-up") {
    return [
      recipe(
        input,
        "follow-up-broth-toast",
        "Broth and toast",
        "10 min",
        "Simple food can be easier while you watch symptoms.",
        ["lower-salt broth", "toast", "soft fruit"],
        ["Warm broth.", "Add toast on the side.", "Stop and get help if symptoms worsen."],
        ["Simple", "Soft", "Hydration"],
        ["lower salt", "soft food", "simple preparation"],
      ),
      recipe(
        input,
        "follow-up-rice-veg",
        "Rice and vegetables",
        "15 min",
        "A familiar plain meal avoids rich or heavy foods during follow-up.",
        ["rice", "frozen vegetables", "egg or tofu"],
        ["Cook rice.", "Warm vegetables.", "Add egg or tofu if you want protein."],
        ["Plain meal", "Familiar", "Gentle"],
        ["simple preparation", "avoid rich foods", "check ingredients"],
      ),
      recipe(
        input,
        "follow-up-yogurt-banana",
        "Yogurt and banana",
        "5 min",
        "A quick soft option for a low-effort day.",
        ["plain yogurt", "banana", "water"],
        ["Slice banana.", "Add to yogurt.", "Sip water slowly."],
        ["Quick", "Soft", "Low effort"],
        ["plain yogurt", "soft food", "check sugar if needed"],
      ),
    ];
  }

  return [
    recipe(
      input,
      "plan-veg-protein",
      "Vegetable and protein plate",
      "20 min",
      "A simple balanced plate works for a general prevention day.",
      ["vegetables", "chicken, fish, beans, or tofu", "olive oil", "fruit"],
      ["Cook or warm the protein.", "Add vegetables.", "Finish with fruit and water."],
      ["Balanced", "Simple", "Protein"],
      ["simple preparation", "vegetables", "protein"],
    ),
    recipe(
      input,
      "plan-soup-fruit",
      "Soup and fruit",
      "10 min",
      "Warm, low-effort food can be easier to keep consistent.",
      ["lower-salt soup", "soft fruit", "plain yogurt"],
      ["Warm soup.", "Add fruit or yogurt on the side.", "Keep water nearby."],
      ["Low effort", "Hydration", "Soft"],
      ["lower salt", "easy to open", "simple preparation"],
    ),
    recipe(
      input,
      "plan-oats",
      "Oats with fruit",
      "10 min",
      "A familiar breakfast with fibre and fruit.",
      ["plain oats", "fruit", "milk or yogurt", "cinnamon"],
      ["Warm oats.", "Add fruit.", "Use cinnamon for flavour."],
      ["Breakfast", "Fibre", "Simple"],
      ["plain oats", "fruit", "lower sugar"],
    ),
  ];
}

function movementRouteForFocus(focus: PreventionFocus): string {
  if (focus === "Heart") return "/activities/relax-breathe";
  if (focus === "Diabetes") return "/social-rooms/morning-movement/exercises/seated-strength";
  if (focus === "Falls") return "/social-rooms/morning-movement/exercises/sit-to-stand";
  if (focus === "Medicine") return "/social-rooms/morning-movement/exercises/calm-breathing";
  if (focus === "Follow-up") return "/activities/relax-breathe";
  return "/social-rooms/morning-movement/exercises/chair-yoga";
}

function sheetForGuidance(
  input: PreventionFocusInput,
  focus: PreventionFocus,
  item: PreventionGuidanceItem,
): PreventionActionSheet {
  const doctorPrompt = `${focus}: ${item.headline}. ${item.detail}`;
  if (item.id === "eat") {
    const foodNeed = focus === "Heart"
      ? "Low-salt groceries and prepared meal ideas for today. Prefer fresh or frozen vegetables, lean protein, fruit, and no salty sauces."
      : focus === "Diabetes"
        ? "Groceries and prepared meal ideas for a steady diabetes-friendly plate. Prefer vegetables, protein, wholegrain or slow-carb choices, and lower sugar."
        : focus === "Falls"
          ? "Groceries and prepared meals that are easy to open, protein-rich, and simple to prepare for strength."
          : focus === "Medicine"
            ? "Simple food and water ideas that make today's medicine routine easier to remember. Do not change medicines."
            : "Simple groceries and prepared meals for today's prevention plan.";
    const prefill = shoppingPrefill(
      input,
      `${foodNeed} Do not order without my confirmation.`,
      `VYVA suggested food support from today's ${focus} prevention focus.`,
      focus === "Heart" ? ["low salt"] : focus === "Diabetes" ? ["diabetic diet", "lower sugar"] : ["easy preparation"],
    );
    const preparedPrefill = shoppingPrefill(
      input,
      `${foodNeed} Find prepared meal or delivery options. Do not order or contact anyone without my confirmation.`,
      `VYVA suggested prepared meal help from today's ${focus} prevention focus.`,
      [...(prefill.constraints ?? []), "prepared meals"],
    );
    return {
      title: item.headline,
      summary: focus === "Heart"
        ? "Use flavour from lemon, herbs, vegetables, and fruit instead of salty packaged food."
        : focus === "Diabetes"
          ? "Aim for protein and vegetables first, then a smaller slow-carb portion."
          : focus === "Falls"
            ? "Choose easy protein and water so strength support is simple."
            : "Keep food simple, familiar, and easy to prepare today.",
      primaryAction: guidanceAction("show-groceries", "Show groceries", "Open a fitted shopping list", "/concierge/shopping", "primary", "navigate", prefill),
      secondaryActions: [
        guidanceAction("prepared-meals", "Prepared meals", "Find simple delivery options", "/concierge/shopping", "secondary", "navigate", preparedPrefill),
        guidanceAction("ask-food", "Ask VYVA", "Get more food ideas for me", "/health/doctor", "secondary", "voice"),
      ],
      recipes: recipesForFocus(input, focus),
      safetyNote: foodSafetyNote(input),
    };
  }

  if (item.id === "move") {
    const route = movementRouteForFocus(focus);
    return {
      title: item.headline,
      summary: focus === "Falls"
        ? "Start supported and slow. Stop if dizzy."
        : focus === "Heart"
          ? "Choose calm breathing or a very easy pace, not strain."
          : "Pick a short gentle routine you can stop at any time.",
      primaryAction: guidanceAction(
        "start-movement",
        focus === "Heart" || focus === "Follow-up" ? "Start breathing" : "Start exercise",
        focus === "Falls" ? "Open supported sit-to-stand" : "Open a gentle routine",
        route,
        "primary",
      ),
      secondaryActions: [
        guidanceAction("calm-breathing", "Breathing reset", "Two quiet minutes", "/activities/relax-breathe"),
        guidanceAction("ask-move", "Ask VYVA", "Adapt movement for how I feel", "/health/doctor", "secondary", "voice"),
      ],
      safetyNote: "Stop and ask for help if you feel chest pain, faint, very breathless, or newly confused.",
    };
  }

  if (item.id === "do") {
    if (focus === "Falls") {
      return {
        title: item.headline,
        summary: "Make one physical thing safer now.",
        primaryAction: guidanceAction("home-safety", "Home safety check", "Clear the next walking path", "/safe-home", "primary"),
        secondaryActions: [
          guidanceAction("caregiver-note", "Ask for help", "Prepare a short note", "/health/doctor", "secondary", "voice"),
          guidanceAction("safe-home-concierge", "Home help", "Ask Concierge for support", "/concierge"),
        ],
      };
    }
    if (focus === "Medicine") {
      return {
        title: item.headline,
        summary: "Keep the routine visible and simple.",
        primaryAction: guidanceAction("review-meds", "Review medicines", "Open today's schedule", "/meds", "primary"),
        secondaryActions: [
          guidanceAction("pharmacy-question", "Pharmacy question", "Ask what to clarify safely", "/health/doctor", "secondary", "voice"),
          guidanceAction("routine-plan", "Make a routine", "Ask VYVA for a simple cue", "/health/doctor", "secondary", "voice"),
        ],
      };
    }
    if (focus === "Follow-up") {
      return {
        title: item.headline,
        summary: "Turn symptoms into a clear next step.",
        primaryAction: guidanceAction("symptom-check", "Check symptoms", "Continue with this context", "/health/symptom-check", "primary"),
        secondaryActions: [
          guidanceAction("doctor-support", "Doctor support", "Appointment or note help", "/concierge"),
          guidanceAction("doctor-note", "Doctor note", "Prepare a short update", "/health/doctor", "secondary", "voice"),
        ],
      };
    }
    return {
      title: item.headline,
      summary: focus === "Heart" ? "Keep the day steady and avoid pressure spikes." : focus === "Diabetes" ? "Notice body cues and keep the day predictable." : "Pick one useful check for today.",
      primaryAction: guidanceAction(
        focus === "Heart" || focus === "Diabetes" ? "check-vitals" : "daily-check",
        focus === "Heart" || focus === "Diabetes" ? "Check vitals" : "Start check-in",
        focus === "Heart" || focus === "Diabetes" ? "Add or review a reading" : "Update how you feel",
        focus === "Heart" || focus === "Diabetes" ? "/health/vitals" : "/health/check-in",
        "primary",
      ),
      secondaryActions: [
        guidanceAction("daily-plan", "Plan my day", "Ask VYVA for a simple plan", "/health/doctor", "secondary", "voice"),
        guidanceAction("doctor-question", "Doctor question", "Prepare what to ask", "/health/doctor", "secondary", "voice"),
      ],
    };
  }

  const swapPrefill = shoppingPrefill(
    input,
    focus === "Heart"
      ? "Low-salt snack and meal swaps: fruit, plain yogurt, unsalted nuts if safe, low-salt soup, no salty sauces. Do not order without my confirmation."
      : focus === "Diabetes"
        ? "Lower-sugar drink and snack swaps: water, plain yogurt, fruit portions, protein snacks. Do not order without my confirmation."
        : "Safer simple alternatives for today's prevention plan. Do not order without my confirmation.",
    `VYVA suggested safer swaps from today's ${focus} prevention focus.`,
    focus === "Heart" ? ["low salt", "no salty snacks"] : focus === "Diabetes" ? ["lower sugar", "diabetic diet"] : ["simple preparation"],
  );
  return {
    title: item.headline,
    summary: focus === "Falls"
      ? "Replace risky tasks with support, light, and slower movement."
      : focus === "Medicine"
        ? "Avoid medicine changes unless a clinician told you."
        : "Turn avoid into a safer swap you can actually use.",
    primaryAction: focus === "Falls"
      ? guidanceAction("safe-home", "Safe home help", "Remove one trip risk", "/safe-home", "primary")
      : focus === "Medicine"
        ? guidanceAction("review-before-change", "Review medicine", "Check before changing anything", "/meds", "primary")
        : guidanceAction("safer-swaps", "Show swaps", "Open safer food ideas", "/concierge/shopping", "primary", "navigate", swapPrefill),
    secondaryActions: [
      guidanceAction("ask-avoid", "Ask VYVA", "What should I avoid today?", "/health/doctor", "secondary", "voice"),
      focus === "Falls"
        ? guidanceAction("concierge-help", "Get help", "Ask Concierge for heavy tasks", "/concierge")
        : guidanceAction("breathing-reset", "Breathing reset", "Calm the pace", "/activities/relax-breathe"),
    ],
    safetyNote: "Call emergency help for severe chest pain, trouble breathing, fainting, or sudden weakness.",
  };
}

function enrichGuidance(
  items: PreventionGuidanceItem[],
  input: PreventionFocusInput,
  focus: PreventionFocus,
): PreventionGuidanceItem[] {
  return items.map((item) => ({
    ...item,
    actionSheet: sheetForGuidance(input, focus, item),
  }));
}

const DAILY_FEEDBACK_OPTIONS: PreventionDailyAction["feedbackOptions"] = [
  { id: "done", label: "Done" },
  { id: "too_hard", label: "Too hard" },
  { id: "remind", label: "Remind me" },
  { id: "ask_vyva", label: "Ask VYVA" },
];

function dailyAction(
  id: string,
  step: PreventionDailyAction["step"],
  title: string,
  detail: string,
  why: string,
  evidenceLabel: string,
  tone: PreventionDailyAction["tone"],
  actionSheet: PreventionActionSheet,
  chips?: string[],
): PreventionDailyAction {
  return {
    id,
    step,
    title,
    detail,
    ...(chips?.length ? { chips: chips.slice(0, 4) } : {}),
    why,
    evidenceLabel,
    tone,
    actionSheet,
    feedbackOptions: DAILY_FEEDBACK_OPTIONS,
  };
}

function sheetByGuidanceId(guidanceItems: PreventionGuidanceItem[]) {
  return new Map(guidanceItems.map((item) => [item.id, item.actionSheet]));
}

function simpleActionSheet(
  title: string,
  summary: string,
  primaryAction: PreventionGuidanceAction,
  secondaryActions: PreventionGuidanceAction[] = [],
  safetyNote?: string,
): PreventionActionSheet {
  return {
    title,
    summary,
    primaryAction,
    secondaryActions,
    safetyNote,
  };
}

function preferredContentIdsFor(
  input: PreventionFocusInput,
  focus: PreventionFocus,
  selected: FocusCandidate,
): string[] {
  const hasSignal = (id: string) => selected.signals.some((signalItem) => signalItem.id === id);
  if (focus === "Heart") {
    return hasSignal("heart-high-bp")
      ? ["heart_low_salt_meal_001", "heart_calm_breath_007", "heart_skip_salty_foods_010"]
      : ["heart_low_salt_meal_001", "heart_easy_walk_008", "heart_sleep_winddown_011"];
  }
  if (focus === "Diabetes") {
    return hasHighGlucose(input)
      ? ["diabetes_water_first_005", "diabetes_after_meal_walk_006", "diabetes_no_sugary_drink_013"]
      : ["diabetes_steady_plate_001", "diabetes_after_meal_walk_006", "diabetes_label_check_011"];
  }
  if (focus === "Falls") {
    return ["mobility_clear_clutter_006", "mobility_slow_stand_012", "mobility_chair_strength_001"];
  }
  if (focus === "Medicine") {
    return hasSignal("medicine-adherence") || hasSignal("medicine-due")
      ? ["meds_missed_dose_007", "meds_medicine_list_002", "meds_daily_cue_001"]
      : ["meds_daily_cue_001", "meds_pharmacist_questions_005", "meds_pill_pack_004"];
  }
  if (focus === "Follow-up") {
    return ["symptom_what_changed_001", "symptom_rest_note_009", "symptom_doctor_note_003"];
  }
  return ["prevention_daily_walk_004", "prevention_sleep_routine_005", "prevention_social_reachout_006"];
}

function routeForContentAction(routeItem: PreventionContentRoute, selected: FocusCandidate): string {
  if (routeItem.route === "concierge.shopping") return "/concierge/shopping";
  if (routeItem.route === "vyva.chat") return "/health/doctor";
  if (routeItem.route === "activities.breathing") return "/activities/relax-breathe";
  if (routeItem.route === "activities.seated_strength") return "/social-rooms/morning-movement/exercises/seated-strength";
  if (routeItem.route === "activities.sit_to_stand") return "/social-rooms/morning-movement/exercises/sit-to-stand";
  if (routeItem.route === "activities.balance") return "/social-rooms/morning-movement/exercises/tai-chi";
  if (routeItem.route === "health.vitals") return "/health/vitals";
  if (routeItem.route === "health.check_in") return "/health/check-in";
  if (routeItem.route === "health.symptoms") return "/health/symptom-check";
  if (routeItem.route === "health.report") return selected.primaryRoute.startsWith("/informes") ? selected.primaryRoute : "/informes";
  if (routeItem.route === "meds") return "/meds";
  if (routeItem.route === "safe_home") return "/safe-home";
  if (routeItem.route === "concierge.schedule") return "/concierge";
  if (routeItem.route === "concierge.transport") return "/concierge";
  if (routeItem.route === "concierge") return "/concierge";
  if (routeItem.route === "community") return "/social-rooms";
  return "/health/doctor";
}

function contentShoppingPrefill(input: PreventionFocusInput, entry: PreventionContentEntry): PreventionShoppingPrefill | undefined {
  const needsShopping = entry.actionRoutes.some((item) => item.route === "concierge.shopping");
  if (!needsShopping) return undefined;
  return shoppingPrefill(
    input,
    `${entry.seniorMessage} Help me choose simple groceries or prepared meals that fit my diet. Do not order without my confirmation.`,
    `VYVA suggested this from prevention content item ${entry.id}.`,
    [
      ...entry.tags.filter((tag) => ["low salt", "sodium", "dash", "diabetes", "lower sugar", "protein"].includes(tag)),
      ...entry.avoidIf.filter((item) => !item.toLowerCase().includes("feeling")),
    ],
    entry.focus === "Medicine" ? "medicine_routine_food" : "prevention_food",
  );
}

function guidanceActionFromContent(
  input: PreventionFocusInput,
  entry: PreventionContentEntry,
  routeItem: PreventionContentRoute,
  selected: FocusCandidate,
  priority: PreventionGuidanceAction["priority"],
): PreventionGuidanceAction {
  return guidanceAction(
    `${entry.id}-${routeItem.route.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    routeItem.label,
    entry.cardVersion.detail,
    routeForContentAction(routeItem, selected),
    priority,
    routeItem.type === "voice" ? "voice" : "navigate",
    routeItem.route === "concierge.shopping" ? contentShoppingPrefill(input, entry) : undefined,
  );
}

function recipeFromContent(input: PreventionFocusInput, entry: PreventionContentEntry): PreventionRecipeSuggestion[] {
  return (entry.recipes ?? []).slice(0, 3).map((item, index) => ({
    id: `${entry.id}-recipe-${index + 1}`,
    title: item.title,
    prepTimeLabel: item.prepTime,
    whyItFits: item.seniorFriendlyWhy,
    ingredients: item.ingredients,
    steps: [
      "Check ingredients fit your diet and allergies.",
      "Prepare the simple parts first.",
      "Stop and ask for help if you feel unwell.",
    ],
    tags: entry.tags.slice(0, 3),
    shoppingPrefill: shoppingPrefill(
      input,
      `Help me get ingredients for ${item.title}. Do not order without my confirmation.`,
      `VYVA suggested this recipe from prevention content item ${entry.id}.`,
      [
        ...entry.tags.filter((tag) => ["low salt", "sodium", "dash", "diabetes", "lower sugar", "protein"].includes(tag)),
        ...entry.avoidIf.filter((avoid) => avoid.toLowerCase().includes("allergy")),
      ],
      "prevention_recipe",
    ),
  }));
}

function actionSheetFromContent(
  input: PreventionFocusInput,
  entry: PreventionContentEntry,
  selected: FocusCandidate,
): PreventionActionSheet {
  const actionableRoutes = entry.actionRoutes.filter((item) => item.route !== "recipes");
  const primaryRoute = actionableRoutes[0] ?? route("Ask VYVA", "vyva.chat", "voice");
  const secondaryRoutes = actionableRoutes.slice(1);
  return {
    title: entry.title,
    summary: entry.shortText,
    primaryAction: guidanceActionFromContent(input, entry, primaryRoute, selected, "primary"),
    secondaryActions: secondaryRoutes.slice(0, 3).map((routeItem) => guidanceActionFromContent(input, entry, routeItem, selected, "secondary")),
    recipes: recipeFromContent(input, entry),
    safetyNote: entry.actionType === "Eat"
      ? foodSafetyNote(input)
      : entry.severityTier >= 4
        ? entry.redFlags.slice(0, 3).join(", ")
        : entry.avoidIf.length
          ? `Avoid if: ${entry.avoidIf.slice(0, 2).join(", ")}.`
          : undefined,
  };
}

function stepFromContent(entry: PreventionContentEntry): PreventionDailyAction["step"] {
  if (entry.actionType === "Eat") return "Eat";
  if (entry.actionType === "Move") return "Move";
  if (entry.actionType === "Calm") return "Calm";
  if (entry.actionType === "Check") return "Check";
  if (entry.actionType === "Home safety") return "Home";
  if (entry.actionType === "Medicine") return "Medicine";
  if (entry.actionType === "Protect" || entry.actionType === "Avoid") return "Protect";
  if (entry.actionType === "Review") return "Review";
  if (entry.actionType === "Sleep") return "Sleep";
  return "Plan";
}

function toneFromContent(entry: PreventionContentEntry): PreventionDailyAction["tone"] {
  if (entry.actionType === "Eat") return "food";
  if (entry.actionType === "Move" || entry.actionType === "Calm") return "movement";
  if (entry.focus === "Medicine" || entry.actionType === "Review" || entry.actionType === "Medicine") return "medicine";
  if (entry.actionType === "Protect" || entry.actionType === "Home safety" || entry.actionType === "Plan" || entry.actionType === "Learn" || entry.actionType === "Avoid" || entry.actionType === "Sleep") return "support";
  return "check";
}

function contentMatchesContext(entry: PreventionContentEntry, contextText: string): number {
  const terms = [...entry.bestFor, ...entry.tags].map(normalize).filter(Boolean);
  return terms.reduce((score, term) => score + (contextText.includes(term) ? 6 : 0), 0);
}

function timeOfDayFor(input: PreventionFocusInput): PreventionTimeOfDay {
  const rawHour = input.loopContext?.clientHour;
  const hour = typeof rawHour === "number" && Number.isFinite(rawHour)
    ? Math.max(0, Math.min(23, Math.floor(rawHour)))
    : (input.now ?? new Date()).getHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function recentFeedbackEvents(input: PreventionFocusInput): PreventionLoopFeedbackEvent[] {
  return (input.loopContext?.recentFeedback ?? []).filter((item) => item && typeof item.actionId === "string").slice(0, 30);
}

function eventMatchesEntry(event: PreventionLoopFeedbackEvent, entry: PreventionContentEntry): boolean {
  return event.actionId === entry.id || normalize(event.title) === normalize(entry.title) || normalize(event.title) === normalize(entry.cardVersion.title);
}

function entryHasRoute(entry: PreventionContentEntry, routeName: PreventionContentRoute["route"]): boolean {
  return entry.actionRoutes.some((item) => item.route === routeName);
}

function entryHasVoiceHelp(entry: PreventionContentEntry): boolean {
  return entry.actionRoutes.some((item) => item.route === "vyva.chat");
}

function feedbackScoreFor(entry: PreventionContentEntry, input: PreventionFocusInput): number {
  let score = 0;
  const step = stepFromContent(entry);
  const tone = toneFromContent(entry);
  for (const event of recentFeedbackEvents(input)) {
    const exact = eventMatchesEntry(event, entry);
    if (event.feedback === "shown" && exact) score -= 120;
    if (event.feedback === "done") {
      if (exact) score -= 30;
      else {
        if (event.step === step) score += 8;
        if (event.tone === tone) score += 5;
      }
    }
    if (event.feedback === "too_hard") {
      if (exact) score -= 140;
      if (event.step === step) score -= 12;
      if (event.barrier === "physical") {
        if (entry.actionType === "Move") score -= 32;
        if (entry.actionType === "Calm") score += 34;
        if (entry.actionType === "Home safety") score += 14;
      }
      if (event.barrier === "cooking" || event.barrier === "no_ingredients") {
        if (entry.actionType === "Eat" && entryHasRoute(entry, "concierge.shopping")) score += 22;
        if (entry.actionType === "Eat" && !entryHasRoute(entry, "concierge.shopping")) score -= 16;
        if (entry.actionType === "Avoid") score += 10;
      }
      if (event.barrier === "confusing") {
        if (entry.focus === "Medicine" || entry.actionType === "Medicine" || entry.actionType === "Check") score += 14;
        if (entryHasVoiceHelp(entry)) score += 12;
      }
      if (event.barrier === "needs_help") {
        if (entry.actionRoutes.some((item) => item.type === "concierge")) score += 24;
        if (entryHasVoiceHelp(entry)) score += 8;
      }
      if (event.barrier === "not_interested") {
        if (event.step === step) score -= 18;
        if (entry.actionType === "Learn" || entry.actionType === "Plan") score += 8;
      }
    }
    if (event.feedback === "remind") {
      if (exact) score -= 18;
      if (entryHasVoiceHelp(entry)) score += 5;
    }
  }
  return score;
}

function timeScoreFor(entry: PreventionContentEntry, input: PreventionFocusInput): number {
  const timeOfDay = timeOfDayFor(input);
  if (timeOfDay === "morning") {
    if (entry.actionType === "Eat" || entry.actionType === "Medicine") return 14;
    if (entry.actionType === "Move") return 8;
    if (entry.actionType === "Sleep") return -20;
  }
  if (timeOfDay === "afternoon") {
    if (entry.actionType === "Move") return 12;
    if (entry.actionType === "Eat" || entry.actionType === "Check") return 7;
  }
  if (timeOfDay === "evening") {
    if (entry.actionType === "Sleep") return 24;
    if (entry.actionType === "Home safety") return 16;
    if (entry.actionType === "Calm") return 12;
    if (entry.actionType === "Move") return -8;
  }
  if (timeOfDay === "night") {
    if (entry.actionType === "Sleep") return 32;
    if (entry.actionType === "Home safety") return 18;
    if (entry.actionType === "Calm") return 14;
    if (entry.actionType === "Move") return -28;
  }
  return 0;
}

function usefulRouteScore(entry: PreventionContentEntry): number {
  const routeTypes = new Set(entry.actionRoutes.map((item) => item.type));
  return (routeTypes.has("content") ? 4 : 0)
    + (routeTypes.has("concierge") ? 5 : 0)
    + (routeTypes.has("route") ? 4 : 0)
    + (routeTypes.has("voice") ? 3 : 0);
}

type ScoredPreventionContent = {
  entry: PreventionContentEntry;
  score: number;
};

type PreventionContentBucket = "eat" | "moveCalm" | "context";

function isBucketMatch(entry: PreventionContentEntry, focus: PreventionFocus, bucket: PreventionContentBucket): boolean {
  if (bucket === "eat") return entry.actionType === "Eat";
  if (bucket === "moveCalm") return entry.actionType === "Move" || entry.actionType === "Calm";
  if (focus === "Heart" || focus === "Diabetes") return entry.actionType === "Avoid" || entry.actionType === "Protect";
  if (focus === "Falls") return entry.actionType === "Home safety" || entry.actionType === "Avoid" || entry.actionType === "Medicine" || entry.actionType === "Protect";
  if (focus === "Medicine") return entry.actionType === "Medicine" || entry.actionType === "Review" || entry.actionType === "Check" || entry.actionType === "Plan";
  if (focus === "Follow-up") return entry.actionType === "Check" || entry.actionType === "Plan" || entry.actionType === "Review" || entry.actionType === "Medicine";
  return entry.actionType === "Sleep" || entry.actionType === "Plan" || entry.actionType === "Home safety" || entry.actionType === "Learn";
}

function pickBucketEntry(
  scored: ScoredPreventionContent[],
  focus: PreventionFocus,
  bucket: PreventionContentBucket,
  usedIds: Set<string>,
): PreventionContentEntry | null {
  const item = scored.find((candidate) => !usedIds.has(candidate.entry.id) && isBucketMatch(candidate.entry, focus, bucket));
  if (!item) return null;
  usedIds.add(item.entry.id);
  return item.entry;
}

function selectPreventionContent(
  input: PreventionFocusInput,
  focus: PreventionFocus,
  selected: FocusCandidate,
): PreventionContentEntry[] {
  const preferredIds = preferredContentIdsFor(input, focus, selected);
  const contextText = allContext(input).map(normalize).join(" | ");
  const contentFocus = focus === "Falls" ? "Falls" : focus;
  const pool = PREVENTION_CONTENT_LIBRARY
    .filter((entry) => entry.focus === contentFocus)
    .filter((entry) => entry.severityTier <= 3);
  const scored: ScoredPreventionContent[] = pool
    .map((entry, index) => {
      const preferredIndex = preferredIds.indexOf(entry.id);
      return {
        entry,
        score: (preferredIndex >= 0 ? 100 - preferredIndex * 8 : 0)
          + contentMatchesContext(entry, contextText)
          + feedbackScoreFor(entry, input)
          + timeScoreFor(entry, input)
          + usefulRouteScore(entry)
          + (entry.severityTier === 1 ? 3 : 0)
          - index * 0.01,
      };
    })
    .sort((a, b) => b.score - a.score);

  const usedIds = new Set<string>();
  const bucketedEntries = [
    pickBucketEntry(scored, focus, "eat", usedIds),
    pickBucketEntry(scored, focus, "moveCalm", usedIds),
    pickBucketEntry(scored, focus, "context", usedIds),
  ].filter(Boolean) as PreventionContentEntry[];

  if (bucketedEntries.length === 3) return bucketedEntries;

  const selectedEntries: PreventionContentEntry[] = [];
  const selectedSteps = new Set<PreventionDailyAction["step"]>();
  for (const entryItem of bucketedEntries) {
    selectedEntries.push(entryItem);
    selectedSteps.add(stepFromContent(entryItem));
  }
  for (const item of scored) {
    if (usedIds.has(item.entry.id)) continue;
    const step = stepFromContent(item.entry);
    if (selectedSteps.has(step)) continue;
    selectedEntries.push(item.entry);
    selectedSteps.add(step);
    if (selectedEntries.length === 3) break;
  }

  return selectedEntries.length === 3
    ? selectedEntries
    : scored.slice(0, 3).map((item) => item.entry);
}

function dailyActionsFromContent(
  input: PreventionFocusInput,
  focus: PreventionFocus,
  selected: FocusCandidate,
): PreventionDailyAction[] {
  return selectPreventionContent(input, focus, selected).map((entry) => dailyAction(
    entry.id,
    stepFromContent(entry),
    entry.cardVersion.title,
    entry.cardVersion.detail,
    entry.why,
    entry.cardVersion.evidenceLabel,
    toneFromContent(entry),
    actionSheetFromContent(input, entry, selected),
  ));
}

function followUpDailyActions(input: PreventionFocusInput, selected: FocusCandidate): PreventionDailyAction[] {
  const subject = symptomReportSubject(input);
  const topic = followUpTopic(input);
  const profileDetail = followUpProfileDetail(input);
  const signs = selected.helpSigns.length ? selected.helpSigns.slice(0, 3) : followUpWatchSigns(input);
  const contextTitle = "Check the pattern";
  const watchTitle = normalize(topic).includes("urinary") ? "Watch urinary changes" : followUpWatchTitle(signs);
  const summaryTitle = "Save a summary";
  const readingDetail = latestReadingLabel(input);
  const contextDetail = readingDetail
    ? `Symptoms, medicine, and ${readingDetail} together.`
    : input.activeMedications?.length
      ? "Symptoms and medicine together."
      : "Symptoms and timing together.";
  const summaryDetail = input.activeMedications?.length || latestReadingLabel(input)
    ? `Keep symptoms, ${latestReadingLabel(input) ? "readings" : "changes"}, and ${input.activeMedications?.length ? "medicine" : "context"} together.`
    : "Keep symptoms and timing together.";
  const symptomContext = `Symptom follow-up: ${subject}. Use saved context: ${profileDetail}. Signs to watch: ${signs.join(", ")}.`;

  return [
    dailyAction(
      "follow-up-context",
      "RIGHT NOW",
      contextTitle,
      contextDetail,
      "VYVA can connect today's symptom with the health context already saved.",
      "",
      "support",
      simpleActionSheet(
        contextTitle,
        symptomContext,
        guidanceAction("talk-context", "Ask VYVA", "Explain what matters from my context", "/health/doctor", "primary", "voice"),
        [
          guidanceAction("symptom-check", "Check symptoms", "Update what changed", "/health/symptom-check"),
        ],
      ),
      followUpPatternChips(input),
    ),
    dailyAction(
      "follow-up-watch-signs",
      "WATCH FOR",
      watchTitle,
      `For this ${topic} follow-up.`,
      "These signs can help you decide whether to check again or get help sooner.",
      "",
      "check",
      simpleActionSheet(
        watchTitle,
        `Continue the symptom check with this context: ${symptomContext}`,
        guidanceAction("symptom-check", "Check symptoms", "Continue with this context", "/health/symptom-check", "primary"),
        [
          guidanceAction("talk-about-signs", "Ask VYVA", "Talk through what changed", "/health/doctor", "secondary", "voice"),
        ],
      ),
      followUpWatchChips(signs),
    ),
    dailyAction(
      "follow-up-summary",
      "IF NEEDED",
      summaryTitle,
      summaryDetail,
      "A simple summary makes it easier to explain what changed.",
      "",
      "support",
      simpleActionSheet(
        summaryTitle,
        symptomContext,
        guidanceAction("prepare-summary", "Make summary", "Create a short note from my context", "/health/doctor", "primary", "voice"),
        [
          guidanceAction("symptom-check-summary", "Check symptoms", "Update what changed", "/health/symptom-check"),
        ],
      ),
      followUpMemoryChips(input),
    ),
  ];
}

function dailyActionsFor(
  input: PreventionFocusInput,
  focus: PreventionFocus,
  enrichedGuidance: PreventionGuidanceItem[],
  selected: FocusCandidate,
): PreventionDailyAction[] {
  if (focus === "Follow-up") return followUpDailyActions(input, selected);

  const libraryActions = dailyActionsFromContent(input, focus, selected);
  if (libraryActions.length === 3) return libraryActions;

  const sheets = sheetByGuidanceId(enrichedGuidance);
  const eatSheet = sheets.get("eat") ?? sheetForGuidance(input, focus, enrichedGuidance.find((item) => item.id === "eat") ?? guidance("eat", "Eat", "Steady meal", "Open food ideas for today.", ["Food"], "food"));
  const moveSheet = sheets.get("move") ?? sheetForGuidance(input, focus, enrichedGuidance.find((item) => item.id === "move") ?? guidance("move", "Move", "Gentle movement", "Open a safe routine.", ["Move"], "movement"));
  const doSheet = sheets.get("do") ?? sheetForGuidance(input, focus, enrichedGuidance.find((item) => item.id === "do") ?? guidance("do", "Do", "One check", "Open the next useful step.", ["Check"], "action"));
  const avoidSheet = sheets.get("avoid") ?? sheetForGuidance(input, focus, enrichedGuidance.find((item) => item.id === "avoid") ?? guidance("avoid", "Avoid", "Safer swap", "Open safer alternatives.", ["Swap"], "avoid"));
  const reading = latestReadingLabel(input);
  const hasMeds = Boolean(input.activeMedications?.length);
  const mobility = compactText(input.mobilityLevel);

  if (focus === "Heart") {
    return [
      dailyAction(
        "heart-low-salt-meal",
        "Eat",
        "Low-salt meal",
        "Recipe, groceries, or prepared meal help.",
        reading ? `${reading} plus your heart profile makes food the best first move.` : "Your heart profile makes sodium swaps a useful first move.",
        "DASH-style food",
        "food",
        eatSheet,
      ),
      dailyAction(
        "heart-calm-breathing",
        "Move",
        "3-minute breathing",
        "Start calm breathing before the next check.",
        "A calm pause can make readings and symptoms easier to interpret.",
        "Calm routine",
        "movement",
        simpleActionSheet(
          "3-minute breathing",
          "Sit comfortably and use the guided breathing reset before the next task.",
          guidanceAction("start-breathing", "Start breathing", "Open the calm breathing guide", "/activities/relax-breathe", "primary"),
          [
            guidanceAction("ask-heart-breathing", "Ask VYVA", "Adapt this for how I feel", "/health/doctor", "secondary", "voice"),
          ],
          "Stop and get help for chest pain, fainting, or severe breathlessness.",
        ),
      ),
      dailyAction(
        "heart-bp-check",
        "Check",
        "BP after rest",
        "Sit quietly, then add or review a reading.",
        "A quiet repeat reading is more useful than a rushed one.",
        "BP technique",
        "check",
        simpleActionSheet(
          "BP after rest",
          "Rest quietly first, then use Vitals to add or review the reading.",
          guidanceAction("open-vitals", "Open Vitals", "Add or review blood pressure", "/health/vitals", "primary"),
          [
            guidanceAction("doctor-question", "Doctor question", "Prepare what to ask", "/health/doctor", "secondary", "voice"),
          ],
          "Call emergency help for chest pain, shortness of breath, fainting, or sudden weakness.",
        ),
      ),
    ];
  }

  if (focus === "Diabetes") {
    return [
      dailyAction(
        "diabetes-steady-plate",
        "Eat",
        "Steady plate",
        "Protein and vegetables first, with simple recipe help.",
        reading ? `${reading} makes a steady meal pattern useful today.` : "Your diabetes context makes meal steadiness useful today.",
        "Diabetes-friendly",
        "food",
        eatSheet,
      ),
      dailyAction(
        "diabetes-after-meal-move",
        "Move",
        "After-meal movement",
        "Try seated strength or an easy walk if safe.",
        "Gentle movement after eating can support a steadier day.",
        "Gentle activity",
        "movement",
        simpleActionSheet(
          "After-meal movement",
          "Choose a short routine that feels safe after a meal.",
          guidanceAction("start-seated-strength", "Start exercise", "Open seated strength", "/social-rooms/morning-movement/exercises/seated-strength", "primary"),
          [
            guidanceAction("breathing-reset", "Breathing reset", "Use calm breathing instead", "/activities/relax-breathe"),
            guidanceAction("ask-diabetes-move", "Ask VYVA", "Adapt movement for today", "/health/doctor", "secondary", "voice"),
          ],
          "Stop if shaky, dizzy, confused, or unwell.",
        ),
      ),
      dailyAction(
        "diabetes-body-cues",
        "Check",
        "Body cues",
        "Notice shakiness, thirst, dizziness, or confusion.",
        "Your profile makes early sugar-related symptoms worth watching.",
        "Watch signs",
        "check",
        doSheet,
      ),
    ];
  }

  if (focus === "Falls") {
    return [
      dailyAction(
        "falls-chair-strength",
        "Move",
        "Chair strength",
        "Practice supported sit-to-stand.",
        mobility ? `${mobility} means supported strength is the safest first move.` : "Supported strength helps reduce avoidable fall risk.",
        "Balance + strength",
        "movement",
        moveSheet,
      ),
      dailyAction(
        "falls-clear-path",
        "Protect",
        "Clear one path",
        "Lights on, firm shoes, no loose rugs.",
        "Most value today comes from removing one trip hazard.",
        "Home safety",
        "support",
        doSheet,
      ),
      dailyAction(
        "falls-protein-water",
        "Eat",
        "Protein + water",
        "Choose an easy strength-support meal.",
        "Strength and hydration support steadier movement.",
        "Strength support",
        "food",
        eatSheet,
      ),
    ];
  }

  if (focus === "Medicine") {
    return [
      dailyAction(
        "medicine-review-doses",
        "Review",
        "Review doses",
        "Open today's medicine schedule.",
        selected.why[0] ?? "Medicine context is today's main prevention signal.",
        "Medication safety",
        "medicine",
        doSheet,
      ),
      dailyAction(
        "medicine-pharmacy-pack",
        "Plan",
        "Ask about pill packs",
        "Prepare a pharmacist question.",
        "Packaging or syncing may make the routine easier.",
        "Pharmacist review",
        "support",
        simpleActionSheet(
          "Ask about pill packs",
          "Prepare a simple pharmacist question about blister packs, refill sync, or large labels.",
          guidanceAction("ask-pharmacy", "Ask VYVA", "Prepare the pharmacy question", "/health/doctor", "primary", "voice"),
          [
            guidanceAction("open-meds", "Review medicines", "Open medicine list", "/meds"),
          ],
          "Do not change doses or stop medicines unless a clinician told you.",
        ),
      ),
      dailyAction(
        "medicine-food-water-cue",
        "Eat",
        "Food + water cue",
        hasMeds ? "Use a meal or water cue beside the medicine routine." : "Use a meal and water cue for today's routine.",
        "Visible cues can reduce confusion without changing medicine advice.",
        "Routine cue",
        "food",
        eatSheet,
      ),
    ];
  }

  return [
    dailyAction(
      "plan-steady-meal",
      "Eat",
      "Steady meal",
      "Pick one simple meal or grocery helper.",
      "Food, water, and routine are useful even without a strong signal.",
      "Daily basics",
      "food",
      eatSheet,
    ),
    dailyAction(
      "plan-gentle-move",
      "Move",
      "Gentle movement",
      "Try chair yoga or breathing.",
      "Small movement keeps prevention active without overdoing it.",
      "Gentle activity",
      "movement",
      moveSheet,
    ),
    dailyAction(
      "plan-check-in",
      "Check",
      "Quick check-in",
      "Update what changed today.",
      "A short check-in gives VYVA better context tomorrow.",
      "Daily pattern",
      "check",
      simpleActionSheet(
        "Quick check-in",
        "Update how you feel so VYVA can adjust tomorrow's plan.",
        guidanceAction("open-check-in", "Start check-in", "Update what changed", "/health/check-in", "primary"),
        [
          guidanceAction("ask-plan", "Ask VYVA", "Build a prevention plan for today", "/health/doctor", "secondary", "voice"),
        ],
      ),
    ),
  ];
}

function personalizationSummaryFor(input: PreventionFocusInput, focus: PreventionFocus): string[] {
  const meds = input.activeMedications?.length ? "Medicine routine" : "";
  const mobility = input.mobilityLevel ? "Mobility context" : "";
  const symptoms = input.latestSymptomReport ? "Recent symptoms" : "";
  const readingsAvailable = readings(input).length ? "Recent pattern" : "";
  const focusContext: Record<PreventionFocus, string> = {
    Heart: "Blood pressure profile",
    Diabetes: "Sugar profile",
    Falls: "Fall prevention",
    Medicine: "Medicine safety",
    "Follow-up": "Follow-up context",
    Plan: "Health profile",
  };

  return unique([
    focusContext[focus],
    ...(input.conditions ?? []).slice(0, 1),
    meds,
    mobility,
    symptoms,
    readingsAvailable,
  ].filter(Boolean)).slice(0, 3);
}

function preventionGuidanceFor(input: PreventionFocusInput, focus: PreventionFocus): PreventionGuidanceItem[] {
  const hasMeds = Boolean(input.activeMedications?.length);
  const hasMobility = Boolean(input.mobilityLevel);

  if (focus === "Heart") {
    return [
      guidance(
        "eat",
        "Eat",
        "Choose a lower-salt plate",
        "Veg plus lean protein, fruit, and water. Keep salty meals small.",
        ["Lower salt", "Fruit/veg", "Water"],
        "food",
      ),
      guidance(
        "move",
        "Move",
        "Gentle rhythm, not strain",
        "Easy walk or seated march. Stop if chest pain, breathless, or dizzy.",
        ["Easy pace", "Short sets", "Stop if unwell"],
        "movement",
      ),
      guidance(
        "do",
        "Do",
        "Keep the day calm",
        hasMeds
          ? "Meds on schedule. Rest between tasks. Ask before changes."
          : "Rest between tasks and ask VYVA what to watch if you feel different.",
        ["Medicines", "Rest", "Ask first"],
        "action",
      ),
      guidance(
        "avoid",
        "Avoid",
        "Skip pressure triggers",
        "No rushing, heavy lifting, extra caffeine, or salty snacks.",
        ["No rushing", "Less caffeine", "Low salt"],
        "avoid",
      ),
    ];
  }

  if (focus === "Diabetes") {
    return [
      guidance(
        "eat",
        "Eat",
        "Build a steady plate",
        "Veg and protein first, then a smaller slow-carb portion. Keep water close.",
        ["Protein", "Slow carbs", "Regular meals"],
        "food",
      ),
      guidance(
        "move",
        "Move",
        "Walk after meals",
        "Short walk or seated leg routine after eating, if safe for you.",
        ["After meals", "Gentle", "Seated option"],
        "movement",
      ),
      guidance(
        "do",
        "Do",
        "Watch your body cues",
        "Notice shakiness, sweating, thirst, dizziness, or confusion.",
        ["Body cues", "Hydrate", "Ask VYVA"],
        "action",
      ),
      guidance(
        "avoid",
        "Avoid",
        "Do not skip basics",
        "Do not skip meals with diabetes medicines unless told. Skip sugary drinks.",
        ["No skipped meals", "No sugary drinks", "Ask first"],
        "avoid",
      ),
    ];
  }

  if (focus === "Falls") {
    return [
      guidance(
        "eat",
        "Eat",
        "Support strength",
        "Protein with meals and water nearby. Ask before adding supplements.",
        ["Protein", "Hydrate", "Strength"],
        "food",
      ),
      guidance(
        "move",
        "Move",
        "Practice safe balance",
        "Slow sit-to-stand or heel raises beside a chair. Stop if dizzy.",
        ["Chair support", "Slow", "Balance"],
        "movement",
      ),
      guidance(
        "do",
        "Do",
        "Clear one walking path",
        hasMobility
          ? "Use support, wear firm shoes, and clear the next path."
          : "Firm shoes, lights on, and the next path clear.",
        ["Shoes", "Lights", "Clear path"],
        "action",
      ),
      guidance(
        "avoid",
        "Avoid",
        "No rushed standing",
        "No fast standing, loose rugs, trailing cables, or heavy carrying.",
        ["Stand slowly", "No loose rugs", "Free hands"],
        "avoid",
      ),
    ];
  }

  if (focus === "Medicine") {
    return [
      guidance(
        "eat",
        "Eat",
        "Keep food consistent",
        "Regular meals and water help medicine routines stay steady.",
        ["Regular meals", "Water", "Ask first"],
        "food",
      ),
      guidance(
        "move",
        "Move",
        "Check steadiness first",
        "Stand slowly. If dizzy or sleepy, choose seated movement.",
        ["Stand slowly", "Seated option", "Notice dizziness"],
        "movement",
      ),
      guidance(
        "do",
        "Do",
        "Make doses visible",
        "Use a pill box or today tray. Ask VYVA if confused.",
        ["Pill box", "Simple routine", "Ask VYVA"],
        "action",
      ),
      guidance(
        "avoid",
        "Avoid",
        "Do not double up",
        "No extra doses or sudden stops unless a clinician told you.",
        ["No double dose", "No sudden stop", "Pharmacist"],
        "avoid",
      ),
    ];
  }

  if (focus === "Follow-up") {
    return [
      guidance(
        "eat",
        "Eat",
        "Keep it simple",
        "Light familiar meals and water while watching symptoms.",
        ["Simple meals", "Water", "Familiar"],
        "food",
      ),
      guidance(
        "move",
        "Move",
        "Gentle only",
        "Light movement if safe. Rest if symptoms worsen.",
        ["Light", "Rest", "Ask help"],
        "movement",
      ),
      guidance(
        "do",
        "Do",
        "Track what changed",
        "Note start time, triggers, and doctor questions.",
        ["Time", "Triggers", "Questions"],
        "action",
      ),
      guidance(
        "avoid",
        "Avoid",
        "Do not wait on red flags",
        "Do not wait for worse symptoms, chest pain, breathing change, or confusion.",
        ["No waiting", "Red flags", "Call help"],
        "avoid",
      ),
    ];
  }

  return [
    guidance(
      "eat",
      "Eat",
      "Choose a steady meal",
      "Aim for vegetables or fruit, protein, and water. Keep snacks simple and familiar.",
      ["Fruit/veg", "Protein", "Water"],
      "food",
    ),
    guidance(
      "move",
      "Move",
      "Ten gentle minutes",
      "Try a short walk, seated march, or stretch. Keep it easy enough to talk while moving.",
      ["10 minutes", "Gentle", "Talk pace"],
      "movement",
    ),
    guidance(
      "do",
      "Do",
      "One prevention check",
      "Keep medicines on schedule, update symptoms if anything changed, and ask VYVA what matters today.",
      ["Medicines", "Symptoms", "Ask VYVA"],
      "action",
    ),
    guidance(
      "avoid",
      "Avoid",
      "Do not ignore changes",
      "Avoid pushing through new chest pain, breathlessness, fainting, confusion, or sudden weakness.",
      ["Do not push", "Watch changes", "Get help"],
      "avoid",
    ),
  ];
}

function preventionLearningFor(focus: PreventionFocus): PreventionLearning {
  if (focus === "Heart") {
    return {
      title: "New options to ask about",
      detail: "DASH meals, BP technique, and remote monitoring for patterns.",
      askPrompt: "Explain a simple heart-prevention plan for today.",
    };
  }
  if (focus === "Diabetes") {
    return {
      title: "New options to ask about",
      detail: "Glucose monitors, foot checks, and nutrition coaching if suitable.",
      askPrompt: "Give me a simple diabetes-prevention plan for today.",
    };
  }
  if (focus === "Falls") {
    return {
      title: "New options to ask about",
      detail: "Balance programs, home safety review, and fall-alert options.",
      askPrompt: "Build me a safe movement and fall-prevention routine.",
    };
  }
  if (focus === "Medicine") {
    return {
      title: "New options to ask about",
      detail: "Pharmacist review, blister packs, dose syncing, reminder packaging.",
      askPrompt: "Help me simplify my medicine routine safely.",
    };
  }
  if (focus === "Follow-up") {
    return {
      title: "New options to ask about",
      detail: "A short doctor update and symptom changes to watch.",
      askPrompt: "Help me prepare a follow-up note for my doctor.",
    };
  }
  return {
    title: "New options to ask about",
    detail: "Vaccines, screenings, strength routines, and food changes for you.",
    askPrompt: "Build me a prevention plan for today.",
  };
}

function barrierText(barrier: PreventionBarrier | undefined): string {
  if (barrier === "physical") return "movement felt hard";
  if (barrier === "cooking") return "cooking was too much";
  if (barrier === "no_ingredients") return "ingredients were missing";
  if (barrier === "confusing") return "the step felt confusing";
  if (barrier === "not_interested") return "it was not interesting";
  if (barrier === "needs_help") return "extra help was needed";
  return "a step felt hard";
}

function mostRecentEvent(input: PreventionFocusInput, feedback: PreventionFeedbackValue): PreventionLoopFeedbackEvent | null {
  return recentFeedbackEvents(input).find((item) => item.feedback === feedback) ?? null;
}

function weeklySummaryFor(input: PreventionFocusInput, focus: PreventionFocus, dailyActions: PreventionDailyAction[]): PreventionWeeklySummary {
  const events = recentFeedbackEvents(input);
  const done = events.filter((item) => item.feedback === "done");
  const hard = events.filter((item) => item.feedback === "too_hard");
  const remind = events.filter((item) => item.feedback === "remind");
  const shown = events.filter((item) => item.feedback === "shown");
  const latestDone = done[0] ?? null;
  const latestHard = hard[0] ?? null;
  const firstAction = dailyActions[0];

  const headline = hard.length
    ? "VYVA made today easier."
    : done.length
      ? "VYVA is building on what worked."
      : shown.length
        ? "VYVA is rotating your plan."
        : "VYVA is learning your routine.";

  const detail = hard.length
    ? `${barrierText(latestHard?.barrier)} last time, so today avoids repeating the same ask.`
    : done.length
      ? `${latestDone?.title ?? latestDone?.step ?? "One step"} worked recently. Similar simple steps get a small boost.`
      : shown.length
        ? "Recently seen moves are rotated so the plan does not feel stale."
        : `Today's first move is ${firstAction?.title ?? "small and practical"}.`;

  const bullets = [
    done.length ? `${done.length} move${done.length === 1 ? "" : "s"} marked done` : "",
    hard.length ? `${hard.length} move${hard.length === 1 ? "" : "s"} marked too hard` : "",
    remind.length ? "Reminder requested" : "",
    `Today: ${dailyActions.map((item) => item.title).join(", ")}`,
  ].filter(Boolean).slice(0, 3);

  const hardText = latestHard ? `${latestHard.title ?? latestHard.step ?? "A prevention step"} was hard because ${barrierText(latestHard.barrier)}.` : "";
  const doneText = latestDone ? `${latestDone.title ?? latestDone.step ?? "A prevention step"} was marked done.` : "";
  const doctorSummary = unique([
    `Prevention focus: ${focus}.`,
    dailyActions.length ? `Today's suggested moves: ${dailyActions.map((item) => `${item.step}: ${item.title}`).join("; ")}.` : "",
    doneText,
    hardText,
  ].map(compactText).filter(Boolean)).slice(0, 3).join(" ");
  const caregiverSummary = compactDoctorNote([
    firstAction ? `Smallest useful step today: ${firstAction.title}.` : "",
    hardText || doneText || "No strong weekly feedback yet.",
    `VYVA prevention focus is ${focus}.`,
  ]);

  return {
    headline,
    detail,
    bullets,
    doctorSummary,
    caregiverSummary,
  };
}

function rankingMetaFor(input: PreventionFocusInput): PreventionRankingMeta {
  const timeOfDay = timeOfDayFor(input);
  const latestHard = mostRecentEvent(input, "too_hard");
  const latestDone = mostRecentEvent(input, "done");
  const shownCount = recentFeedbackEvents(input).filter((item) => item.feedback === "shown").length;
  const rankingReasons = [
    `${timeOfDay[0].toUpperCase()}${timeOfDay.slice(1)} timing`,
    latestHard ? `Avoiding repeats because ${barrierText(latestHard.barrier)}` : "",
    latestDone ? `Building on ${latestDone.title ?? latestDone.step ?? "what worked"}` : "",
    shownCount ? "Rotating recently seen moves" : "",
  ].filter(Boolean).slice(0, 4);
  return { timeOfDay, rankingReasons };
}

export function buildPreventionFocus(input: PreventionFocusInput): PreventionFocusResult {
  const context = allContext(input);
  const conditions = input.conditions ?? [];
  const medications = input.activeMedications ?? [];
  const adherence = input.adherence ?? { scheduledToday: 0, takenToday: 0, missedOrLate30: 0 };
  const safetySignals = input.medicationSafetySignals ?? [];
  const remainingDoses = Math.max(0, adherence.scheduledToday - adherence.takenToday);
  const hasHeartContext = includesAny(context, HEART_TERMS);
  const hasDiabetesContext = includesAny(context, DIABETES_TERMS);
  const hasFallContext = includesAny(context, FALL_TERMS);
  const hasSedatingMedication = includesAny(
    medications.map((med) => med.medicationName),
    SEDATING_MED_TERMS,
  );
  const hasBloodThinner = includesAny(
    medications.map((med) => med.medicationName),
    BLOOD_THINNER_TERMS,
  );
  const mobilityNeedsSupport = includesAny([input.mobilityLevel, input.livingSituation].map(compactText), [
    "limited",
    "walker",
    "cane",
    "wheelchair",
    "support",
    "alone",
    "assisted",
    "mobility",
  ]);
  const highBp = hasHighBloodPressure(input);
  const highGlucose = hasHighGlucose(input);
  const vitalsFollowUp = vitalsNeedFollowUp(input);
  const latestSymptomAgeDays = symptomAgeDays(input);
  const hasRecentSymptom = latestSymptomAgeDays != null && latestSymptomAgeDays <= 7;
  const symptomUrgency = normalize(input.latestSymptomReport?.nextStepLevel ?? input.latestSymptomReport?.urgency);
  const symptomNeedsFollowUp = hasRecentSymptom && includesAny([symptomUrgency], ["urgent", "routine", "doctor", "today", "soon", "follow"]);
  const medicationSafetyOpen = safetySignals.length > 0;
  const medicineNeedsReview = medicationSafetyOpen || adherence.missedOrLate30 > 0 || remainingDoses > 0;

  const candidates: FocusCandidate[] = [];

  if (hasHeartContext || highBp || vitalsFollowUp) {
    const bpLabel = bloodPressureLabel(input);
    const reasons = firstReasons([
      highBp ? "A recent blood pressure reading was high." : "",
      vitalsFollowUp ? "Recent vitals asked for closer follow-up." : "",
      hasHeartContext ? "Your profile includes heart or blood pressure context." : "",
    ], "Heart and blood pressure context is part of today's plan.");
    const heartInsights = [
      insight(
        "heart-reading",
        "Latest signal",
        bpLabel ?? latestReadingLabel(input) ?? "Vitals",
        highBp ? "This reading is the strongest reason for today's focus." : "Recent vitals are part of this focus.",
        highBp ? "alert" : "caution",
        "/health/vitals",
      ),
      profileInsight(input, "Heart"),
      medicationInsight(input, remainingDoses > 0 ? "One or more doses are still due today." : "Medicine context is included when VYVA reviews this."),
    ].filter(Boolean) as PreventionInsight[];
    candidates.push({
      focus: "Heart",
      score: 25 + (highBp ? 80 : 0) + (vitalsFollowUp ? 35 : 0) + (hasHeartContext ? 30 : 0),
      priority: 5,
      headline: "Heart check today.",
      why: reasons,
      todayAction: "Add a blood pressure reading, then ask VYVA what to watch.",
      helpSigns: ["Chest pain", "Shortness of breath", "New weakness or fainting"],
      primaryRoute: "/health/vitals",
      secondaryRoute: "/health/doctor",
      insights: heartInsights,
      actions: [
        action("heart-food", "Food ideas", "Low-salt meals for today", "/health/doctor", "primary", "voice"),
        action("heart-move", "Movement plan", "Gentle exercise I can do", "/health/doctor", "secondary", "voice"),
        action("heart-avoid", "What to avoid", "Heart-safety limits today", "/health/doctor", "secondary", "voice"),
      ],
      doctorNote: compactDoctorNote([
        bpLabel ? `${bpLabel} was the latest key signal.` : "",
        hasHeartContext ? "Profile includes heart or blood pressure context." : "",
        remainingDoses > 0 ? "Medicine is still due today." : "",
      ]),
      signals: [
        ...(highBp ? [signal("heart-high-bp", "High blood pressure reading", "vitals", "high", "/health/vitals")] : []),
        ...(vitalsFollowUp ? [signal("heart-vitals-follow-up", "Vitals need follow-up", "vitals", "medium", "/health/vitals")] : []),
        ...(hasHeartContext ? [signal("heart-profile", "Heart or blood pressure context", "profile", "medium")] : []),
      ],
    });
  }

  if (hasDiabetesContext || highGlucose) {
    const sugarLabel = glucoseLabel(input);
    const reasons = firstReasons([
      highGlucose ? "A recent glucose signal was high." : "",
      hasDiabetesContext ? "Your profile or medicines include diabetes context." : "",
    ], "Diabetes context is part of today's prevention plan.");
    const diabetesInsights = [
      insight(
        "diabetes-reading",
        "Latest signal",
        sugarLabel ?? latestReadingLabel(input) ?? "Sugar",
        highGlucose ? "This is the strongest reason for today's focus." : "VYVA is using your diabetes context.",
        highGlucose ? "alert" : "caution",
        "/health/vitals",
      ),
      profileInsight(input, "Diabetes"),
      medicationInsight(input, "Medicine context is included when VYVA reviews this."),
    ].filter(Boolean) as PreventionInsight[];
    candidates.push({
      focus: "Diabetes",
      score: 25 + (highGlucose ? 85 : 0) + (hasDiabetesContext ? 35 : 0),
      priority: 4,
      headline: "Sugar check today.",
      why: reasons,
      todayAction: "Add a sugar reading if you have one, and note how you feel.",
      helpSigns: ["Shaking or sweating", "Confusion", "Extreme thirst or dizziness"],
      primaryRoute: "/health/vitals",
      secondaryRoute: "/health/doctor",
      insights: diabetesInsights,
      actions: [
        action("diabetes-food", "Food ideas", "Steady meals for today", "/health/doctor", "primary", "voice"),
        action("diabetes-move", "After-meal move", "Gentle routine after eating", "/health/doctor", "secondary", "voice"),
        action("diabetes-watch", "What to watch", "Sugar warning signs", "/health/doctor", "secondary", "voice"),
      ],
      doctorNote: compactDoctorNote([
        sugarLabel ? `${sugarLabel} was the latest key signal.` : "",
        hasDiabetesContext ? "Profile or medicines include diabetes context." : "",
      ]),
      signals: [
        ...(highGlucose ? [signal("diabetes-high-glucose", "High glucose signal", "vitals", "high", "/health/vitals")] : []),
        ...(hasDiabetesContext ? [signal("diabetes-context", "Diabetes context", "profile", "medium")] : []),
      ],
    });
  }

  if (hasFallContext || mobilityNeedsSupport || hasSedatingMedication || hasBloodThinner) {
    const reasons = firstReasons([
      mobilityNeedsSupport ? "Your profile mentions mobility or home support." : "",
      hasFallContext ? "Your health context includes balance or fall risk." : "",
      hasSedatingMedication ? "Some medicines can affect steadiness." : "",
      hasBloodThinner ? "A fall can matter more when blood thinners are involved." : "",
    ], "Moving safely is a useful prevention focus today.");
    candidates.push({
      focus: "Falls",
      score: 20 + (mobilityNeedsSupport ? 45 : 0) + (hasFallContext ? 35 : 0) + (hasSedatingMedication ? 30 : 0) + (hasBloodThinner ? 18 : 0),
      priority: 3,
      headline: "Move safely today.",
      why: reasons,
      todayAction: "Stand slowly and clear the next walkway.",
      helpSigns: ["A fall", "Dizziness when standing", "New confusion"],
      primaryRoute: "/safe-home",
      secondaryRoute: "/health/doctor",
      insights: [
        insight(
          "falls-mobility",
          "Mobility",
          mobilityNeedsSupport ? compactText(input.mobilityLevel) || "Support noted" : "Safety focus",
          mobilityNeedsSupport ? "Used from your saved mobility context." : "VYVA is prioritising safe movement.",
          "caution",
          "/safe-home",
        ),
        ...(hasSedatingMedication ? [insight("falls-meds", "Medicines", "Steadiness", "Some medicines can affect balance.", "caution", "/meds")] : []),
        ...(hasBloodThinner ? [insight("falls-blood-thinner", "Extra caution", "Blood thinner", "Falls can matter more with this medicine context.", "caution", "/meds")] : []),
      ],
      actions: [
        action("falls-routine", "Safe routine", "Balance moves for today", "/health/doctor", "primary", "voice"),
        action("falls-home-safety", "Home safety", "Check the next walkway", "/safe-home"),
        action("falls-caregiver", "Caregiver note", "What support to ask for", "/health/doctor", "secondary", "voice"),
      ],
      doctorNote: compactDoctorNote([
        mobilityNeedsSupport ? "Mobility support is noted in the profile." : "",
        hasSedatingMedication ? "Medicine context may affect steadiness." : "",
        hasBloodThinner ? "Blood thinner context adds fall caution." : "",
      ]),
      signals: [
        ...(mobilityNeedsSupport ? [signal("falls-mobility", "Mobility support", "profile", "medium")] : []),
        ...(hasFallContext ? [signal("falls-profile", "Fall or balance context", "profile", "medium")] : []),
        ...(hasSedatingMedication ? [signal("falls-medicine", "Medicine can affect steadiness", "medicine", "medium", "/meds")] : []),
        ...(hasBloodThinner ? [signal("falls-blood-thinner", "Blood thinner context", "medicine", "low", "/meds")] : []),
      ],
    });
  }

  if (medicineNeedsReview) {
    const reasons = firstReasons([
      medicationSafetyOpen ? "A medication safety signal is open." : "",
      adherence.missedOrLate30 > 0 ? "There were missed or late doses recently." : "",
      remainingDoses > 0 ? "Medicine is still due today." : "",
    ], "Your medicines are part of today's prevention plan.");
    candidates.push({
      focus: "Medicine",
      score: 20 + (medicationSafetyOpen ? 85 : 0) + (adherence.missedOrLate30 > 0 ? 45 : 0) + (remainingDoses > 0 ? 25 : 0),
      priority: 2,
      headline: "Medicine check today.",
      why: reasons,
      todayAction: "Review what is due and mark it taken when done.",
      helpSigns: ["Severe dizziness", "Rash or swelling", "Trouble breathing"],
      primaryRoute: "/meds",
      secondaryRoute: "/health/doctor",
      insights: [
        insight(
          "medicine-today",
          "Today",
          remainingDoses > 0 ? `${remainingDoses} due` : "Review",
          remainingDoses > 0 ? "A dose still needs attention today." : "Medication context is the main prevention signal.",
          remainingDoses > 0 ? "alert" : "caution",
          "/meds",
        ),
        ...(adherence.missedOrLate30 > 0 ? [insight("medicine-adherence", "Pattern", `${adherence.missedOrLate30} missed/late`, "Recent adherence pattern needs attention.", "caution", "/meds")] : []),
        ...(medicationSafetyOpen ? [insight("medicine-safety", "Safety", "Open signal", "A possible side effect or safety signal is open.", "alert", "/meds")] : []),
      ],
      actions: [
        action("medicine-routine", "Simplify routine", "Safer medicine habits", "/health/doctor", "primary", "voice"),
        action("medicine-side-effects", "Side effects", "What to watch safely", "/health/doctor", "secondary", "voice"),
        action("medicine-pharmacy", "Pharmacy help", "Ask about packs or review", "/meds"),
      ],
      doctorNote: compactDoctorNote([
        medicationSafetyOpen ? "A medication safety signal is open." : "",
        adherence.missedOrLate30 > 0 ? `${adherence.missedOrLate30} missed or late doses recently.` : "",
        remainingDoses > 0 ? `${remainingDoses} dose still due today.` : "",
      ]),
      signals: [
        ...(medicationSafetyOpen ? [signal("medicine-safety", "Medication safety signal", "safety", "high", "/meds")] : []),
        ...(adherence.missedOrLate30 > 0 ? [signal("medicine-adherence", "Missed or late doses", "medicine", "medium", "/meds")] : []),
        ...(remainingDoses > 0 ? [signal("medicine-due", "Medicine due today", "medicine", "low", "/meds")] : []),
      ],
    });
  }

  if (hasRecentSymptom) {
    const report = input.latestSymptomReport;
    const subject = symptomReportSubject(input);
    const signs = followUpWatchSigns(input);
    const topic = followUpTopic(input);
    const contextLabel = conditionContextLabel(input);
    const reasons = firstReasons([
      report?.chiefComplaint ? `Latest symptom report: ${report.chiefComplaint}.` : "A symptom report was saved recently.",
      symptomNeedsFollowUp ? "The report suggested follow-up." : "",
    ], "A recent symptom report is ready to review.");
    candidates.push({
      focus: "Follow-up",
      score: 45 + (symptomNeedsFollowUp ? 45 : 0) + (symptomUrgency.includes("urgent") ? 35 : 0),
      priority: 1,
      headline: "Symptom follow-up today.",
      why: reasons,
      todayAction: `Ask VYVA to connect ${topic} with ${contextLabel}.`,
      helpSigns: signs,
      primaryRoute: "/health/doctor",
      secondaryRoute: "/health/doctor",
      insights: [
        insight("follow-up-report", "Symptom", report?.chiefComplaint ?? "Symptom check", symptomNeedsFollowUp ? "VYVA can connect this with your saved context." : "Recent symptom context is available.", symptomNeedsFollowUp ? "caution" : "steady", symptomReportRoute(input)),
        ...(latestReadingLabel(input) ? [insight("follow-up-vitals", "Vitals", latestReadingLabel(input) as string, "Recent readings can help VYVA explain the report.", "steady", "/health/vitals")] : []),
        profileInsight(input, "Follow-up"),
      ],
      actions: [
        action("follow-up-context", "Ask VYVA", `Connect ${topic} with ${contextLabel}`, "/health/doctor", "primary", "voice"),
        action("follow-up-symptom-check", "Check symptoms", signs.slice(0, 2).join(", "), "/health/symptom-check"),
        action("follow-up-summary", "Make summary", followUpSummaryTitle(input), "/health/doctor", "secondary", "voice"),
      ],
      doctorNote: compactDoctorNote([
        report?.chiefComplaint ? `Latest symptom report: ${report.chiefComplaint}.` : "",
        symptomNeedsFollowUp ? "Report suggested follow-up." : "",
        latestReadingLabel(input) ? `${latestReadingLabel(input)} is available.` : "",
      ]),
      signals: [
        signal("follow-up-report", "Recent symptom report", "symptom", symptomNeedsFollowUp ? "high" : "medium", symptomReportRoute(input)),
      ],
    });
  }

  const planCandidate: FocusCandidate = {
    focus: "Plan",
    score: 0,
    priority: 0,
    headline: "Longevity ready.",
    why: ["No strong pattern stands out right now."],
    todayAction: "Do one quick check-in.",
    helpSigns: ["Sudden chest pain", "Trouble breathing", "New confusion"],
    primaryRoute: "/health/check-in",
    secondaryRoute: "/health/doctor",
    insights: [
      insight("plan-status", "Today", "No strong alert", "No strong pattern stands out from available data.", "steady"),
      ...(latestReadingLabel(input) ? [insight("plan-reading", "Latest signal", latestReadingLabel(input) as string, "Recent readings are available if you want to review them.", "steady", "/health/vitals")] : []),
      profileInsight(input, "Plan"),
    ],
    actions: [
      action("plan-day", "Build my day", "Food, movement, and reminders", "/health/doctor", "primary", "voice"),
      action("plan-move", "Movement idea", "Gentle routine for today", "/health/doctor", "secondary", "voice"),
      action("plan-check-in", "Check in", "Update what changed", "/health/check-in"),
    ],
    doctorNote: "No strong pattern stands out from the available data today.",
    signals: conditions.length
      ? [signal("plan-profile", "Profile context is available", "profile", "low")]
      : [],
  };

  const selected = [...candidates, planCandidate].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.priority - a.priority;
  })[0];
  const guidance = enrichGuidance(preventionGuidanceFor(input, selected.focus), input, selected.focus);
  const dailyActions = dailyActionsFor(input, selected.focus, guidance, selected);
  const weeklySummary = weeklySummaryFor(input, selected.focus, dailyActions);
  const ranking = rankingMetaFor(input);
  const doctorNote = compactDoctorNote([
    selected.doctorNote,
    weeklySummary.doctorSummary,
  ]);
  const followUp = selected.focus === "Follow-up" && input.latestSymptomReport
    ? {
      reportId: input.latestSymptomReport.id ?? null,
      reportedAt: isoDateOrNull(input.latestSymptomReport.createdAt),
      subject: symptomReportSubject(input),
      topic: followUpTopic(input),
    }
    : undefined;

  return {
    focus: selected.focus,
    headline: selected.headline,
    why: selected.why.slice(0, 2),
    todayAction: selected.todayAction,
    helpSigns: selected.helpSigns.slice(0, 3),
    primaryRoute: selected.primaryRoute,
    secondaryRoute: selected.secondaryRoute,
    confidence: confidenceFor(selected.score, selected.focus),
    signals: selected.signals.slice(0, 4),
    insights: selected.insights.slice(0, 3),
    actions: selected.actions.slice(0, 3),
    guidance,
    dailyActions,
    learning: preventionLearningFor(selected.focus),
    personalizationSummary: personalizationSummaryFor(input, selected.focus),
    profileSignals: profileSignalsFor(input, selected.focus),
    weeklySummary,
    ranking,
    doctorNote,
    ...(followUp ? { followUp } : {}),
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}
