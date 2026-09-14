import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bluetooth, Camera, Check, ImagePlus, Keyboard, Loader2, Mic, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { VITALS_DEVICE_CATALOG } from "@/lib/vitalsDeviceCatalog";
import { isWebBluetoothSupported, readStandardBluetoothDevice } from "@/lib/vitalsBluetooth";
import VitalsScan from "@/components/VitalsScan";
import type { ProposedVitalsReading, VitalsParsingResult } from "../../shared/vitalsParsing";
import { VITALS_SIGNAL_CATALOG, type VitalsCaptureMethod, type VitalsSignalKey } from "../../shared/vitalsSignalCatalog";
import type { VitalsReadingSource } from "../../shared/vitalsEvidence";
import {
  TRIAGE_VITAL_SIGNAL_MAP,
  type VitalsMeasurementEnvelope,
} from "../../shared/vitalsAcquisition";

export type TriageVitalValues = {
  bpm?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  temperatureC?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  glucoseMgdl?: number | null;
};

type PromptAction = { id: keyof typeof TRIAGE_VITAL_SIGNAL_MAP; label: string };
type AcquisitionContext = {
  readings: VitalsMeasurementEnvelope[];
  signals: Array<{ signal_type: VitalsSignalKey; current_reading: VitalsMeasurementEnvelope | null; compatible_methods: VitalsCaptureMethod[] }>;
  devices: Array<{ id?: string | null; deviceName?: string | null; capabilities?: VitalsSignalKey[] }>;
};

type SpeechResultEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const METHOD_COPY: Record<VitalsCaptureMethod, { label: string; Icon: typeof Activity }> = {
  web_bluetooth: { label: "Bluetooth device", Icon: Bluetooth },
  phone_camera: { label: "Camera scan", Icon: Camera },
  device_photo: { label: "Scan device screen", Icon: ImagePlus },
  voice: { label: "Speak reading", Icon: Mic },
  manual: { label: "Type reading", Icon: Keyboard },
  oauth_import: { label: "Connected service", Icon: RefreshCw },
  clinical_import: { label: "Clinical record", Icon: Activity },
};

function readingValues(readings: Array<Pick<VitalsMeasurementEnvelope | ProposedVitalsReading, "signalType" | "value"> | ProposedVitalsReading>): TriageVitalValues {
  const values: TriageVitalValues = {};
  for (const reading of readings) {
    const signal = "signalType" in reading ? reading.signalType : reading.signal_type;
    if (signal === "resting_hr_bpm") values.bpm = reading.value;
    if (signal === "respiratory_rate") values.respiratoryRate = reading.value;
    if (signal === "oxygen_saturation") values.oxygenSaturation = reading.value;
    if (signal === "temperature_c") values.temperatureC = reading.value;
    if (signal === "bp_systolic") values.systolicBp = reading.value;
    if (signal === "bp_diastolic") values.diastolicBp = reading.value;
    if (signal === "glucose_mgdl") values.glucoseMgdl = reading.value;
  }
  return values;
}

function readingLabel(reading: VitalsMeasurementEnvelope) {
  const rounded = Number.isInteger(reading.value) ? reading.value : Math.round(reading.value * 10) / 10;
  const unit = reading.unit === "%" ? "%" : reading.unit ? ` ${reading.unit}` : "";
  return `${VITALS_SIGNAL_CATALOG[reading.signalType].shortLabel} ${rounded}${unit}`;
}

function readingSourceLabel(reading: VitalsMeasurementEnvelope) {
  const sourceRef = reading.sourceRef ?? {};
  const deviceName = typeof sourceRef.device_name === "string"
    ? sourceRef.device_name
    : typeof sourceRef.deviceName === "string"
      ? sourceRef.deviceName
      : null;
  if (deviceName) return deviceName;
  if (reading.source === "connected_device") return "Connected device";
  if (reading.source === "clinical") return "Clinical reading";
  return "Confirmed reading";
}

function ageLabel(recordedAt: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(recordedAt)) / 60000));
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

