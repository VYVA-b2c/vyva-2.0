import type {
  ProfileRiskFlags,
  TriageGuidancePlan,
  TriageGuidanceSignal,
  TriageHealthMemory,
  TriageRuleRiskFlags,
  TriageWizardContext,
  WizardStage,
} from "../types.js";
import { profileRiskFlags, selectedAnswers, selectedSymptomId } from "./routeOutcome.js";

type GuidanceProtocolId =
  | "chest_breathing"
  | "dizziness"
  | "weakness"
  | "falls"
  | "medication"
  | "confusion"
  | "general";

type UsefulVitalId = "pulse" | "oxygen" | "blood_pressure" | "temperature" | "glucose" | "pain" | "energy";

type GuidanceProtocol = {
  id: GuidanceProtocolId;
  labelEn: string;
  labelEs: string;
  symptomIds: string[];
  contextIds?: string[];
  cluePattern?: RegExp;
  profileRisks: Array<keyof TriageRuleRiskFlags>;
  usefulVitals: UsefulVitalId[];
  stageFocus: Partial<Record<WizardStage, { en: string; es: string }>>;
};

function isSpanishLocale(locale: string) {
  return locale.split("-")[0].toLowerCase() === "es";
}

function text(locale: string, english: string, spanish: string) {
  return isSpanishLocale(locale) ? spanish : english;
}

