export const VITALS_CAPTURE_METHODS = [
  "manual",
  "voice",
  "device_photo",
  "phone_camera",
  "web_bluetooth",
  "oauth_import",
  "clinical_import",
] as const;

export type VitalsCaptureMethod = typeof VITALS_CAPTURE_METHODS[number];
export type VitalsInputType = "number" | "paired_bp" | "scale_0_10" | "binary";
export type VitalsDisplayGroup = "heart" | "breathing" | "blood" | "body" | "wellbeing" | "activity" | "labs";

export type VitalsSignalContext = {
  key: string;
  label: string;
};

export type VitalsSignalMeta = {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  inputType: VitalsInputType;
  displayGroup: VitalsDisplayGroup;
  contexts: VitalsSignalContext[];
  aliases: string[];
  profileTriggers: string[];
  safeRange: { min: number; max: number };
  normalRange?: { low: number; high: number };
  futureReady?: boolean;
};

export const VITALS_SIGNAL_CATALOG = {
  resting_hr_bpm: {
    key: "resting_hr_bpm",
    label: "Heart rate",
    shortLabel: "Pulse",
    unit: "bpm",
    inputType: "number",
    displayGroup: "heart",
    contexts: [
      { key: "resting", label: "Resting" },
      { key: "morning", label: "Morning" },
      { key: "general", label: "Now" },
    ],
    aliases: ["heart rate", "pulse", "hr", "bpm", "pulso"],
    profileTriggers: ["heart", "afib", "atrial", "palpitation", "blood pressure", "hypertension"],
    safeRange: { min: 30, max: 220 },
    normalRange: { low: 55, high: 100 },
  },
  respiratory_rate: {
    key: "respiratory_rate",
    label: "Breathing rate",
    shortLabel: "Breathing",
    unit: "/min",
    inputType: "number",
    displayGroup: "breathing",
    contexts: [
      { key: "resting", label: "Resting" },
      { key: "general", label: "Now" },
    ],
    aliases: ["breathing", "breaths", "respiration", "respiratory rate", "rr"],
    profileTriggers: ["copd", "asthma", "breath", "respiratory", "oxygen", "heart failure"],
    safeRange: { min: 4, max: 50 },
    normalRange: { low: 10, high: 20 },
  },
  bp_systolic: {
    key: "bp_systolic",
    label: "Blood pressure top number",
    shortLabel: "BP top",
    unit: "mmHg",
    inputType: "paired_bp",
    displayGroup: "heart",
    contexts: [
      { key: "morning", label: "Morning" },
      { key: "evening", label: "Evening" },
      { key: "general", label: "Now" },
    ],
    aliases: ["blood pressure", "bp", "pressure", "systolic"],
    profileTriggers: ["hypertension", "blood pressure", "heart", "stroke", "kidney"],
    safeRange: { min: 70, max: 260 },
    normalRange: { low: 90, high: 140 },
  },
  bp_diastolic: {
    key: "bp_diastolic",
    label: "Blood pressure bottom number",
    shortLabel: "BP bottom",
    unit: "mmHg",
    inputType: "paired_bp",
    displayGroup: "heart",
    contexts: [
      { key: "morning", label: "Morning" },
      { key: "evening", label: "Evening" },
      { key: "general", label: "Now" },
    ],
    aliases: ["diastolic", "bottom number", "blood pressure bottom"],
    profileTriggers: ["hypertension", "blood pressure", "heart", "stroke", "kidney"],
    safeRange: { min: 35, max: 160 },
    normalRange: { low: 55, high: 90 },
  },
  oxygen_saturation: {
    key: "oxygen_saturation",
    label: "Oxygen saturation",
    shortLabel: "Oxygen",
    unit: "%",
    inputType: "number",
    displayGroup: "breathing",
    contexts: [
      { key: "resting", label: "Resting" },
      { key: "general", label: "Now" },
    ],
    aliases: ["oxygen", "spo2", "o2", "saturation"],
    profileTriggers: ["copd", "asthma", "oxygen", "breath", "heart failure", "respiratory"],
    safeRange: { min: 50, max: 100 },
    normalRange: { low: 93, high: 100 },
  },
  temperature_c: {
    key: "temperature_c",
    label: "Temperature",
    shortLabel: "Temp",
    unit: "C",
    inputType: "number",
    displayGroup: "body",
    contexts: [
      { key: "general", label: "Now" },
      { key: "evening", label: "Evening" },
    ],
    aliases: ["temperature", "temp", "fever", "thermometer"],
    profileTriggers: ["fever", "infection", "uti", "cough", "flu", "immunity"],
    safeRange: { min: 32, max: 43 },
    normalRange: { low: 36, high: 37.8 },
  },
  glucose_mgdl: {
    key: "glucose_mgdl",
    label: "Glucose",
    shortLabel: "Glucose",
    unit: "mg/dL",
    inputType: "number",
    displayGroup: "blood",
    contexts: [
      { key: "fasting", label: "Fasting" },
      { key: "post_meal_2h", label: "After meal" },
      { key: "nocturnal", label: "Night" },
      { key: "general", label: "Now" },
    ],
    aliases: ["glucose", "blood sugar", "sugar", "cgm", "glucose meter"],
    profileTriggers: ["diabetes", "insulin", "metformin", "glucose", "blood sugar", "cgm"],
    safeRange: { min: 20, max: 650 },
    normalRange: { low: 70, high: 180 },
  },
  weight_kg: {
    key: "weight_kg",
    label: "Weight",
    shortLabel: "Weight",
    unit: "kg",
    inputType: "number",
    displayGroup: "body",
    contexts: [
      { key: "morning", label: "Morning" },
      { key: "general", label: "Now" },
    ],
    aliases: ["weight", "scale", "peso"],
    profileTriggers: ["heart failure", "kidney", "fluid", "weight"],
    safeRange: { min: 25, max: 350 },
  },
  pain_score: {
    key: "pain_score",
    label: "Pain",
    shortLabel: "Pain",
    unit: "/10",
    inputType: "scale_0_10",
    displayGroup: "wellbeing",
    contexts: [{ key: "general", label: "Now" }],
    aliases: ["pain", "dolor"],
    profileTriggers: ["pain", "arthritis", "fall", "injury"],
    safeRange: { min: 0, max: 10 },
  },
  mood_score: {
    key: "mood_score",
    label: "Mood",
    shortLabel: "Mood",
    unit: "/10",
    inputType: "scale_0_10",
    displayGroup: "wellbeing",
    contexts: [{ key: "general", label: "Today" }],
    aliases: ["mood", "feeling", "animo", "ánimo"],
    profileTriggers: ["depression", "anxiety", "mood", "lonely"],
    safeRange: { min: 1, max: 10 },
  },
  energy_level: {
    key: "energy_level",
    label: "Energy",
    shortLabel: "Energy",
    unit: "/10",
    inputType: "scale_0_10",
    displayGroup: "wellbeing",
    contexts: [{ key: "general", label: "Today" }],
    aliases: ["energy", "energia", "tired"],
    profileTriggers: ["fatigue", "tired", "weak", "energy"],
    safeRange: { min: 1, max: 10 },
  },
  sleep_quality_score: {
    key: "sleep_quality_score",
    label: "Sleep",
    shortLabel: "Sleep",
    unit: "/10",
    inputType: "scale_0_10",
    displayGroup: "wellbeing",
    contexts: [{ key: "general", label: "Last night" }],
    aliases: ["sleep", "slept", "sueno", "sueño"],
    profileTriggers: ["sleep", "insomnia", "fatigue", "tired"],
    safeRange: { min: 1, max: 10 },
  },
  medication_confirmed: {
    key: "medication_confirmed",
    label: "Medication taken",
    shortLabel: "Meds",
    unit: "",
    inputType: "binary",
    displayGroup: "wellbeing",
    contexts: [
      { key: "morning", label: "Morning" },
      { key: "evening", label: "Evening" },
      { key: "general", label: "Today" },
    ],
    aliases: ["medication", "medicine", "meds", "pill"],
    profileTriggers: ["medication", "medicine", "pill", "adherence"],
    safeRange: { min: 0, max: 1 },
  },
  hrv_ms: {
    key: "hrv_ms",
    label: "Heart rate variability",
    shortLabel: "HRV",
    unit: "ms",
    inputType: "number",
    displayGroup: "heart",
    contexts: [{ key: "sleep", label: "Sleep" }, { key: "general", label: "Now" }],
    aliases: ["hrv", "heart rate variability"],
    profileTriggers: ["wearable", "sleep", "heart"],
    safeRange: { min: 1, max: 300 },
    futureReady: true,
  },
  steps_count: {
    key: "steps_count",
    label: "Steps",
    shortLabel: "Steps",
    unit: "steps",
    inputType: "number",
    displayGroup: "activity",
    contexts: [{ key: "daily", label: "Today" }],
    aliases: ["steps", "walking"],
    profileTriggers: ["activity", "mobility", "walking"],
    safeRange: { min: 0, max: 100000 },
    futureReady: true,
  },
  fall_event: {
    key: "fall_event",
    label: "Fall detected",
    shortLabel: "Fall",
    unit: "",
    inputType: "binary",
    displayGroup: "activity",
    contexts: [{ key: "general", label: "Now" }],
    aliases: ["fall", "fell"],
    profileTriggers: ["fall", "frailty", "mobility"],
    safeRange: { min: 0, max: 1 },
    futureReady: true,
  },
  lab_hba1c_pct: {
    key: "lab_hba1c_pct",
    label: "HbA1c",
    shortLabel: "HbA1c",
    unit: "%",
    inputType: "number",
    displayGroup: "labs",
    contexts: [{ key: "clinical", label: "Clinical" }],
    aliases: ["hba1c", "a1c"],
    profileTriggers: ["diabetes", "glucose"],
    safeRange: { min: 3, max: 20 },
    futureReady: true,
  },
  lab_creatinine: {
    key: "lab_creatinine",
    label: "Creatinine",
    shortLabel: "Creatinine",
    unit: "mg/dL",
    inputType: "number",
    displayGroup: "labs",
    contexts: [{ key: "clinical", label: "Clinical" }],
    aliases: ["creatinine", "kidney"],
    profileTriggers: ["kidney", "renal", "creatinine"],
    safeRange: { min: 0.1, max: 20 },
    futureReady: true,
  },
  lab_cholesterol: {
    key: "lab_cholesterol",
    label: "Cholesterol",
    shortLabel: "Cholesterol",
    unit: "mg/dL",
    inputType: "number",
    displayGroup: "labs",
    contexts: [{ key: "clinical", label: "Clinical" }],
    aliases: ["cholesterol", "ldl"],
    profileTriggers: ["cholesterol", "heart"],
    safeRange: { min: 50, max: 500 },
    futureReady: true,
  },
} as const satisfies Record<string, VitalsSignalMeta>;

