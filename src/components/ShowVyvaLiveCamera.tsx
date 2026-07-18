import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Check, ImagePlus, Mic, MicOff, Upload, Volume2, VolumeX, X } from "lucide-react";
import {
  assessShowVyvaLiveFrame,
  evaluateShowVyvaCaptureMetrics,
  type ShowVyvaCaptureMetrics,
  type ShowVyvaCaptureQualityIssue,
  type ShowVyvaLiveCameraStatus,
} from "@/lib/showVyvaEvidence";
import { getShowVyvaUseCase, type ShowVyvaUseCaseId } from "../../shared/showVyvaFlow";
import { useShowVyvaSpokenCapture } from "@/hooks/useShowVyvaSpokenCapture";

type ShowVyvaLiveCameraProps = {
  useCaseId: ShowVyvaUseCaseId;
  onCapture: (file: File) => void;
  onUseDeviceCamera: () => void;
  onUpload: () => void;
  onCancel: () => void;
};

type CameraPhase = "starting" | "live" | "capturing" | "error";

type LiveFrameSample = {
  issues: ShowVyvaCaptureQualityIssue[];
  luminance: Float32Array;
  motionScore: number | null;
};

const SAMPLE_WIDTH = 180;
const SAMPLE_HEIGHT = 135;

export function supportsShowVyvaLiveCamera(): boolean {
  return typeof navigator !== "undefined"
    && typeof navigator.mediaDevices?.getUserMedia === "function";
}

function inspectLiveFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  previousLuminance: Float32Array | null,
): LiveFrameSample | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const luminance = new Float32Array(SAMPLE_WIDTH * SAMPLE_HEIGHT);
  let luminanceTotal = 0;
  let darkPixels = 0;
  let brightPixels = 0;

  for (let pixel = 0, offset = 0; offset < data.length; pixel += 1, offset += 4) {
    const value = (0.2126 * data[offset]) + (0.7152 * data[offset + 1]) + (0.0722 * data[offset + 2]);
    luminance[pixel] = value;
    luminanceTotal += value;
    if (value < 48) darkPixels += 1;
    if (value > 246) brightPixels += 1;
  }

  let edgeTotal = 0;
  let edgeSamples = 0;
  let detailPixels = 0;
  let centerDetailPixels = 0;
  for (let y = 1; y < SAMPLE_HEIGHT; y += 1) {
    for (let x = 1; x < SAMPLE_WIDTH; x += 1) {
      const index = (y * SAMPLE_WIDTH) + x;
      const edge = Math.abs(luminance[index] - luminance[index - 1])
        + Math.abs(luminance[index] - luminance[index - SAMPLE_WIDTH]);
      edgeTotal += edge;
      edgeSamples += 2;
      if (edge > 28) {
        detailPixels += 1;
        if (x > SAMPLE_WIDTH * 0.12 && x < SAMPLE_WIDTH * 0.88 && y > SAMPLE_HEIGHT * 0.12 && y < SAMPLE_HEIGHT * 0.88) {
          centerDetailPixels += 1;
        }
      }
    }
  }

  const samplePixels = SAMPLE_WIDTH * SAMPLE_HEIGHT;
  const metrics: ShowVyvaCaptureMetrics = {
    width: video.videoWidth,
    height: video.videoHeight,
    averageLuminance: luminanceTotal / samplePixels,
    darkPixelRatio: darkPixels / samplePixels,
    brightPixelRatio: brightPixels / samplePixels,
    edgeScore: edgeSamples ? edgeTotal / edgeSamples : 0,
  };
  const issues = evaluateShowVyvaCaptureMetrics(metrics);
  const detailPixelRatio = detailPixels / samplePixels;
  const centeredDetailRatio = detailPixels ? centerDetailPixels / detailPixels : 0;
  if ((detailPixelRatio < 0.012 || centeredDetailRatio < 0.42) && !issues.includes("framing")) {
    issues.push("framing");
  }

  let motionScore: number | null = null;
  if (previousLuminance?.length === luminance.length) {
    let motionTotal = 0;
    for (let index = 0; index < luminance.length; index += 1) {
      motionTotal += Math.abs(luminance[index] - previousLuminance[index]);
    }
    motionScore = motionTotal / luminance.length;
  }

  return { issues, luminance, motionScore };
}