const GUIDANCE_PROTOCOLS: GuidanceProtocol[] = [
  {
    id: "chest_breathing",
    labelEn: "Chest and breathing safety",
    labelEs: "Seguridad de pecho y respiracion",
    symptomIds: ["chest", "breathing"],
    profileRisks: ["heartDisease", "heartFailure", "afib", "hypertension", "copd", "strokeHistory"],
    usefulVitals: ["oxygen", "pulse", "blood_pressure"],
    stageFocus: {
      red_flag: {
        en: "Checking chest, breathing, fainting, and oxygen warning signs first.",
        es: "Comprobando primero senales de pecho, respiracion, desmayo y oxigeno.",
      },
      severity: {
        en: "Finding out whether breathing, pressure, or effort is affecting safety now.",
        es: "Averiguando si respiracion, presion o esfuerzo afectan la seguridad ahora.",
      },
      trend: {
        en: "Checking whether this is improving, returning, or getting worse.",
        es: "Comprobando si mejora, vuelve o empeora.",
      },
    },
  },
  {
    id: "dizziness",
    labelEn: "Dizziness and faintness",
    labelEs: "Mareo y desmayo",
    symptomIds: ["dizzy"],
    profileRisks: ["diabetes", "kidneyDisease", "diureticMedication", "hypertension", "heartDisease", "afib", "strokeHistory", "sedatingMedication"],
    usefulVitals: ["pulse", "blood_pressure", "glucose"],
    stageFocus: {
      red_flag: {
        en: "Checking fainting, walking safety, chest symptoms, and stroke-like signs before smaller details.",
        es: "Comprobando desmayo, seguridad al caminar, pecho y senales tipo ictus antes de detalles menores.",
      },
      severity: {
        en: "Checking whether dizziness is strong enough to make standing or walking unsafe.",
        es: "Comprobando si el mareo hace inseguro estar de pie o caminar.",
      },
      trend: {
        en: "Checking whether it happens on standing, with head movement, or keeps getting worse.",
        es: "Comprobando si pasa al levantarse, con movimiento de cabeza o empeora.",
      },
    },
  },
  {
    id: "weakness",
    labelEn: "Weakness and low energy",
    labelEs: "Debilidad y poca energia",
    symptomIds: ["tired"],
    profileRisks: ["diabetes", "kidneyDisease", "heartDisease", "heartFailure", "cognitiveConcern", "opioidMedication", "sedatingMedication", "diureticMedication"],
    usefulVitals: ["pulse", "blood_pressure", "glucose", "temperature", "energy"],
    stageFocus: {
      red_flag: {
        en: "Checking one-sided weakness, unsafe standing, breathing, chest symptoms, and alertness first.",
        es: "Comprobando primero debilidad de un lado, estar de pie, respiracion, pecho y alerta.",
      },
      duration: {
        en: "Checking whether this is new today, building over days, or part of a longer pattern.",
        es: "Comprobando si empezo hoy, lleva dias o es un patron mas largo.",
      },
      severity: {
        en: "Checking whether weakness is limiting drinking, walking, or daily safety.",
        es: "Comprobando si la debilidad limita beber, caminar o la seguridad diaria.",
      },
    },
  },
  {
    id: "falls",
    labelEn: "Fall and injury safety",
    labelEs: "Seguridad de caidas y lesiones",
    symptomIds: ["fall"],
    profileRisks: ["bloodThinner", "fallsFrailty", "osteoporosis", "parkinsonMobility", "sedatingMedication"],
    usefulVitals: ["pain", "pulse", "blood_pressure"],
    stageFocus: {
      red_flag: {
        en: "Checking head injury, ability to stand, bleeding, and whether someone can check on you.",
        es: "Comprobando golpe en cabeza, estar de pie, sangrado y si alguien puede revisarte.",
      },
      severity: {
        en: "Checking whether pain, swelling, or movement makes walking unsafe.",
        es: "Comprobando si dolor, hinchazon o movimiento hacen inseguro caminar.",
      },
      trend: {
        en: "Checking whether pain or movement is improving or becoming more concerning.",
        es: "Comprobando si dolor o movimiento mejoran o preocupan mas.",
      },
    },
  },
  {
    id: "medication",
    labelEn: "Medication-related change",
    labelEs: "Cambio relacionado con medicacion",
    symptomIds: ["other", "dizzy", "tired", "confusion", "stomach"],
    contextIds: ["medication_context"],
    cluePattern: /\b(medicine|medication|tablet|pill|dose|new med|missed dose|took extra|side effect|medicina|medicacion|pastilla|dosis|efecto)\b/i,
    profileRisks: ["bloodThinner", "diabetes", "opioidMedication", "sedatingMedication", "diureticMedication", "steroidMedication", "kidneyDisease"],
    usefulVitals: ["pulse", "blood_pressure", "glucose", "temperature"],
    stageFocus: {
      red_flag: {
        en: "Checking whether medicine changes are linked with breathing, alertness, bleeding, sugar, or unsafe walking.",
        es: "Comprobando si cambios de medicacion se relacionan con respiracion, alerta, sangrado, azucar o caminar inseguro.",
      },
      severity: {
        en: "Checking how strongly the change affects daily safety and whether a recent dose may matter.",
        es: "Comprobando cuanto afecta la seguridad diaria y si una dosis reciente puede importar.",
      },
      trend: {
        en: "Checking whether symptoms started after a dose change, missed dose, or new medicine.",
        es: "Comprobando si empezo tras cambio de dosis, dosis perdida o medicina nueva.",
      },
    },
  },
  {
    id: "confusion",
    labelEn: "Confusion and alertness",
    labelEs: "Confusion y estado de alerta",
    symptomIds: ["confusion"],
    profileRisks: ["cognitiveConcern", "strokeHistory", "hypertension", "diabetes", "utiHistory", "kidneyDisease", "opioidMedication", "sedatingMedication"],
    usefulVitals: ["glucose", "temperature", "blood_pressure", "oxygen", "pulse"],
    stageFocus: {
      red_flag: {
        en: "Checking sudden confusion, stroke-like signs, fever, urine change, and whether staying alone is safe.",
        es: "Comprobando confusion repentina, senales tipo ictus, fiebre, orina y si estar solo es seguro.",
      },
      severity: {
        en: "Checking whether this is mild forgetfulness or a safety-changing alertness problem.",
        es: "Comprobando si es olvido leve o un cambio de alerta que afecta seguridad.",
      },
      trend: {
        en: "Checking whether this started suddenly, over days, or gradually over longer time.",
        es: "Comprobando si empezo de repente, en dias o gradualmente.",
      },
    },
  },
  {
    id: "general",
    labelEn: "General symptom check",
    labelEs: "Chequeo general de sintomas",
    symptomIds: ["pain", "fever", "stomach", "urinary", "skin", "other"],
    profileRisks: ["diabetes", "kidneyDisease", "cognitiveConcern", "immunosuppressed", "cancerActive", "recentSurgery"],
    usefulVitals: ["temperature", "pulse", "pain"],
    stageFocus: {
      red_flag: {
        en: "Checking urgent warning signs before choosing the safest next detail.",
        es: "Comprobando senales urgentes antes de elegir el detalle mas seguro.",
      },
      duration: {
        en: "Checking when this started so the next step has a clear follow-up window.",
        es: "Comprobando cuando empezo para que el siguiente paso tenga un plazo claro.",
      },
      severity: {
        en: "Checking how much this affects safety, comfort, and daily function.",
        es: "Comprobando cuanto afecta seguridad, comodidad y vida diaria.",
      },
      trend: {
        en: "Checking whether this is improving, steady, or getting worse.",
        es: "Comprobando si mejora, sigue igual o empeora.",
      },
    },
  },
];

