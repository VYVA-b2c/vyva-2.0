import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, Bell, Check, HeartPulse, Loader2, Moon, PhoneCall, Pill, Plus, RefreshCw, Scale, Share2, ShieldCheck, Smile, Sparkles, Stethoscope, Thermometer, Wind, Zap } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";

type Language = "es" | "de" | "en" | "fr" | "it" | "pt";
type Screen = "dashboard" | "add";
type SignalKey = keyof typeof SIGNAL_CONFIG;

interface Props {
  userId: string;
  userConditions: string[];
  language?: Language;
}

interface LatestAnalysis {
  id?: string | null;
  analysed_at?: string | null;
  safety_status?: SafetyStatus | null;
  recommended_action?: SafetyStatus | string | null;
  risk_score?: number | null;
  risk_tier?: string | null;
  senior_message?: string | null;
  caregiver_note?: string | null;
  acknowledged_action?: string | null;
  acknowledged_at?: string | null;
  rule_version?: string | null;
  model_version?: string | null;
}

type SafetyStatus = "steady" | "recheck" | "share_with_caregiver" | "contact_doctor" | "urgent_help";

interface LatestAlert {
  id: string;
  severity: string;
  message: string;
  created_at?: string | null;
  resolved_at?: string | null;
}

interface RecentReading {
  signal_type: string;
  value: string | number;
  recorded_at: string;
  source: string;
  source_confidence?: "low" | "medium" | "high";
  source_confidence_reason?: string;
  source_display_label?: string;
  source_context_label?: string;
  deviation_pct: string | number | null;
  context_tag: string | null;
}

interface LatestResponse {
  analysis: LatestAnalysis | null;
  recent_readings: RecentReading[];
  latest_alert?: LatestAlert | null;
}

const COPY = {
  es: {
    logo: "VYVA",
    add: "Añadir dato",
    analyse: "Analizar ahora",
    analysing: "Analizando...",
    loading: "Preparando tus signos...",
    back: "Volver",
    save: "Guardar dato",
    saving: "Guardando...",
    lastAnalysis: "Último análisis",
    noAnalysis: "Sin análisis todavía",
    now: "Ahora",
    normal: "Normal",
    today: "Hoy",
    yes: "Sí, tomada",
    no: "No todavía",
    valuePlaceholder: "142",
    messageFallback: "Buenos días. VYVA está lista para revisar tus señales contigo.",
    safetyTitle: "Chequeo diario",
    safetyAck: "Guardado",
    recheck: "Repetir",
    share: "Compartir",
    doctor: "Medico",
    urgent: "Urgente",
    sourceEstimated: "Estimado",
    sourceManual: "Manual",
    sourceDevice: "Dispositivo",
    confidenceLow: "Baja",
    confidenceMedium: "Media",
    confidenceHigh: "Alta",
    evidenceTitle: "Calidad de los datos",
    evidenceBody: "VYVA combina estimaciones del telefono con datos que introduces de dispositivos. Las estimaciones ayudan con tendencias; los dispositivos y lecturas clinicas pesan mas.",
    evidencePhone: "Telefono: pulso y respiracion estimados",
    evidenceManual: "Manual: dolor, animo, energia y medicacion",
    evidenceDevice: "Dispositivo: oxigeno, temperatura, tension, glucosa y peso",
    addEvidenceNote: "Introduce el numero tal como aparece en tu dispositivo, o registra como te sientes. Esto ayuda a VYVA a refinar la evaluacion.",
    sourceClinical: "ClÃ­nico",
  },
  de: {
    logo: "VYVA",
    add: "Wert hinzufügen",
    analyse: "Jetzt analysieren",
    analysing: "Analysiere...",
    loading: "Werte werden vorbereitet...",
    back: "Zurück",
    save: "Wert speichern",
    saving: "Speichern...",
    lastAnalysis: "Letzte Analyse",
    noAnalysis: "Noch keine Analyse",
    now: "Jetzt",
    normal: "Normal",
    today: "Heute",
    yes: "Ja, genommen",
    no: "Noch nicht",
    valuePlaceholder: "142",
    messageFallback: "Guten Morgen. VYVA ist bereit, deine Werte mit dir anzusehen.",
    safetyTitle: "Taglicher Check",
    safetyAck: "Gespeichert",
    recheck: "Erneut prufen",
    share: "Teilen",
    doctor: "Arzt",
    urgent: "Dringend",
    sourceEstimated: "Geschatzt",
    sourceManual: "Manuell",
    sourceDevice: "Gerat",
    confidenceLow: "Niedrig",
    confidenceMedium: "Mittel",
    confidenceHigh: "Hoch",
    evidenceTitle: "Datenqualitat",
    evidenceBody: "VYVA kombiniert Telefonschatzungen mit Werten, die Sie von Geraten eingeben. Schatzungen helfen bei Trends; Gerate- und klinische Werte zahlen starker.",
    evidencePhone: "Telefon: geschatzter Puls und Atmung",
    evidenceManual: "Manuell: Schmerz, Stimmung, Energie und Medikamente",
    evidenceDevice: "Gerat: Sauerstoff, Temperatur, Blutdruck, Glukose und Gewicht",
    addEvidenceNote: "Geben Sie den Wert so ein, wie er auf dem Gerat steht, oder erfassen Sie, wie Sie sich fuhlen. Das hilft VYVA, die Einschatzung zu verfeinern.",
    sourceClinical: "Klinisch",
  },
  en: {
    logo: "VYVA",
    add: "Add reading",
    analyse: "Analyse now",
    analysing: "Analysing...",
    loading: "Preparing your vitals...",
    back: "Back",
    save: "Save reading",
    saving: "Saving...",
    lastAnalysis: "Last analysis",
    noAnalysis: "No analysis yet",
    now: "Now",
    normal: "Normal",
    today: "Today",
    yes: "Yes, taken",
    no: "Not yet",
    valuePlaceholder: "142",
    messageFallback: "Good morning. VYVA is ready to review your signals with you.",
    safetyTitle: "Daily safety check",
    safetyAck: "Recorded",
    recheck: "Recheck",
    share: "Share",
    doctor: "Doctor",
    urgent: "Urgent",
    sourceEstimated: "Estimated",
    sourceManual: "Manual",
    sourceDevice: "Device",
    confidenceLow: "Low",
    confidenceMedium: "Medium",
    confidenceHigh: "High",
    evidenceTitle: "Reading quality",
    evidenceBody: "VYVA combines phone estimates with numbers you enter from devices. Estimates help spot trends; device and clinical readings carry stronger weight.",
    evidencePhone: "Phone: estimated pulse and breathing",
    evidenceManual: "Manual: pain, mood, energy and medication",
    evidenceDevice: "Device: oxygen, temperature, blood pressure, glucose and weight",
    addEvidenceNote: "Enter the number exactly as it appears on your device, or record how you feel. This helps VYVA refine the assessment.",
    sourceClinical: "Clinical",
  },
};

type LocalizedText = Partial<Record<Language, string>>;