export default function ShowVyvaLiveCamera({
  useCaseId,
  onCapture,
  onUseDeviceCamera,
  onUpload,
  onCancel,
}: ShowVyvaLiveCameraProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previousLuminanceRef = useRef<Float32Array | null>(null);
  const stableSamplesRef = useRef(0);
  const captureInProgressRef = useRef(false);
  const countdownRef = useRef<number | null>(null);
  const announceCaptureSuccessRef = useRef<() => Promise<void>>(async () => {});
  const [phase, setPhase] = useState<CameraPhase>("starting");
  const [status, setStatus] = useState<ShowVyvaLiveCameraStatus>("hold_steady");
  const [countdown, setCountdown] = useState<number | null>(null);
  const useCase = getShowVyvaUseCase(useCaseId);
  const instruction = t(`showVyva.capture.instruction.${useCaseId}`, useCase.captureInstruction);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const updateCountdown = useCallback((value: number | null) => {
    countdownRef.current = value;
    setCountdown(value);
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight || captureInProgressRef.current) return;
    captureInProgressRef.current = true;
    updateCountdown(null);
    setPhase("capturing");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      stopCamera();
      captureInProgressRef.current = false;
      setPhase("error");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        stopCamera();
        captureInProgressRef.current = false;
        setPhase("error");
        return;
      }
      stopCamera();
      const file = new File([blob], `vyva-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      void announceCaptureSuccessRef.current().finally(() => onCapture(file));
    }, "image/jpeg", 0.9);
  }, [onCapture, stopCamera, updateCountdown]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [onCancel, stopCamera]);

  const handleUpload = useCallback(() => {
    stopCamera();
    onUpload();
  }, [onUpload, stopCamera]);

  const handleDeviceCamera = useCallback(() => {
    stopCamera();
    onUseDeviceCamera();
  }, [onUseDeviceCamera, stopCamera]);

  const handleVoiceTakePhoto = useCallback(() => {
    if (phase === "error") handleDeviceCamera();
    else captureFrame();
  }, [captureFrame, handleDeviceCamera, phase]);

  const spokenCapture = useShowVyvaSpokenCapture({
    phase,
    status,
    countdown,
    onTakePhoto: handleVoiceTakePhoto,
    onCancel: handleCancel,
    onUpload: handleUpload,
  });
  announceCaptureSuccessRef.current = spokenCapture.announceCaptureSuccess;

  useEffect(() => {
    let cancelled = false;
    if (!supportsShowVyvaLiveCamera()) {
      setPhase("error");
      return;
    }
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
    }).then(async (stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      if (!cancelled) setPhase("live");
    }).catch(() => {
      stopCamera();
      if (!cancelled) setPhase("error");
    });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (phase !== "live") return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas) return;
      const sample = inspectLiveFrame(video, canvas, previousLuminanceRef.current);
      if (!sample) return;
      previousLuminanceRef.current = sample.luminance;
      const stableNow = sample.issues.length === 0
        && sample.motionScore !== null
        && sample.motionScore <= 4.5;
      stableSamplesRef.current = stableNow ? stableSamplesRef.current + 1 : 0;
      const assessment = assessShowVyvaLiveFrame({
        qualityIssues: sample.issues,
        motionScore: sample.motionScore,
        stableSampleCount: stableSamplesRef.current,
      });
      setStatus(assessment.status);
      if (assessment.canStartCountdown && countdownRef.current === null) {
        updateCountdown(3);
      } else if (!assessment.canStartCountdown && countdownRef.current !== null) {
        updateCountdown(null);
      }
    }, 180);
    return () => window.clearInterval(interval);
  }, [phase, updateCountdown]);

  useEffect(() => {
    if (countdown === null || phase !== "live") return;
    const timeout = window.setTimeout(() => {
      if (countdown > 1) updateCountdown(countdown - 1);
      else captureFrame();
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [captureFrame, countdown, phase, updateCountdown]);

  if (phase === "error") {
    return (
      <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[#241B2E]/45 sm:items-center sm:p-5" role="dialog" aria-modal="true" data-testid="dialog-show-vyva-camera-fallback">
        <section className="w-full rounded-t-[24px] bg-[#FFFCF8] p-5 shadow-[0_24px_70px_rgba(36,27,46,0.24)] sm:max-w-[520px] sm:rounded-[24px]">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
              <Camera size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-body text-[21px] font-black text-vyva-text-1">{t("showVyva.liveCamera.unavailableTitle", "Use your device camera")}</h2>
              <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">{t("showVyva.liveCamera.unavailableBody", "The guided camera is not available here. You can still take or upload a photo.")}</p>
            </div>
            <button type="button" onClick={handleCancel} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EDE5DB] bg-white" aria-label={t("common.cancel", "Cancel")}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={handleDeviceCamera} className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-[16px] bg-vyva-purple px-4 font-body text-[15px] font-black text-white" data-testid="button-show-vyva-device-camera">
              <Camera size={20} aria-hidden="true" />
              {t("showVyva.liveCamera.useDeviceCamera", "Use device camera")}
            </button>
            <button type="button" onClick={handleUpload} className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-[16px] border border-[#D8CFF7] bg-white px-4 font-body text-[15px] font-black text-vyva-purple" data-testid="button-show-vyva-camera-upload-fallback">
              <Upload size={20} aria-hidden="true" />
              {t("showVyva.liveCamera.upload", "Upload")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-[#FFFCF8]" role="dialog" aria-modal="true" aria-labelledby="show-vyva-live-camera-title" data-testid="dialog-show-vyva-live-camera">
      <div className="mx-auto flex min-h-full w-full max-w-[680px] flex-col">
        <header className="flex items-center gap-3 border-b border-[#EDE5DB] px-4 py-3">
          <button type="button" onClick={handleCancel} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EDE5DB] bg-white" aria-label={t("common.cancel", "Cancel")} data-testid="button-show-vyva-live-cancel">
            <X size={19} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="show-vyva-live-camera-title" className="font-body text-[18px] font-black text-vyva-text-1">{t("showVyva.liveCamera.title", "Show VYVA")}</h2>
            <p className="font-body text-[12px] font-semibold leading-tight text-vyva-text-2">{t("showVyva.liveCamera.taskOpen", "Your current task stays open")}</p>
          </div>
          <button
            type="button"
            onClick={spokenCapture.toggleSpokenGuidance}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#D8CFF7] bg-white text-vyva-purple"
            aria-label={t(
              spokenCapture.spokenGuidanceEnabled
                ? "showVyva.liveCamera.spoken.turnOffGuidance"
                : "showVyva.liveCamera.spoken.turnOnGuidance",
            )}
            aria-pressed={spokenCapture.spokenGuidanceEnabled}
            title={t(
              spokenCapture.spokenGuidanceEnabled
                ? "showVyva.liveCamera.spoken.turnOffGuidance"
                : "showVyva.liveCamera.spoken.turnOnGuidance",
            )}
            data-testid="button-show-vyva-spoken-guidance"
          >
            {spokenCapture.spokenGuidanceEnabled ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={spokenCapture.toggleCommands}
            disabled={!spokenCapture.commandsSupported}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#D8CFF7] bg-white text-vyva-purple disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t(
              !spokenCapture.commandsSupported
                ? "showVyva.liveCamera.spoken.commandsUnavailable"
                : spokenCapture.commandsEnabled
                  ? "showVyva.liveCamera.spoken.turnOffCommands"
                  : "showVyva.liveCamera.spoken.turnOnCommands",
            )}
            aria-pressed={spokenCapture.commandsEnabled}
            title={t(
              !spokenCapture.commandsSupported
                ? "showVyva.liveCamera.spoken.commandsUnavailable"
                : spokenCapture.commandsEnabled
                  ? "showVyva.liveCamera.spoken.turnOffCommands"
                  : "showVyva.liveCamera.spoken.turnOnCommands",
            )}
            data-testid="button-show-vyva-voice-commands"
          >
            {spokenCapture.commandsEnabled && spokenCapture.commandsSupported ? <Mic size={19} aria-hidden="true" /> : <MicOff size={19} aria-hidden="true" />}
          </button>
          <button type="button" onClick={handleUpload} className="flex min-h-[44px] flex-shrink-0 items-center gap-2 rounded-full border border-[#D8CFF7] bg-white px-3 font-body text-[13px] font-black text-vyva-purple" data-testid="button-show-vyva-live-upload">
            <Upload size={17} aria-hidden="true" />
            <span className="hidden sm:inline">{t("showVyva.liveCamera.upload", "Upload")}</span>
          </button>
        </header>

        <main className="flex flex-1 flex-col px-4 pb-5 pt-4">
          <div className="mb-4 flex items-start gap-3 rounded-[16px] border border-[#D8CFF7] bg-[#F8F6FF] p-3">
            <ImagePlus size={21} className="mt-0.5 flex-shrink-0 text-vyva-purple" aria-hidden="true" />
            <p className="font-body text-[16px] font-black leading-snug text-vyva-text-1" data-testid="text-show-vyva-live-instruction">{instruction}</p>
          </div>

          <div className="relative w-full max-w-[68vh] self-center overflow-hidden rounded-[20px] bg-[#211A27] shadow-[0_16px_36px_rgba(36,27,46,0.18)]" style={{ aspectRatio: "4 / 3" }}>
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" data-testid="video-show-vyva-live" />
            <div className="pointer-events-none absolute inset-[8%] rounded-[14px] border-2 border-dashed border-white/65" aria-hidden="true" />
            {phase === "starting" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#211A27]/75 font-body text-[16px] font-black text-white">{t("showVyva.liveCamera.starting", "Opening camera...")}</div>
            ) : null}
            {countdown !== null ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#211A27]/20" role="status" aria-live="assertive" aria-atomic="true" data-testid="text-show-vyva-live-countdown">
                <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#6B21A8]/85 font-body text-[48px] font-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)]">{countdown}</span>
              </div>
            ) : null}
          </div>
          <canvas ref={analysisCanvasRef} className="hidden" aria-hidden="true" />

          <div className="mt-4 flex flex-col items-center gap-3">
            <div className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 font-body text-[14px] font-black ${status === "ready" ? "bg-[#E7F8F4] text-[#0F766E]" : "bg-[#FFF4DE] text-[#92400E]"}`} role="status" aria-live="polite" aria-atomic="true" data-testid="text-show-vyva-live-status">
              {status === "ready" ? <Check size={17} aria-hidden="true" /> : <Camera size={17} aria-hidden="true" />}
              {t(`showVyva.liveCamera.status.${status}`, {
                dark: "Find more light",
                glare: "Tilt away from glare",
                blur: "Hold closer and let the camera focus",
                framing: "Place the whole item inside the frame",
                hold_steady: "Hold steady",
                ready: "Ready - keep still",
              }[status])}
            </div>
            <p className="font-body text-[12px] font-bold text-vyva-text-2">{t("showVyva.liveCamera.autoCapture", "Auto capture is on")}</p>
            {spokenCapture.commandsSupported && spokenCapture.commandsEnabled ? (
              <p className="max-w-[420px] text-center font-body text-[12px] font-semibold leading-snug text-vyva-text-2" data-testid="text-show-vyva-command-hint">
                {spokenCapture.commandsListening
                  ? t("showVyva.liveCamera.spoken.commandHint")
                  : t("showVyva.liveCamera.spoken.preparingCommands")}
              </p>
            ) : null}
            <button type="button" onClick={captureFrame} disabled={phase !== "live"} className="vyva-tap flex min-h-[64px] min-w-[190px] items-center justify-center gap-3 rounded-full bg-vyva-purple px-7 font-body text-[17px] font-black text-white shadow-[0_10px_24px_rgba(107,33,168,0.24)] disabled:opacity-50" data-testid="button-show-vyva-live-shutter">
              <Camera size={24} aria-hidden="true" />
              {phase === "capturing" ? t("showVyva.liveCamera.capturing", "Taking photo...") : t("showVyva.liveCamera.takePhoto", "Take photo")}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
