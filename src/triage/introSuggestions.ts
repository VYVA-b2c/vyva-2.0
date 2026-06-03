import { languageText, normalizeAppLanguage, type LanguageCopy } from "../../shared/language.js";
import { profileRiskFlags } from "./engine/routeOutcome.js";
import type {
  ProfileRiskFlags,
  TriageHealthMemory,
  TriagePersonalizedSuggestion,
  TriageSuggestionReasonCode,
} from "./types.js";

type SignalSource =
  | "healthContext"
  | "conditions"
  | "allergies"
  | "medications"
  | "latestVitals"
  | "vitalsTrend"
  | "latestSymptomReport"
  | "medicationAdherence"
  | "medicationInteraction";

type TriageProfileSignal = {
  active: boolean;
  sources: SignalSource[];
  reasonCode: TriageSuggestionReasonCode;
  strength: number;
  safetyWeight: 0 | 1 | 2 | 3;
};

export type TriageProfileSignals = {
  hasProfileContext: boolean;
  risks: ProfileRiskFlags;
  diabetes: TriageProfileSignal;
  respiratory: TriageProfileSignal;
  heartBp: TriageProfileSignal;
  fallBleed: TriageProfileSignal;
  medicationRisk: TriageProfileSignal;
  moodCognitive: TriageProfileSignal;
  kidney: TriageProfileSignal;
  immunosuppression: TriageProfileSignal;
  surgeryWound: TriageProfileSignal;
  strokeCognitiveParkinson: TriageProfileSignal;
  liver: TriageProfileSignal;
  uti: TriageProfileSignal;
  medicationAdherence: TriageProfileSignal;
  medicationInteraction: TriageProfileSignal;
  recentVitals: TriageProfileSignal;
  recentReport: TriageProfileSignal;
};

type DraftSuggestion = Omit<TriagePersonalizedSuggestion, "label" | "description" | "initialClue" | "score"> & {
  label: LanguageCopy;
  description: LanguageCopy;
  initialClue?: LanguageCopy;
  score: number;
};

const MAX_CONCERNS = 6;
const MAX_IMPROVEMENTS = 5;

function copy(en: string, es: string, fr: string, de: string, it: string, pt: string): LanguageCopy {
  return { en, es, fr, de, it, pt };
}

