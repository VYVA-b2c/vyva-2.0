import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bluetooth,
  Camera,
  Check,
  ChevronRight,
  FileImage,
  HeartPulse,
  Keyboard,
  Loader2,
  Mic,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import VitalsScan from "@/components/VitalsScan";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { VITALS_DEVICE_CATALOG } from "@/lib/vitalsDeviceCatalog";
import { isWebBluetoothSupported, readStandardBluetoothDevice } from "@/lib/vitalsBluetooth";
import {
  VITALS_SIGNAL_CATALOG,
  VITALS_SIGNAL_KEYS,
  type VitalsCaptureMethod,
  type VitalsDisplayGroup,
  type VitalsSignalKey,
} from "../../shared/vitalsSignalCatalog";
import { compatibleCaptureMethods, type VitalsMeasurementEnvelope } from "../../shared/vitalsAcquisition";
import { formatVitalsReadingDisplay, type ProposedVitalsReading, type VitalsParsingResult } from "../../shared/vitalsParsing";

const GROUP_ORDER: VitalsDisplayGroup[] = ["heart", "breathing", "blood", "body", "wellbeing", "activity", "labs"];
const GROUP_LABELS: Record<VitalsDisplayGroup, string> = {
  heart: "Heart",
  breathing: "Breathing",
  blood: "Blood",
  body: "Body",
  wellbeing: "Wellbeing",
  activity: "Activity",
  labs: "Labs",
};

const METHOD_DETAILS: Record<VitalsCaptureMethod, { label: string; hint: string; Icon: typeof Activity }> = {
  web_bluetooth: { label: "Bluetooth device", hint: "Read directly from a nearby compatible device", Icon: Bluetooth },
  phone_camera: { label: "Phone camera", hint: "Estimate pulse or breathing using the camera", Icon: Camera },
  device_photo: { label: "Device photo", hint: "Read the number shown on a monitor or meter", Icon: FileImage },
  voice: { label: "Say the reading", hint: "Speak naturally, then confirm what VYVA heard", Icon: Mic },
  manual: { label: "Type the reading", hint: "Enter the number or a short phrase", Icon: Keyboard },
  oauth_import: { label: "Wearable or app", hint: "Use a connected health service", Icon: RefreshCw },
  clinical_import: { label: "Clinical record", hint: "Use a reading shared by your care team", Icon: ShieldCheck },
};

type AcquisitionSignal = {
  signal_type: VitalsSignalKey;
  current_reading: VitalsMeasurementEnvelope | null;
  compatible_methods: VitalsCaptureMethod[];
};

export type VitalsAcquisitionContext = {
  readings: VitalsMeasurementEnvelope[];
  signals: AcquisitionSignal[];
  devices: Array<{ id?: string | null; deviceName?: string | null; capabilities?: VitalsSignalKey[] }>;
};

type Stage = "vital" | "tracked" | "method" | "capture" | "confirm";