const VITAL_LABELS: Record<UsefulVitalId, { en: string; es: string }> = {
  pulse: { en: "Pulse", es: "Pulso" },
  oxygen: { en: "Oxygen", es: "Oxigeno" },
  blood_pressure: { en: "Blood pressure", es: "Presion arterial" },
  temperature: { en: "Temperature", es: "Temperatura" },
  glucose: { en: "Blood sugar", es: "Azucar" },
  pain: { en: "Pain rating", es: "Nivel de dolor" },
  energy: { en: "Energy level", es: "Nivel de energia" },
};

const VITAL_FIELDS: Record<UsefulVitalId, Array<keyof NonNullable<TriageWizardContext["vitals"]>>> = {
  pulse: ["bpm"],
  oxygen: ["oxygenSaturation"],
  blood_pressure: ["systolicBp", "diastolicBp"],
  temperature: ["temperatureC"],
  glucose: ["glucoseMgdl"],
  pain: ["painScore"],
  energy: ["energyLevel"],
};

function hasRisk(risks: ProfileRiskFlags, riskKeys: Array<keyof TriageRuleRiskFlags>) {
  return riskKeys.some((risk) => Boolean(risks[risk]));
}

function hasVital(wizard: TriageWizardContext | undefined, vital: UsefulVitalId) {
  const vitals = wizard?.vitals;
  if (!vitals) return false;
  return VITAL_FIELDS[vital].every((field) => typeof vitals[field] === "number");
}

function hasAnyUsefulVital(wizard: TriageWizardContext | undefined, protocol: GuidanceProtocol) {
  return protocol.usefulVitals.some((vital) => hasVital(wizard, vital));
}

function signalRows(locale: string, wizard: TriageWizardContext | undefined, protocol: GuidanceProtocol): TriageGuidanceSignal[] {
  return protocol.usefulVitals.slice(0, 3).map((vital) => {
    const label = VITAL_LABELS[vital];
    return {
      id: vital,
      label: text(locale, label.en, label.es),
      status: hasVital(wizard, vital) ? "available" : "missing",
    };
  });
}

function firstUserClue(messages: Array<{ role: string; content: string }>) {
  return messages.find((message) => message.role === "user")?.content ?? "";
}

function bestProtocol(input: {
  wizard: TriageWizardContext | undefined;
  healthMemory?: TriageHealthMemory;
  messages?: Array<{ role: string; content: string }>;
}) {
  const symptomId = selectedSymptomId(input.wizard);
  const answerIds = new Set(selectedAnswers(input.wizard).map((answer) => answer.id));
  const clue = firstUserClue(input.messages ?? []);
  const healthText = [
    input.healthMemory?.medications,
    input.healthMemory?.medicationAdherence,
    input.healthMemory?.medicationInteraction,
  ].filter(Boolean).join(" ");

  const medicationLikely = /\b(medicine|medication|tablet|pill|dose|new med|missed dose|took extra|side effect|medicina|medicacion|pastilla|dosis|efecto)\b/i.test(`${clue} ${healthText}`);
  const medicationContext = answerIds.has("medication_context") || medicationLikely;
  if (medicationContext) {
    return GUIDANCE_PROTOCOLS.find((protocol) => protocol.id === "medication") ?? GUIDANCE_PROTOCOLS.at(-1)!;
  }

  return GUIDANCE_PROTOCOLS.find((protocol) => {
    if (symptomId && protocol.symptomIds.includes(symptomId)) return true;
    if (protocol.contextIds?.some((id) => answerIds.has(id))) return true;
    if (protocol.cluePattern?.test(clue)) return true;
    return false;
  }) ?? GUIDANCE_PROTOCOLS.at(-1)!;
}

function priorityLabel(locale: string, stage: WizardStage, profileUsed: boolean, hasVitals: boolean) {
  if (stage === "red_flag") return text(locale, "Safety first", "Seguridad primero");
  if (profileUsed) return text(locale, "Profile-aware", "Segun el perfil");
  if (!hasVitals && ["duration", "severity", "trend"].includes(stage)) return text(locale, "Useful signal", "Senal util");
  if (stage === "complete") return text(locale, "Ready for next step", "Listo para el siguiente paso");
  return text(locale, "One question", "Una pregunta");
}