function localize(copyValue: LanguageCopy | undefined, language: string): string | undefined {
  return copyValue ? languageText(normalizeAppLanguage(language, "en"), copyValue) : undefined;
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function fieldText(memory: TriageHealthMemory | undefined): Record<SignalSource, string> {
  return {
    healthContext: memory?.healthContext ?? "",
    conditions: memory?.conditions ?? "",
    allergies: memory?.allergies ?? "",
    medications: memory?.medications ?? "",
    latestVitals: memory?.latestVitals ?? "",
    vitalsTrend: memory?.vitalsTrend ?? "",
    latestSymptomReport: memory?.latestSymptomReport ?? "",
    medicationAdherence: memory?.medicationAdherence ?? "",
    medicationInteraction: memory?.medicationInteraction ?? "",
  };
}

function matchSources(
  fields: Record<SignalSource, string>,
  pattern: RegExp,
  sources: SignalSource[],
): SignalSource[] {
  return sources.filter((source) => pattern.test(fields[source]));
}

function uniqueSources(sources: SignalSource[]): SignalSource[] {
  return [...new Set(sources)];
}

function reasonFor(sources: SignalSource[]): TriageSuggestionReasonCode {
  if (sources.includes("conditions") || sources.includes("healthContext") || sources.includes("allergies")) {
    return "condition_match";
  }
  if (sources.includes("medications") || sources.includes("medicationAdherence") || sources.includes("medicationInteraction")) {
    return "medicine_match";
  }
  if (sources.includes("latestSymptomReport")) return "recent_report";
  if (sources.includes("latestVitals") || sources.includes("vitalsTrend")) return "recent_vitals";
  return "condition_match";
}

function signal(sources: SignalSource[], safetyWeight: 0 | 1 | 2 | 3): TriageProfileSignal {
  const unique = uniqueSources(sources);
  return {
    active: unique.length > 0,
    sources: unique,
    reasonCode: unique.length ? reasonFor(unique) : "fallback",
    strength: unique.length,
    safetyWeight,
  };
}

function sourceFor(signalValue: TriageProfileSignal): TriagePersonalizedSuggestion["source"] {
  if (signalValue.reasonCode === "medicine_match") return "medications";
  if (signalValue.reasonCode === "recent_report") return "recent_report";
  if (signalValue.reasonCode === "recent_vitals") return "vitals";
  if (!signalValue.active) return "fallback";
  return "profile";
}

function scoreFor(signalValue: TriageProfileSignal, priority: number): number {
  if (!signalValue.active) return priority;
  const hasDirectProfile = signalValue.sources.some((source) => source === "conditions" || source === "healthContext" || source === "allergies");
  const hasMedicine = signalValue.sources.some((source) => source === "medications" || source === "medicationAdherence" || source === "medicationInteraction");
  const hasRecentReport = signalValue.sources.includes("latestSymptomReport");
  const hasRecentVitals = signalValue.sources.some((source) => source === "latestVitals" || source === "vitalsTrend");

  return (
    signalValue.safetyWeight * 1000 +
    (hasDirectProfile ? 350 : 0) +
    (hasMedicine ? 280 : 0) +
    (hasRecentReport ? 170 : 0) +
    (hasRecentVitals ? 140 : 0) +
    signalValue.strength * 20 +
    priority
  );
}

export function extractTriageProfileSignals(memory?: TriageHealthMemory): TriageProfileSignals {
  const fields = fieldText(memory);
  const coreSources: SignalSource[] = ["healthContext", "conditions"];
  const clinicalSources: SignalSource[] = ["healthContext", "conditions", "latestSymptomReport"];
  const allSources: SignalSource[] = [
    "healthContext",
    "conditions",
    "allergies",
    "medications",
    "latestVitals",
    "vitalsTrend",
    "latestSymptomReport",
    "medicationAdherence",
    "medicationInteraction",
  ];

  const diabetes = signal([
    ...matchSources(fields, /\b(diabetes|diabetic|blood sugar|glucose|cgm)\b/i, coreSources),
    ...matchSources(fields, /\b(insulin|metformin|glucose|blood sugar|cgm)\b/i, ["medications", "latestVitals", "vitalsTrend"]),
  ], 1);

  const respiratory = signal([
    ...matchSources(fields, /\b(copd|emphysema|chronic bronchitis|asthma|oxygen therapy|home oxygen|shortness of breath|breathing)\b/i, clinicalSources),
    ...matchSources(fields, /\b(oxygen|spo2|respiratory rate|breathing)\b/i, ["latestVitals", "vitalsTrend"]),
    ...matchSources(fields, /\b(inhaler|salbutamol|albuterol|tiotropium|steroid inhaler)\b/i, ["medications"]),
  ], 3);

  const heartBp = signal([
    ...matchSources(fields, /\b(heart failure|chf|heart disease|coronary|angina|heart attack|myocardial infarction|stent|bypass|afib|atrial fibrillation|arrhythmia|hypertension|high blood pressure|blood pressure|stroke|tia)\b/i, clinicalSources),
    ...matchSources(fields, /\b(blood pressure|bp|systolic|diastolic|pulse|heart rate|irregular|palpitations)\b/i, ["latestVitals", "vitalsTrend"]),
    ...matchSources(fields, /\b(amlodipine|lisinopril|losartan|atenolol|metoprolol|furosemide|diuretic)\b/i, ["medications"]),
  ], 3);

  const fallBleed = signal([
    ...matchSources(fields, /\b(fall risk|falls|frail|frailty|walker|walking aid|mobility aid|unsteady|balance problem|osteoporosis|osteopenia|parkinson|tremor)\b/i, clinicalSources),
    ...matchSources(fields, /\b(warfarin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|anticoagulant|blood thinner|clopidogrel|plavix)\b/i, ["medications", "healthContext", "conditions"]),
  ], 3);

  const medicationRisk = signal([
    ...matchSources(fields, /\S/i, ["medications"]),
    ...matchSources(fields, /\b(zolpidem|ambien|benzodiazepine|diazepam|lorazepam|alprazolam|clonazepam|sleeping pill|sedative|quetiapine|gabapentin|pregabalin|opioid|morphine|oxycodone|tramadol|fentanyl|codeine|furosemide|diuretic|prednisone|prednisolone|steroid)\b/i, ["medications"]),
    ...matchSources(fields, /\b(side effect|interaction|missed|refill|dose|adherence|not taking|late dose)\b/i, ["medicationAdherence", "medicationInteraction", "latestSymptomReport"]),
  ], 1);

  const moodCognitive = signal([
    ...matchSources(fields, /\b(depression|depressed|anxiety|panic|lonely|self harm|self-harm|dementia|alzheimer|memory loss|cognitive impairment|confusion)\b/i, clinicalSources),
  ], 2);

  const kidney = signal([
    ...matchSources(fields, /\b(kidney disease|ckd|renal|dialysis|egfr|nephropathy|kidney failure)\b/i, clinicalSources),
    ...matchSources(fields, /\b(creatinine|egfr|renal|kidney)\b/i, ["latestVitals", "vitalsTrend"]),
  ], 2);

  const immunosuppression = signal([
    ...matchSources(fields, /\b(immunosuppressed|immunocompromised|chemotherapy|transplant|low immunity|neutropenia|cancer|oncology|tumou?r|malignan)\b/i, clinicalSources),
    ...matchSources(fields, /\b(prednisone|prednisolone|dexamethasone|methotrexate|biologic|chemotherapy)\b/i, ["medications"]),
  ], 3);

  const surgeryWound = signal([
    ...matchSources(fields, /\b(recent surgery|post[- ]?op|operation|hospital stay|discharged|wound|incision|surgical|draining|redness)\b/i, clinicalSources),
  ], 2);

  const strokeCognitiveParkinson = signal([
    ...matchSources(fields, /\b(stroke|tia|mini stroke|cva|transient ischemic|transient ischaemic|parkinson|levodopa|carbidopa|freezing|tremor|dementia|alzheimer|memory loss|cognitive impairment|confusion)\b/i, clinicalSources),
    ...matchSources(fields, /\b(levodopa|carbidopa)\b/i, ["medications"]),
  ], 3);

  const liver = signal([
    ...matchSources(fields, /\b(liver disease|cirrhosis|hepatitis|hepatic|jaundice|ascites)\b/i, clinicalSources),
  ], 2);

  const uti = signal([
    ...matchSources(fields, /\b(uti|urinary tract infection|recurrent infection|bladder infection|cystitis|urine|urinary|pain when pee|burning when urinating)\b/i, clinicalSources),
  ], 2);

  const medicationAdherence = signal([
    ...matchSources(fields, /\b(missed|forgot|late|not taking|skipped|refill|running out|adherence|dose)\b/i, ["medicationAdherence", "latestSymptomReport"]),
  ], 1);

  const medicationInteraction = signal([
    ...matchSources(fields, /\b(interaction|side effect|allergy|rash|swelling|drowsy|dizziness after medicine|medicine concern)\b/i, ["medicationInteraction", "allergies", "latestSymptomReport"]),
  ], 1);

  const recentVitals = signal([
    ...matchSources(fields, /\S/i, ["latestVitals", "vitalsTrend"]),
  ], 0);

  const recentReport = signal([
    ...matchSources(fields, /\S/i, ["latestSymptomReport"]),
  ], 0);

  return {
    hasProfileContext: allSources.some((source) => hasText(fields[source])),
    risks: profileRiskFlags(memory),
    diabetes,
    respiratory,
    heartBp,
    fallBleed,
    medicationRisk,
    moodCognitive,
    kidney,
    immunosuppression,
    surgeryWound,
    strokeCognitiveParkinson,
    liver,
    uti,
    medicationAdherence,
    medicationInteraction,
    recentVitals,
    recentReport,
  };
}

function draft(
  item: Omit<DraftSuggestion, "source" | "score" | "reasonCode" | "priority"> & {
    signal: TriageProfileSignal;
    priority: number;
    source?: TriagePersonalizedSuggestion["source"];
    reasonCode?: TriageSuggestionReasonCode;
  },
): DraftSuggestion {
  return {
    ...item,
    source: item.source ?? sourceFor(item.signal),
    reasonCode: item.reasonCode ?? item.signal.reasonCode,
    score: scoreFor(item.signal, item.priority),
    priority: item.priority,
  };
}

function fallback(
  item: Omit<DraftSuggestion, "source" | "score" | "reasonCode">,
): DraftSuggestion {
  return {
    ...item,
    source: "fallback",
    reasonCode: "fallback",
    score: item.priority,
  };
}

const fallbackSuggestions: DraftSuggestion[] = [
  fallback({
    id: "fallback-breathing",
    kind: "common_concern",
    label: copy("Breathing feels different", "Respiro diferente", "Respiration differente", "Atmung anders", "Respiro diverso", "Respiracao diferente"),
    description: copy("Start with what changed and when.", "Empieza por que cambio y cuando.", "Commencez par ce qui a change et quand.", "Beginnen Sie mit dem, was sich geandert hat.", "Inizia da cosa e cambiato e quando.", "Comece pelo que mudou e quando."),
    initialClue: copy("Breathing feels different", "Respiro diferente", "Respiration feels different", "Atmung fuhlt sich anders an", "Respiro diverso", "Respiracao diferente"),
    tone: "blue",
    icon: "wind",
    priority: 45,
  }),
  fallback({
    id: "fallback-pain",
    kind: "common_concern",
    label: copy("Pain or headache", "Dolor o dolor de cabeza", "Douleur ou mal de tete", "Schmerz oder Kopfschmerz", "Dolore o mal di testa", "Dor ou dor de cabeca"),
    description: copy("Tell VYVA where it hurts.", "Di a VYVA donde duele.", "Dites a VYVA ou vous avez mal.", "Sagen Sie VYVA, wo es weh tut.", "Dici a VYVA dove fa male.", "Diga a VYVA onde doi."),
    initialClue: copy("Pain or headache", "Dolor o dolor de cabeza", "Douleur ou mal de tete", "Schmerz oder Kopfschmerz", "Dolore o mal di testa", "Dor ou dor de cabeca"),
    tone: "red",
    icon: "heart",
    priority: 44,
  }),
  fallback({
    id: "fallback-urine",
    kind: "common_concern",
    label: copy("Urine discomfort", "Molestia al orinar", "Gene urinaire", "Beschwerden beim Wasserlassen", "Fastidio urinario", "Desconforto urinario"),
    description: copy("Mention pain, smell, color, or frequency.", "Menciona dolor, olor, color o frecuencia.", "Mentionnez douleur, odeur, couleur ou frequence.", "Nennen Sie Schmerz, Geruch, Farbe oder Haufigkeit.", "Indica dolore, odore, colore o frequenza.", "Indique dor, cheiro, cor ou frequencia."),
    initialClue: copy("Pain when I pee", "Dolor al orinar", "Douleur en urinant", "Schmerz beim Wasserlassen", "Dolore quando faccio pipi", "Dor ao urinar"),
    tone: "amber",
    icon: "droplet",
    priority: 43,
  }),
  fallback({
    id: "fallback-vitals",
    kind: "health_improvement",
    label: copy("Check vitals", "Revisar constantes", "Verifier les constantes", "Vitalwerte prufen", "Controlla i parametri", "Verificar sinais vitais"),
    description: copy("Add a quick reading before or after the check.", "Anade una lectura rapida antes o despues.", "Ajoutez une mesure rapide avant ou apres.", "Fugen Sie vorher oder nachher einen kurzen Wert hinzu.", "Aggiungi una lettura rapida prima o dopo.", "Adicione uma leitura rapida antes ou depois."),
    route: "/health/vitals",
    tone: "blue",
    icon: "gauge",
    priority: 42,
  }),
  fallback({
    id: "fallback-checkin",
    kind: "health_improvement",
    label: copy("Daily check-in", "Control diario", "Controle quotidien", "Taglicher Check-in", "Check-in quotidiano", "Check-in diario"),
    description: copy("Log how today feels in one minute.", "Registra como te sientes hoy en un minuto.", "Notez comment vous vous sentez aujourd'hui en une minute.", "Halten Sie in einer Minute fest, wie es heute geht.", "Registra como va oggi in un minuto.", "Registe como se sente hoje num minuto."),
    route: "/health/check-in",
    tone: "green",
    icon: "activity",
    priority: 41,
  }),
  fallback({
    id: "fallback-doctor",
    kind: "health_improvement",
    label: copy("Ask doctor support", "Pedir ayuda medica", "Demander aide medicale", "Arzthilfe fragen", "Chiedi supporto medico", "Pedir apoio medico"),
    description: copy("Use profile context when you want guidance.", "Usa tu perfil cuando quieras orientacion.", "Utilisez le profil si vous voulez une orientation.", "Nutzen Sie Ihr Profil, wenn Sie Orientierung mochten.", "Usa il profilo quando vuoi orientamento.", "Use o perfil quando quiser orientacao."),
    route: "/health/doctor",
    tone: "purple",
    icon: "stethoscope",
    priority: 40,
  }),
];

function dedupeAndLimit(items: DraftSuggestion[], language: string): TriagePersonalizedSuggestion[] {
  const seen = new Set<string>();
  const sorted = [...items].sort((a, b) => b.score - a.score || b.priority - a.priority);
  const limited: DraftSuggestion[] = [];
  const laneCounts = { common_concern: 0, health_improvement: 0 };

  for (const item of sorted) {
    if (seen.has(item.id)) continue;
    const maxForLane = item.kind === "common_concern" ? MAX_CONCERNS : MAX_IMPROVEMENTS;
    if (laneCounts[item.kind] >= maxForLane) continue;
    seen.add(item.id);
    laneCounts[item.kind] += 1;
    limited.push(item);
  }

  return limited.map((item) => ({
    ...item,
    label: localize(item.label, language) ?? "",
    description: localize(item.description, language) ?? "",
    initialClue: localize(item.initialClue, language),
  }));
}

export function buildPersonalizedTriageSuggestions(
  memory: TriageHealthMemory | undefined,
  language = "en",
): TriagePersonalizedSuggestion[] {
  const signals = extractTriageProfileSignals(memory);
  const suggestions: DraftSuggestion[] = [];
  const add = (item: DraftSuggestion) => suggestions.push(item);

  if (signals.heartBp.active) {
    add(draft({
      signal: signals.heartBp,
      id: "heart-chest-pressure",
      kind: "common_concern",
      label: copy("Chest pressure or tightness", "Presion u opresion en pecho", "Pression ou oppression thoracique", "Druck oder Enge in der Brust", "Pressione o oppressione al petto", "Pressao ou aperto no peito"),
      description: copy("VYVA will check warning signs first.", "VYVA revisara senales de alerta primero.", "VYVA verifiera les signes d'alerte d'abord.", "VYVA pruft zuerst Warnzeichen.", "VYVA controllera prima i segnali di allarme.", "A VYVA verifica primeiro sinais de alerta."),
      initialClue: copy("Chest pressure or tightness", "Presion u opresion en el pecho", "Pression ou oppression dans la poitrine", "Druck oder Enge in der Brust", "Pressione o oppressione al petto", "Pressao ou aperto no peito"),
      tone: "red",
      icon: "heart",
      priority: 99,
    }));
    add(draft({
      signal: signals.heartBp,
      id: "heart-dizzy-faint",
      kind: "common_concern",
      label: copy("Dizzy or faint", "Mareo o desmayo", "Etourdi ou malaise", "Schwindel oder Ohnmacht", "Capogiro o svenimento", "Tontura ou desmaio"),
      description: copy("Relevant when circulation or rhythm may be involved.", "Relevante si puede influir circulacion o ritmo.", "Pertinent si circulation ou rythme peuvent jouer.", "Relevant, wenn Kreislauf oder Rhythmus beteiligt sein kann.", "Rilevante se circolazione o ritmo possono contare.", "Relevante se circulacao ou ritmo podem influenciar."),
      initialClue: copy("I feel dizzy or faint", "Me siento mareado o como si fuera a desmayarme", "Je me sens etourdi ou proche du malaise", "Mir ist schwindlig oder ich werde ohnmachtig", "Mi sento stordito o quasi svenire", "Sinto tontura ou quase desmaio"),
      tone: "amber",
      icon: "activity",
      priority: 91,
    }));
    add(draft({
      signal: signals.heartBp,
      id: "heart-bp-check",
      kind: "health_improvement",
      label: copy("Check pressure reading", "Revisar lectura de presion", "Verifier la tension", "Druckwert prufen", "Controlla la pressione", "Verificar leitura da pressao"),
      description: copy("Add a current reading before deciding next steps.", "Anade una lectura actual antes de decidir.", "Ajoutez une mesure actuelle avant de decider.", "Fugen Sie vor der Entscheidung einen aktuellen Wert hinzu.", "Aggiungi una lettura attuale prima di decidere.", "Adicione uma leitura atual antes de decidir."),
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      priority: 90,
    }));
  }

  if (signals.respiratory.active) {
    add(draft({
      signal: signals.respiratory,
      id: "breathing-harder",
      kind: "common_concern",
      label: copy("Breathing harder than usual", "Respirar peor de lo habitual", "Respirer plus difficilement", "Atmen schwerer als ublich", "Respiro piu difficile del solito", "Respirar pior que o habitual"),
      description: copy("Start with what changed and how quickly.", "Empieza por que cambio y con que rapidez.", "Commencez par ce qui a change et a quelle vitesse.", "Beginnen Sie damit, was sich wie schnell geandert hat.", "Inizia da cosa e cambiato e quanto in fretta.", "Comece pelo que mudou e com que rapidez."),
      initialClue: copy("Breathing is harder than usual", "Me cuesta respirar mas de lo habitual", "Respirer est plus difficile que d'habitude", "Atmen ist schwerer als ublich", "Respirare e piu difficile del solito", "Respirar esta mais dificil que o habitual"),
      tone: "blue",
      icon: "wind",
      priority: 98,
    }));
    add(draft({
      signal: signals.respiratory,
      id: "breathing-check",
      kind: "health_improvement",
      label: copy("Breathing check", "Revisar respiracion", "Controle respiration", "Atmung prufen", "Controllo respiro", "Verificar respiracao"),
      description: copy("Capture a breathing or oxygen reading if available.", "Registra respiracion u oxigeno si puedes.", "Notez respiration ou oxygene si possible.", "Erfassen Sie Atmung oder Sauerstoff, falls moglich.", "Registra respiro o ossigeno se puoi.", "Registe respiracao ou oxigenio se puder."),
      route: "/health/vitals",
      tone: "blue",
      icon: "wind",
      priority: 92,
    }));
  }

  if (signals.fallBleed.active) {
    add(draft({
      signal: signals.fallBleed,
      id: "fall-or-injury",
      kind: "common_concern",
      label: copy("Fall or new injury", "Caida o lesion nueva", "Chute ou blessure recente", "Sturz oder neue Verletzung", "Caduta o nuova lesione", "Queda ou nova lesao"),
      description: copy("Tell VYVA what happened and what hurts.", "Di que paso y que duele.", "Dites ce qui s'est passe et ce qui fait mal.", "Sagen Sie, was passiert ist und was weh tut.", "Dici cosa e successo e cosa fa male.", "Diga o que aconteceu e o que doi."),
      initialClue: copy("I fell or hurt myself", "Me cai o me hice dano", "Je suis tombe ou blesse", "Ich bin gesturzt oder verletzt", "Sono caduto o mi sono fatto male", "Cai ou magoei-me"),
      tone: "red",
      icon: "shield",
      priority: 97,
    }));
    add(draft({
      signal: signals.fallBleed,
      id: "bruise-bleeding",
      kind: "common_concern",
      label: copy("Bruise or bleeding", "Moraton o sangrado", "Bleu ou saignement", "Bluterguss oder Blutung", "Livido o sanguinamento", "Nodoa negra ou sangramento"),
      description: copy("Mention size, timing, and whether it is spreading.", "Menciona tamano, momento y si se extiende.", "Mentionnez taille, moment et propagation.", "Nennen Sie Grosse, Zeitpunkt und Ausbreitung.", "Indica dimensione, tempo e se si estende.", "Indique tamanho, momento e se aumenta."),
      initialClue: copy("Bruise or bleeding concern", "Preocupacion por moraton o sangrado", "Question sur bleu ou saignement", "Sorge wegen Bluterguss oder Blutung", "Preoccupazione per livido o sanguinamento", "Preocupacao com nodoa negra ou sangramento"),
      tone: "amber",
      icon: "shield",
      priority: 89,
    }));
    add(draft({
      signal: signals.fallBleed,
      id: "safe-home-review",
      kind: "health_improvement",
      label: copy("Review home safety", "Revisar seguridad en casa", "Verifier securite maison", "Zuhause Sicherheit prufen", "Rivedi sicurezza in casa", "Rever seguranca em casa"),
      description: copy("Scan a room for trip or fall risks.", "Escanea una habitacion por riesgo de caidas.", "Scannez une piece pour les risques de chute.", "Scannen Sie einen Raum auf Stolperrisiken.", "Scansiona una stanza per rischi di caduta.", "Analise uma divisao por riscos de queda."),
      route: "/safe-home",
      tone: "green",
      icon: "home",
      priority: 88,
    }));
  }

  if (signals.diabetes.active) {
    add(draft({
      signal: signals.diabetes,
      id: "diabetes-urine",
      kind: "common_concern",
      label: copy("Urine pain or urgency", "Dolor o urgencia al orinar", "Douleur ou urgence urinaire", "Schmerz oder Harndrang", "Dolore o urgenza urinaria", "Dor ou urgencia urinaria"),
      description: copy("Mention pain, frequency, smell, or color.", "Menciona dolor, frecuencia, olor o color.", "Mentionnez douleur, frequence, odeur ou couleur.", "Nennen Sie Schmerz, Haufigkeit, Geruch oder Farbe.", "Indica dolore, frequenza, odore o colore.", "Indique dor, frequencia, cheiro ou cor."),
      initialClue: copy("Pain or urgency when I pee", "Dolor o urgencia al orinar", "Douleur ou urgence en urinant", "Schmerz oder Drang beim Wasserlassen", "Dolore o urgenza quando urino", "Dor ou urgencia ao urinar"),
      tone: "amber",
      icon: "droplet",
      priority: 96,
    }));
    add(draft({
      signal: signals.diabetes,
      id: "diabetes-dizzy",
      kind: "common_concern",
      label: copy("Dizzy or shaky", "Mareo o temblor", "Etourdi ou tremblant", "Schwindlig oder zittrig", "Capogiro o tremore", "Tonturas ou tremores"),
      description: copy("Tell VYVA if food, medicine, or readings may be involved.", "Di si comida, medicacion o lecturas pueden influir.", "Dites si repas, medicament ou mesures peuvent jouer.", "Sagen Sie, ob Essen, Medizin oder Werte beteiligt sein konnen.", "Dici se cibo, farmaci o letture possono contare.", "Diga se comida, medicacao ou leituras podem influenciar."),
      initialClue: copy("I feel dizzy or shaky", "Me siento mareado o tembloroso", "Je me sens etourdi ou tremblant", "Mir ist schwindlig oder zittrig", "Mi sento stordito o tremante", "Sinto tonturas ou tremores"),
      tone: "amber",
      icon: "activity",
      priority: 94,
    }));
    add(draft({
      signal: signals.diabetes,
      id: "diabetes-glucose-check",
      kind: "health_improvement",
      label: copy("Check key reading", "Revisar lectura clave", "Verifier une mesure cle", "Wichtigen Wert prufen", "Controlla lettura chiave", "Verificar leitura-chave"),
      description: copy("Add a current reading so the report has better context.", "Anade una lectura actual para dar mas contexto.", "Ajoutez une mesure actuelle pour plus de contexte.", "Fugen Sie einen aktuellen Wert fur mehr Kontext hinzu.", "Aggiungi una lettura attuale per piu contesto.", "Adicione uma leitura atual para mais contexto."),
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      priority: 93,
    }));
  }

  if (signals.kidney.active) {
    add(draft({
      signal: signals.kidney,
      id: "kidney-urine-change",
      kind: "common_concern",
      label: copy("Urine or swelling change", "Cambio en orina o hinchazon", "Changement urine ou gonflement", "Urin- oder Schwellungsanderung", "Cambio urine o gonfiore", "Mudanca em urina ou inchaco"),
      description: copy("Mention swelling, urine changes, weight, or breath.", "Menciona hinchazon, orina, peso o respiracion.", "Mentionnez gonflement, urine, poids ou souffle.", "Nennen Sie Schwellung, Urin, Gewicht oder Atmung.", "Indica gonfiore, urine, peso o respiro.", "Indique inchaco, urina, peso ou respiracao."),
      initialClue: copy("Urine or swelling change", "Cambio en orina o hinchazon", "Changement urine ou gonflement", "Urin- oder Schwellungsanderung", "Cambio urine o gonfiore", "Mudanca em urina ou inchaco"),
      tone: "amber",
      icon: "droplet",
      priority: 88,
    }));
    add(draft({
      signal: signals.kidney,
      id: "kidney-hydration-vitals",
      kind: "health_improvement",
      label: copy("Review fluids and vitals", "Revisar liquidos y constantes", "Revoir liquides et constantes", "Flussigkeit und Werte prufen", "Rivedi liquidi e parametri", "Rever liquidos e sinais"),
      description: copy("Capture a reading and compare it with how you feel.", "Registra una lectura y comparala con como te sientes.", "Notez une mesure et comparez avec votre ressenti.", "Erfassen Sie einen Wert und vergleichen Sie ihn mit Ihrem Gefuhl.", "Registra una lettura e confrontala con come ti senti.", "Registe uma leitura e compare com como se sente."),
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      priority: 74,
    }));
  }

  if (signals.immunosuppression.active) {
    add(draft({
      signal: signals.immunosuppression,
      id: "immune-fever-infection",
      kind: "common_concern",
      label: copy("Fever or infection concern", "Fiebre o posible infeccion", "Fievre ou infection possible", "Fieber oder Infektionssorge", "Febbre o possibile infezione", "Febre ou possivel infeccao"),
      description: copy("VYVA will ask safety questions early.", "VYVA hara preguntas de seguridad pronto.", "VYVA posera vite des questions de securite.", "VYVA stellt fruh Sicherheitsfragen.", "VYVA fara presto domande di sicurezza.", "A VYVA fara cedo perguntas de seguranca."),
      initialClue: copy("Fever or infection concern", "Fiebre o posible infeccion", "Fievre ou infection possible", "Fieber oder Infektionssorge", "Febbre o possibile infezione", "Febre ou possivel infeccao"),
      tone: "red",
      icon: "shield",
      priority: 95,
    }));
    add(draft({
      signal: signals.immunosuppression,
      id: "immune-doctor-context",
      kind: "health_improvement",
      label: copy("Prepare doctor context", "Preparar contexto medico", "Preparer le contexte medical", "Arztkontext vorbereiten", "Prepara contesto medico", "Preparar contexto medico"),
      description: copy("Use profile and reports before asking for help.", "Usa perfil e informes antes de pedir ayuda.", "Utilisez profil et rapports avant de demander aide.", "Nutzen Sie Profil und Berichte vor Hilfe.", "Usa profilo e report prima di chiedere aiuto.", "Use perfil e relatorios antes de pedir ajuda."),
      route: "/health/doctor",
      tone: "purple",
      icon: "stethoscope",
      priority: 84,
    }));
  }

  if (signals.surgeryWound.active) {
    add(draft({
      signal: signals.surgeryWound,
      id: "wound-change",
      kind: "common_concern",
      label: copy("Wound or skin change", "Cambio en herida o piel", "Changement plaie ou peau", "Wund- oder Hautanderung", "Cambio ferita o pelle", "Mudanca em ferida ou pele"),
      description: copy("Mention redness, warmth, drainage, or new pain.", "Menciona enrojecimiento, calor, drenaje o dolor nuevo.", "Mentionnez rougeur, chaleur, ecoulement ou douleur.", "Nennen Sie Rotung, Warme, Ausfluss oder neuen Schmerz.", "Indica rossore, calore, drenaggio o nuovo dolore.", "Indique vermelhidao, calor, drenagem ou nova dor."),
      initialClue: copy("Wound or skin change", "Cambio en herida o piel", "Changement plaie ou peau", "Wund- oder Hautanderung", "Cambio ferita o pelle", "Mudanca em ferida ou pele"),
      tone: "red",
      icon: "shield",
      priority: 86,
    }));
  }

  if (signals.strokeCognitiveParkinson.active) {
    add(draft({
      signal: signals.strokeCognitiveParkinson,
      id: "neuro-weak-speech",
      kind: "common_concern",
      label: copy("Weakness or speech change", "Debilidad o cambio al hablar", "Faiblesse ou parole changee", "Schwache oder Sprachanderung", "Debolezza o cambio nel parlare", "Fraqueza ou fala alterada"),
      description: copy("VYVA will check urgent warning signs first.", "VYVA revisara primero senales urgentes.", "VYVA verifiera d'abord les signes urgents.", "VYVA pruft zuerst dringende Warnzeichen.", "VYVA controllera prima segnali urgenti.", "A VYVA verifica primeiro sinais urgentes."),
      initialClue: copy("Weakness or speech change", "Debilidad o cambio al hablar", "Faiblesse ou parole changee", "Schwache oder Sprachanderung", "Debolezza o cambio nel parlare", "Fraqueza ou fala alterada"),
      tone: "red",
      icon: "brain",
      priority: 96,
    }));
    add(draft({
      signal: signals.strokeCognitiveParkinson,
      id: "support-safe-home",
      kind: "health_improvement",
      label: copy("Review support at home", "Revisar apoyo en casa", "Revoir le soutien a domicile", "Unterstutzung zuhause prufen", "Rivedi supporto a casa", "Rever apoio em casa"),
      description: copy("Check home setup or support needs.", "Revisa la casa o necesidades de apoyo.", "Verifiez l'installation ou les besoins d'aide.", "Prufen Sie Zuhause und Hilfebedarf.", "Controlla casa o bisogni di supporto.", "Verifique casa ou necessidades de apoio."),
      route: "/safe-home",
      tone: "green",
      icon: "home",
      priority: 76,
    }));
  }

  if (signals.liver.active) {
    add(draft({
      signal: signals.liver,
      id: "liver-swelling-confusion",
      kind: "common_concern",
      label: copy("Swelling or confusion", "Hinchazon o confusion", "Gonflement ou confusion", "Schwellung oder Verwirrung", "Gonfiore o confusione", "Inchaco ou confusao"),
      description: copy("Mention belly swelling, yellowing, sleepiness, or confusion.", "Menciona hinchazon, color amarillo, sueno o confusion.", "Mentionnez gonflement, jaunissement, somnolence ou confusion.", "Nennen Sie Schwellung, Gelbfarbung, Schlafrigkeit oder Verwirrung.", "Indica gonfiore, giallo, sonnolenza o confusione.", "Indique inchaco, amarelecimento, sono ou confusao."),
      initialClue: copy("Swelling or confusion", "Hinchazon o confusion", "Gonflement ou confusion", "Schwellung oder Verwirrung", "Gonfiore o confusione", "Inchaco ou confusao"),
      tone: "amber",
      icon: "activity",
      priority: 87,
    }));
    add(draft({
      signal: signals.liver,
      id: "liver-med-doctor-review",
      kind: "health_improvement",
      label: copy("Review medicines with doctor", "Revisar medicacion con medico", "Revoir medicaments avec medecin", "Medikamente mit Arzt prufen", "Rivedi farmaci con medico", "Rever medicacao com medico"),
      description: copy("Prepare the current profile context before asking.", "Prepara el contexto actual antes de pedir ayuda.", "Preparez le contexte actuel avant de demander.", "Bereiten Sie den aktuellen Kontext vor.", "Prepara il contesto attuale prima di chiedere.", "Prepare o contexto atual antes de pedir ajuda."),
      route: "/health/doctor",
      tone: "purple",
      icon: "stethoscope",
      priority: 73,
    }));
  }

  if (signals.uti.active) {
    add(draft({
      signal: signals.uti,
      id: "uti-urine-discomfort",
      kind: "common_concern",
      label: copy("Urine discomfort", "Molestia al orinar", "Gene urinaire", "Beschwerden beim Wasserlassen", "Fastidio urinario", "Desconforto urinario"),
      description: copy("Mention pain, urgency, fever, or new weakness.", "Menciona dolor, urgencia, fiebre o nueva debilidad.", "Mentionnez douleur, urgence, fievre ou faiblesse.", "Nennen Sie Schmerz, Drang, Fieber oder neue Schwache.", "Indica dolore, urgenza, febbre o nuova debolezza.", "Indique dor, urgencia, febre ou nova fraqueza."),
      initialClue: copy("Urine discomfort", "Molestia al orinar", "Gene urinaire", "Beschwerden beim Wasserlassen", "Fastidio urinario", "Desconforto urinario"),
      tone: "amber",
      icon: "droplet",
      priority: 92,
    }));
    add(draft({
      signal: signals.uti,
      id: "uti-confusion-weakness",
      kind: "common_concern",
      label: copy("New weakness or confusion", "Nueva debilidad o confusion", "Nouvelle faiblesse ou confusion", "Neue Schwache oder Verwirrung", "Nuova debolezza o confusione", "Nova fraqueza ou confusao"),
      description: copy("VYVA will ask safety questions first.", "VYVA hara preguntas de seguridad primero.", "VYVA posera d'abord des questions de securite.", "VYVA stellt zuerst Sicherheitsfragen.", "VYVA fara prima domande di sicurezza.", "A VYVA fara primeiro perguntas de seguranca."),
      initialClue: copy("New weakness or confusion", "Nueva debilidad o confusion", "Nouvelle faiblesse ou confusion", "Neue Schwache oder Verwirrung", "Nuova debolezza o confusione", "Nova fraqueza ou confusao"),
      tone: "red",
      icon: "brain",
      priority: 89,
    }));
  }

  if (signals.medicationRisk.active || signals.medicationInteraction.active) {
    const medicationSignal = signals.medicationInteraction.active ? signals.medicationInteraction : signals.medicationRisk;
    add(draft({
      signal: medicationSignal,
      id: "med-side-effect",
      kind: "common_concern",
      label: copy("Possible side effect", "Posible efecto secundario", "Effet secondaire possible", "Mogliche Nebenwirkung", "Possibile effetto collaterale", "Possivel efeito secundario"),
      description: copy("Mention what changed and when it started.", "Menciona que cambio y cuando empezo.", "Mentionnez ce qui a change et quand.", "Nennen Sie, was sich wann geandert hat.", "Indica cosa e cambiato e quando.", "Indique o que mudou e quando comecou."),
      initialClue: copy("Possible medication side effect", "Posible efecto secundario de medicamento", "Effet secondaire possible d'un medicament", "Mogliche Medikamenten-Nebenwirkung", "Possibile effetto collaterale del farmaco", "Possivel efeito secundario de medicamento"),
      tone: "purple",
      icon: "pill",
      priority: 87,
      source: "medications",
      reasonCode: "medicine_match",
    }));
    add(draft({
      signal: medicationSignal,
      id: "med-weak-tired",
      kind: "common_concern",
      label: copy("Weak or very tired", "Debilidad o mucho cansancio", "Faible ou tres fatigue", "Schwach oder sehr mude", "Debole o molto stanco", "Fraco ou muito cansado"),
      description: copy("Helpful if timing, dose, or sleep has changed.", "Util si cambiaron horarios, dosis o sueno.", "Utile si horaires, dose ou sommeil ont change.", "Hilfreich, wenn Zeit, Dosis oder Schlaf anders sind.", "Utile se orario, dose o sonno sono cambiati.", "Util se horario, dose ou sono mudaram."),
      initialClue: copy("I feel weak or very tired", "Me siento debil o muy cansado", "Je me sens faible ou tres fatigue", "Ich fuhle mich schwach oder sehr mude", "Mi sento debole o molto stanco", "Sinto-me fraco ou muito cansado"),
      tone: "amber",
      icon: "activity",
      priority: 86,
      source: "medications",
      reasonCode: "medicine_match",
    }));
    add(draft({
      signal: medicationSignal,
      id: "med-review",
      kind: "health_improvement",
      label: copy("Medication review", "Revisar medicacion", "Revue des medicaments", "Medikamente prufen", "Revisione farmaci", "Rever medicacao"),
      description: copy("Check dose, timing, missed doses, or refills.", "Revisa dosis, horarios, olvidos o reposicion.", "Verifiez dose, horaires, oublis ou renouvellement.", "Prufen Sie Dosis, Zeiten, Ausfalle oder Nachschub.", "Controlla dose, orari, dimenticanze o rifornimenti.", "Verifique dose, horarios, falhas ou renovacoes."),
      route: "/meds",
      tone: "purple",
      icon: "pill",
      priority: 85,
      source: "medications",
      reasonCode: "medicine_match",
    }));
  }

  if (signals.medicationAdherence.active) {
    add(draft({
      signal: signals.medicationAdherence,
      id: "med-missed-dose",
      kind: "common_concern",
      label: copy("Missed dose concern", "Duda por dosis olvidada", "Dose oubliee", "Ausgelassene Dosis", "Dose dimenticata", "Dose esquecida"),
      description: copy("Tell VYVA what happened before changing anything.", "Di a VYVA que paso antes de cambiar nada.", "Dites a VYVA ce qui s'est passe avant de changer.", "Sagen Sie VYVA, was passiert ist, bevor Sie etwas andern.", "Dici a VYVA cosa e successo prima di cambiare.", "Diga a VYVA o que aconteceu antes de mudar algo."),
      initialClue: copy("Missed dose concern", "Duda por dosis olvidada", "Dose oubliee", "Ausgelassene Dosis", "Dose dimenticata", "Dose esquecida"),
      tone: "purple",
      icon: "pill",
      priority: 84,
      source: "medications",
      reasonCode: "medicine_match",
    }));
    add(draft({
      signal: signals.medicationAdherence,
      id: "med-refill-help",
      kind: "health_improvement",
      label: copy("Refill or dose help", "Ayuda con dosis o reposicion", "Aide dose ou renouvellement", "Hilfe bei Dosis oder Nachschub", "Aiuto dose o rifornimento", "Ajuda com dose ou renovacao"),
      description: copy("Open medicines to review what is due.", "Abre medicacion para revisar lo pendiente.", "Ouvrez medicaments pour verifier.", "Offnen Sie Medikamente zur Prufung.", "Apri medicine per verificare.", "Abra medicacao para verificar."),
      route: "/meds",
      tone: "purple",
      icon: "pill",
      priority: 82,
      source: "medications",
      reasonCode: "medicine_match",
    }));
  }

  if (signals.moodCognitive.active) {
    add(draft({
      signal: signals.moodCognitive,
      id: "mood-anxiety",
      kind: "common_concern",
      label: copy("Anxious or low mood", "Ansiedad o bajo animo", "Anxiete ou moral bas", "Angstlich oder niedergeschlagen", "Ansia o umore basso", "Ansiedade ou baixo animo"),
      description: copy("Start with how long it has felt this way.", "Empieza por cuanto tiempo llevas asi.", "Commencez par depuis quand cela dure.", "Beginnen Sie damit, wie lange es so ist.", "Inizia da quanto dura.", "Comece por ha quanto tempo se sente assim."),
      initialClue: copy("I feel anxious or low", "Me siento ansioso o bajo de animo", "Je me sens anxieux ou bas", "Ich fuhle mich angstlich oder niedergeschlagen", "Mi sento ansioso o giu", "Sinto ansiedade ou baixo animo"),
      tone: "purple",
      icon: "brain",
      priority: 84,
    }));
    add(draft({
      signal: signals.moodCognitive,
      id: "confusion-memory",
      kind: "common_concern",
      label: copy("Confusion or memory change", "Confusion o cambio de memoria", "Confusion ou memoire changee", "Verwirrung oder Gedachtnisanderung", "Confusione o memoria cambiata", "Confusao ou mudanca de memoria"),
      description: copy("VYVA will ask safety questions first.", "VYVA hara preguntas de seguridad primero.", "VYVA posera d'abord des questions de securite.", "VYVA stellt zuerst Sicherheitsfragen.", "VYVA fara prima domande di sicurezza.", "A VYVA fara primeiro perguntas de seguranca."),
      initialClue: copy("New confusion or memory change", "Nueva confusion o cambio de memoria", "Nouvelle confusion ou changement de memoire", "Neue Verwirrung oder Gedachtnisanderung", "Nuova confusione o cambio di memoria", "Nova confusao ou mudanca de memoria"),
      tone: "red",
      icon: "brain",
      priority: 83,
    }));
    add(draft({
      signal: signals.moodCognitive,
      id: "daily-checkin",
      kind: "health_improvement",
      label: copy("Daily wellbeing check", "Control diario de bienestar", "Controle bien-etre quotidien", "Taglicher Wohlbefinden-Check", "Controllo benessere quotidiano", "Check-in diario de bem-estar"),
      description: copy("Record mood, energy, and support needs.", "Registra animo, energia y apoyo.", "Notez humeur, energie et besoins.", "Halten Sie Stimmung, Energie und Hilfe fest.", "Registra umore, energia e bisogni.", "Registe humor, energia e apoio."),
      route: "/health/check-in",
      tone: "green",
      icon: "activity",
      priority: 82,
    }));
  }

  if (signals.recentReport.active) {
    add(draft({
      signal: signals.recentReport,
      id: "recent-symptom-followup",
      kind: "common_concern",
      label: copy("Follow up recent symptom", "Seguir sintoma reciente", "Suivre un symptome recent", "Neues Symptom nachverfolgen", "Segui sintomo recente", "Acompanhar sintoma recente"),
      description: copy("Continue from your latest VYVA report.", "Continua desde tu ultimo informe VYVA.", "Continuez depuis votre dernier rapport VYVA.", "Machen Sie mit dem letzten VYVA-Bericht weiter.", "Continua dall'ultimo report VYVA.", "Continue a partir do ultimo relatorio VYVA."),
      initialClue: copy("Follow up my recent symptom", "Seguir mi sintoma reciente", "Suivre mon symptome recent", "Mein letztes Symptom nachverfolgen", "Seguire il mio sintomo recente", "Acompanhar o meu sintoma recente"),
      tone: "purple",
      icon: "stethoscope",
      priority: 80,
      source: "recent_report",
      reasonCode: "recent_report",
    }));
    add(draft({
      signal: signals.recentReport,
      id: "doctor-followup",
      kind: "health_improvement",
      label: copy("Prepare doctor context", "Preparar contexto medico", "Preparer le contexte medical", "Arztkontext vorbereiten", "Prepara contesto medico", "Preparar contexto medico"),
      description: copy("Use profile and reports before asking for help.", "Usa perfil e informes antes de pedir ayuda.", "Utilisez profil et rapports avant de demander aide.", "Nutzen Sie Profil und Berichte vor Hilfe.", "Usa profilo e report prima di chiedere aiuto.", "Use perfil e relatorios antes de pedir ajuda."),
      route: "/health/doctor",
      tone: "purple",
      icon: "stethoscope",
      priority: 79,
      source: "recent_report",
      reasonCode: "recent_report",
    }));
  }

  if (signals.recentVitals.active) {
    add(draft({
      signal: signals.recentVitals,
      id: "recent-vitals-change",
      kind: "health_improvement",
      label: copy("Review latest vitals", "Revisar ultimas constantes", "Revoir dernieres constantes", "Letzte Vitalwerte prufen", "Rivedi ultimi parametri", "Rever ultimos sinais"),
      description: copy("Compare how you feel with the latest reading.", "Compara como te sientes con la ultima lectura.", "Comparez votre ressenti avec la derniere mesure.", "Vergleichen Sie Gefuhl und letzten Wert.", "Confronta come ti senti con l'ultima lettura.", "Compare como se sente com a ultima leitura."),
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      priority: 78,
      source: "vitals",
      reasonCode: "recent_vitals",
    }));
  }

  if (!signals.hasProfileContext || suggestions.length === 0) {
    suggestions.push(...fallbackSuggestions);
  } else {
    suggestions.push(...fallbackSuggestions.filter((item) => item.kind === "health_improvement").map((item) => ({
      ...item,
      priority: item.priority - 25,
      score: item.score - 25,
    })));
  }

  return dedupeAndLimit(suggestions, language);
}
