import { useRef, useState, type ChangeEvent } from "react";
import { Camera, CheckCircle, Droplets, HeartPulse, ImagePlus, Loader2, RefreshCw, SkipForward } from "lucide-react";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { compressImageFile } from "@/lib/imageCompression";
import type { TriageScanOffer } from "@/lib/triageScanOffers";
import { HealthWizardCard } from "@/components/health/HealthWizard";
import VitalsScan from "@/components/VitalsScan";
import type { TriageScanConcernLevel, TriageScanResult, TriageScanType } from "../../shared/triageScans";
import { triageScanLabel } from "../../shared/triageScans";

type TriageScanCardProps = {
  offer: TriageScanOffer;
  language: string;
  onAccepted: (result: TriageScanResult) => void;
  onSkip: (type: TriageScanType) => void;
  onVitalsCaptured?: (bpm: number | null, respiratoryRate: number | null) => void;
};

type ScanTranslator = ReturnType<typeof useLanguage>["t"];

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `triage-scan-${Date.now()}`;
}

function concernForVitals(bpm: number | null, respiratoryRate: number | null): TriageScanConcernLevel {
  if ((typeof bpm === "number" && (bpm >= 120 || bpm <= 45)) || (typeof respiratoryRate === "number" && (respiratoryRate >= 28 || respiratoryRate <= 8))) {
    return "urgent";
  }
  if ((typeof bpm === "number" && (bpm >= 110 || bpm <= 50)) || (typeof respiratoryRate === "number" && (respiratoryRate >= 24 || respiratoryRate <= 10))) {
    return "watch";
  }
  return "normal";
}