type SpeechRecognitionEventLike = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function sourceDeviceName(reading: VitalsMeasurementEnvelope, context: VitalsAcquisitionContext | null) {
  const sourceRef = reading.sourceRef ?? {};
  const explicitName = typeof sourceRef.device_name === "string"
    ? sourceRef.device_name
    : typeof sourceRef.deviceName === "string"
      ? sourceRef.deviceName
      : null;
  if (explicitName) return explicitName;
  const registered = context?.devices.find((device) => device.capabilities?.includes(reading.signalType));
  return registered?.deviceName || (reading.source === "clinical" ? "your clinical record" : "a connected device");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function proposedPayload(reading: ProposedVitalsReading) {
  return {
    signal_type: reading.signal_type,
    value: reading.value,
    source: reading.source,
    capture_method: reading.capture_method,
    context_tag: reading.context_tag,
    unit: reading.unit,
    recorded_at: reading.recorded_at,
    source_ref: reading.source_ref,
  };
}

export default function VitalsAddReadingFlow({
  onBack,
  onSaved,
  previewMode = false,
  previewContext,
  initialSignal,
  onBackActionChange,
}: {
  onBack: () => void;
  onSaved: () => void | Promise<void>;
  previewMode?: boolean;
  previewContext?: VitalsAcquisitionContext | null;
  initialSignal?: VitalsSignalKey | null;
  onBackActionChange?: (handler: (() => void) | null) => void;
}) {
  const { isDark } = useHomeMasterTheme();
  const [stage, setStage] = useState<Stage>("vital");
  const [context, setContext] = useState<VitalsAcquisitionContext | null>(previewContext ?? null);
  const [selectedSignal, setSelectedSignal] = useState<VitalsSignalKey | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<VitalsCaptureMethod | null>(null);
  const [inputText, setInputText] = useState("");
  const [proposed, setProposed] = useState<ProposedVitalsReading[]>([]);
  const [loadingContext, setLoadingContext] = useState(!previewMode);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const activeSignals = useMemo(
    () => VITALS_SIGNAL_KEYS.filter((key) => !VITALS_SIGNAL_CATALOG[key].futureReady),
    [],
  );
  const groupedSignals = useMemo(() => GROUP_ORDER.flatMap((group) => {
    const signals = activeSignals.filter((key) => VITALS_SIGNAL_CATALOG[key].displayGroup === group);
    return signals.length ? [{ group, signals }] : [];
  }), [activeSignals]);

  useEffect(() => {
    if (previewMode) {
      setContext(previewContext ?? { readings: [], signals: [], devices: [] });
      setLoadingContext(false);
      return;
    }
    let cancelled = false;
    const signalList = activeSignals.join(",");
    void apiFetch(`/api/vitals-engine/acquisition-context?signals=${signalList}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load capture options");
        const payload = await response.json() as VitalsAcquisitionContext;
        if (!cancelled) setContext(payload);
      })
      .catch(() => {
        if (!cancelled) setContext({ readings: [], signals: [], devices: [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });
    return () => { cancelled = true; };
  }, [activeSignals, previewContext, previewMode]);

  const currentSignalContext = selectedSignal
    ? context?.signals.find((signal) => signal.signal_type === selectedSignal) ?? null
    : null;
  const currentReading = currentSignalContext?.current_reading ?? null;
  const alreadyTracked = currentReading && (currentReading.source === "connected_device" || currentReading.source === "clinical")
    ? currentReading
    : null;
  const methods = selectedSignal ? compatibleCaptureMethods(selectedSignal) : [];

  const chooseSignal = useCallback((signal: VitalsSignalKey) => {
    setSelectedSignal(signal);
    setSelectedMethod(null);
    setInputText("");
    setProposed([]);
    setError("");
    const tracked = context?.signals.find((item) => item.signal_type === signal)?.current_reading;
    setStage(tracked && (tracked.source === "connected_device" || tracked.source === "clinical") ? "tracked" : "method");
  }, [context]);

  useEffect(() => {
    if (loadingContext || !initialSignal || selectedSignal || stage !== "vital") return;
    chooseSignal(initialSignal);
  }, [chooseSignal, initialSignal, loadingContext, selectedSignal, stage]);

  const chooseMethod = (method: VitalsCaptureMethod) => {
    setSelectedMethod(method);
    setProposed([]);
    setError("");
    setStage("capture");
    if (method === "web_bluetooth") void startBluetooth();
  };

  const parseText = async () => {
    if (!inputText.trim() || !selectedMethod) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/parse-text", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          text: inputText.trim(),
          source: "manual_entry",
          capture_method: selectedMethod,
        }),
      });
      if (!response.ok) throw new Error("Could not read that value");
      const result = await response.json() as VitalsParsingResult;
      const matches = result.proposed_readings.filter((reading) => reading.signal_type === selectedSignal);
      if (!matches.length) throw new Error(result.clarification_prompt || "I could not find that vital in the phrase.");
      setProposed(matches);
      setStage("confirm");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try a simpler phrase.");
    } finally {
      setBusy(false);
    }
  };

  const startVoice = () => {
    const recognitionConstructor = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }).SpeechRecognition ?? (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!recognitionConstructor) {
      setError("Voice entry is not available in this browser. You can type the reading instead.");
      return;
    }
    const recognition = new recognitionConstructor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      setInputText(transcript);
    };
    recognition.onerror = () => setError("I could not hear that clearly. Try again or type the reading.");
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const scanDevicePhoto = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/scan-device-photo", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ image: await fileToDataUrl(file) }),
      });
      if (!response.ok) throw new Error("I could not read that photo.");
      const result = await response.json() as VitalsParsingResult;
      const matches = result.proposed_readings.filter((reading) => reading.signal_type === selectedSignal);
      if (!matches.length) throw new Error(result.clarification_prompt || "That vital was not visible in the photo.");
      setProposed(matches);
      setStage("confirm");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Try a clearer photo or type the reading.");
    } finally {
      setBusy(false);
    }
  };

  async function startBluetooth() {
    if (!selectedSignal) return;
    const device = VITALS_DEVICE_CATALOG.find((item) => item.signals.includes(selectedSignal));
    if (!device) {
      setError("No standard Bluetooth device is registered for this vital.");
      return;
    }
    if (!isWebBluetoothSupported()) {
      setError("Bluetooth is not available in this browser. Choose photo, voice, or manual entry instead.");
      return;
    }
    setBusy(true);
    try {
      const result = await readStandardBluetoothDevice(device, () => undefined);
      const matches = result.readings.filter((reading) => reading.signal_type === selectedSignal);
      if (!matches.length) throw new Error("The device did not return this vital.");
      setProposed(matches);
      setStage("confirm");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the Bluetooth device.");
    } finally {
      setBusy(false);
    }
  }

  const saveConfirmed = async () => {
    if (!proposed.length) return;
    setBusy(true);
    setError("");
    try {
      if (!previewMode) {
        const response = await apiFetch("/api/vitals-engine/readings", {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ readings: proposed.map(proposedPayload) }),
        });
        if (!response.ok) throw new Error("Could not save the reading.");
        window.dispatchEvent(new Event("vyva:vitals-updated"));
      }
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resetToVital = useCallback(() => {
    setStage("vital");
    setSelectedSignal(null);
    setSelectedMethod(null);
    setInputText("");
    setProposed([]);
    setError("");
  }, []);

  const back = useCallback(() => {
    if (stage === "vital") {
      onBack();
      return;
    }
    if (stage === "tracked" || stage === "method") {
      resetToVital();
      return;
    }
    setStage("method");
  }, [onBack, resetToVital, stage]);

  useEffect(() => {
    onBackActionChange?.(back);
    return () => onBackActionChange?.(null);
  }, [back, onBackActionChange]);

  const selectedMeta = selectedSignal ? VITALS_SIGNAL_CATALOG[selectedSignal] : null;

  return (
    <section className={`rounded-[30px] border p-5 ${isDark ? "border-white/[0.14] bg-[#2B2035] text-[#FFF8FF] shadow-[0_22px_48px_rgba(0,0,0,0.22)]" : "border-[#E6DCEB] bg-[#FFFCF8] text-[#241238] shadow-[0_16px_40px_rgba(63,45,75,0.08)]"}`} data-testid="vitals-add-flow">
      <header className="mb-6">
        <p className={`font-body text-[11px] font-black uppercase tracking-[0.12em] ${isDark ? "text-[#C4A7FF]" : "text-[#7024C4]"}`}>Add a reading</p>
        <h2 className={`mt-1 font-body text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] sm:text-[31px] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}>
          {stage === "vital" ? "What would you like to add?" : selectedMeta?.label}
        </h2>
      </header>

      {stage === "vital" ? (
        loadingContext ? (
          <div className="flex min-h-[220px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#7C3AED]" /></div>
        ) : (
          <div className="space-y-5">
            {groupedSignals.map(({ group, signals }) => (
              <div key={group}>
                <p className={`mb-2 font-body text-[12px] font-black uppercase tracking-[0.13em] ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A80]"}`}>{GROUP_LABELS[group]}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {signals.map((signal, index) => {
                    const meta = VITALS_SIGNAL_CATALOG[signal];
                    const balancesOddGroup = signals.length % 2 === 1 && index === 0;
                    return (
                      <button key={signal} type="button" onClick={() => chooseSignal(signal)} className={`flex min-h-[64px] items-center gap-3 rounded-[20px] border px-4 text-left sm:min-h-[66px] ${balancesOddGroup ? "sm:col-span-2" : ""} ${isDark ? "border-white/[0.13] bg-[#352842] shadow-[0_7px_20px_rgba(0,0,0,0.14)]" : "border-[#E7DDF0] bg-white shadow-[0_5px_16px_rgba(53,28,87,0.04)]"}`} data-testid={`button-vital-${signal}`}>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${isDark ? "bg-[#49355E] text-[#C4A7FF]" : "bg-[#F3E8FF] text-[#7C3AED]"}`}><HeartPulse className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-body text-[16px] font-black ${isDark ? "text-[#FFF8FF]" : "text-[#27152F]"}`}>{meta.label}</span>
                          <span className={`block font-body text-[12px] font-bold ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A80]"}`}>{meta.unit || "Yes or no"}</span>
                        </span>
                        <ChevronRight className={`h-5 w-5 ${isDark ? "text-[#C4A7FF]" : "text-[#A78BBA]"}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {stage === "tracked" && alreadyTracked ? (
        <div className="rounded-[24px] border border-[#B7E4D3] bg-[#ECFDF5] p-5" data-testid="vitals-already-tracked">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#047857]"><Check className="h-6 w-6" /></div>
          <h3 className="mt-4 font-display text-[24px] font-bold text-[#173F35]">Already being tracked</h3>
          <p className="mt-2 font-body text-[16px] font-bold leading-relaxed text-[#2B5C4D]">
            {selectedMeta?.label} is already being tracked via {sourceDeviceName(alreadyTracked, context)}.
          </p>
          <p className="mt-2 font-body text-[14px] text-[#477B6B]">The latest reading is available, so you do not need to add it again.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={onBack} className="min-h-[54px] rounded-[18px] bg-[#047857] px-5 font-body text-[16px] font-black text-white">Use latest reading</button>
            <button type="button" onClick={() => setStage("method")} className="min-h-[54px] rounded-[18px] border border-[#8FD2BC] bg-white px-5 font-body text-[16px] font-black text-[#047857]">Log anyway</button>
          </div>
        </div>
      ) : null}

      {stage === "method" ? (
        <div>
          <p className={`mb-4 font-body text-[16px] font-bold ${isDark ? "text-[#D8CDE4]" : "text-[#6B5B72]"}`}>Choose the easiest way to add it. You will confirm before anything is saved.</p>
          <div className="grid gap-3 sm:grid-cols-2" data-testid="vitals-method-picker">
            {methods.map((method) => {
              const detail = METHOD_DETAILS[method];
              const Icon = detail.Icon;
              return (
                <button key={method} type="button" onClick={() => chooseMethod(method)} className={`flex min-h-[88px] items-center gap-4 rounded-[22px] border p-4 text-left ${isDark ? "border-white/[0.13] bg-[#352842] shadow-[0_7px_20px_rgba(0,0,0,0.14)]" : "border-[#E0D1EC] bg-white shadow-[0_7px_20px_rgba(53,28,87,0.05)]"}`} data-testid={`button-method-${method}`}>
                  <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] ${isDark ? "bg-[#49355E] text-[#C4A7FF]" : "bg-[#F3E8FF] text-[#7C3AED]"}`}><Icon className="h-6 w-6" /></span>
                  <span className="min-w-0">
                    <span className={`block font-body text-[16px] font-black ${isDark ? "text-[#FFF8FF]" : "text-[#27152F]"}`}>{detail.label}</span>
                    <span className={`mt-1 block font-body text-[12px] font-bold leading-snug ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A80]"}`}>{detail.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {stage === "capture" && selectedMethod === "phone_camera" && selectedSignal ? (
        <div className={`overflow-hidden rounded-[24px] border p-3 ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E0D1EC] bg-white"}`}>
          <p className="mb-3 rounded-[16px] bg-[#FFF7ED] px-4 py-3 font-body text-[13px] font-bold text-[#92400E]">Phone-camera estimates are for trends and do not affect triage.</p>
          <VitalsScan
            saveReading={false}
            onComplete={(bpm, respiratoryRate) => {
              const now = new Date().toISOString();
              const rows: ProposedVitalsReading[] = [];
              if (selectedSignal === "resting_hr_bpm" && bpm != null) rows.push({ signal_type: selectedSignal, value: bpm, unit: "bpm", context_tag: "resting", recorded_at: now, source: "phone_estimate", capture_method: "phone_camera", confidence: "low", explanation: "Phone camera estimate." });
              if (selectedSignal === "respiratory_rate" && respiratoryRate != null) rows.push({ signal_type: selectedSignal, value: respiratoryRate, unit: "/min", context_tag: "resting", recorded_at: now, source: "phone_estimate", capture_method: "phone_camera", confidence: "low", explanation: "Phone camera estimate." });
              if (rows.length) { setProposed(rows); setStage("confirm"); }
            }}
          />
        </div>
      ) : null}

      {stage === "capture" && selectedMethod === "device_photo" ? (
        <label className={`flex min-h-[190px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed p-6 text-center ${isDark ? "border-[#8D71A5] bg-[#352842]" : "border-[#B997D4] bg-[#F8F1FC]"}`}>
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" /> : <FileImage className="h-9 w-9 text-[#7C3AED]" />}
          <span className={`font-body text-[22px] font-extrabold ${isDark ? "text-[#FFF8FF]" : "text-[#27152F]"}`}>Take or upload a device photo</span>
          <span className={`font-body text-[13px] font-bold ${isDark ? "text-[#C9BDD6]" : "text-[#7A6A80]"}`}>Keep the full number and unit clearly visible.</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanDevicePhoto(file); }} />
        </label>
      ) : null}

      {stage === "capture" && selectedMethod === "web_bluetooth" ? (
        <div className="rounded-[24px] border border-[#D6E4F5] bg-[#EFF6FF] p-5 text-center">
          {busy ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1D4ED8]" /> : <Bluetooth className="mx-auto h-8 w-8 text-[#1D4ED8]" />}
          <p className="mt-3 font-display text-[22px] font-bold text-[#17345C]">{busy ? "Looking for your device…" : "Bluetooth device"}</p>
          {!busy ? <button type="button" onClick={() => void startBluetooth()} className="mt-4 min-h-[52px] rounded-[17px] bg-[#1D4ED8] px-6 font-body text-[15px] font-black text-white">Try again</button> : null}
        </div>
      ) : null}

      {stage === "capture" && (selectedMethod === "manual" || selectedMethod === "voice") ? (
        <div className={`rounded-[24px] border p-4 ${isDark ? "border-white/[0.13] bg-[#352842]" : "border-[#E0D1EC] bg-white"}`}>
          {selectedMethod === "voice" ? (
            <button type="button" onClick={startVoice} disabled={listening} className="mb-3 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C3AED] px-5 font-body text-[16px] font-black text-white disabled:opacity-60">
              <Mic className="h-5 w-5" />{listening ? "Listening…" : "Start speaking"}
            </button>
          ) : null}
          <textarea value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder={selectedMeta ? `${selectedMeta.label} ${selectedMeta.unit}` : "Type the reading"} className={`min-h-[120px] w-full rounded-[18px] border px-4 py-3 font-body text-[18px] font-bold outline-none focus:border-[#7C3AED] ${isDark ? "border-white/[0.13] bg-[#2B2035] text-[#FFF8FF] placeholder:text-[#AA9DB7]" : "border-[#E0D1EC] bg-[#FFFCF8] text-[#27152F]"}`} />
          <button type="button" onClick={() => void parseText()} disabled={!inputText.trim() || busy} className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#7C3AED] px-5 font-body text-[16px] font-black text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}Review reading
          </button>
        </div>
      ) : null}

      {stage === "confirm" ? (
        <div className="rounded-[24px] border border-[#B7E4D3] bg-[#F0FDF8] p-5" data-testid="vitals-confirm-readings">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#047857]">Confirm before saving</p>
          <div className="mt-3 grid gap-2">
            {proposed.map((reading) => (
              <div key={`${reading.signal_type}-${reading.value}`} className="flex items-start gap-3 rounded-[18px] bg-white px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]"><Check className="h-5 w-5" /></span>
                <div><p className="font-body text-[17px] font-black text-[#173F35]">{formatVitalsReadingDisplay(reading)}</p><p className="mt-1 font-body text-[12px] font-bold text-[#477B6B]">{reading.explanation}</p></div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => void saveConfirmed()} disabled={busy} className="mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#047857] px-5 font-body text-[17px] font-black text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Save confirmed reading
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-[18px] bg-[#FEF2F2] px-4 py-3 font-body text-[14px] font-bold text-[#B91C1C]" role="alert">{error}</p> : null}
    </section>
  );
}