export function VitalsAcquisitionPanel({ actions, assessmentSessionId, disabled, onApply }: {
  actions: PromptAction[];
  disabled?: boolean;
  assessmentSessionId?: string;
  onApply: (values: TriageVitalValues, disclosure: string, affectsTriage: boolean, source: VitalsReadingSource) => void;
}) {
  const [context, setContext] = useState<AcquisitionContext | null>(null);
  const [selected, setSelected] = useState<PromptAction | null>(null);
  const [method, setMethod] = useState<VitalsCaptureMethod | null>(null);
  const [proposed, setProposed] = useState<ProposedVitalsReading[]>([]);
  const [manualText, setManualText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const appliedCurrentRef = useRef("");

  const requestedSignals = useMemo(() => [...new Set(actions.flatMap((action) => TRIAGE_VITAL_SIGNAL_MAP[action.id]))], [actions]);
  const requestedSignalKey = requestedSignals.join(",");

  useEffect(() => {
    let cancelled = false;
    void apiFetch(`/api/vitals-engine/acquisition-context?signals=${requestedSignalKey}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load readings");
        const payload = await response.json() as AcquisitionContext;
        if (!cancelled) setContext(payload);
      })
      .catch(() => { if (!cancelled) setContext({ readings: [], signals: [], devices: [] }); });
    return () => { cancelled = true; };
  }, [requestedSignalKey]);

  const currentReadings = useMemo(() => (context?.readings ?? []).filter((reading) => (
    requestedSignals.includes(reading.signalType) && reading.freshness === "current" && reading.qualityFlag === "clean"
  )) ?? [], [context, requestedSignals]);

  const usableCurrentReadings = useMemo(() => currentReadings.filter((reading) => (
    reading.source !== "phone_estimate" && reading.signalType !== "hrv_ms"
  )), [currentReadings]);

  useEffect(() => {
    if (!usableCurrentReadings.length) return;
    const key = usableCurrentReadings.map((reading) => `${reading.signalType}:${reading.recordedAt}`).join("|");
    if (appliedCurrentRef.current === key) return;
    appliedCurrentRef.current = key;
    const newest = usableCurrentReadings[0];
    onApply(readingValues(usableCurrentReadings), `Using ${readingLabel(newest)} · ${readingSourceLabel(newest)} · ${ageLabel(newest.recordedAt)}`, true, newest.source);
  }, [usableCurrentReadings, onApply]);

  const selectedSignals = selected ? [...TRIAGE_VITAL_SIGNAL_MAP[selected.id]] : [];
  const methods = selected
    ? (context?.signals ?? []).find((signal) => signal.signal_type === selectedSignals[0])?.compatible_methods ?? []
    : [];

  const parseText = async (captureMethod: "manual" | "voice") => {
    if (!manualText.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/vitals-engine/parse-text", {
        method: "POST",
        body: JSON.stringify({ text: manualText, source: "manual_entry", capture_method: captureMethod }),
      });
      const result = await response.json() as VitalsParsingResult;
      const matching = result.proposed_readings.filter((reading) => selectedSignals.includes(reading.signal_type));
      if (!matching.length) throw new Error(result.clarification_prompt || "I could not find that reading.");
      setProposed(matching);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read that value."); }
    finally { setBusy(false); }
  };

  const startVoice = () => {
    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Voice input is not supported in this browser."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.onresult = (event) => setManualText(event.results?.[0]?.[0]?.transcript ?? "");
    recognition.onerror = () => setError("I could not hear that reading.");
    recognition.start();
  };

  const startBluetooth = async () => {
    const device = VITALS_DEVICE_CATALOG.find((candidate) => candidate.signals.some((signal) => selectedSignals.includes(signal)));
    if (!device || !isWebBluetoothSupported()) { setError("Bluetooth is unavailable here. Choose another method."); return; }
    setBusy(true); setError("");
    try {
      const result = await readStandardBluetoothDevice(device, () => undefined);
      const matching = result.readings.filter((reading) => selectedSignals.includes(reading.signal_type));
      if (!matching.length) throw new Error("The device did not provide this reading.");
      setProposed(matching);
      if (rememberDevice) {
        await apiFetch("/api/settings/health-devices", { method: "POST", body: JSON.stringify({ device: {
          id: device.id, deviceName: result.deviceName, method: "web_bluetooth", status: "ready",
          sourceRef: { provider: "web_bluetooth", device_type: device.id, device_name: result.deviceName },
        } }) });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bluetooth reading failed."); }
    finally { setBusy(false); }
  };

  const scanPhoto = async (file: File) => {
    setBusy(true); setError("");
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const response = await apiFetch("/api/vitals-engine/scan-device-photo", { method: "POST", body: JSON.stringify({ image }) });
      const result = await response.json() as VitalsParsingResult;
      const matching = result.proposed_readings.filter((reading) => selectedSignals.includes(reading.signal_type));
      if (!matching.length) throw new Error(result.clarification_prompt || "No matching reading found.");
      setProposed(matching);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not scan the device screen."); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!proposed.length) return;
    setBusy(true); setError("");
    try {
      const readings = proposed.map((reading) => ({ ...reading, assessment_session_id: assessmentSessionId }));
      const response = await apiFetch("/api/vitals-engine/readings", { method: "POST", body: JSON.stringify({ readings }) });
      if (!response.ok) throw new Error("Could not save the reading.");
      const affectsTriage = proposed.every((reading) => reading.source !== "phone_estimate" && reading.signal_type !== "hrv_ms");
      onApply(
        readingValues(proposed),
        `${selected?.label}: ${proposed.map((reading) => `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}`).join(" / ")}`,
        affectsTriage,
        proposed[0]?.source ?? "manual_entry",
      );
      setProposed([]); setSelected(null); setMethod(null); setShowCamera(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the reading."); }
    finally { setBusy(false); }
  };

  return (
    <div className="border-t border-[#EEE7F3] px-4 pb-4 pt-3" data-testid="vitals-acquisition-panel">
      {usableCurrentReadings.length > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-[16px] bg-[#ECFDF5] px-3 py-2 text-[13px] font-black text-[#047857]">
          <Check size={16} /><span className="min-w-0 flex-1">{`Using ${readingLabel(usableCurrentReadings[0])} · ${readingSourceLabel(usableCurrentReadings[0])} · ${ageLabel(usableCurrentReadings[0].recordedAt)}`}</span>
          <button type="button" onClick={() => setSelected(actions[0] ?? null)} className="underline">Replace</button>
        </div>
      ) : null}
      {!selected ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {actions.map((action) => <button key={action.id} type="button" disabled={disabled} onClick={() => setSelected(action)} className="vyva-tap min-h-[54px] rounded-[18px] border border-[#DDD6FE] bg-[#FBFAFF] px-3 font-body text-[14px] font-black text-vyva-purple">{action.label}</button>)}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2"><strong className="font-body text-[15px]">Add {selected.label.toLowerCase()}</strong><button type="button" onClick={() => { setSelected(null); setMethod(null); setProposed([]); }} className="text-[13px] font-black text-vyva-purple">Cancel</button></div>
          {!method ? <div className="grid grid-cols-2 gap-2">{methods.map((item) => { const { Icon, label } = METHOD_COPY[item]; return <button key={item} type="button" onClick={() => { setMethod(item); if (item === "web_bluetooth") void startBluetooth(); if (item === "voice") startVoice(); if (item === "phone_camera") setShowCamera(true); }} className="vyva-tap flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-[18px] border border-[#DDD6FE] bg-white px-2 text-center text-[12px] font-black text-vyva-purple"><Icon size={19}/>{label}</button>; })}</div> : null}
          {method === "web_bluetooth" ? <label className="mt-3 flex items-center gap-2 text-[13px] font-bold"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />Remember this device</label> : null}
          {method === "device_photo" ? <label className="mt-3 flex min-h-[64px] cursor-pointer items-center justify-center rounded-[18px] border border-dashed border-vyva-purple font-black text-vyva-purple"><ImagePlus size={18} className="mr-2"/>Choose photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanPhoto(file); }}/></label> : null}
          {(method === "manual" || method === "voice") ? <div className="mt-3 flex gap-2"><input value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={selected.id === "blood_pressure" ? "Example: blood pressure 120/80" : `Enter ${selected.label.toLowerCase()}`} className="min-h-[54px] min-w-0 flex-1 rounded-[16px] border border-[#DDD6FE] px-3 font-body"/><button type="button" onClick={() => void parseText(method)} className="rounded-[16px] bg-vyva-purple px-4 font-black text-white">Check</button></div> : null}
          {showCamera ? <div className="mt-3 overflow-hidden rounded-[18px] border border-[#DDD6FE]"><VitalsScan onComplete={(bpm, respiratoryRate) => { const now = new Date().toISOString(); const rows: ProposedVitalsReading[] = []; if (bpm != null && selectedSignals.includes("resting_hr_bpm")) rows.push({ signal_type: "resting_hr_bpm", value: bpm, unit: "bpm", context_tag: "resting", recorded_at: now, source: "phone_estimate", capture_method: "phone_camera", confidence: "low", explanation: "Phone camera estimate." }); if (respiratoryRate != null && selectedSignals.includes("respiratory_rate")) rows.push({ signal_type: "respiratory_rate", value: respiratoryRate, unit: "/min", context_tag: "resting", recorded_at: now, source: "phone_estimate", capture_method: "phone_camera", confidence: "low", explanation: "Phone camera estimate." }); setProposed(rows); }}/></div> : null}
          {busy ? <p className="mt-3 flex items-center gap-2 text-[13px] font-bold text-vyva-purple"><Loader2 size={16} className="animate-spin"/>Reading…</p> : null}
          {error ? <p role="alert" className="mt-3 text-[13px] font-bold text-red-700">{error}</p> : null}
          {proposed.length ? <div className="mt-3 rounded-[18px] border border-[#BBF7D0] bg-[#ECFDF5] p-3"><p className="font-body text-[14px] font-black">Confirm {proposed.map((reading) => `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}`).join(" / ")}</p><button type="button" disabled={busy} onClick={() => void confirm()} className="mt-2 min-h-[48px] w-full rounded-[15px] bg-[#047857] font-black text-white">Confirm and use</button></div> : null}
        </div>
      )}
    </div>
  );
}