function confidenceFor(input: {
  locale: string;
  wizard: TriageWizardContext | undefined;
  healthMemory?: TriageHealthMemory;
  protocol: GuidanceProtocol;
  stage: WizardStage;
  profileUsed: boolean;
}) {
  const { locale, wizard, healthMemory, protocol, stage, profileUsed } = input;
  const answers = selectedAnswers(wizard);
  const hasSymptom = answers.some((answer) => answer.kind === "symptom");
  const hasSafety = answers.some((answer) => answer.kind === "red_flag");
  const hasDetails = answers.some((answer) => ["duration", "severity", "trend"].includes(answer.kind ?? ""));
  const hasProfile = Boolean(healthMemory?.healthContext || healthMemory?.conditions || healthMemory?.medications || healthMemory?.latestSymptomReport || healthMemory?.medicationAdherence || healthMemory?.medicationInteraction);
  const hasUsefulVital = hasAnyUsefulVital(wizard, protocol);
  const reasons: string[] = [];
  const missing: string[] = [];

  let score = 1;
  if (hasSymptom) {
    score += 1;
    reasons.push(text(locale, "symptom described", "sintoma descrito"));
  } else {
    missing.push(text(locale, "what feels wrong", "que se siente mal"));
  }
  if (hasSafety) {
    score += 1;
    reasons.push(text(locale, "safety question answered", "pregunta de seguridad respondida"));
  } else {
    missing.push(text(locale, "safety warning signs", "senales de seguridad"));
  }
  if (hasDetails || stage === "complete") {
    score += 1;
    reasons.push(text(locale, "symptom detail added", "detalle del sintoma agregado"));
  } else if (hasSafety) {
    missing.push(text(locale, "one detail about timing or strength", "un detalle sobre tiempo o intensidad"));
  }
  if (hasProfile || profileUsed) {
    score += 1;
    reasons.push(text(locale, "health profile considered", "perfil de salud considerado"));
  } else {
    missing.push(text(locale, "health profile", "perfil de salud"));
  }
  if (hasUsefulVital) {
    score += 1;
    reasons.push(text(locale, "useful reading available", "medicion util disponible"));
  } else if (["duration", "severity", "trend"].includes(stage)) {
    missing.push(text(locale, "optional useful reading", "medicion opcional util"));
  }

  const cappedScore = Math.min(5, Math.max(1, score));
  const label = cappedScore >= 5
    ? text(locale, "High confidence", "Confianza alta")
    : cappedScore >= 4
      ? text(locale, "Strong confidence", "Confianza solida")
      : cappedScore >= 3
        ? text(locale, "Building confidence", "Confianza en progreso")
        : text(locale, "Early confidence", "Confianza inicial");

  return {
    score: cappedScore,
    label,
    reasons: reasons.slice(0, 3),
    missing: [...new Set(missing)].slice(0, 3),
  };
}

export function buildGuidancePlan(input: {
  locale: string;
  stage: WizardStage;
  wizard: TriageWizardContext | undefined;
  healthMemory?: TriageHealthMemory;
  messages?: Array<{ role: string; content: string }>;
}): TriageGuidancePlan {
  const { locale, stage, wizard, healthMemory } = input;
  const protocol = bestProtocol(input);
  const risks = profileRiskFlags(healthMemory);
  const profileContextUsed = hasRisk(risks, protocol.profileRisks);
  const hasUsefulVital = hasAnyUsefulVital(wizard, protocol);
  const focus = protocol.stageFocus[stage] ?? protocol.stageFocus.red_flag ?? {
    en: "Choosing the next safest question from the symptom protocol.",
    es: "Eligiendo la siguiente pregunta mas segura del protocolo de sintomas.",
  };

  return {
    protocolId: protocol.id,
    protocolLabel: text(locale, protocol.labelEn, protocol.labelEs),
    stage,
    priorityLabel: priorityLabel(locale, stage, profileContextUsed, hasUsefulVital),
    nextQuestionFocus: text(locale, focus.en, focus.es),
    confidence: confidenceFor({ locale, wizard, healthMemory, protocol, stage, profileUsed: profileContextUsed }),
    profileContextUsed,
    usefulSignals: signalRows(locale, wizard, protocol),
  };
}
