import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, Bell, Check, HeartPulse, Loader2, Moon, PhoneCall, Pill, Plus, RefreshCw, Share2, ShieldCheck, Smile, Sparkles, Stethoscope } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";

type Language = "es" | "de" | "en";
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
  },
};

const SIGNAL_CONFIG = {
  glucose_mgdl: {
    label: { es: "Glucosa", de: "Blutzucker", en: "Glucose" },
    unit: "mg/dL",
    icon: "drop",
    question: { es: "¿Cuánto marca tu glucómetro?", de: "Was zeigt dein Blutzuckermessgerät?", en: "What does your glucose meter show?" },
    contexts: [
      { key: "fasting", label: { es: "Ayunas", de: "Nüchtern", en: "Fasting" } },
      { key: "post_meal_2h", label: { es: "Tras comer", de: "Nach dem Essen", en: "After meal" } },
      { key: "nocturnal", label: { es: "Noche", de: "Nachts", en: "Night" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: ["diabetes_t2"],
  },
  resting_hr_bpm: {
    label: { es: "Pulso", de: "Puls", en: "Heart rate" },
    unit: "bpm",
    icon: "heart",
    question: { es: "¿Cuántas pulsaciones por minuto?", de: "Wie viele Herzschläge pro Minute?", en: "How many beats per minute?" },
    contexts: [
      { key: "morning", label: { es: "Por la mañana", de: "Morgens", en: "Morning" } },
      { key: "general", label: { es: "Ahora", de: "Jetzt", en: "Now" } },
    ],
    conditions: [],
  },
  bp_systolic: {
    label: { es: "Tensión", de: "Blutdruck", en: "Blood pressure" },
    unit: "mmHg",
    icon: "stethoscope",
    question: { es: "¿Cuánto marca el tensiómetro? (número alto)", de: "Was zeigt das Blutdruckmessgerät? (obere Zahl)", en: "What does the BP monitor show? (top number)" },
    contexts: [
      { key: "morning", label: { es: "Mañana", de: "Morgens", en: "Morning" } },
      { key: "evening", label: { es: "Tarde", de: "Abends", en: "Evening" } },
    ],
    conditions: ["hypertension", "chf"],
  },
  sleep_quality_score: {
    label: { es: "Sueño", de: "Schlaf", en: "Sleep" },
    unit: "/10",
    icon: "moon",
    question: { es: "¿Cómo dormiste anoche? (1 = muy mal, 10 = muy bien)", de: "Wie haben Sie letzte Nacht geschlafen? (1 = sehr schlecht, 10 = sehr gut)", en: "How did you sleep last night? (1 = very badly, 10 = very well)" },
    contexts: [{ key: "general", label: { es: "Anoche", de: "Letzte Nacht", en: "Last night" } }],
    conditions: [],
  },
  medication_confirmed: {
    label: { es: "Medicación", de: "Medikamente", en: "Medication" },
    unit: "",
    icon: "pill",
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
    question: { es: "¿Cómo te sientes hoy? (1 = muy mal, 10 = excelente)", de: "Wie fühlen Sie sich heute? (1 = sehr schlecht, 10 = ausgezeichnet)", en: "How are you feeling today? (1 = very bad, 10 = excellent)" },
    contexts: [{ key: "general", label: { es: "Hoy", de: "Heute", en: "Today" } }],
    conditions: [],
  },
} as const;

const DASHBOARD_SIGNALS: SignalKey[] = ["glucose_mgdl", "resting_hr_bpm", "sleep_quality_score", "medication_confirmed"];

function SignalIcon({ type, className = "" }: { type: string; className?: string }) {
  const common = `h-8 w-8 ${className}`;
  if (type === "heart") return <HeartPulse className={common} />;
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
  const labels = {
    es: ["Todo bien", "Atención leve", "Requiere atención", "Urgente"],
    de: ["Alles gut", "Leichte Aufmerksamkeit", "Aufmerksamkeit erforderlich", "Dringend"],
    en: ["All good", "Mild attention", "Needs attention", "Urgent"],
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
  };
  return labels[language][status];
}

function relativeTime(iso: string | null | undefined, language: Language) {
  if (!iso) return COPY[language].noAnalysis;
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
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

  const [selectedSignal, setSelectedSignal] = useState<SignalKey>("glucose_mgdl");
  const [inputValue, setInputValue] = useState("");
  const [selectedContext, setSelectedContext] = useState("general");
  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const copy = COPY[language];
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
      setError(language === "es" ? "No pude cargar tus signos ahora." : "Could not load vitals right now.");
    } finally {
      setLoading(false);
    }
  }, [language, userId]);

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
          source: "manual",
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
      setError(language === "es" ? "No pude guardar este dato." : "Could not save this reading.");
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
      setError(language === "es" ? "El análisis no se pudo completar." : "The analysis could not finish.");
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
      setError(language === "es" ? "No pude guardar esta accion." : "Could not record this action.");
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
                {cfg.label[language]}
              </button>
            );
          })}
        </div>

        <div className="my-7 h-px bg-[#E8DED4]" />

        <h2 className="font-display text-[30px] italic leading-tight text-[#2F241F]">
          {selectedConfig.question[language]}
        </h2>

        {openedFromGlucoseAction ? (
          <div className="mt-5 rounded-[24px] border border-[#DDD6FE] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-[#6B21A8]">
                <Activity className="h-6 w-6" />
              </span>
              <div>
                <p className="font-body text-[19px] font-black leading-tight text-[#2F241F]">
                  {addSource === "connected"
                    ? language === "es" ? "Buscar sensor conectado" : "Check connected sensor"
                    : language === "es" ? "Entrada manual de glucosa" : "Manual glucose entry"}
                </p>
                <p className="mt-1 font-body text-[16px] font-bold leading-snug text-[#6B5B52]">
                  {addSource === "connected"
                    ? language === "es"
                      ? "Si no hay lectura automatica disponible, introduce el numero del glucometro aqui."
                      : "If no automatic reading is available, enter the number from the glucose meter here."
                    : language === "es"
                      ? "Escribe el numero del glucometro para guardarlo con tus signos."
                      : "Type the number from the glucose meter to save it with your vitals."}
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
              placeholder={copy.valuePlaceholder}
              className="min-w-0 flex-1 bg-transparent font-body text-[72px] font-bold leading-none text-[#2F241F] outline-none placeholder:text-[#D6C7BA]"
            />
            <span className="pb-3 font-body text-[22px] font-bold text-[#7A6A60]">{selectedConfig.unit}</span>
          </div>
        )}

        <p className="mt-7 font-body text-[20px] font-bold text-[#3B2C25]">
          {language === "es" ? "¿Cuándo fue esta medición?" : language === "de" ? "Wann war diese Messung?" : "When was this reading?"}
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
                {context.label[language]}
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

  return (
    <article className="min-h-[152px] rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-[#6B21A8]">
        <SignalIcon type={cfg.icon} className="h-7 w-7" />
      </div>
      <p className="font-body text-[18px] font-bold text-[#6B5B52]">{cfg.label[language]}</p>
      <p className="mt-1 font-body text-[24px] font-bold leading-tight text-[#2F241F]">{display}</p>
      <p className="mt-2 font-body text-[18px] font-bold text-[#7A6A60]">{subLabel}</p>
    </article>
  );
}