function vitalsSummary(bpm: number | null, respiratoryRate: number | null, t: ScanTranslator) {
  const parts = [
    typeof bpm === "number" ? t("triageScan.vitals.pulseSummary", "Pulse {{bpm}} bpm", { bpm }) : "",
    typeof respiratoryRate === "number" ? t("triageScan.vitals.breathingSummary", "breathing {{rate}}/min", { rate: respiratoryRate }) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : t("triageScan.vitals.noReading", "No reading captured.");
}

function iconFor(type: TriageScanType) {
  if (type === "vitals") return HeartPulse;
  if (type === "urine_photo") return Droplets;
  return Camera;
}

export default function TriageScanCard({
  offer,
  language,
  onAccepted,
  onSkip,
  onVitalsCaptured,
}: TriageScanCardProps) {
  const { t } = useLanguage();
  const Icon = iconFor(offer.type);
  const primaryLabel = offer.type === "vitals"
    ? t("triageScan.actions.checkNow", "Check now")
    : t("triageScan.actions.takePhoto", "Take photo");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"offer" | "vitals" | "result">("offer");
  const [result, setResult] = useState<TriageScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScanNow = () => {
    setError(null);
    if (offer.type === "vitals") {
      setMode("vitals");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleVitalsComplete = (bpm: number | null, respiratoryRate: number | null) => {
    if (bpm == null && respiratoryRate == null) {
      onSkip(offer.type);
      return;
    }
    onVitalsCaptured?.(bpm, respiratoryRate);
    setResult({
      id: createId(),
      type: "vitals",
      label: t("triageScan.labels.vitals", triageScanLabel("vitals")),
      concernLevel: concernForVitals(bpm, respiratoryRate),
      summary: vitalsSummary(bpm, respiratoryRate, t),
      findings: [
        typeof bpm === "number" ? t("triageScan.vitals.pulseFinding", "Pulse: {{bpm}} bpm", { bpm }) : "",
        typeof respiratoryRate === "number" ? t("triageScan.vitals.breathingFinding", "Breathing rate: {{rate}}/min", { rate: respiratoryRate }) : "",
      ].filter(Boolean),
      capturedAt: new Date().toISOString(),
      values: {
        pulseBpm: bpm,
        respiratoryRate,
      },
    });
    setMode("result");
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const image = await compressImageFile(file);
      const response = await apiFetch("/api/triage/scan", {
        method: "POST",
        body: JSON.stringify({
          type: offer.type,
          image,
          locale: language,
        }),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const payload = await response.json() as TriageScanResult;
      setResult(payload);
      setMode("result");
    } catch {
      setError(t("triageScan.photoError", "We could not check that photo. You can try again or continue without it."));
    } finally {
      setBusy(false);
    }
  };

  const retake = () => {
    setResult(null);
    setError(null);
    setMode("offer");
    if (offer.type !== "vitals") {
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  };

  if (mode === "vitals") {
    return (
      <div
        className="rounded-[26px] border border-[#E8DED4] bg-white px-3 py-3 shadow-[0_12px_30px_rgba(63,45,35,0.07)]"
        data-testid="triage-scan-card"
      >
        <VitalsScan onComplete={handleVitalsComplete} compact />
      </div>
    );
  }

  if (mode === "result" && result) {
    return (
      <HealthWizardCard tone={result.concernLevel === "urgent" ? "amber" : "green"} className="grid gap-4 px-4 py-4" testId="triage-scan-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#047857] shadow-[0_6px_16px_rgba(4,120,87,0.10)]">
            <CheckCircle size={21} />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
              {t("triageScan.resultAdded", "Scan note added")}
            </p>
            <p className="mt-1 font-body text-[18px] font-black leading-snug text-vyva-text-1">{result.summary}</p>
            {result.findings.length > 0 ? (
              <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                {result.findings.slice(0, 3).join(" - ")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={retake}
            data-testid="button-triage-scan-retake"
            className="vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-[#E8DED4] bg-white px-3 font-body text-[15px] font-black text-vyva-text-1"
          >
            <RefreshCw size={17} />
            {t("triageScan.actions.tryAgain", "Try again")}
          </button>
          <button
            type="button"
            onClick={() => onAccepted(result)}
            data-testid="button-triage-scan-continue"
            className="vyva-tap flex min-h-[54px] items-center justify-center rounded-[18px] bg-vyva-purple px-3 font-body text-[15px] font-black text-white"
          >
            {t("triageScan.actions.continue", "Continue")}
          </button>
        </div>
      </HealthWizardCard>
    );
  }

  return (
    <HealthWizardCard tone="purple" className="grid gap-4 px-4 py-4" testId="triage-scan-card">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="input-triage-scan-photo"
        onChange={handlePhotoChange}
      />
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-vyva-purple shadow-[0_6px_16px_rgba(107,33,168,0.10)]">
          <Icon size={22} />
        </span>
        <div className="min-w-0">
          <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-purple">
            {t("triageScan.eyebrow", "Your choice")}
          </p>
          <p className="mt-1 font-body text-[19px] font-black leading-snug text-vyva-text-1">{offer.title}</p>
          <p className="mt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-2">{offer.body}</p>
          {offer.privacyNote ? (
            <p className="mt-2 font-body text-[12px] font-bold leading-snug text-vyva-text-3">{offer.privacyNote}</p>
          ) : null}
          {error ? (
            <p className="mt-2 font-body text-[13px] font-bold leading-snug text-[#B91C1C]">{error}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleScanNow}
          disabled={busy}
          data-testid="button-triage-scan-now"
          className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-3 font-body text-[16px] font-black text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : offer.type === "vitals" ? <HeartPulse size={18} /> : <ImagePlus size={18} />}
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => onSkip(offer.type)}
          disabled={busy}
          data-testid="button-triage-scan-skip"
          className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border border-[#E8DED4] bg-white px-3 font-body text-[16px] font-black text-vyva-text-1 disabled:opacity-60"
        >
          <SkipForward size={16} />
          {t("triageScan.actions.notNow", "Not now")}
        </button>
      </div>
    </HealthWizardCard>
  );
}
