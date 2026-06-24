import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  Bluetooth,
  Calendar,
  Camera,
  Check,
  Car,
  ChevronLeft,
  ClipboardList,
  Heart,
  Keyboard,
  LucideIcon,
  Loader2,
  Mail,
  Mic,
  Phone,
  ScanLine,
  Scale,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  UserPlus,
  Video,
  Wind,
  X,
} from "lucide-react";
import VitalsScan from "@/components/VitalsScan";
import {
  HealthWizardCard,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { sanitizePhoneHref } from "@/lib/emergencyContacts";
import { VITALS_DEVICE_CATALOG, type VitalsDeviceCatalogItem, type VitalsDeviceKind } from "@/lib/vitalsDeviceCatalog";
import {
  isWebBluetoothSupported,
  readStandardBluetoothDevice,
  type BluetoothCaptureState,
} from "@/lib/vitalsBluetooth";
import { type VitalsSourceConfidence } from "../../shared/vitalsEvidence";
import {
  VITALS_SIGNAL_CATALOG,
  promptSignalsForProfile,
  type VitalsSignalKey,
} from "../../shared/vitalsSignalCatalog";
import {
  formatVitalsReadingDisplay,
  type ProposedVitalsReading,
  type VitalsParsingResult,
} from "../../shared/vitalsParsing";

type MetricType = "hr" | "rr" | "bp";
type ReadingSource = "phone_estimate" | "manual_entry" | "connected_device" | "clinical";

interface VitalsSummaryEntry {
  latest_value: string | null;
  latest_recorded_at: string | null;
  latest_source?: ReadingSource | null;
  latest_source_confidence?: VitalsSourceConfidence | null;
  latest_source_confidence_reason?: string | null;
  latest_source_display_label?: string | null;
  latest_source_context_label?: string | null;
  trend: (string | null)[];
  has_data: boolean;
}

interface VitalsResponse {
  summary: Record<string, VitalsSummaryEntry>;
  compliance_days: boolean[];
}

type VitalsCaptureMode = "text" | "voice" | "photo";

type VitalsEngineLatestResponse = {
  recent_readings?: Array<{
    signal_type: string;
    recorded_at?: string | null;
  }>;
};

interface MetricMeta {
  id: MetricType;
  Icon: LucideIcon;
  labelKey: string;
  fallbackLabel: string;
  unit: string;
  placeholder: string;
  accent: string;
  soft: string;
  range?: { low: number; high: number };
}

const METRIC_META: Record<MetricType, MetricMeta> = {
  hr: {
    id: "hr",
    Icon: Heart,
    labelKey: "statusVitals.metrics.heartRate",
    fallbackLabel: "Heart rate",
    unit: "bpm",
    placeholder: "72",
    accent: "#BE123C",
    soft: "#FFF1F2",
    range: { low: 50, high: 100 },
  },
  rr: {
    id: "rr",
    Icon: Wind,
    labelKey: "statusVitals.metrics.respiration",
    fallbackLabel: "Respiration",
    unit: "rpm",
    placeholder: "16",
    accent: "#0369A1",
    soft: "#EFF6FF",
    range: { low: 12, high: 20 },
  },
  bp: {
    id: "bp",
    Icon: Activity,
    labelKey: "statusVitals.metrics.bloodPressure",
    fallbackLabel: "Blood pressure",
    unit: "mmHg",
    placeholder: "118/76",
    accent: "#6B21A8",
    soft: "#F5F3FF",
  },
};

const ENGINE_SIGNAL_BY_METRIC: Record<MetricType, string> = {
  hr: "resting_hr_bpm",
  rr: "respiratory_rate",
  bp: "bp_systolic",
};

const DEVICE_ICON_BY_ID: Record<VitalsDeviceKind, LucideIcon> = {
  bp_cuff: Activity,
  pulse_oximeter: Wind,
  thermometer: Thermometer,
  glucose_meter: Stethoscope,
  weight_scale: Scale,
  heart_monitor: Heart,
};

const FACE_SCAN_DURATION_MS = 20_000;
const FACE_SCAN_FPS = 15;

const VITALS_AUDIO_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function supportedVitalsAudioType() {
  if (typeof MediaRecorder === "undefined") return "";
  return VITALS_AUDIO_TYPES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) ?? "";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function faceScanDurationMs() {
  const testWindow = window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number };
  return typeof testWindow.__VYVA_FACE_SCAN_TEST_DURATION_MS === "number"
    ? Math.max(1, testWindow.__VYVA_FACE_SCAN_TEST_DURATION_MS)
    : FACE_SCAN_DURATION_MS;
}

async function captureVitalLensPayload(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<{ video: string; fps: number; duration_seconds: number }> {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read camera frames.");

  canvas.width = 40;
  canvas.height = 40;
  const durationMs = faceScanDurationMs();
  const frameIntervalMs = 1000 / FACE_SCAN_FPS;
  const chunks: Uint8Array[] = [];
  const startedAt = performance.now();

  return new Promise((resolve, reject) => {
    const capture = () => {
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const rgb = new Uint8Array(canvas.width * canvas.height * 3);
        for (let src = 0, dest = 0; src < image.data.length; src += 4) {
          rgb[dest++] = image.data[src];
          rgb[dest++] = image.data[src + 1];
          rgb[dest++] = image.data[src + 2];
        }
        chunks.push(rgb);

        if (performance.now() - startedAt >= durationMs) {
          const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const payload = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            payload.set(chunk, offset);
            offset += chunk.length;
          }
          resolve({
            video: bytesToBase64(payload),
            fps: FACE_SCAN_FPS,
            duration_seconds: Math.round((durationMs / 1000) * 10) / 10,
          });
          return;
        }
        window.setTimeout(capture, frameIntervalMs);
      } catch (err) {
        reject(err);
      }
    };
    capture();
  });
}

function isTodayReading(iso?: string | null) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function publicSignalLabel(signal: VitalsSignalKey) {
  if (signal === "bp_systolic" || signal === "bp_diastolic") return "Blood pressure";
  return VITALS_SIGNAL_CATALOG[signal].shortLabel;
}

type ProposedVitalsReadingCard = {
  key: string;
  display: string;
  explanation: string;
  confidence: VitalsSourceConfidence;
};

function lowerConfidence(a: VitalsSourceConfidence, b: VitalsSourceConfidence): VitalsSourceConfidence {
  const rank: Record<VitalsSourceConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[a] <= rank[b] ? a : b;
}