interface ExtraTrackerCopy {
  loadError: string;
  saveError: string;
  analysisError: string;
  actionError: string;
  checkConnectedSensor: string;
  manualGlucoseEntry: string;
  connectedGlucoseHelp: string;
  manualGlucoseHelp: string;
  whenReading: string;
  ok: string;
}

const COPY_BASE: Partial<Record<Language, typeof COPY.en>> = COPY;

const COPY_OVERRIDES: Record<Language, Partial<typeof COPY.en> & ExtraTrackerCopy> = {
  es: {
    loadError: "No pude cargar tus signos ahora.",
    saveError: "No pude guardar este dato.",
    analysisError: "El analisis no se pudo completar.",
    actionError: "No pude guardar esta accion.",
    checkConnectedSensor: "Buscar sensor conectado",
    manualGlucoseEntry: "Entrada manual de glucosa",
    connectedGlucoseHelp: "Si no hay lectura automatica disponible, introduce el numero del glucometro aqui.",
    manualGlucoseHelp: "Escribe el numero del glucometro para guardarlo con tus signos.",
    whenReading: "Cuando fue esta medicion?",
    ok: "OK",
  },
  de: {
    loadError: "Vitalwerte konnten gerade nicht geladen werden.",
    saveError: "Dieser Wert konnte nicht gespeichert werden.",
    analysisError: "Die Analyse konnte nicht abgeschlossen werden.",
    actionError: "Diese Aktion konnte nicht gespeichert werden.",
    checkConnectedSensor: "Verbundenen Sensor prufen",
    manualGlucoseEntry: "Manuelle Glukoseeingabe",
    connectedGlucoseHelp: "Wenn kein automatischer Wert verfugbar ist, geben Sie den Wert vom Glukosemessgerat hier ein.",
    manualGlucoseHelp: "Geben Sie den Wert vom Glukosemessgerat ein, um ihn mit Ihren Vitalwerten zu speichern.",
    whenReading: "Wann war diese Messung?",
    ok: "OK",
  },
  en: {
    loadError: "Could not load vitals right now.",
    saveError: "Could not save this reading.",
    analysisError: "The analysis could not finish.",
    actionError: "Could not record this action.",
    checkConnectedSensor: "Check connected sensor",
    manualGlucoseEntry: "Manual glucose entry",
    connectedGlucoseHelp: "If no automatic reading is available, enter the number from the glucose meter here.",
    manualGlucoseHelp: "Type the number from the glucose meter to save it with your vitals.",
    whenReading: "When was this reading?",
    ok: "OK",
  },
  fr: {
    add: "Ajouter une mesure",
    analyse: "Analyser maintenant",
    analysing: "Analyse...",
    loading: "Preparation de vos constantes...",
    back: "Retour",
    save: "Enregistrer la mesure",
    saving: "Enregistrement...",
    lastAnalysis: "Derniere analyse",
    noAnalysis: "Aucune analyse encore",
    now: "Maintenant",
    normal: "Normal",
    today: "Aujourd'hui",
    yes: "Oui, pris",
    no: "Pas encore",
    messageFallback: "Bonjour. VYVA est prete a revoir vos constantes avec vous.",
    safetyTitle: "Controle quotidien",
    safetyAck: "Enregistre",
    recheck: "Verifier a nouveau",
    share: "Partager",
    doctor: "Medecin",
    urgent: "Urgent",
    sourceEstimated: "Estime",
    sourceManual: "Manuel",
    sourceDevice: "Appareil",
    confidenceLow: "Faible",
    confidenceMedium: "Moyenne",
    confidenceHigh: "Elevee",
    evidenceTitle: "Qualite des donnees",
    evidenceBody: "VYVA combine les estimations du telephone avec les valeurs saisies depuis des appareils. Les estimations aident a voir les tendances; les appareils et mesures cliniques ont plus de poids.",
    evidencePhone: "Telephone : pouls et respiration estimes",
    evidenceManual: "Manuel : douleur, humeur, energie et medication",
    evidenceDevice: "Appareil : oxygene, temperature, tension, glycemie et poids",
    addEvidenceNote: "Saisissez le nombre tel qu'il apparait sur votre appareil, ou notez comment vous vous sentez. Cela aide VYVA a affiner l'evaluation.",
    sourceClinical: "Clinique",
    loadError: "Impossible de charger vos constantes maintenant.",
    saveError: "Impossible d'enregistrer cette mesure.",
    analysisError: "L'analyse n'a pas pu se terminer.",
    actionError: "Impossible d'enregistrer cette action.",
    checkConnectedSensor: "Verifier le capteur connecte",
    manualGlucoseEntry: "Saisie manuelle de glycemie",
    connectedGlucoseHelp: "Si aucune mesure automatique n'est disponible, saisissez ici le nombre du lecteur de glycemie.",
    manualGlucoseHelp: "Saisissez le nombre du lecteur de glycemie pour l'enregistrer avec vos constantes.",
    whenReading: "Quand cette mesure a-t-elle ete prise?",
    ok: "OK",
  },
  it: {
    add: "Aggiungi lettura",
    analyse: "Analizza ora",
    analysing: "Analisi...",
    loading: "Preparazione dei parametri...",
    back: "Indietro",
    save: "Salva lettura",
    saving: "Salvataggio...",
    lastAnalysis: "Ultima analisi",
    noAnalysis: "Nessuna analisi ancora",
    now: "Ora",
    normal: "Normale",
    today: "Oggi",
    yes: "Si, presa",
    no: "Non ancora",
    messageFallback: "Buongiorno. VYVA e pronta a rivedere i tuoi segnali con te.",
    safetyTitle: "Controllo quotidiano",
    safetyAck: "Registrato",
    recheck: "Ricontrolla",
    share: "Condividi",
    doctor: "Medico",
    urgent: "Urgente",
    sourceEstimated: "Stimato",
    sourceManual: "Manuale",
    sourceDevice: "Dispositivo",
    confidenceLow: "Bassa",
    confidenceMedium: "Media",
    confidenceHigh: "Alta",
    evidenceTitle: "Qualita dei dati",
    evidenceBody: "VYVA combina stime del telefono con valori inseriti da dispositivi. Le stime aiutano con i trend; dispositivi e letture cliniche hanno piu peso.",
    evidencePhone: "Telefono: polso e respirazione stimati",
    evidenceManual: "Manuale: dolore, umore, energia e farmaci",
    evidenceDevice: "Dispositivo: ossigeno, temperatura, pressione, glucosio e peso",
    addEvidenceNote: "Inserisci il numero esattamente come appare sul dispositivo, o registra come ti senti. Questo aiuta VYVA a perfezionare la valutazione.",
    sourceClinical: "Clinico",
    loadError: "Impossibile caricare i parametri ora.",
    saveError: "Impossibile salvare questa lettura.",
    analysisError: "L'analisi non e stata completata.",
    actionError: "Impossibile registrare questa azione.",
    checkConnectedSensor: "Controlla sensore connesso",
    manualGlucoseEntry: "Inserimento manuale glucosio",
    connectedGlucoseHelp: "Se non e disponibile una lettura automatica, inserisci qui il numero del glucometro.",
    manualGlucoseHelp: "Digita il numero del glucometro per salvarlo con i tuoi parametri.",
    whenReading: "Quando e stata presa questa misura?",
    ok: "OK",
  },
  pt: {
    add: "Adicionar leitura",
    analyse: "Analisar agora",
    analysing: "A analisar...",
    loading: "A preparar os seus sinais...",
    back: "Voltar",
    save: "Guardar leitura",
    saving: "A guardar...",
    lastAnalysis: "Ultima analise",
    noAnalysis: "Sem analise ainda",
    now: "Agora",
    normal: "Normal",
    today: "Hoje",
    yes: "Sim, tomado",
    no: "Ainda nao",
    messageFallback: "Bom dia. A VYVA esta pronta para rever os seus sinais consigo.",
    safetyTitle: "Verificacao diaria",
    safetyAck: "Registado",
    recheck: "Rever",
    share: "Partilhar",
    doctor: "Medico",
    urgent: "Urgente",
    sourceEstimated: "Estimado",
    sourceManual: "Manual",
    sourceDevice: "Dispositivo",
    confidenceLow: "Baixa",
    confidenceMedium: "Media",
    confidenceHigh: "Alta",
    evidenceTitle: "Qualidade dos dados",
    evidenceBody: "A VYVA combina estimativas do telefone com valores introduzidos de dispositivos. As estimativas ajudam nas tendencias; dispositivos e leituras clinicas tem mais peso.",
    evidencePhone: "Telefone: pulso e respiracao estimados",
    evidenceManual: "Manual: dor, humor, energia e medicacao",
    evidenceDevice: "Dispositivo: oxigenio, temperatura, tensao, glicose e peso",
    addEvidenceNote: "Introduza o numero exatamente como aparece no dispositivo, ou registe como se sente. Isto ajuda a VYVA a refinar a avaliacao.",
    sourceClinical: "Clinico",
    loadError: "Nao foi possivel carregar os seus sinais agora.",
    saveError: "Nao foi possivel guardar esta leitura.",
    analysisError: "A analise nao conseguiu terminar.",
    actionError: "Nao foi possivel registar esta acao.",
    checkConnectedSensor: "Verificar sensor ligado",
    manualGlucoseEntry: "Entrada manual de glicose",
    connectedGlucoseHelp: "Se nao houver leitura automatica disponivel, introduza aqui o numero do medidor de glicose.",
    manualGlucoseHelp: "Digite o numero do medidor de glicose para guardar com os seus sinais.",
    whenReading: "Quando foi esta medicao?",
    ok: "OK",
  },
};

