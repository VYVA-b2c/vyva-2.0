import type { TriageScanResult } from "../../../shared/triageScans.js";
import { evaluateTriageRules } from "./evaluateTriage.js";
import { mergeTriageRecommendations } from "./recommendationDedupe.js";
import type {
  TriageEscalationSource,
  ProfileRiskFlags,
  TriageChatMessage,
  TriageHealthMemory,
  TriageRuleLevel,
  TriageSummary,
  TriageUrgency,
  TriageWizardContext,
  WizardStage,
} from "../types.js";

export type TriageOutcomeTelemetry = {
  symptomPath: string;
  urgency: TriageUrgency;
  ruleIdsFired: string[];
  profileModifiersApplied: string[];
  vitalsOverlaysApplied: string[];
  caregiverEscalationTriggered: boolean;
  escalationSources: TriageEscalationSource[];
};

export const CRITICAL_RED_FLAG_IDS = new Set([
  "chest_pressure",
  "chest_rest_long",
  "chest_breathing",
  "chest_sweaty_faint",
  "chest_spreading",
  "chest_cough_blood",
  "one_calf_swollen",
  "chest_pain",
  "sudden_severe",
  "back_bladder_weakness",
  "headache_fever_stiff",
  "limb_cold_blue",
  "cannot_speak_breathing",
  "breath_rest",
  "blue_confused",
  "breathing_chest_pain",
  "coughing_blood",
  "confused_fever",
  "sepsis_signs",
  "stiff_neck",
  "cancer_fever",
  "fainted_not_normal",
  "fainted_with_chest",
  "fainted",
  "stroke_sign",
  "dizzy_chest",
  "cannot_stand",
  "hard_to_wake",
  "new_severe",
  "low_sugar",
  "high_sugar_sick",
  "low_oxygen",
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
  "cannot_stool_gas",
  "collapsed_stomach",
  "cannot_pee",
  "urine_heavy_blood",
  "urine_confusion_weak",
  "fall_head_hit",
  "head_injury_red_flags",
  "fall_cannot_stand",
  "heavy_bleeding",
  "allergic_swelling",
  "skin_sepsis_signs",
  "non_fading_rash",
  "sudden_confusion",
  "self_harm",
  "severe_bleeding",
]);

const SAFETY_ACTION_IDS = new Set([
  "call_emergency",
  "contact_doctor",
  "make_report",
  "continue_questions",
]);

function isSpanishLocale(locale: string) {
  return locale.split("-")[0].toLowerCase() === "es";
}

function text(locale: string, english: string, spanish: string) {
  return isSpanishLocale(locale) ? spanish : english;
}