function proposedVitalsReadingCards(readings: ProposedVitalsReading[]): ProposedVitalsReadingCard[] {
  const systolic = readings.find((reading) => reading.signal_type === "bp_systolic");
  const diastolic = readings.find((reading) => reading.signal_type === "bp_diastolic");
  const cards: ProposedVitalsReadingCard[] = [];

  for (const reading of readings) {
    if (reading.signal_type === "bp_systolic" && diastolic) {
      cards.push({
        key: "blood-pressure-pair",
        display: `Blood pressure: ${reading.value}/${diastolic.value} mmHg`,
        explanation: "Blood pressure reading detected.",
        confidence: lowerConfidence(reading.confidence, diastolic.confidence),
      });
      continue;
    }

    if (reading.signal_type === "bp_diastolic" && systolic) continue;

    cards.push({
      key: `${reading.signal_type}-${reading.value}-${reading.context_tag}`,
      display: formatVitalsReadingDisplay(reading),
      explanation: reading.explanation,
      confidence: reading.confidence,
    });
  }

  return cards;
}

function readingsPayloadFromProposed(readings: ProposedVitalsReading[]) {
  return readings.map((reading) => ({
    signal_type: reading.signal_type,
    value: reading.value,
    source: reading.source,
    capture_method: reading.capture_method,
    context_tag: reading.context_tag,
    unit: reading.unit,
    recorded_at: reading.recorded_at,
    source_ref: reading.source_ref,
  }));
}

type VitalsStatusServiceActionKind =
  | "call_gp"
  | "email_gp"
  | "doctor_help"
  | "add_doctor_contact"
  | "schedule_appointment"
  | "book_ride";

type VitalsStatusServiceAction = {
  kind: VitalsStatusServiceActionKind;
  label: string;
  href?: string;
  to?: string;
  state?: Record<string, unknown>;
};

type VitalsStatusServiceLabels = {
  callGp: string;
  callGpWithName: string;
  emailGp: string;
  doctorHelp: string;
  addDoctor: string;
  appointment: string;
  ride: string;
  appointmentPrefill: string;
  ridePrefill: string;
};

export function vitalsStatusServiceActionsFor({
  gpName,
  gpPhone,
  gpEmail,
  context,
  labels,
}: {
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
  context: string;
  labels: VitalsStatusServiceLabels;
}): VitalsStatusServiceAction[] {
  const actions: VitalsStatusServiceAction[] = [];
  const gpPhoneHref = sanitizePhoneHref(gpPhone);
  const email = gpEmail?.trim() ?? "";
  const displayName = gpName?.trim();
  const safeContext = context.trim() || "VYVA vitals summary requested.";

  if (gpPhoneHref) {
    actions.push({
      kind: "call_gp",
      label: displayName ? labels.callGpWithName.replace("{{name}}", displayName) : labels.callGp,
      href: gpPhoneHref,
    });
  }

  if (email) {
    actions.push({
      kind: "email_gp",
      label: labels.emailGp,
      href: `mailto:${email}?subject=${encodeURIComponent("VYVA vitals summary")}&body=${encodeURIComponent(safeContext)}`,
    });
  }

  if (!gpPhoneHref && !email) {
    actions.push({
      kind: "add_doctor_contact",
      label: labels.addDoctor,
      to: "/onboarding/profile/gp",
    });
  }

  actions.push({
    kind: "doctor_help",
    label: labels.doctorHelp,
    to: "/health/doctor",
    state: {
      autoStartVoice: true,
      latestSymptomReport: safeContext,
      source: "vitals_status",
    },
  });

  actions.push({
    kind: "schedule_appointment",
    label: labels.appointment,
    to: "/concierge",
    state: {
      conciergePrefill: {
        kind: "appointment",
        message: `${labels.appointmentPrefill}\n\nContext:\n${safeContext}`,
        source: "vitals_safety",
      },
    },
  });

  actions.push({
    kind: "book_ride",
    label: labels.ride,
    to: "/concierge",
    state: {
      conciergePrefill: {
        kind: "ride",
        message: `${labels.ridePrefill}\n\nContext:\n${safeContext}`,
        source: "vitals_safety",
      },
    },
  });

  return actions;
}

function parseNumericValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.split("/")[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRecordedAt(iso: string | null, language: string): string {
  if (!iso) return "--";
  const date = new Date(iso);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return `${language.startsWith("es") ? "Hoy" : "Today"}, ${date.toLocaleTimeString(language, {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  if (diffHours < 48) return language.startsWith("es") ? "Ayer" : "Yesterday";
  return date.toLocaleDateString(language, { day: "numeric", month: "short" });
}

function getMetricState(meta: MetricMeta, value: string | null) {
  const numeric = parseNumericValue(value);
  if (!numeric) return { tone: "neutral", color: "#6B7280", bg: "#F3F4F6" };
  if (!meta.range) return { tone: "logged", color: "#6B21A8", bg: "#F5F3FF" };
  if (numeric < meta.range.low || numeric > meta.range.high) return { tone: "review", color: "#B45309", bg: "#FEF3C7" };
  return { tone: "steady", color: "#047857", bg: "#D1FAE5" };
}

function LogReadingModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [metricType, setMetricType] = useState<MetricType>("hr");
  const [value, setValue] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/vitals", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ metric_type: metricType, value: value.trim(), source: "manual_entry" }),
      });
      if (!response.ok) throw new Error("Failed to save reading");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.savedBody", "Your vitals timeline has been updated."),
      });
      onClose();
    },
    onError: () => {
      toast({
        title: t("statusVitals.saveErrorTitle", "Could not save reading"),
        description: t("statusVitals.saveErrorBody", "Please try again in a moment."),
        variant: "destructive",
      });
    },
  });

  const activeMetric = METRIC_META[metricType];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="w-full max-w-[520px] rounded-t-[30px] bg-white px-5 pb-8 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[24px] italic leading-tight text-vyva-text-1">
              {t("statusVitals.logTitle", "Log a reading")}
            </h2>
            <p className="mt-1 font-body text-[13px] text-vyva-text-2">
              {t("statusVitals.logSubtitle", "Add a confirmed number from a device or manual check.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
            data-testid="button-close-log-modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          {(Object.keys(METRIC_META) as MetricType[]).map((key) => {
            const meta = METRIC_META[key];
            const Icon = meta.Icon;
            const active = metricType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMetricType(key);
                  setValue("");
                }}
                className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[18px] border px-2 py-3 active:scale-[0.98]"
                style={{
                  background: active ? meta.accent : "#F9F6F2",
                  borderColor: active ? meta.accent : "#EDE5DB",
                  color: active ? "#FFFFFF" : meta.accent,
                }}
                data-testid={`button-metric-select-${key}`}
              >
                <Icon size={18} />
                <span className="font-body text-[11px] font-bold leading-tight">{meta.unit}</span>
              </button>
            );
          })}
        </div>

        <label className="mb-2 block font-body text-[12px] font-bold uppercase tracking-[0.1em] text-vyva-text-2" htmlFor="vitals-value-input">
          {t(activeMetric.labelKey, activeMetric.fallbackLabel)} ({activeMetric.unit})
        </label>
        <input
          id="vitals-value-input"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={activeMetric.placeholder}
          className="mb-5 w-full rounded-[18px] border-2 border-transparent bg-[#F7F1E9] px-4 py-4 font-body text-[22px] font-bold text-vyva-text-1 outline-none focus:border-[#6B21A8]"
          data-testid="input-vitals-value"
        />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!value.trim() || mutation.isPending}
          className="vyva-primary-action w-full"
          data-testid="button-save-vital"
        >
          {mutation.isPending ? t("statusVitals.saving", "Saving...") : t("statusVitals.saveReading", "Save reading")}
        </button>
      </section>
    </div>
  );
}

function ScanModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-white">
      <section className="flex min-h-screen w-full max-w-[520px] flex-col bg-[#FBF7F2]">
        <div className="flex items-center justify-between border-b border-[#EDE5DB] bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-[22px] italic text-vyva-text-1">
              {t("statusVitals.scanTitle", "Vitals scan")}
            </h2>
            <p className="font-body text-[12px] text-vyva-text-2">
              {t("statusVitals.scanSubtitle", "Camera estimate, not a medical device reading")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
            data-testid="button-close-scan-modal"
          >
            <X size={18} />
          </button>
        </div>
        <VitalsScan
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] });
            onClose();
          }}
        />
      </section>
    </div>
  );
}

function VitalsCaptureModal({
  mode,
  onClose,
  initialSignal,
}: {
  mode: VitalsCaptureMode;
  onClose: () => void;
  initialSignal?: VitalsSignalKey | null;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [inputText, setInputText] = useState(initialSignal ? `${publicSignalLabel(initialSignal)} ` : "");
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<VitalsParsingResult | null>(null);
  const [error, setError] = useState("");

  const proposed = useMemo(() => result?.proposed_readings ?? [], [result?.proposed_readings]);
  const proposedCards = useMemo(() => proposedVitalsReadingCards(proposed), [proposed]);
  const title =
    mode === "voice"
      ? t("statusVitals.capture.voiceTitle", "Say a reading")
      : mode === "photo"
        ? t("statusVitals.capture.photoTitle", "Scan a device screen")
        : t("statusVitals.capture.textTitle", "Type a reading");
  const subtitle =
    mode === "voice"
      ? t("statusVitals.capture.voiceSubtitle", "Say something like: blood pressure 128 over 76, oxygen 97, sugar 142.")
      : mode === "photo"
        ? t("statusVitals.capture.photoSubtitle", "Take or upload a clear photo of the number on your device.")
        : t("statusVitals.capture.textSubtitle", "Use natural words. VYVA will pull out the numbers for you to confirm.");

  const parseText = useCallback(async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/parse-text", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ text: inputText.trim(), capture_method: "manual", source: "manual_entry" }),
      });
      if (!response.ok) throw new Error("parse failed");
      setResult(await response.json() as VitalsParsingResult);
    } catch {
      setError(t("statusVitals.capture.parseError", "I could not read that yet. Try a simpler phrase or type the number."));
    } finally {
      setIsParsing(false);
    }
  }, [inputText, t]);

  const sendAudio = useCallback(async (blob: Blob) => {
    setIsParsing(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/parse-audio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!response.ok) throw new Error("audio parse failed");
      setResult(await response.json() as VitalsParsingResult);
    } catch {
      setError(t("statusVitals.capture.voiceError", "I could not read the voice note. You can type it instead."));
    } finally {
      setIsParsing(false);
    }
  }, [t]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("statusVitals.capture.voiceUnsupported", "Voice capture is not available on this browser."));
      return;
    }
    setError("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = supportedVitalsAudioType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) void sendAudio(blob);
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setError(t("statusVitals.capture.voicePermission", "Microphone access is needed to say a reading."));
    }
  }, [sendAudio, t]);

  const parsePhoto = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setError("");
    try {
      const image = await fileToDataUrl(file);
      const response = await apiFetch("/api/vitals-engine/scan-device-photo", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ image }),
      });
      if (!response.ok) throw new Error("photo parse failed");
      setResult(await response.json() as VitalsParsingResult);
    } catch {
      setError(t("statusVitals.capture.photoError", "I could not read that photo. Try a clearer image or type the number."));
    } finally {
      setIsParsing(false);
    }
  }, [t]);

  const saveReadings = useCallback(async () => {
    if (!proposed.length) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/readings", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          readings: readingsPayloadFromProposed(proposed),
        }),
      });
      if (!response.ok) throw new Error("save failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/vitals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest", "hub-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] }),
      ]);
      window.dispatchEvent(new Event("vyva:vitals-updated"));
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.savedBody", "Your vitals timeline has been updated."),
      });
      onClose();
    } catch {
      setError(t("statusVitals.saveErrorBody", "Please try again in a moment."));
    } finally {
      setIsSaving(false);
    }
  }, [onClose, proposed, queryClient, t, toast]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-8 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[26px] italic leading-tight text-vyva-text-1">{title}</h2>
            <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
          >
            <X size={18} />
          </button>
        </div>

        {mode === "text" && (
          <div className="grid gap-3">
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={t("statusVitals.capture.textPlaceholder", "BP 128/76, oxygen 97, sugar 142...")}
              className="min-h-[132px] rounded-[22px] border border-[#DDD6FE] bg-[#FAF9F6] px-4 py-4 font-body text-[18px] font-bold leading-snug text-vyva-text-1 outline-none focus:border-[#7C3AED]"
              data-testid="textarea-vitals-reading"
            />
            <button
              type="button"
              onClick={parseText}
              disabled={!inputText.trim() || isParsing}
              className="vyva-primary-action min-h-[58px] text-[17px] disabled:opacity-60"
              data-testid="button-parse-vitals-text"
            >
              {isParsing ? <Loader2 size={18} className="animate-spin" /> : <Keyboard size={18} />}
              {isParsing ? t("statusVitals.capture.reading", "Reading...") : t("statusVitals.capture.findReadings", "Find readings")}
            </button>
          </div>
        )}

        {mode === "voice" && (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isParsing}
              className={`flex min-h-[96px] items-center justify-center gap-3 rounded-[24px] px-5 font-body text-[20px] font-black text-white shadow-[0_12px_26px_rgba(107,33,168,0.24)] ${isRecording ? "bg-[#BE123C]" : "bg-[#6B21A8]"}`}
              data-testid="button-vitals-voice-record"
            >
              {isParsing ? <Loader2 size={22} className="animate-spin" /> : <Mic size={24} />}
              {isParsing
                ? t("statusVitals.capture.reading", "Reading...")
                : isRecording
                  ? t("statusVitals.capture.stopRecording", "Stop")
                  : t("statusVitals.capture.startRecording", "Record reading")}
            </button>
            <p className="rounded-[18px] border border-[#EDE5DB] bg-[#FAF9F6] px-4 py-3 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
              {t("statusVitals.capture.voiceHint", "VYVA only uses this voice note to extract the numbers you confirm here.")}
            </p>
          </div>
        )}

        {mode === "photo" && (
          <div className="grid gap-3">
            <label className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-[#BDA7FF] bg-[#F5F3FF] px-5 text-center font-body text-[17px] font-black text-[#6B21A8]">
              {isParsing ? <Loader2 size={24} className="animate-spin" /> : <Camera size={26} />}
              {isParsing ? t("statusVitals.capture.reading", "Reading...") : t("statusVitals.capture.choosePhoto", "Take or upload photo")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={parsePhoto}
                className="hidden"
                data-testid="input-vitals-device-photo"
              />
            </label>
            <p className="rounded-[18px] border border-[#EDE5DB] bg-[#FAF9F6] px-4 py-3 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
              {t("statusVitals.capture.photoHint", "Photos are used to read the device number. Confirm before anything is saved.")}
            </p>
          </div>
        )}

        {result?.transcript && mode !== "text" && (
          <p className="mt-4 rounded-[18px] bg-[#FAF9F6] px-4 py-3 font-body text-[13px] font-semibold text-vyva-text-2">
            {result.transcript}
          </p>
        )}

        {result?.clarification_prompt && (
          <p className="mt-4 rounded-[18px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#92400E]">
            {result.clarification_prompt}
          </p>
        )}

        {proposed.length > 0 && (
          <div className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.11em] text-vyva-purple">
              {t("statusVitals.capture.confirmTitle", "Confirm before saving")}
            </p>
            <div className="mt-3 grid gap-2">
              {proposedCards.map((reading) => (
                <div key={reading.key} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <Check size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">
                      {reading.display}
                    </p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                      {reading.explanation} {reading.confidence === "medium" ? t("statusVitals.confidence.medium", "Medium") : reading.confidence}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveReadings}
              disabled={isSaving}
              className="vyva-primary-action mt-4 min-h-[60px] w-full text-[18px] disabled:opacity-60"
              data-testid="button-confirm-vitals-readings"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? t("statusVitals.saving", "Saving...") : t("statusVitals.capture.saveConfirmed", "Save confirmed readings")}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function BluetoothDeviceModal({
  device,
  onClose,
  onFallback,
}: {
  device: VitalsDeviceCatalogItem;
  onClose: () => void;
  onFallback: (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<BluetoothCaptureState>(isWebBluetoothSupported() ? "supported" : "unsupported");
  const [result, setResult] = useState<VitalsParsingResult | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const proposed = useMemo(() => result?.proposed_readings ?? [], [result?.proposed_readings]);
  const proposedCards = useMemo(() => proposedVitalsReadingCards(proposed), [proposed]);
  const Icon = DEVICE_ICON_BY_ID[device.id];
  const primarySignal = device.fallbackSignals[0];

  const stateCopy: Record<BluetoothCaptureState, string> = {
    supported: t("statusVitals.bluetooth.supported", "Ready to search nearby Bluetooth devices."),
    unsupported: t("statusVitals.bluetooth.unsupported", "Bluetooth is not available in this browser. You can scan, say, or type the reading instead."),
    searching: t("statusVitals.bluetooth.searching", "Searching for your device..."),
    connected: t("statusVitals.bluetooth.connected", "Connected. Keep the device nearby."),
    waiting: t("statusVitals.bluetooth.waiting", "Waiting for the measurement..."),
    reading_found: t("statusVitals.bluetooth.readingFound", "Reading found."),
    needs_confirmation: t("statusVitals.bluetooth.confirm", "Please confirm before saving."),
    failed: t("statusVitals.bluetooth.failed", "Could not read this device. Use scan, voice, or type instead."),
  };

  const startBluetooth = useCallback(async () => {
    setError("");
    setResult(null);
    try {
      const readResult = await readStandardBluetoothDevice(device, setState);
      setResult({
        proposed_readings: readResult.readings,
        needs_confirmation: true,
        clarification_prompt: t("statusVitals.bluetooth.confirmPrompt", "Confirm these Bluetooth readings before VYVA saves them."),
        transcript: readResult.deviceName,
      });
    } catch (err) {
      setState(isWebBluetoothSupported() ? "failed" : "unsupported");
      setError(err instanceof Error ? err.message : t("statusVitals.bluetooth.failed", "Could not read this device."));
    }
  }, [device, t]);

  const saveReadings = useCallback(async () => {
    if (!proposed.length) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/readings", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ readings: readingsPayloadFromProposed(proposed) }),
      });
      if (!response.ok) throw new Error("save failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/vitals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest", "hub-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] }),
      ]);
      window.dispatchEvent(new Event("vyva:vitals-updated"));
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.bluetooth.saved", "Bluetooth reading added to your vitals."),
      });
      onClose();
    } catch {
      setError(t("statusVitals.saveErrorBody", "Please try again in a moment."));
    } finally {
      setIsSaving(false);
    }
  }, [onClose, proposed, queryClient, t, toast]);

  const fallback = (mode: VitalsCaptureMode) => {
    onClose();
    onFallback(mode, mode === "photo" ? undefined : primarySignal);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-8 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]" data-testid="bluetooth-device-modal">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ color: device.accent, background: device.bg }}>
              <Icon size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[26px] italic leading-tight text-vyva-text-1">{device.label}</h2>
              <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">{device.helper}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#6B21A8]">
              {state === "searching" || state === "waiting" ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.11em] text-vyva-purple">
                {t("statusVitals.bluetooth.title", "Bluetooth device")}
              </p>
              <p className="mt-1 font-body text-[15px] font-bold leading-snug text-vyva-text-1" data-testid={`bluetooth-state-${state}`}>
                {stateCopy[state]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={startBluetooth}
            disabled={state === "searching" || state === "waiting" || state === "connected"}
            className="vyva-primary-action mt-4 min-h-[58px] w-full text-[17px] disabled:opacity-60"
            data-testid="button-start-bluetooth"
          >
            {state === "searching" || state === "waiting" ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
            {t("statusVitals.bluetooth.try", "Try Bluetooth")}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => fallback("photo")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-2 font-body text-[12px] font-black text-[#1D4ED8]"
            data-testid="button-bluetooth-fallback-photo"
          >
            <Camera size={17} />
            {t("statusVitals.capture.photoShort", "Scan")}
          </button>
          <button
            type="button"
            onClick={() => fallback("voice")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[18px] border border-[#FED7AA] bg-[#FFF7ED] px-2 font-body text-[12px] font-black text-[#B45309]"
            data-testid="button-bluetooth-fallback-voice"
          >
            <Mic size={17} />
            {t("statusVitals.capture.voiceShort", "Say")}
          </button>
          <button
            type="button"
            onClick={() => fallback("text")}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[18px] border border-[#DDD6FE] bg-[#F5F3FF] px-2 font-body text-[12px] font-black text-[#6B21A8]"
            data-testid="button-bluetooth-fallback-type"
          >
            <Keyboard size={17} />
            {t("statusVitals.capture.typeShort", "Type")}
          </button>
        </div>

        {result?.clarification_prompt && (
          <p className="mt-4 rounded-[18px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#6B21A8]">
            {result.clarification_prompt}
          </p>
        )}

        {proposed.length > 0 && (
          <div className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.11em] text-vyva-purple">
              {t("statusVitals.capture.confirmTitle", "Confirm before saving")}
            </p>
            <div className="mt-3 grid gap-2">
              {proposedCards.map((reading) => (
                <div key={reading.key} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <Check size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">{reading.display}</p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                      {reading.explanation} {t("statusVitals.confidence.high", "High")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveReadings}
              disabled={isSaving}
              className="vyva-primary-action mt-4 min-h-[60px] w-full text-[18px] disabled:opacity-60"
              data-testid="button-confirm-bluetooth-readings"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? t("statusVitals.saving", "Saving...") : t("statusVitals.capture.saveConfirmed", "Save confirmed readings")}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function FaceScanModal({
  onClose,
  onLocalScan,
}: {
  onClose: () => void;
  onLocalScan: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "camera" | "scanning" | "reading" | "needs_confirmation" | "not_configured" | "failed">("idle");
  const [result, setResult] = useState<VitalsParsingResult | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const proposed = useMemo(() => result?.proposed_readings ?? [], [result?.proposed_readings]);
  const proposedCards = useMemo(() => proposedVitalsReadingCards(proposed), [proposed]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startScan = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("failed");
      setError(t("statusVitals.faceScan.unsupported", "Camera access is not available on this browser."));
      return;
    }

    setError("");
    setResult(null);
    try {
      setStatus("camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current || !canvasRef.current) throw new Error("Camera preview is not ready.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("scanning");
      const payload = await captureVitalLensPayload(videoRef.current, canvasRef.current);
      stream.getTracks().forEach((track) => track.stop());
      setStatus("reading");
      const response = await apiFetch("/api/vitals-engine/face-scan", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("face scan failed");
      const parsed = await response.json() as VitalsParsingResult;
      setResult(parsed);
      if (parsed.proposed_readings.length > 0) {
        setStatus("needs_confirmation");
      } else {
        setStatus("not_configured");
      }
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setStatus("failed");
      setError(err instanceof Error ? err.message : t("statusVitals.faceScan.failed", "Face scan did not complete."));
    }
  }, [t]);

  const saveReadings = useCallback(async () => {
    if (!proposed.length) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/readings", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ readings: readingsPayloadFromProposed(proposed) }),
      });
      if (!response.ok) throw new Error("save failed");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/vitals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/vitals-engine/latest", "hub-prompts"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] }),
      ]);
      window.dispatchEvent(new Event("vyva:vitals-updated"));
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.faceScan.saved", "Face scan estimate added to your vitals."),
      });
      onClose();
    } catch {
      setError(t("statusVitals.saveErrorBody", "Please try again in a moment."));
    } finally {
      setIsSaving(false);
    }
  }, [onClose, proposed, queryClient, t, toast]);

  const useLocalScan = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onClose();
    onLocalScan();
  };

  const statusText = {
    idle: t("statusVitals.faceScan.idle", "Use your front camera for heart rate, breathing, and HRV estimates."),
    camera: t("statusVitals.faceScan.camera", "Opening camera..."),
    scanning: t("statusVitals.faceScan.scanning", "Hold still while VYVA captures a short face scan."),
    reading: t("statusVitals.faceScan.reading", "Reading estimates securely..."),
    needs_confirmation: t("statusVitals.faceScan.confirm", "Confirm before saving."),
    not_configured: result?.clarification_prompt ?? t("statusVitals.faceScan.notConfigured", "VitalLens is not configured yet. You can use the local phone estimate instead."),
    failed: t("statusVitals.faceScan.failed", "Face scan did not complete."),
  }[status];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-8 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]" data-testid="face-scan-modal">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-[#6B21A8]">
              <Video size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[26px] italic leading-tight text-vyva-text-1">
                {t("statusVitals.faceScan.title", "Face scan")}
              </h2>
              <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                {t("statusVitals.faceScan.subtitle", "Camera estimates are for wellness trends and always need confirmation.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-[#EDE5DB] bg-[#151026]">
          <video ref={videoRef} playsInline muted className="h-[260px] w-full object-cover" style={{ transform: "scaleX(-1)" }} />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <p className="mt-4 rounded-[18px] border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#6B21A8]" data-testid={`face-scan-status-${status}`}>
          {statusText}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={startScan}
            disabled={status === "camera" || status === "scanning" || status === "reading"}
            className="vyva-primary-action min-h-[60px] text-[17px] disabled:opacity-60"
            data-testid="button-start-face-scan"
          >
            {status === "camera" || status === "scanning" || status === "reading" ? <Loader2 size={18} className="animate-spin" /> : <Video size={18} />}
            {t("statusVitals.faceScan.start", "Start face scan")}
          </button>
          <button
            type="button"
            onClick={useLocalScan}
            className="vyva-secondary-action min-h-[60px] rounded-full text-[17px]"
            data-testid="button-use-local-phone-scan"
          >
            <ScanLine size={18} />
            {t("statusVitals.faceScan.local", "Phone estimate")}
          </button>
        </div>

        {proposed.length > 0 && (
          <div className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.11em] text-vyva-purple">
              {t("statusVitals.capture.confirmTitle", "Confirm before saving")}
            </p>
            <div className="mt-3 grid gap-2">
              {proposedCards.map((reading) => (
                <div key={reading.key} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <Check size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">{reading.display}</p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                      {reading.explanation} {reading.confidence === "medium" ? t("statusVitals.confidence.medium", "Medium") : reading.confidence}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={saveReadings}
              disabled={isSaving}
              className="vyva-primary-action mt-4 min-h-[60px] w-full text-[18px] disabled:opacity-60"
              data-testid="button-confirm-face-scan-readings"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? t("statusVitals.saving", "Saving...") : t("statusVitals.capture.saveConfirmed", "Save confirmed readings")}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function AddReadingSheet({
  selectedSignal,
  onClose,
  onCapture,
  onFaceScan,
  onConnectDevice,
}: {
  selectedSignal: VitalsSignalKey | null;
  onClose: () => void;
  onCapture: (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => void;
  onFaceScan: () => void;
  onConnectDevice: () => void;
}) {
  const { t } = useTranslation();
  const signalLabel = selectedSignal ? publicSignalLabel(selectedSignal) : null;
  const captureWithSignal = (mode: VitalsCaptureMode) => {
    onClose();
    onCapture(mode, selectedSignal ?? undefined);
  };

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/40 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-7 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]" data-testid="add-reading-sheet">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[27px] italic leading-tight text-vyva-text-1">
              {t("statusVitals.addSheet.title", "Add a reading")}
            </h2>
            <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
              {signalLabel
                ? t("statusVitals.addSheet.signalSubtitle", { defaultValue: "Choose how to add {{label}}.", label: signalLabel })
                : t("statusVitals.addSheet.subtitle", "Choose the easiest way. VYVA saves only after you confirm.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
            data-testid="button-close-add-reading-sheet"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onFaceScan();
            }}
            className="flex min-h-[70px] items-center gap-4 rounded-[22px] bg-[#6B21A8] p-4 text-left text-white shadow-[0_10px_24px_rgba(107,33,168,0.20)] active:scale-[0.98]"
            data-testid="button-open-face-scan"
          >
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white/15">
              <Video size={22} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[17px] font-black leading-tight">{t("statusVitals.faceScan.action", "Face scan")}</span>
              <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-white/80">{t("statusVitals.faceScan.actionHint", "Heart, breathing, HRV")}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onConnectDevice}
            className="flex min-h-[66px] items-center gap-4 rounded-[20px] border border-[#CFEFE4] bg-[#ECFDF5] p-4 text-left active:scale-[0.98]"
            data-testid="button-open-bluetooth-device"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#047857]">
              <Bluetooth size={21} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[15px] font-black leading-tight text-vyva-text-1">{t("settings.healthDevices.title", "Health devices")}</span>
              <span className="mt-0.5 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">{t("settings.healthDevices.addSheetHint", "Set up Bluetooth devices in Settings")}</span>
            </span>
          </button>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => captureWithSignal("voice")}
              className="flex min-h-[62px] items-center justify-center gap-2 rounded-[18px] border border-[#FED7AA] bg-[#FFF7ED] px-3 font-body text-[14px] font-black text-vyva-text-1 active:scale-[0.98]"
              data-testid="button-vitals-say-reading"
            >
              <Mic size={17} className="text-[#B45309]" />
              {t("statusVitals.hub.say", "Say reading")}
            </button>
            <button
              type="button"
              onClick={() => captureWithSignal("photo")}
              className="flex min-h-[62px] items-center justify-center gap-2 rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-3 font-body text-[14px] font-black text-vyva-text-1 active:scale-[0.98]"
              data-testid="button-vitals-snap-reading"
            >
              <Camera size={17} className="text-[#1D4ED8]" />
              {t("statusVitals.hub.snapShort", "Scan")}
            </button>
            <button
              type="button"
              onClick={() => captureWithSignal("text")}
              className="flex min-h-[62px] items-center justify-center gap-2 rounded-[18px] border border-[#DDD6FE] bg-[#F5F3FF] px-3 font-body text-[14px] font-black text-vyva-text-1 active:scale-[0.98]"
              data-testid="button-log-reading"
            >
              <Keyboard size={17} className="text-[#6B21A8]" />
              {t("statusVitals.logAction", "Type reading")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ConnectDeviceSheet({
  onClose,
  onSelectDevice,
  onCapture,
}: {
  onClose: () => void;
  onSelectDevice: (device: VitalsDeviceCatalogItem) => void;
  onCapture: (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => void;
}) {
  const { t } = useTranslation();

  const captureFallback = (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => {
    onClose();
    onCapture(mode, signal);
  };

  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center bg-black/40 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="max-h-[88vh] w-full max-w-[660px] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-7 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]" data-testid="connect-health-devices">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[27px] italic leading-tight text-vyva-text-1">
              {t("statusVitals.devices.sheetTitle", "Connect device")}
            </h2>
            <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
              {t("statusVitals.devices.sheetBody", "Try Bluetooth, or scan, say, or type the same reading.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
            data-testid="button-close-device-sheet"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-2">
          {VITALS_DEVICE_CATALOG.map((device) => {
            const Icon = DEVICE_ICON_BY_ID[device.id];
            return (
              <article
                key={device.id}
                className="rounded-[20px] border border-[#F0E7DE] bg-[#FFFCF8] p-3 shadow-[0_5px_14px_rgba(63,45,35,0.035)]"
                data-testid={`device-card-${device.id}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ color: device.accent, background: device.bg }}>
                    <Icon size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[15px] font-black leading-tight text-vyva-text-1">{device.label}</p>
                    <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">{device.helper}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {device.signals.map((signal) => (
                        <span key={signal} className="rounded-full px-2 py-0.5 font-body text-[10px] font-black" style={{ color: device.accent, background: device.bg }}>
                          {publicSignalLabel(signal)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectDevice(device);
                    }}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-[14px] font-body text-[12px] font-black text-white shadow-[0_7px_14px_rgba(107,33,168,0.12)] active:scale-[0.98]"
                    style={{ background: device.accent }}
                    data-testid={`button-device-bluetooth-${device.id}`}
                  >
                    <Bluetooth size={14} />
                    {t("statusVitals.bluetooth.tryShort", "Bluetooth")}
                  </button>
                  <button
                    type="button"
                    onClick={() => captureFallback("photo")}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] font-body text-[12px] font-black text-[#1D4ED8]"
                    data-testid={`button-device-photo-${device.id}`}
                  >
                    <Camera size={13} />
                    {t("statusVitals.capture.photoShort", "Scan")}
                  </button>
                  <button
                    type="button"
                    onClick={() => captureFallback("voice", device.fallbackSignals[0])}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#FED7AA] bg-[#FFF7ED] font-body text-[12px] font-black text-[#B45309]"
                    data-testid={`button-device-voice-${device.id}`}
                  >
                    <Mic size={13} />
                    {t("statusVitals.capture.voiceShort", "Say")}
                  </button>
                  <button
                    type="button"
                    onClick={() => captureFallback("text", device.fallbackSignals[0])}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#DDD6FE] bg-white font-body text-[12px] font-black text-[#6B21A8]"
                    data-testid={`button-device-type-${device.id}`}
                  >
                    <Keyboard size={13} />
                    {t("statusVitals.capture.typeShort", "Type")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CompactMetricRow({
  metricKey,
  summary,
  t,
  onAdd,
}: {
  metricKey: MetricType;
  summary?: VitalsSummaryEntry;
  t: (key: string, fallback: string) => string;
  onAdd: (signal: VitalsSignalKey) => void;
}) {
  const meta = METRIC_META[metricKey];
  const Icon = meta.Icon;
  const hasData = summary?.has_data === true;
  const displayValue = hasData ? summary?.latest_value ?? "--" : null;
  const state = getMetricState(meta, summary?.latest_value ?? null);
  const stateLabel =
    state.tone === "steady"
      ? t("statusVitals.status.steady", "Steady")
      : state.tone === "review"
        ? t("statusVitals.status.review", "Review")
        : state.tone === "logged"
          ? t("statusVitals.status.logged", "Logged")
          : t("statusVitals.status.noData", "No data");

  return (
    <button
      type="button"
      onClick={() => onAdd(ENGINE_SIGNAL_BY_METRIC[metricKey] as VitalsSignalKey)}
      className="flex min-h-[64px] w-full items-center gap-3 rounded-[18px] border border-[#EFE5DC] bg-white px-3 py-2 text-left active:scale-[0.99]"
      data-testid={`compact-vital-${metricKey}`}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ background: meta.soft }}>
        <Icon size={18} style={{ color: meta.accent }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[13px] font-bold leading-tight text-vyva-text-2">
          {t(meta.labelKey, meta.fallbackLabel)}
        </span>
        <span className="mt-0.5 block truncate font-body text-[18px] font-black leading-tight text-vyva-text-1">
          {displayValue ? `${displayValue} ${meta.unit}` : t("statusVitals.emptyMetric", "No reading")}
        </span>
      </span>
      <span
        className="flex-shrink-0 rounded-full px-2.5 py-1 font-body text-[11px] font-bold"
        style={{
          color: hasData ? state.color : "#6B21A8",
          background: hasData ? state.bg : "#F5F3FF",
        }}
      >
        {hasData ? stateLabel : t("statusVitals.addShort", "Add")}
      </span>
    </button>
  );
}

const SignosScreen = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language: appLanguage } = useLanguage();
  const { toast } = useToast();
  const { profile } = useProfile();
  const [showScanModal, setShowScanModal] = useState(false);
  const [showFaceScanModal, setShowFaceScanModal] = useState(false);
  const [showAddReadingSheet, setShowAddReadingSheet] = useState(false);
  const [selectedSuggestedSignal, setSelectedSuggestedSignal] = useState<VitalsSignalKey | null>(null);
  const [bluetoothDevice, setBluetoothDevice] = useState<VitalsDeviceCatalogItem | null>(null);
  const [captureMode, setCaptureMode] = useState<VitalsCaptureMode | null>(null);
  const [captureSignal, setCaptureSignal] = useState<VitalsSignalKey | null>(null);

  const { data: vitalsData } = useQuery<VitalsResponse>({
    queryKey: ["/api/vitals"],
    retry: false,
  });
  const { data: vitalsEngineData } = useQuery<VitalsEngineLatestResponse>({
    queryKey: ["/api/vitals-engine/latest", "hub-prompts"],
    retry: false,
  });
  const { data: personalisationData } = useQuery<{
    conditions: string[];
    hobbies: string[];
    hasMedications: boolean;
  }>({
    queryKey: ["/api/profile/personalisation"],
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const summary = vitalsData?.summary;
  const todaySignals = useMemo(() => new Set(
    (vitalsEngineData?.recent_readings ?? [])
      .filter((reading) => isTodayReading(reading.recorded_at))
      .map((reading) => reading.signal_type),
  ), [vitalsEngineData?.recent_readings]);
  const suggestedSignals = useMemo(() => {
    const profileSignals = promptSignalsForProfile(personalisationData?.conditions ?? []);
    return profileSignals.filter((signal) => {
      if (signal === "bp_systolic") return !todaySignals.has("bp_systolic") || !todaySignals.has("bp_diastolic");
      return !todaySignals.has(signal);
    }).slice(0, 4);
  }, [personalisationData?.conditions, todaySignals]);
  const primarySuggestedSignals = suggestedSignals.slice(0, 3);

  const openCapture = (mode: VitalsCaptureMode, signal?: VitalsSignalKey) => {
    setShowAddReadingSheet(false);
    setCaptureSignal(signal ?? null);
    setCaptureMode(mode);
  };
  const openAddReadingSheet = (signal?: VitalsSignalKey | null) => {
    setSelectedSuggestedSignal(signal ?? null);
    setShowAddReadingSheet(true);
  };

  const latestReadingAt = useMemo(() => {
    if (!summary) return null;
    const dates = Object.values(summary)
      .map((entry) => entry.latest_recorded_at)
      .filter(Boolean) as string[];
    return dates.sort().reverse()[0] ?? null;
  }, [summary]);

  const latestText = latestReadingAt
    ? formatRecordedAt(latestReadingAt, appLanguage)
    : t("statusVitals.noLatest", "No recent readings");
  const statusSummaryText = useMemo(() => {
    const lines = (["hr", "rr", "bp"] as MetricType[]).map((key) => {
      const meta = METRIC_META[key];
      const value = summary?.[key]?.latest_value;
      return `${t(meta.labelKey, meta.fallbackLabel)}: ${value ? `${value} ${meta.unit}` : t("statusVitals.noReading", "no reading")}`;
    });
    return `${t("statusVitals.shareTitle", "VYVA Status / Vitals")}\n${lines.join("\n")}\n${t("statusVitals.shareUpdated", "Updated")}: ${latestText}`;
  }, [latestText, summary, t]);

  const statusServiceActions = useMemo(() => vitalsStatusServiceActionsFor({
    gpName: profile?.gpName,
    gpPhone: profile?.gpPhone,
    gpEmail: profile?.gpEmail,
    context: statusSummaryText,
    labels: {
      callGp: t("statusVitals.actions.callGp", "Call GP"),
      callGpWithName: t("statusVitals.actions.callGpWithName", "Call {{name}}"),
      emailGp: t("statusVitals.actions.emailGp", "Email GP"),
      doctorHelp: t("statusVitals.actions.doctorHelp", "Doctor help"),
      addDoctor: t("statusVitals.actions.addDoctor", "Add doctor"),
      appointment: t("statusVitals.actions.appointment", "Book appointment"),
      ride: t("statusVitals.actions.ride", "Arrange ride"),
      appointmentPrefill: t("statusVitals.actions.appointmentPrefill", "Please help me schedule a doctor appointment based on my VYVA vitals. Ask me to confirm before booking."),
      ridePrefill: t("statusVitals.actions.ridePrefill", "Please help me arrange a ride based on my VYVA vitals. Ask me to confirm before contacting anyone."),
    },
  }), [profile?.gpEmail, profile?.gpName, profile?.gpPhone, statusSummaryText, t]);
  const compactStatusServiceActions = useMemo(() => {
    const careActions = statusServiceActions.filter((action) => action.kind === "call_gp" || action.kind === "email_gp");
    const doctorHelp = statusServiceActions.find((action) => action.kind === "doctor_help");
    const ride = statusServiceActions.find((action) => action.kind === "book_ride");
    const actions = careActions.length > 0 ? careActions.slice(0, 2) : doctorHelp ? [doctorHelp] : [];
    if (ride && actions.length < 3) actions.push(ride);
    return actions.slice(0, 3);
  }, [statusServiceActions]);
  const latestMetricKeys = ["hr", "rr", "bp"] as MetricType[];
  const hasAnyLatestReading = latestMetricKeys.some((key) => summary?.[key]?.has_data === true);

  const statusServiceIcons: Record<VitalsStatusServiceActionKind, LucideIcon> = {
    call_gp: Phone,
    email_gp: Mail,
    doctor_help: Stethoscope,
    add_doctor_contact: UserPlus,
    schedule_appointment: Calendar,
    book_ride: Car,
  };

  const statusServiceClass: Record<VitalsStatusServiceActionKind, string> = {
    call_gp: "bg-[#6B21A8] text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]",
    email_gp: "border border-[#DDD6FE] bg-white text-[#6B21A8]",
    doctor_help: "border border-[#DDD6FE] bg-white text-[#6B21A8]",
    add_doctor_contact: "border border-[#DDD6FE] bg-white text-[#6B21A8]",
    schedule_appointment: "border border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]",
    book_ride: "border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
  };

  const renderStatusServiceAction = (action: VitalsStatusServiceAction) => {
    const Icon = statusServiceIcons[action.kind];
    const className = `vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[17px] px-3 text-center font-body text-[14px] font-black leading-tight ${statusServiceClass[action.kind]}`;

    if (action.href) {
      return (
        <a
          key={action.kind}
          href={action.href}
          className={className}
          data-testid={`button-status-${action.kind.replaceAll("_", "-")}`}
        >
          <Icon size={17} />
          <span>{action.label}</span>
        </a>
      );
    }

    return (
      <button
        key={action.kind}
        type="button"
        onClick={() => action.to && navigate(action.to, { state: action.state })}
        className={className}
        data-testid={`button-status-${action.kind.replaceAll("_", "-")}`}
      >
        <Icon size={17} />
        <span>{action.label}</span>
      </button>
    );
  };

  const shareStatus = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("statusVitals.shareTitle", "VYVA Status / Vitals"), text: statusSummaryText });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(statusSummaryText);
    toast({ description: t("statusVitals.copied", "Vitals summary copied.") });
  };

  return (
    <HealthWizardShell contentClassName="max-w-[1180px] px-4 pb-40 sm:px-6 lg:px-8">
      <HealthWizardTopBar
        title={t("statusVitals.hub.pageTitle", "Vitals")}
        kicker={t("statusVitals.hub.pageKicker", "Health")}
        onBack={() => navigate("/health")}
        backLabel={t("common.back", "Back")}
        className="mb-3"
      />

      <section className="rounded-[26px] border border-[#E8DED4] bg-white p-4 shadow-[0_12px_30px_rgba(63,45,35,0.055)] sm:p-5 lg:p-6" data-testid="vitals-guided-hub">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
              <Activity size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[29px] italic leading-tight text-vyva-text-1">
                {t("statusVitals.hub.primaryTitle", "Add a vital reading")}
              </h2>
              <p className="mt-1 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                {t("statusVitals.hub.todayMissingBody", "Start with one useful reading. You can add more later.")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openAddReadingSheet()}
            className="mt-5 flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#6B21A8] px-5 font-body text-[19px] font-black text-white shadow-[0_12px_28px_rgba(107,33,168,0.22)] active:scale-[0.98]"
            data-testid="button-open-add-reading-sheet"
          >
            <Activity size={22} />
            {t("statusVitals.hub.addReadingCta", "Add reading")}
          </button>

          {primarySuggestedSignals.length > 0 && (
            <div className="mt-4" data-testid="vitals-today-prompts">
              <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-vyva-text-2">
                {t("statusVitals.hub.todayPrompt", "Useful to add")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {primarySuggestedSignals.map((signal) => (
                  <button
                    key={signal}
                    type="button"
                    onClick={() => openAddReadingSheet(signal)}
                    className="rounded-full border border-[#DDD6FE] bg-white px-3 py-2 font-body text-[13px] font-black text-[#6B21A8] active:scale-95"
                    data-testid={`button-suggested-vital-${signal}`}
                  >
                    {publicSignalLabel(signal)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-[#EDE5DB] bg-white p-4 shadow-[0_8px_24px_rgba(63,45,35,0.055)]" data-testid="latest-readings-section">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-body text-[20px] font-black leading-tight text-vyva-text-1">
              {t("statusVitals.latestReadings", "Latest readings")}
            </h2>
            <p className="mt-1 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2" data-testid="latest-readings-summary">
              {hasAnyLatestReading ? latestText : t("statusVitals.noLatestCalm", "No readings yet")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddReadingSheet()}
            className="flex min-h-[40px] flex-shrink-0 items-center justify-center rounded-full bg-[#F5F3FF] px-4 font-body text-[13px] font-black text-[#6B21A8] active:scale-[0.98]"
            data-testid="button-latest-add-reading"
          >
            {t("statusVitals.hub.addReadingCta", "Add reading")}
          </button>
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          {latestMetricKeys.map((key) => (
            <CompactMetricRow
              key={key}
              metricKey={key}
              summary={summary?.[key]}
              t={t}
              onAdd={openAddReadingSheet}
            />
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[22px] border border-[#EDE5DB] bg-white p-4 shadow-[0_8px_24px_rgba(63,45,35,0.045)]" data-testid="compact-vitals-help">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-[#6B21A8]">
              <ShieldCheck size={18} />
            </span>
            <h2 className="font-body text-[18px] font-black leading-tight text-vyva-text-1">
              {t("statusVitals.helpTitle", "Need help with readings?")}
            </h2>
          </div>
          <button
            type="button"
            onClick={shareStatus}
            className="flex min-h-[38px] flex-shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-white px-3 font-body text-[12px] font-black text-[#6B21A8] active:scale-[0.98]"
            data-testid="button-share-care-team"
          >
            {t("statusVitals.copySummary", "Copy")}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {compactStatusServiceActions.map(renderStatusServiceAction)}
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-[#FED7AA] bg-[#FFFBEB] p-4">
        <div className="flex items-start gap-3">
          <ClipboardList size={18} className="mt-0.5 flex-shrink-0" style={{ color: "#B45309" }} />
          <p className="font-body text-[12px] leading-relaxed" style={{ color: "#92400E" }}>
            {t("statusVitals.disclaimer", "Vitals are informational and do not replace medical care. If symptoms are severe or sudden, contact emergency services.")}
          </p>
        </div>
      </section>

      {showAddReadingSheet && (
        <AddReadingSheet
          selectedSignal={selectedSuggestedSignal}
          onClose={() => setShowAddReadingSheet(false)}
          onCapture={openCapture}
          onFaceScan={() => setShowFaceScanModal(true)}
          onConnectDevice={() => {
            setShowAddReadingSheet(false);
            navigate("/settings/health-devices");
          }}
        />
      )}
      {showScanModal && <ScanModal onClose={() => setShowScanModal(false)} />}
      {showFaceScanModal && (
        <FaceScanModal
          onClose={() => setShowFaceScanModal(false)}
          onLocalScan={() => setShowScanModal(true)}
        />
      )}
      {bluetoothDevice && (
        <BluetoothDeviceModal
          device={bluetoothDevice}
          onClose={() => setBluetoothDevice(null)}
          onFallback={openCapture}
        />
      )}
      {captureMode && (
        <VitalsCaptureModal
          mode={captureMode}
          initialSignal={captureSignal}
          onClose={() => {
            setCaptureMode(null);
            setCaptureSignal(null);
          }}
        />
      )}
    </HealthWizardShell>
  );
};

export default SignosScreen;