export type VitalsSignalKey = keyof typeof VITALS_SIGNAL_CATALOG;

export const VITALS_SIGNAL_KEYS = Object.keys(VITALS_SIGNAL_CATALOG) as VitalsSignalKey[];

export function isVitalsSignalKey(value: unknown): value is VitalsSignalKey {
  return typeof value === "string" && value in VITALS_SIGNAL_CATALOG;
}

export function isVitalsCaptureMethod(value: unknown): value is VitalsCaptureMethod {
  return typeof value === "string" && (VITALS_CAPTURE_METHODS as readonly string[]).includes(value);
}

export function defaultContextForSignal(signalType: VitalsSignalKey): string {
  return VITALS_SIGNAL_CATALOG[signalType].contexts[0]?.key ?? "general";
}

export function unitForSignal(signalType: VitalsSignalKey): string {
  return VITALS_SIGNAL_CATALOG[signalType].unit;
}

export function validateVitalsSignalValue(signalType: VitalsSignalKey, value: number): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(value)) return { ok: false, reason: "Value must be a number." };
  const meta = VITALS_SIGNAL_CATALOG[signalType];
  if (value < meta.safeRange.min || value > meta.safeRange.max) {
    return {
      ok: false,
      reason: `${meta.label} must be between ${meta.safeRange.min} and ${meta.safeRange.max}${meta.unit ? ` ${meta.unit}` : ""}.`,
    };
  }
  if (meta.inputType === "binary" && value !== 0 && value !== 1) {
    return { ok: false, reason: `${meta.label} must be yes or no.` };
  }
  return { ok: true };
}

export function promptSignalsForProfile(conditions: string[]): VitalsSignalKey[] {
  const haystack = conditions.join(" ").toLowerCase();
  const prioritized: VitalsSignalKey[] = [];

  for (const key of VITALS_SIGNAL_KEYS) {
    const meta = VITALS_SIGNAL_CATALOG[key];
    if (meta.futureReady) continue;
    if (key === "bp_diastolic") continue;
    if (meta.profileTriggers.some((trigger) => haystack.includes(trigger))) {
      prioritized.push(key);
    }
  }

  const defaults: VitalsSignalKey[] = ["resting_hr_bpm", "respiratory_rate", "bp_systolic", "oxygen_saturation", "temperature_c"];
  return [...new Set([...prioritized, ...defaults])].slice(0, 6);
}