export function profileRiskFlags(memory?: TriageHealthMemory): ProfileRiskFlags {
  const haystack = [
    memory?.healthContext,
    memory?.careContext,
    memory?.checkinContext,
    memory?.conditions,
    memory?.allergies,
    memory?.medications,
    memory?.devices,
    memory?.latestVitals,
    memory?.vitalsTrend,
    memory?.latestSymptomReport,
    memory?.recentSymptomReports,
    memory?.medicationAdherence,
    memory?.medicationInteraction,
    memory?.recentHealthEvents,
    memory?.latestMedicalVisit,
    memory?.upcomingMedicalAppointment,
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

export function selectedAnswers(wizard?: TriageWizardContext) {
  return wizard?.quickAnswers ?? [];
}

export function hasAnswer(wizard: TriageWizardContext | undefined, ids: string[]) {
  return selectedAnswers(wizard).some((answer) => ids.includes(answer.id));
}

export function firstAnswerKind(wizard: TriageWizardContext | undefined, kind: string) {
  return selectedAnswers(wizard).find((answer) => answer.kind === kind);
}

export function selectedSymptomId(wizard: TriageWizardContext | undefined) {
  return firstAnswerKind(wizard, "symptom")?.id;
}

export function selectedSafetyAnswer(wizard: TriageWizardContext | undefined) {
  if (hasAnswer(wizard, Array.from(SAFETY_ACTION_IDS))) return null;
  return selectedAnswers(wizard).find((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
}

function hasKind(wizard: TriageWizardContext | undefined, kind: string) {
  return selectedAnswers(wizard).some((answer) => answer.kind === kind);
}

export function shouldCompleteFromRules(wizard: TriageWizardContext | undefined, healthMemory?: TriageHealthMemory) {
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

  if (symptomId === "chest") {
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

  if (symptomId === "stomach") {
    if ((ids.has("not_drinking") || ids.has("fever_or_severe_pain") || ids.has("diabetes_vomiting")) && hasKind(wizard, "severity")) return true;
    if (ids.has("vomit_diarrhea_24h") || ids.has("constipation_passing_gas")) return true;
    if ((ids.has("strong") || ids.has("worse") || ids.has("new_symptoms")) && hasKind(wizard, "severity")) return true;
    if (hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "fall") {
    if (ids.has("lost_consciousness") || ids.has("fell_from_height") || ids.has("alone_after_fall")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "urinary") {
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
    if ((ids.has("urine_fever_chills") || ids.has("urine_side_pain") || ids.has("urine_confusion_weak")) && hasKind(wizard, "severity")) return true;
  }

  if (symptomId === "skin") {
    if (ids.has("shingles_eye") || ids.has("shingles_immune") || ids.has("shingles_early")) return true;
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  if (symptomId === "confusion") {
    if (hasKind(wizard, "severity")) return true;
  }

  if (symptomId === "other") {
    if (hasKind(wizard, "severity") && hasKind(wizard, "trend")) return true;
  }

  return hasKind(wizard, "duration") && hasKind(wizard, "severity") && hasKind(wizard, "trend");
}

export function nextAdaptiveStage(wizard: TriageWizardContext | undefined, healthMemory?: TriageHealthMemory): WizardStage {
  const answers = selectedAnswers(wizard);
  if (wizard?.refineRequested) return "complete";
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

  if (symptomId === "chest") {
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
    if (!hasKind(wizard, "duration")) return "duration";
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

  if (["stomach", "urinary", "skin", "other"].includes(symptomId ?? "")) {
    if (!hasKind(wizard, "severity")) return "severity";
    if (!hasKind(wizard, "trend")) return "trend";
    if (!hasKind(wizard, "duration")) return "duration";
  }

  if (!hasKind(wizard, "severity")) return "severity";
  if (!hasKind(wizard, "duration")) return "duration";
  if (!hasKind(wizard, "trend")) return "trend";
  return "complete";
}

function urgencyRank(urgency: TriageUrgency) {
  if (urgency === "urgent") return 3;
  if (urgency === "routine") return 2;
  return 1;
}

function maxUrgency(current: TriageUrgency, floor: TriageUrgency): TriageUrgency {
  return urgencyRank(current) >= urgencyRank(floor) ? current : floor;
}

export function symptomLabel(locale: string, symptomId: string | undefined) {
  const labels: Record<string, { en: string; es: string }> = {
    pain: { en: "pain or headache", es: "dolor o dolor de cabeza" },
    chest: { en: "chest discomfort", es: "molestia de pecho" },
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

export function watchSignsFor(locale: string, symptomId: string | undefined): string[] {
  if (symptomId === "chest") {
    return [
      text(locale, "Chest pressure, tightness, or pain is happening now or getting worse.", "Presion, opresion o dolor de pecho ocurre ahora o empeora."),
      text(locale, "Breathing trouble, sweating, faintness, nausea, or spreading pain appears.", "Aparece falta de aire, sudor, desmayo, nausea o dolor que se extiende."),
      text(locale, "Pulse feels very fast, irregular, or very slow.", "El pulso se siente muy rapido, irregular o muy lento."),
    ];
  }
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

export function profileConsiderationsFor(locale: string, risks: ProfileRiskFlags, symptomId: string | undefined): string[] {
  const notes = [
    risks.bloodThinner && ["chest", "pain", "dizzy", "other"].includes(symptomId ?? "")
      ? text(locale, "Blood thinner in profile: falls, head hits, unusual bleeding, or severe headache need extra caution.", "Anticoagulante en el perfil: caidas, golpes en la cabeza, sangrado raro o dolor de cabeza fuerte requieren mas cuidado.")
      : "",
    risks.diabetes && ["dizzy", "tired", "fever", "urinary", "confusion", "other"].includes(symptomId ?? "")
      ? text(locale, "Diabetes or glucose medicine in profile: sugar changes can make weakness, dizziness, or infection feel different.", "Diabetes o medicacion de azucar en el perfil: cambios de azucar pueden cambiar debilidad, mareo o infeccion.")
      : "",
    (risks.copd || risks.heartFailure) && ["chest", "breathing", "tired", "fall", "other"].includes(symptomId ?? "")
      ? text(locale, "Breathing or heart condition in profile: shortness of breath should be watched more closely.", "Condicion respiratoria o cardiaca en el perfil: la falta de aire debe vigilarse mas de cerca.")
      : "",
    (risks.strokeHistory || risks.hypertension) && ["chest", "pain", "dizzy", "confusion", "other"].includes(symptomId ?? "")
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

export function vitalsNotesFor(locale: string, wizard: TriageWizardContext | undefined): string[] {
  const bpm = wizard?.vitals?.bpm;
  const rr = wizard?.vitals?.respiratoryRate;
  const spo2 = wizard?.vitals?.oxygenSaturation;
  const temperatureC = wizard?.vitals?.temperatureC;
  const systolicBp = wizard?.vitals?.systolicBp;
  const diastolicBp = wizard?.vitals?.diastolicBp;
  const glucoseMgdl = wizard?.vitals?.glucoseMgdl;
  const painScore = wizard?.vitals?.painScore;
  const energyLevel = wizard?.vitals?.energyLevel;
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
  if (typeof spo2 === "number") {
    notes.push(text(locale, `Oxygen saturation was ${spo2}%.`, `La saturacion de oxigeno fue ${spo2}%.`));
  }
  if (typeof temperatureC === "number") {
    notes.push(text(locale, `Temperature was ${temperatureC} C.`, `La temperatura fue ${temperatureC} C.`));
  }
  if (typeof systolicBp === "number" && typeof diastolicBp === "number") {
    notes.push(text(locale, `Blood pressure was ${systolicBp}/${diastolicBp}.`, `La presion arterial fue ${systolicBp}/${diastolicBp}.`));
  }
  if (typeof glucoseMgdl === "number") {
    notes.push(text(locale, `Glucose was ${glucoseMgdl} mg/dL.`, `La glucosa fue ${glucoseMgdl} mg/dL.`));
  }
  if (typeof painScore === "number") {
    notes.push(text(locale, `Pain score was ${painScore}/10.`, `El dolor fue ${painScore}/10.`));
  }
  if (typeof energyLevel === "number") {
    notes.push(text(locale, `Energy level was ${energyLevel}/10.`, `La energia fue ${energyLevel}/10.`));
  }
  return notes.slice(0, 4);
}

function concernLabel(locale: string, level: TriageScanResult["concernLevel"]) {
  if (level === "urgent") return text(locale, "concerning", "preocupante");
  if (level === "watch") return text(locale, "worth watching", "para vigilar");
  return text(locale, "not concerning", "sin senales preocupantes");
}

export function scanNotesFor(locale: string, wizard: TriageWizardContext | undefined): string[] {
  const scans = wizard?.scanResults ?? [];
  return scans.map((scan) => {
    const findings = scan.findings.length ? ` ${scan.findings.slice(0, 3).join("; ")}` : "";
    const storageNote = scan.type === "vitals"
      ? ""
      : ` ${text(locale, "The photo was analyzed and discarded.", "La foto se analizo y se descarto.")}`;
    const limitation = scan.type === "urine_photo"
      ? ` ${text(locale, "A photo cannot diagnose a urine infection.", "Una foto no puede diagnosticar una infeccion de orina.")}`
      : scan.type === "stool_photo"
        ? ` ${text(locale, "A photo cannot diagnose bleeding or bowel disease.", "Una foto no puede diagnosticar sangrado o enfermedad intestinal.")}`
        : "";
    return text(
      locale,
      `Optional scan (${scan.label}) looked ${concernLabel(locale, scan.concernLevel)}: ${scan.summary}.${findings}${storageNote}${limitation}`,
      `Escaneo opcional (${scan.label}) se ve ${concernLabel(locale, scan.concernLevel)}: ${scan.summary}.${findings}${storageNote}${limitation}`,
    );
  }).slice(0, 4);
}

export function uniqueStrings(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
}

export function fallbackReportContent(locale: string, summary: TriageSummary, symptom: string) {
  if (summary.nextStepLevel === "emergency") {
    return text(
      locale,
      `Your answers include an emergency warning sign for ${symptom}.`,
      `Tus respuestas incluyen una senal de emergencia para ${symptom}.`,
    );
  }
  if (summary.nextStepLevel === "doctor_today") {
    return text(
      locale,
      `Your answers show ${symptom} should be checked today.`,
      `Tus respuestas indican que ${symptom} debe revisarse hoy.`,
    );
  }
  if (summary.nextStepLevel === "doctor_24_48") {
    return text(
      locale,
      `Your answers show ${symptom} should be checked within 24-48 hours.`,
      `Tus respuestas indican que ${symptom} debe revisarse en 24-48 horas.`,
    );
  }
  return text(
    locale,
    `Your answers fit a lower-risk ${symptom} pattern right now.`,
    `Tus respuestas encajan ahora con un patron de menor riesgo para ${symptom}.`,
  );
}

function firstUserClue(messages: TriageChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content ?? "";
}

export function buildFallbackTriageReport(
  locale: string,
  wizard: TriageWizardContext | undefined,
  messages: TriageChatMessage[],
  healthMemory?: TriageHealthMemory,
): { content: string; summary: TriageSummary } {
  const report = buildFallbackTriageReportWithTelemetry(locale, wizard, messages, healthMemory);
  return {
    content: report.content,
    summary: report.summary,
  };
}

export function buildFallbackTriageReportWithTelemetry(
  locale: string,
  wizard: TriageWizardContext | undefined,
  messages: TriageChatMessage[],
  healthMemory?: TriageHealthMemory,
): { content: string; summary: TriageSummary; telemetry: TriageOutcomeTelemetry } {
  const symptomId = selectedSymptomId(wizard);
  const symptom = symptomLabel(locale, symptomId);
  const chiefComplaint = firstUserClue(messages).replace(/\s+/g, " ").trim() || symptom;
  const detailLabels = selectedAnswers(wizard)
    .filter((answer) => ["severity", "duration", "trend"].includes(answer.kind ?? ""))
    .map((answer) => answer.label);
  const baseSummary: TriageSummary = {
    chiefComplaint,
    symptoms: uniqueStrings([symptom, ...detailLabels]).slice(0, 4),
    urgency: "monitor",
    recommendations: [],
    disclaimer: text(
      locale,
      "This assessment is for information only and is not medical advice. Always consult your doctor or call emergency services if you feel it is serious.",
      "Esta evaluacion es solo informativa y no sustituye el consejo medico. Consulta siempre con tu medico o llama a emergencias si sientes que es grave.",
    ),
    triageReasons: [],
    watchSigns: watchSignsFor(locale, symptomId),
    profileConsiderations: [],
    vitalsNotes: [],
  };
  const { summary, telemetry } = evaluateTriageSafetyFloor(baseSummary, wizard, locale, healthMemory);
  return {
    content: fallbackReportContent(locale, summary, symptom),
    summary,
    telemetry,
  };
}

export function nextStepFor(
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
      nextStepLabel: text(locale, "Talk to a doctor today", "Habla con un médico hoy"),
    };
  }
  if (summary.urgency === "routine" || ids.has("strong") || ids.has("worse")) {
    return {
      nextStepLevel: "doctor_24_48",
      nextStepLabel: text(locale, "Talk to a doctor within 24-48 hours", "Habla con un médico en 24-48 horas"),
    };
  }
  return {
    nextStepLevel: "monitor",
    nextStepLabel: text(locale, "Monitor at home, with doctor access ready", "Vigila en casa, con medico disponible"),
  };
}

function nextStepRank(level: TriageRuleLevel | undefined) {
  if (level === "emergency") return 4;
  if (level === "doctor_today") return 3;
  if (level === "doctor_24_48") return 2;
  return 1;
}

function outcomeTelemetryFor(input: {
  symptom?: string;
  summary: TriageSummary;
  ruleTelemetry: {
    ruleIdsFired: string[];
    profileModifiersApplied: string[];
    vitalsOverlaysApplied: string[];
    escalationSources: TriageEscalationSource[];
  };
  urgentScanApplied: boolean;
}): TriageOutcomeTelemetry {
  const ruleIds = input.urgentScanApplied
    ? [...input.ruleTelemetry.ruleIdsFired, "triage.scan.urgent_visible_change"]
    : input.ruleTelemetry.ruleIdsFired;
  const escalationSources = input.urgentScanApplied
    ? [...input.ruleTelemetry.escalationSources, "symptom" as const]
    : input.ruleTelemetry.escalationSources;

  return {
    symptomPath: input.symptom ?? "unknown",
    urgency: input.summary.urgency,
    ruleIdsFired: uniqueStrings(ruleIds),
    profileModifiersApplied: uniqueStrings(input.ruleTelemetry.profileModifiersApplied),
    vitalsOverlaysApplied: uniqueStrings(input.ruleTelemetry.vitalsOverlaysApplied),
    caregiverEscalationTriggered: false,
    escalationSources: [...new Set(escalationSources)],
  };
}

export function primaryEscalationSource(telemetry: TriageOutcomeTelemetry): TriageEscalationSource | undefined {
  if (telemetry.escalationSources.includes("caregiver")) return "caregiver";
  if (telemetry.escalationSources.includes("vitals")) return "vitals";
  if (telemetry.escalationSources.includes("profile")) return "profile";
  if (telemetry.escalationSources.includes("symptom")) return "symptom";
  return undefined;
}

export function evaluateTriageSafetyFloor(
  summary: TriageSummary,
  wizard: TriageWizardContext | undefined,
  locale: string,
  healthMemory?: TriageHealthMemory,
): { summary: TriageSummary; telemetry: TriageOutcomeTelemetry } {
  const answers = selectedAnswers(wizard);
  const ids = new Set(answers.map((answer) => answer.id));
  const symptom = selectedSymptomId(wizard);
  const hasCriticalRedFlag = answers.some((answer) => CRITICAL_RED_FLAG_IDS.has(answer.id));
  const risks = profileRiskFlags(healthMemory);
  const bpm = wizard?.vitals?.bpm ?? undefined;
  const respiratoryRate = wizard?.vitals?.respiratoryRate ?? undefined;
  const abnormalPulse = typeof bpm === "number" && (bpm >= 110 || bpm <= 50);
  const abnormalBreathingRate = typeof respiratoryRate === "number" && (respiratoryRate >= 24 || respiratoryRate <= 10);
  const scanResults = wizard?.scanResults ?? [];
  const scanNotes = scanNotesFor(locale, wizard);
  const urgentScans = scanResults.filter((scan) => scan.concernLevel === "urgent");
  const urgentScanReason = urgentScans.length
    ? text(locale, "An optional scan found a concerning visible change that should be shared with a clinician today.", "Un escaneo opcional encontro un cambio visible preocupante que conviene compartir hoy con un clinico.")
    : "";
  const urgentScanRecommendation = urgentScans.length
    ? text(locale, "Talk to a doctor today and share the scan note. Seek urgent help sooner if severe symptoms appear.", "Habla con un medico hoy y comparte la nota del escaneo. Busca ayuda urgente antes si aparecen sintomas fuertes.")
    : "";
  const ruleDecision = evaluateTriageRules({
    locale,
    symptomId: symptom,
    answerIds: ids,
    risks,
    hasCriticalRedFlag,
    abnormalPulse,
    abnormalBreathingRate,
    pulseBpm: bpm,
    respiratoryRate,
    oxygenSaturation: wizard?.vitals?.oxygenSaturation ?? undefined,
    temperatureC: wizard?.vitals?.temperatureC ?? undefined,
    systolicBp: wizard?.vitals?.systolicBp ?? undefined,
    diastolicBp: wizard?.vitals?.diastolicBp ?? undefined,
    glucoseMgdl: wizard?.vitals?.glucoseMgdl ?? undefined,
    painScore: wizard?.vitals?.painScore ?? undefined,
    energyLevel: wizard?.vitals?.energyLevel ?? undefined,
  });
  const baseSummary = {
    ...summary,
    symptoms: summary.symptoms?.length ? summary.symptoms : [symptomLabel(locale, symptom)],
    urgency: urgentScans.length ? maxUrgency(ruleDecision.urgency, "urgent") : ruleDecision.urgency,
    triageReasons: [
      urgentScanReason,
      ...ruleDecision.reasons,
      ...(summary.triageReasons ?? []),
    ].filter(Boolean).filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index).slice(0, 3),
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
    scanResults,
    scanNotes: uniqueStrings([
      ...(summary.scanNotes ?? []),
      ...scanNotes,
    ]).slice(0, 4),
    recommendations: mergeTriageRecommendations(
      [urgentScanRecommendation, ...ruleDecision.recommendations],
      summary.recommendations ?? [],
    ),
  };
  const scanNextStep = urgentScans.length && nextStepRank(ruleDecision.level) < nextStepRank("doctor_today")
    ? {
        nextStepLevel: "doctor_today" as const,
        nextStepLabel: text(locale, "Talk to a doctor today", "Habla con un medico hoy"),
      }
    : null;
  const nextStep: Pick<TriageSummary, "nextStepLabel" | "nextStepLevel"> = scanNextStep ?? {
    nextStepLevel: ruleDecision.level,
    nextStepLabel: ruleDecision.nextStepLabel,
  };

  const finalSummary = {
    ...baseSummary,
    ...nextStep,
  };

  return {
    summary: finalSummary,
    telemetry: outcomeTelemetryFor({
      symptom,
      summary: finalSummary,
      ruleTelemetry: ruleDecision.telemetry,
      urgentScanApplied: urgentScans.length > 0,
    }),
  };
}

export function applyTriageSafetyFloor(
  summary: TriageSummary,
  wizard: TriageWizardContext | undefined,
  locale: string,
  healthMemory?: TriageHealthMemory,
): TriageSummary {
  return evaluateTriageSafetyFloor(summary, wizard, locale, healthMemory).summary;
}