function copyFor(language: Language) {
  return { ...COPY.en, ...(COPY_BASE[language] ?? {}), ...COPY_OVERRIDES[language] };
}

function textFor(values: LocalizedText, language: Language): string {
  return values[language] ?? values.en ?? values.es ?? "";
}

const SIGNAL_CONFIG = {
  glucose_mgdl: {
    label: { es: "Glucosa", de: "Blutzucker", en: "Glucose" },
    unit: "mg/dL",
    icon: "drop",
    placeholder: "142",
    question: { es: "¿Cuánto marca tu glucómetro?", de: "Was zeigt dein Blutzuckermessgerät?", en: "What does your glucose meter show?" },
    contexts: [
      { key: "fasting", label: { es: "Ayunas", de: "Nüchtern", en: "Fasting" } },
      { key: "post_meal_2h", label: { es: "Tras comer", de: "Nach dem Essen", en: "After meal" } },
      { key: "nocturnal", label: { es: "Noche", de: "Nachts", en: "Night" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  resting_hr_bpm: {
    label: { es: "Pulso", de: "Puls", en: "Heart rate" },
    unit: "bpm",
    icon: "heart",
    placeholder: "72",
    question: { es: "¿Cuántas pulsaciones por minuto?", de: "Wie viele Herzschläge pro Minute?", en: "How many beats per minute?" },
    contexts: [
      { key: "morning", label: { es: "Por la mañana", de: "Morgens", en: "Morning" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  respiratory_rate: {
    label: { es: "Respiracion", de: "Atemfrequenz", en: "Breathing rate" },
    unit: "/min",
    icon: "wind",
    placeholder: "16",
    question: { es: "Cuantas respiraciones por minuto?", de: "Wie viele Atemzuge pro Minute?", en: "How many breaths per minute?" },
    contexts: [
      { key: "resting", label: { es: "En reposo", de: "In Ruhe", en: "Resting" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  oxygen_saturation: {
    label: { es: "Oxigeno", de: "Sauerstoff", en: "Oxygen" },
    unit: "%",
    icon: "oxygen",
    placeholder: "97",
    question: { es: "Cuanto marca el oximetro?", de: "Was zeigt das Pulsoximeter?", en: "What does the pulse oximeter show?" },
    contexts: [
      { key: "resting", label: { es: "En reposo", de: "In Ruhe", en: "Resting" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  temperature_c: {
    label: { es: "Temperatura", de: "Temperatur", en: "Temperature" },
    unit: "C",
    icon: "thermometer",
    placeholder: "37.2",
    question: { es: "Cuanto marca el termometro?", de: "Was zeigt das Thermometer?", en: "What does the thermometer show?" },
    contexts: [
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
      { key: "evening", label: { es: "Tarde", de: "Abends", en: "Evening" } },
    ],
    conditions: [],
  },
  bp_systolic: {
    label: { es: "Tensión", de: "Blutdruck", en: "Blood pressure" },
    unit: "mmHg",
    icon: "stethoscope",
    placeholder: "128",
    question: { es: "¿Cuánto marca el tensiómetro? (número alto)", de: "Was zeigt das Blutdruckmessgerät? (obere Zahl)", en: "What does the BP monitor show? (top number)" },
    contexts: [
      { key: "morning", label: { es: "Mañana", de: "Morgens", en: "Morning" } },
      { key: "evening", label: { es: "Tarde", de: "Abends", en: "Evening" } },
    ],
    conditions: [],
  },
  weight_kg: {
    label: { es: "Peso", de: "Gewicht", en: "Weight" },
    unit: "kg",
    icon: "scale",
    placeholder: "70",
    question: { es: "Cuanto marca la bascula?", de: "Was zeigt die Waage?", en: "What does the scale show?" },
    contexts: [
      { key: "morning", label: { es: "Manana", de: "Morgens", en: "Morning" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  pain_score: {
    label: { es: "Dolor", de: "Schmerz", en: "Pain" },
    unit: "/10",
    icon: "pain",
    placeholder: "4",
    question: { es: "Cuanto dolor tienes? (0 = nada, 10 = mucho)", de: "Wie stark sind die Schmerzen? (0 = keine, 10 = stark)", en: "How much pain do you have? (0 = none, 10 = severe)" },
    contexts: [{ key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } }],
    conditions: [],
  },
  sleep_quality_score: {
    label: { es: "Sueño", de: "Schlaf", en: "Sleep" },
    unit: "/10",
    icon: "moon",
    placeholder: "7",
    question: { es: "¿Cómo dormiste anoche? (1 = muy mal, 10 = muy bien)", de: "Wie haben Sie letzte Nacht geschlafen? (1 = sehr schlecht, 10 = sehr gut)", en: "How did you sleep last night? (1 = very badly, 10 = very well)" },
    contexts: [{ key: "general", label: { es: "Anoche", de: "Letzte Nacht", en: "Last night" } }],
    conditions: [],
  },
  energy_level: {
    label: { es: "Energia", de: "Energie", en: "Energy" },
    unit: "/10",
    icon: "energy",
    placeholder: "6",
    question: { es: "Cuanta energia tienes hoy? (1 = muy baja, 10 = alta)", de: "Wie viel Energie haben Sie heute? (1 = sehr niedrig, 10 = hoch)", en: "How much energy do you have today? (1 = very low, 10 = high)" },
    contexts: [{ key: "general", label: { es: "Hoy", de: "Heute", en: "Today" } }],
    conditions: [],
  },
  medication_confirmed: {
    label: { es: "Medicación", de: "Medikamente", en: "Medication" },
    unit: "",
    icon: "pill",
    placeholder: "1",
    question: { es: "¿Has tomado tu medicación hoy?", de: "Haben Sie heute Ihre Medikamente genommen?", en: "Have you taken your medication today?" },
    contexts: [
      { key: "morning", label: { es: "Mañana", de: "Morgens", en: "Morning" } },
      { key: "evening", label: { es: "Noche", de: "Abends", en: "Evening" } },
    ],
    conditions: [],
    isBinary: true,
  },
  mood_score: {
    label: { es: "Ánimo", de: "Stimmung", en: "Mood" },
    unit: "/10",
    icon: "smile",
    placeholder: "7",
    question: { es: "¿Cómo te sientes hoy? (1 = muy mal, 10 = excelente)", de: "Wie fühlen Sie sich heute? (1 = sehr schlecht, 10 = ausgezeichnet)", en: "How are you feeling today? (1 = very bad, 10 = excellent)" },
    contexts: [{ key: "general", label: { es: "Hoy", de: "Heute", en: "Today" } }],
    conditions: [],
  },
} as const;

interface SignalTranslation {
  label?: string;
  question?: string;
  contexts?: Record<string, string>;
}

const SIGNAL_TRANSLATIONS: Partial<Record<Language, Partial<Record<SignalKey, SignalTranslation>>>> = {
  fr: {
    glucose_mgdl: {
      label: "Glycemie",
      question: "Que montre votre lecteur de glycemie?",
      contexts: { fasting: "A jeun", post_meal_2h: "Apres repas", nocturnal: "Nuit", general: "Maintenant" },
    },
    resting_hr_bpm: {
      label: "Pouls",
      question: "Combien de battements par minute?",
      contexts: { morning: "Matin", general: "Maintenant" },
    },
    respiratory_rate: {
      label: "Respiration",
      question: "Combien de respirations par minute?",
      contexts: { resting: "Au repos", general: "Maintenant" },
    },
    oxygen_saturation: {
      label: "Oxygene",
      question: "Que montre l'oxymetre?",
      contexts: { resting: "Au repos", general: "Maintenant" },
    },
    temperature_c: {
      label: "Temperature",
      question: "Que montre le thermometre?",
      contexts: { general: "Maintenant", evening: "Soir" },
    },
    bp_systolic: {
      label: "Tension",
      question: "Que montre le tensiometre? (nombre du haut)",
      contexts: { morning: "Matin", evening: "Soir" },
    },
    weight_kg: {
      label: "Poids",
      question: "Que montre la balance?",
      contexts: { morning: "Matin", general: "Maintenant" },
    },
    pain_score: {
      label: "Douleur",
      question: "Quel niveau de douleur avez-vous? (0 = aucune, 10 = forte)",
      contexts: { general: "Maintenant" },
    },
    sleep_quality_score: {
      label: "Sommeil",
      question: "Comment avez-vous dormi cette nuit? (1 = tres mal, 10 = tres bien)",
      contexts: { general: "Cette nuit" },
    },
    energy_level: {
      label: "Energie",
      question: "Quel est votre niveau d'energie aujourd'hui? (1 = tres bas, 10 = eleve)",
      contexts: { general: "Aujourd'hui" },
    },
    medication_confirmed: {
      label: "Medicament",
      question: "Avez-vous pris votre medicament aujourd'hui?",
      contexts: { morning: "Matin", evening: "Soir" },
    },
    mood_score: {
      label: "Humeur",
      question: "Comment vous sentez-vous aujourd'hui? (1 = tres mal, 10 = excellent)",
      contexts: { general: "Aujourd'hui" },
    },
  },
  it: {
    glucose_mgdl: {
      label: "Glucosio",
      question: "Cosa mostra il glucometro?",
      contexts: { fasting: "A digiuno", post_meal_2h: "Dopo pasto", nocturnal: "Notte", general: "Ora" },
    },
    resting_hr_bpm: {
      label: "Polso",
      question: "Quanti battiti al minuto?",
      contexts: { morning: "Mattina", general: "Ora" },
    },
    respiratory_rate: {
      label: "Respirazione",
      question: "Quanti respiri al minuto?",
      contexts: { resting: "A riposo", general: "Ora" },
    },
    oxygen_saturation: {
      label: "Ossigeno",
      question: "Cosa mostra il pulsossimetro?",
      contexts: { resting: "A riposo", general: "Ora" },
    },
    temperature_c: {
      label: "Temperatura",
      question: "Cosa mostra il termometro?",
      contexts: { general: "Ora", evening: "Sera" },
    },
    bp_systolic: {
      label: "Pressione",
      question: "Cosa mostra il misuratore di pressione? (numero alto)",
      contexts: { morning: "Mattina", evening: "Sera" },
    },
    weight_kg: {
      label: "Peso",
      question: "Cosa mostra la bilancia?",
      contexts: { morning: "Mattina", general: "Ora" },
    },
    pain_score: {
      label: "Dolore",
      question: "Quanto dolore hai? (0 = niente, 10 = forte)",
      contexts: { general: "Ora" },
    },
    sleep_quality_score: {
      label: "Sonno",
      question: "Come hai dormito questa notte? (1 = molto male, 10 = molto bene)",
      contexts: { general: "Questa notte" },
    },
    energy_level: {
      label: "Energia",
      question: "Quanta energia hai oggi? (1 = molto bassa, 10 = alta)",
      contexts: { general: "Oggi" },
    },
    medication_confirmed: {
      label: "Farmaci",
      question: "Hai preso i farmaci oggi?",
      contexts: { morning: "Mattina", evening: "Sera" },
    },
    mood_score: {
      label: "Umore",
      question: "Come ti senti oggi? (1 = molto male, 10 = eccellente)",
      contexts: { general: "Oggi" },
    },
  },
  pt: {
    glucose_mgdl: {
      label: "Glicose",
      question: "O que mostra o medidor de glicose?",
      contexts: { fasting: "Em jejum", post_meal_2h: "Depois da refeicao", nocturnal: "Noite", general: "Agora" },
    },
    resting_hr_bpm: {
      label: "Pulso",
      question: "Quantas batidas por minuto?",
      contexts: { morning: "Manha", general: "Agora" },
    },
    respiratory_rate: {
      label: "Respiracao",
      question: "Quantas respiracoes por minuto?",
      contexts: { resting: "Em repouso", general: "Agora" },
    },
    oxygen_saturation: {
      label: "Oxigenio",
      question: "O que mostra o oximetro?",
      contexts: { resting: "Em repouso", general: "Agora" },
    },
    temperature_c: {
      label: "Temperatura",
      question: "O que mostra o termometro?",
      contexts: { general: "Agora", evening: "Noite" },
    },
    bp_systolic: {
      label: "Tensao",
      question: "O que mostra o medidor de tensao? (numero alto)",
      contexts: { morning: "Manha", evening: "Noite" },
    },
    weight_kg: {
      label: "Peso",
      question: "O que mostra a balanca?",
      contexts: { morning: "Manha", general: "Agora" },
    },
    pain_score: {
      label: "Dor",
      question: "Quanta dor sente? (0 = nenhuma, 10 = forte)",
      contexts: { general: "Agora" },
    },
    sleep_quality_score: {
      label: "Sono",
      question: "Como dormiu esta noite? (1 = muito mal, 10 = muito bem)",
      contexts: { general: "Esta noite" },
    },
    energy_level: {
      label: "Energia",
      question: "Quanta energia tem hoje? (1 = muito baixa, 10 = alta)",
      contexts: { general: "Hoje" },
    },
    medication_confirmed: {
      label: "Medicacao",
      question: "Tomou a sua medicacao hoje?",
      contexts: { morning: "Manha", evening: "Noite" },
    },
    mood_score: {
      label: "Humor",
      question: "Como se sente hoje? (1 = muito mal, 10 = excelente)",
      contexts: { general: "Hoje" },
    },
  },
};

function signalLabel(signalKey: SignalKey, cfg: typeof SIGNAL_CONFIG[SignalKey], language: Language): string {
  return SIGNAL_TRANSLATIONS[language]?.[signalKey]?.label ?? textFor(cfg.label, language);
}

function signalQuestion(signalKey: SignalKey, cfg: typeof SIGNAL_CONFIG[SignalKey], language: Language): string {
  return SIGNAL_TRANSLATIONS[language]?.[signalKey]?.question ?? textFor(cfg.question, language);
}

function signalContextLabel(signalKey: SignalKey, context: { key: string; label: LocalizedText }, language: Language): string {
  return SIGNAL_TRANSLATIONS[language]?.[signalKey]?.contexts?.[context.key] ?? textFor(context.label, language);
}

const DASHBOARD_SIGNALS: SignalKey[] = ["resting_hr_bpm", "oxygen_saturation", "temperature_c", "glucose_mgdl", "mood_score", "sleep_quality_score"];

function SignalIcon({ type, className = "" }: { type: string; className?: string }) {
  const common = `h-8 w-8 ${className}`;
  if (type === "heart") return <HeartPulse className={common} />;
  if (type === "wind") return <Wind className={common} />;
  if (type === "oxygen") return <Activity className={common} />;
  if (type === "thermometer") return <Thermometer className={common} />;
  if (type === "scale") return <Scale className={common} />;
  if (type === "energy") return <Zap className={common} />;
  if (type === "stethoscope") return <Stethoscope className={common} />;
  if (type === "moon") return <Moon className={common} />;
  if (type === "pill") return <Pill className={common} />;
  if (type === "smile") return <Smile className={common} />;
  return <Activity className={common} />;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRiskColor(score: number) {
  if (score < 30) return "#22C55E";
  if (score < 50) return "#F59E0B";
  if (score < 75) return "rgba(239,68,68,0.7)";
  return "#EF4444";
}

function getRiskLabel(score: number, language: Language) {
  const labels: Record<Language, string[]> = {
    es: ["Todo bien", "Atención leve", "Requiere atención", "Urgente"],
    de: ["Alles gut", "Leichte Aufmerksamkeit", "Aufmerksamkeit erforderlich", "Dringend"],
    en: ["All good", "Mild attention", "Needs attention", "Urgent"],
    fr: ["Tout va bien", "Attention legere", "Attention necessaire", "Urgent"],
    it: ["Tutto bene", "Lieve attenzione", "Richiede attenzione", "Urgente"],
    pt: ["Tudo bem", "Atencao ligeira", "Requer atencao", "Urgente"],
  };
  const lang = labels[language];
  if (score < 30) return lang[0];
  if (score < 50) return lang[1];
  if (score < 75) return lang[2];
  return lang[3];
}

function normalizeSafetyStatus(value: unknown): SafetyStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "urgent_help" || raw === "urgent") return "urgent_help";
  if (raw === "contact_doctor" || raw === "doctor_today") return "contact_doctor";
  if (raw === "share_with_caregiver" || raw === "notify") return "share_with_caregiver";
  if (raw === "recheck" || raw === "watch") return "recheck";
  return "steady";
}

function safetyTone(status: SafetyStatus) {
  if (status === "urgent_help") return { color: "#DC2626", bg: "#FEF2F2", Icon: AlertTriangle };
  if (status === "contact_doctor") return { color: "#B45309", bg: "#FFF7ED", Icon: PhoneCall };
  if (status === "share_with_caregiver") return { color: "#6B21A8", bg: "#F5F3FF", Icon: Bell };
  if (status === "recheck") return { color: "#0369A1", bg: "#EFF6FF", Icon: RefreshCw };
  return { color: "#047857", bg: "#ECFDF5", Icon: ShieldCheck };
}

function safetyLabel(status: SafetyStatus, language: Language) {
  const labels: Record<Language, Record<SafetyStatus, string>> = {
    es: {
      steady: "Estable",
      recheck: "Repetir medicion",
      share_with_caregiver: "Compartir con cuidador",
      contact_doctor: "Consultar medico",
      urgent_help: "Ayuda urgente",
    },
    de: {
      steady: "Stabil",
      recheck: "Erneut prufen",
      share_with_caregiver: "Mit Betreuung teilen",
      contact_doctor: "Arzt kontaktieren",
      urgent_help: "Dringende Hilfe",
    },
    en: {
      steady: "Steady",
      recheck: "Recheck",
      share_with_caregiver: "Share with caregiver",
      contact_doctor: "Contact doctor",
      urgent_help: "Urgent help",
    },
    fr: {
      steady: "Stable",
      recheck: "Verifier a nouveau",
      share_with_caregiver: "Partager avec l'aidant",
      contact_doctor: "Contacter le medecin",
      urgent_help: "Aide urgente",
    },
    it: {
      steady: "Stabile",
      recheck: "Ricontrolla",
      share_with_caregiver: "Condividi con caregiver",
      contact_doctor: "Contatta medico",
      urgent_help: "Aiuto urgente",
    },
    pt: {
      steady: "Estavel",
      recheck: "Rever",
      share_with_caregiver: "Partilhar com cuidador",
      contact_doctor: "Contactar medico",
      urgent_help: "Ajuda urgente",
    },
  };
  return labels[language][status];
}

function readingSourceBadge(reading: RecentReading | undefined, language: Language) {
  if (!reading) return null;
  const copy = copyFor(language);
  const source = reading.source;
  const confidence = reading.source_confidence ?? (source === "phone_estimate" ? "low" : source === "connected_device" || source === "clinical" ? "high" : "medium");
  const confidenceLabel =
    confidence === "high"
      ? copy.confidenceHigh
      : confidence === "low"
        ? copy.confidenceLow
        : copy.confidenceMedium;
  if (source === "phone_estimate") return { label: `${copy.sourceEstimated} - ${confidenceLabel}`, bg: "#F5F3FF", color: "#6B21A8" };
  if (source === "connected_device") return { label: `${copy.sourceDevice} - ${confidenceLabel}`, bg: "#D1FAE5", color: "#047857" };
  if (source === "clinical") return { label: `${copy.sourceClinical} - ${confidenceLabel}`, bg: "#E0F2FE", color: "#0369A1" };
  return { label: `${copy.sourceManual} - ${confidenceLabel}`, bg: "#FEF3C7", color: "#92400E" };
}

function relativeTime(iso: string | null | undefined, language: Language) {
  if (!iso) return copyFor(language).noAnalysis;
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (language === "fr") {
    if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} jours`;
  }
  if (language === "it") {
    if (diffMinutes < 60) return `${diffMinutes} min fa`;
    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `${hours} ore fa`;
    return `${Math.round(hours / 24)} giorni fa`;
  }
  if (language === "pt") {
    if (diffMinutes < 60) return `ha ${diffMinutes} min`;
    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `ha ${hours} horas`;
    return `ha ${Math.round(hours / 24)} dias`;
  }
  if (diffMinutes < 60) return language === "es" ? `hace ${diffMinutes} min` : language === "de" ? `vor ${diffMinutes} Min.` : `${diffMinutes} min ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return language === "es" ? `hace ${hours} horas` : language === "de" ? `vor ${hours} Std.` : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return language === "es" ? `hace ${days} días` : language === "de" ? `vor ${days} Tagen` : `${days} days ago`;
}

export default function VitalsTracker({ userId, userConditions, language = "es" }: Props) {
  const [searchParams] = useSearchParams();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [analysis, setAnalysis] = useState<LatestAnalysis | null>(null);
  const [recentReadings, setRecentReadings] = useState<RecentReading[]>([]);
  const [latestAlert, setLatestAlert] = useState<LatestAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSignal, setSelectedSignal] = useState<SignalKey>("resting_hr_bpm");
  const [inputValue, setInputValue] = useState("");
  const [selectedContext, setSelectedContext] = useState("general");
  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const copy = useMemo(() => copyFor(language), [language]);
  const visibleSignals = useMemo(() => getVisibleSignals(userConditions), [userConditions]);
  const selectedConfig = SIGNAL_CONFIG[selectedSignal];
  const riskScore = analysis?.risk_score ?? 0;
  const riskColor = getRiskColor(riskScore);
  const safetyStatus = normalizeSafetyStatus(analysis?.recommended_action ?? analysis?.safety_status);
  const addSource = searchParams.get("source");
  const openedFromGlucoseAction = (searchParams.get("add") === "glucose" || searchParams.get("add") === "glucose_mgdl") && selectedSignal === "glucose_mgdl";
  const safety = safetyTone(safetyStatus);
  const SafetyIcon = safety.Icon;
  const safetyAcknowledged = Boolean(analysis?.acknowledged_at);

  useEffect(() => {
    const signalParam = searchParams.get("add");
    if (signalParam === "glucose" || signalParam === "glucose_mgdl") {
      setSelectedSignal("glucose_mgdl");
      setSelectedContext("general");
      setScreen("add");
    }
  }, [searchParams]);

  const loadDashboard = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/vitals-engine/latest");
      if (!response.ok) throw new Error("Dashboard load failed");
      const data = await response.json() as LatestResponse;
      setAnalysis(data.analysis ?? null);
      setRecentReadings(data.recent_readings ?? []);
      setLatestAlert(data.latest_alert ?? null);
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, userId]);

  async function saveReading() {
    const numeric = selectedConfig.isBinary ? Number(inputValue) : Number(inputValue);
    if (!Number.isFinite(numeric)) return;

    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch("/api/vitals-engine/reading", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          signal_type: selectedSignal,
          value: numeric,
          source: "manual_entry",
          context_tag: selectedContext,
          condition_tags: userConditions,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      const data = await response.json() as { deviation_pct?: number | null };
      setScreen("dashboard");
      setInputValue("");
      await loadDashboard();
      if (data.deviation_pct != null && Math.abs(Number(data.deviation_pct)) > 25) {
        await triggerAnalysis();
      }
    } catch {
      setError(copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function triggerAnalysis() {
    setAnalysing(true);
    setError(null);
    try {
      const response = await apiFetch("/api/vitals-engine/analyse", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Analysis failed");
      await loadDashboard();
    } catch {
      setError(copy.analysisError);
    } finally {
      setAnalysing(false);
    }
  }

  async function acknowledgeSafety(action: "recheck" | "dismissed" | "shared" | "contacted_doctor" | "urgent_guidance_followed") {
    setAcknowledging(action);
    setError(null);
    try {
      const response = await apiFetch("/api/vitals-engine/acknowledge", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          analysis_id: analysis?.id ?? undefined,
          action,
        }),
      });
      if (!response.ok) throw new Error("Acknowledge failed");
      const updated = await response.json() as LatestAnalysis;
      setAnalysis((current) => ({ ...(current ?? {}), ...updated }));
      await loadDashboard();
    } catch {
      setError(copy.actionError);
    } finally {
      setAcknowledging(null);
    }
  }

  function selectSignal(key: SignalKey) {
    setSelectedSignal(key);
    setSelectedContext(SIGNAL_CONFIG[key].contexts[0]?.key ?? "general");
    setInputValue("");
  }

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!visibleSignals.some(([key]) => key === selectedSignal)) {
      selectSignal(visibleSignals[0]?.[0] ?? "resting_hr_bpm");
    }
  }, [visibleSignals, selectedSignal]);

  // TODO: Device connection settings screen for Apple Health / LibreView / Withings.
  // TODO: Nightly cron job should call POST /api/vitals/baseline/update for active users.
  // TODO: Caregiver dashboard can read vyva_pattern_windows.caregiver_note.
  // TODO: VYVA voice can read senior_message aloud after analysis.
  // TODO: Optional 40Hz gamma audio layer under daily check-in audio.

  if (screen === "add") {
    const isBinary = selectedConfig.isBinary === true;
    const canSave = isBinary ? inputValue === "1" || inputValue === "0" : inputValue.trim().length > 0 && Number.isFinite(Number(inputValue));

    return (
      <section className="rounded-[28px] border border-[#E8DED4] bg-[#FAF9F6] p-5 shadow-[0_14px_34px_rgba(63,45,35,0.08)]" data-testid="vitals-engine-add">
        <button
          type="button"
          onClick={() => setScreen("dashboard")}
          className="mb-6 flex min-h-[64px] items-center gap-3 rounded-full bg-white px-5 font-body text-[18px] font-bold text-[#3B2C25] shadow-[0_6px_18px_rgba(63,45,35,0.07)]"
        >
          <ArrowLeft className="h-6 w-6" />
          {copy.back}
        </button>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleSignals.map(([key, cfg]) => {
            const active = key === selectedSignal;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectSignal(key)}
                className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[24px] border px-3 text-center font-body text-[18px] font-bold transition active:scale-[0.98]"
                style={{
                  background: active ? "#6B21A8" : "#FFFFFF",
                  borderColor: active ? "#6B21A8" : "#E8DED4",
                  color: active ? "#FFFFFF" : "#3B2C25",
                }}
              >
                <SignalIcon type={cfg.icon} className={active ? "text-white" : "text-[#6B21A8]"} />
                {signalLabel(key, cfg, language)}
              </button>
            );
          })}
        </div>

        <div className="my-7 h-px bg-[#E8DED4]" />

        <h2 className="font-display text-[30px] italic leading-tight text-[#2F241F]">
          {signalQuestion(selectedSignal, selectedConfig, language)}
        </h2>
        <p className="mt-3 rounded-[20px] border border-[#DDD6FE] bg-white px-4 py-3 font-body text-[16px] font-bold leading-snug text-[#6B5B52]">
          {copy.addEvidenceNote}
        </p>

        {openedFromGlucoseAction ? (
          <div className="mt-5 rounded-[24px] border border-[#DDD6FE] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-[#6B21A8]">
                <Activity className="h-6 w-6" />
              </span>
              <div>
                <p className="font-body text-[19px] font-black leading-tight text-[#2F241F]">
                  {addSource === "connected" ? copy.checkConnectedSensor : copy.manualGlucoseEntry}
                </p>
                <p className="mt-1 font-body text-[16px] font-bold leading-snug text-[#6B5B52]">
                  {addSource === "connected" ? copy.connectedGlucoseHelp : copy.manualGlucoseHelp}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {isBinary ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setInputValue("1")}
              className="flex min-h-[96px] items-center justify-center gap-3 rounded-[24px] border px-5 font-body text-[22px] font-bold"
              style={{
                background: inputValue === "1" ? "#ECFDF5" : "#FFFFFF",
                borderColor: inputValue === "1" ? "#22C55E" : "#E8DED4",
                color: "#14532D",
              }}
            >
              <Check className="h-7 w-7" />
              {copy.yes}
            </button>
            <button
              type="button"
              onClick={() => setInputValue("0")}
              className="flex min-h-[96px] items-center justify-center rounded-[24px] border px-5 font-body text-[22px] font-bold"
              style={{
                background: inputValue === "0" ? "#FFF7ED" : "#FFFFFF",
                borderColor: inputValue === "0" ? "#F59E0B" : "#E8DED4",
                color: "#92400E",
              }}
            >
              {copy.no}
            </button>
          </div>
        ) : (
          <div className="mt-6 flex items-end gap-3 rounded-[28px] border-2 border-[#E8DED4] bg-white px-5 py-4">
            <input
              type="number"
              inputMode="decimal"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={selectedConfig.placeholder}
              className="min-w-0 flex-1 bg-transparent font-body text-[72px] font-bold leading-none text-[#2F241F] outline-none placeholder:text-[#D6C7BA]"
            />
            <span className="pb-3 font-body text-[22px] font-bold text-[#7A6A60]">{selectedConfig.unit}</span>
          </div>
        )}

        <p className="mt-7 font-body text-[20px] font-bold text-[#3B2C25]">
          {copy.whenReading}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {selectedConfig.contexts.map((context) => {
            const active = selectedContext === context.key;
            return (
              <button
                key={context.key}
                type="button"
                onClick={() => setSelectedContext(context.key)}
                className="min-h-[64px] rounded-full border px-4 font-body text-[18px] font-bold"
                style={{
                  background: active ? "#F59E0B" : "#FFFFFF",
                  borderColor: active ? "#F59E0B" : "#E8DED4",
                  color: active ? "#2F241F" : "#6B5B52",
                }}
              >
                {signalContextLabel(selectedSignal, context, language)}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 rounded-[18px] bg-[#FEF2F2] p-4 font-body text-[18px] font-bold text-[#B91C1C]">{error}</p>}

        <button
          type="button"
          onClick={saveReading}
          disabled={!canSave || saving}
          className="mt-7 flex min-h-[72px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#6B21A8] px-6 font-body text-[22px] font-bold text-white shadow-[0_12px_26px_rgba(107,33,168,0.24)] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-6 w-6 animate-spin" />}
          {saving ? copy.saving : copy.save}
        </button>
      </section>
    );
  }

  const latestBySignal = latestReadingMap(recentReadings);

  return (
    <section className="rounded-[28px] border border-[#E8DED4] bg-[#FAF9F6] p-5 shadow-[0_14px_34px_rgba(63,45,35,0.08)]" data-testid="vitals-engine-dashboard">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="font-display text-[30px] italic leading-none text-[#6B21A8]">{copy.logo}</div>
        <button
          type="button"
          onClick={triggerAnalysis}
          disabled={analysing}
          className="flex min-h-[64px] items-center gap-2 rounded-full border border-[#DDD6FE] bg-white px-5 font-body text-[18px] font-bold text-[#6B21A8]"
        >
          {analysing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {analysing ? copy.analysing : copy.analyse}
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-[26px] bg-white">
          <div className="text-center font-body text-[20px] font-bold text-[#6B5B52]">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#6B21A8]" />
            {copy.loading}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center rounded-[28px] bg-white px-5 py-7 shadow-[0_8px_24px_rgba(63,45,35,0.06)]">
            <div
              className="flex h-[190px] w-[190px] items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${riskColor} ${riskScore * 3.6}deg, #EEE6DE 0deg)` }}
              aria-label={`${riskScore}, ${getRiskLabel(riskScore, language)}`}
            >
              <div className="flex h-[142px] w-[142px] flex-col items-center justify-center rounded-full bg-[#FAF9F6] text-center">
                <span className="font-body text-[50px] font-bold leading-none text-[#2F241F]">{riskScore}</span>
                <span className="mt-2 font-body text-[18px] font-bold text-[#6B5B52]">/100</span>
              </div>
            </div>
            <p className="mt-4 font-display text-[30px] italic leading-tight text-[#2F241F]">
              {getRiskLabel(riskScore, language)}
            </p>
          </div>

          <div className="mt-4 rounded-[26px] border border-[#DDD6FE] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]" data-testid="vitals-evidence-guide">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-[#6B21A8]">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-[#6B21A8]">{copy.evidenceTitle}</p>
                <p className="mt-2 font-body text-[17px] font-bold leading-snug text-[#3B2C25]">{copy.evidenceBody}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {[copy.evidencePhone, copy.evidenceManual, copy.evidenceDevice].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[18px] bg-[#FAF9F6] px-4 py-3 font-body text-[15px] font-bold text-[#6B5B52]">
                  <Check className="h-5 w-5 flex-shrink-0 text-[#047857]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[26px] border border-[#EDE5DB] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]" data-testid="daily-safety-check">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px]" style={{ background: safety.bg, color: safety.color }}>
                <SafetyIcon className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-[#7A6A60]">{copy.safetyTitle}</p>
                  <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: safety.bg, color: safety.color }}>
                    {safetyLabel(safetyStatus, language)}
                  </span>
                  {safetyAcknowledged && (
                    <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] font-bold text-[#047857]">
                      {copy.safetyAck}
                    </span>
                  )}
                </div>
                <p className="mt-3 font-body text-[20px] font-bold leading-relaxed text-[#2F241F]">
                  {analysis?.senior_message ?? copy.messageFallback}
                </p>
                {latestAlert && !latestAlert.resolved_at && (
                  <p className="mt-3 rounded-[18px] bg-[#FFF7ED] p-3 font-body text-[15px] font-bold text-[#92400E]">
                    {latestAlert.message}
                  </p>
                )}
              </div>
            </div>

            {!safetyAcknowledged && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {safetyStatus === "urgent_help" ? (
                  <button
                    type="button"
                    onClick={() => acknowledgeSafety("urgent_guidance_followed")}
                    disabled={acknowledging !== null}
                    className="flex min-h-[58px] items-center justify-center gap-2 rounded-[18px] bg-[#DC2626] px-4 font-body text-[17px] font-bold text-white disabled:opacity-60"
                    data-testid="button-safety-urgent"
                  >
                    {acknowledging === "urgent_guidance_followed" ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
                    {copy.urgent}
                  </button>
                ) : safetyStatus === "contact_doctor" ? (
                  <button
                    type="button"
                    onClick={() => acknowledgeSafety("contacted_doctor")}
                    disabled={acknowledging !== null}
                    className="flex min-h-[58px] items-center justify-center gap-2 rounded-[18px] bg-[#B45309] px-4 font-body text-[17px] font-bold text-white disabled:opacity-60"
                    data-testid="button-safety-doctor"
                  >
                    {acknowledging === "contacted_doctor" ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneCall className="h-5 w-5" />}
                    {copy.doctor}
                  </button>
                ) : safetyStatus === "share_with_caregiver" ? (
                  <button
                    type="button"
                    onClick={() => acknowledgeSafety("shared")}
                    disabled={acknowledging !== null}
                    className="flex min-h-[58px] items-center justify-center gap-2 rounded-[18px] bg-[#6B21A8] px-4 font-body text-[17px] font-bold text-white disabled:opacity-60"
                    data-testid="button-safety-share"
                  >
                    {acknowledging === "shared" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
                    {copy.share}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => acknowledgeSafety("recheck")}
                    disabled={acknowledging !== null}
                    className="flex min-h-[58px] items-center justify-center gap-2 rounded-[18px] bg-[#0369A1] px-4 font-body text-[17px] font-bold text-white disabled:opacity-60"
                    data-testid="button-safety-recheck"
                  >
                    {acknowledging === "recheck" ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                    {copy.recheck}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => acknowledgeSafety("dismissed")}
                  disabled={acknowledging !== null}
                  className="min-h-[58px] rounded-[18px] border border-[#E8DED4] bg-[#FAF9F6] px-4 font-body text-[17px] font-bold text-[#6B5B52] disabled:opacity-60"
                  data-testid="button-safety-dismiss"
                >
                  {acknowledging === "dismissed" ? copy.safetyAck : "OK"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {DASHBOARD_SIGNALS.map((key) => (
              <SignalCard
                key={key}
                signalKey={key}
                reading={latestBySignal[key]}
                language={language}
                normalLabel={copy.normal}
                todayLabel={copy.today}
              />
            ))}
          </div>

          {!analysis?.senior_message && recentReadings.length === 0 && (
            <div className="mt-5 rounded-[26px] border border-[#EDE5DB] bg-white p-5">
              <p className="font-body text-[20px] font-bold leading-relaxed text-[#6B5B52]">{copy.messageFallback}</p>
            </div>
          )}

          {error && <p className="mt-4 rounded-[18px] bg-[#FEF2F2] p-4 font-body text-[18px] font-bold text-[#B91C1C]">{error}</p>}

          <button
            type="button"
            onClick={() => setScreen("add")}
            className="mt-6 flex min-h-[76px] w-full items-center justify-center gap-3 rounded-[24px] bg-[#6B21A8] px-6 font-body text-[24px] font-bold text-white shadow-[0_12px_26px_rgba(107,33,168,0.24)]"
          >
            <Plus className="h-7 w-7" />
            {copy.add}
          </button>
          <p className="mt-4 text-center font-body text-[18px] font-bold text-[#7A6A60]">
            {copy.lastAnalysis}: {relativeTime(analysis?.analysed_at, language)}
          </p>
        </>
      )}
    </section>
  );
}

function getVisibleSignals(userConditions: string[]): Array<[SignalKey, typeof SIGNAL_CONFIG[SignalKey]]> {
  return (Object.entries(SIGNAL_CONFIG) as Array<[SignalKey, typeof SIGNAL_CONFIG[SignalKey]]>).filter(([, cfg]) =>
    cfg.conditions.length === 0 ||
    cfg.conditions.some((condition) => userConditions.includes(condition)),
  );
}

function latestReadingMap(readings: RecentReading[]): Partial<Record<SignalKey, RecentReading>> {
  const map: Partial<Record<SignalKey, RecentReading>> = {};
  for (const reading of readings) {
    if (reading.signal_type in SIGNAL_CONFIG && !map[reading.signal_type as SignalKey]) {
      map[reading.signal_type as SignalKey] = reading;
    }
  }
  return map;
}

function SignalCard({
  signalKey,
  reading,
  language,
  normalLabel,
  todayLabel,
}: {
  signalKey: SignalKey;
  reading?: RecentReading;
  language: Language;
  normalLabel: string;
  todayLabel: string;
}) {
  const cfg = SIGNAL_CONFIG[signalKey];
  const value = numberValue(reading?.value);
  const deviation = numberValue(reading?.deviation_pct);
  const display =
    signalKey === "medication_confirmed"
      ? value === 1
        ? "✓"
        : value === 0
          ? "—"
          : "--"
      : value == null
        ? "--"
        : `${value}${cfg.unit ? ` ${cfg.unit}` : ""}`;
  const subLabel =
    signalKey === "medication_confirmed"
      ? value === 1
        ? todayLabel
        : normalLabel
      : deviation == null
        ? normalLabel
        : `${deviation > 0 ? "+" : ""}${deviation}% ${deviation > 0 ? "↑" : "↓"}`;

  const sourceBadge = readingSourceBadge(reading, language);

  return (
    <article className="min-h-[152px] rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-[#6B21A8]">
          <SignalIcon type={cfg.icon} className="h-7 w-7" />
        </div>
        {sourceBadge && (
          <span className="rounded-full px-3 py-1 font-body text-[11px] font-bold" style={{ background: sourceBadge.bg, color: sourceBadge.color }}>
            {sourceBadge.label}
          </span>
        )}
      </div>
      <p className="font-body text-[18px] font-bold text-[#6B5B52]">{signalLabel(signalKey, cfg, language)}</p>
      <p className="mt-1 font-body text-[24px] font-bold leading-tight text-[#2F241F]">{display}</p>
      <p className="mt-2 font-body text-[18px] font-bold text-[#7A6A60]">{subLabel}</p>
    </article>
  );
}
