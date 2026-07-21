import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, Hand, Mic, MicOff, Phone, RotateCcw, UserRound, X } from "lucide-react";
import { type TranscriptEntry, type VoiceConnectionErrorCode, type VoiceDiagnosticStep } from "@/hooks/useVyvaVoice";
import type { VoiceAppAction } from "@/lib/voiceNavigation";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";
import ZamoraVoiceOrb, { type ZamoraOrbState } from "@/components/ZamoraVoiceOrb";
import { emitSosSheetOpen } from "@/lib/sosEvents";
import { VoiceCanvasScene, useVoiceCanvasAgentPresence, type VoiceCanvasViewModel } from "@/components/voice-canvas";

interface VoiceCallOverlayProps {
  isSpeaking: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
  onEnd: () => void;
  onMinimize?: () => void;
  activeAction?: VoiceAppAction | null;
  voiceSessionPhase?: VoiceSessionPhase;
  isMicMuted?: boolean;
  onMicToggle?: (muted: boolean) => void;
  connectionError?: string | null;
  connectionErrorCode?: VoiceConnectionErrorCode | null;
  voiceDiagnostics?: VoiceDiagnosticStep[];
  onRetry?: () => void;
  onType?: () => void;
  canvasViewModel?: VoiceCanvasViewModel | null;
  onCanvasChoice?: (choiceId: string) => void;
  onCanvasPrimary?: (value?: string) => void;
  onCanvasSecondary?: () => void;
  onCanvasFile?: (file: File | null) => void;
}

function orbState(isSpeaking: boolean, isConnecting: boolean): ZamoraOrbState {
  if (isSpeaking) return "speaking";
  if (isConnecting) return "listening";
  return "listening";
}

function inferConnectionErrorCode(message?: string | null): VoiceConnectionErrorCode | null {
  const normalized = message?.toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.includes("microphone") || normalized.includes("permission")) return "MICROPHONE_ACCESS_FAILED";
  if (normalized.includes("api key")) return "ELEVENLABS_API_KEY_MISSING";
  if (normalized.includes("agent configured")) return "ELEVENLABS_AGENT_MISSING";
  if (normalized.includes("signed url")) return "ELEVENLABS_SIGNED_URL_ERROR";
  if (normalized.includes("account access is disabled")) return "VOICE_ACCOUNT_ACCESS_DISABLED";
  if (normalized.includes("no active care profile")) return "VOICE_ACTIVE_PROFILE_MISSING";
  if (normalized.includes("selected care profile could not be found")) return "VOICE_ACTIVE_PROFILE_NOT_FOUND";
  if (normalized.includes("current plan") || normalized.includes("entitlement")) return "VOICE_ENTITLEMENT_REQUIRED";
  if (normalized.includes("could not verify access") || normalized.includes("verify access")) return "VOICE_ACCESS_UNAVAILABLE";
  if (normalized.includes("not authenticated")) return "VOICE_AUTH_REQUIRED";
  if (
    normalized.includes("failed to connect") ||
    normalized.includes("could not connect") ||
    normalized.includes("couldn't connect") ||
    normalized.includes("unable to start voice session") ||
    normalized.includes("failed to start session") ||
    normalized.includes("websocket") ||
    normalized.includes("voice session closed")
  ) {
    return "VOICE_SESSION_START_FAILED";
  }
  return null;
}

function isMicrophoneError(code: VoiceConnectionErrorCode | null) {
  return code === "MICROPHONE_UNAVAILABLE" ||
    code === "MICROPHONE_PERMISSION_DENIED" ||
    code === "MICROPHONE_ACCESS_FAILED";
}

function isSetupError(code: VoiceConnectionErrorCode | null) {
  return code === "ELEVENLABS_AGENT_MISSING" ||
    code === "ELEVENLABS_API_KEY_MISSING" ||
    code === "ELEVENLABS_SIGNED_URL_ERROR" ||
    code === "ELEVENLABS_TOKEN_ERROR";
}

function isSessionError(code: VoiceConnectionErrorCode | null) {
  return code === "VOICE_SESSION_START_FAILED" ||
    code === "VOICE_SESSION_ERROR" ||
    code === "VOICE_SESSION_CLOSED";
}

function isProfileAccessError(code: VoiceConnectionErrorCode | null) {
  return code === "VOICE_ACCOUNT_ACCESS_DISABLED" ||
    code === "VOICE_ACTIVE_PROFILE_MISSING" ||
    code === "VOICE_ACTIVE_PROFILE_NOT_FOUND";
}

function safeConnectionErrorDetail(message?: string | null) {
  const trimmed = message?.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  return trimmed
    .replace(/([?&](?:token|api_key|xi-api-key|signed_url)=)[^&\s]+/gi, "$1[hidden]")
    .replace(/\b(?:wss?|https?):\/\/\S+/gi, "[voice session url hidden]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [hidden]")
    .slice(0, 180);
}

function diagnosticStatusLabel(step: VoiceDiagnosticStep) {
  if (step.status === "failed") return "Stopped";
  if (step.status === "passed") return "OK";
  if (step.status === "running") return "Checking";
  if (step.status === "skipped") return "Skipped";
  return "Waiting";
}

function diagnosticTone(step: VoiceDiagnosticStep) {
  if (step.status === "failed") return { background: "#FEF2F2", color: "#B91C1C", border: "#FECACA" };
  if (step.status === "passed") return { background: "#ECFDF5", color: "#047857", border: "#A7F3D0" };
  if (step.status === "running") return { background: "#F5F3FF", color: "#6B21A8", border: "#DDD6FE" };
  return { background: "#F8F4EF", color: "#7D6B65", border: "#EADFD5" };
}

function controlButtonStyle(variant: "soft" | "danger" | "primary" = "soft"): CSSProperties {
  return {
    width: "100%",
    minWidth: 0,
    minHeight: 98,
    border: "none",
    background: "transparent",
    color: variant === "danger" ? "#241C22" : variant === "primary" ? "#5B12A0" : "#2D2230",
    padding: "4px 2px",
    cursor: "pointer",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1,
    WebkitTapHighlightColor: "transparent",
  };
}

function controlIconStyle(variant: "soft" | "danger" | "primary" = "soft"): CSSProperties {
  if (variant === "danger") {
    return {
      width: 68,
      height: 68,
      borderRadius: 999,
      background: "#111111",
      color: "#FFFFFF",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 18px 36px rgba(17,17,17,0.22)",
    };
  }

  return {
    width: 68,
    height: 68,
    borderRadius: 999,
    background: variant === "primary"
      ? "linear-gradient(145deg, #F5EFFF 0%, #E7DAFF 100%)"
      : "linear-gradient(145deg, #F7F0FF 0%, #EEE3FF 100%)",
    color: "#5B12A0",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  };
}

const MAX_TRANSCRIPT_CHUNK_WORDS = 9;
const MAX_TRANSCRIPT_CHUNK_CHARS = 70;

function splitTranscriptIntoCaptionChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = trimmed.split(/(?<=[.!?¡¿。！？])\s+/u).filter(Boolean);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    let current: string[] = [];

    for (const word of words) {
      const candidate = [...current, word].join(" ");
      if (
        current.length > 0 &&
        (current.length >= MAX_TRANSCRIPT_CHUNK_WORDS || candidate.length > MAX_TRANSCRIPT_CHUNK_CHARS)
      ) {
        chunks.push(current.join(" "));
        current = [word];
      } else {
        current.push(word);
      }
    }

    if (current.length > 0) {
      chunks.push(current.join(" "));
    }
  }

  return chunks;
}

function captionChunkDuration(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(3400, Math.max(1500, wordCount * 330));
}

const VoiceCallOverlay = ({
  isSpeaking,
  isConnecting,
  transcript,
  onEnd,
  onMinimize,
  activeAction,
  voiceSessionPhase,
  isMicMuted = false,
  onMicToggle,
  connectionError,
  connectionErrorCode,
  voiceDiagnostics,
  onRetry,
  onType,
  canvasViewModel,
  onCanvasChoice,
  onCanvasPrimary,
  onCanvasSecondary,
  onCanvasFile,
}: VoiceCallOverlayProps) => {
  const { t } = useTranslation();
  const latestEntry = transcript.length > 0 ? transcript[transcript.length - 1] : null;
  const latestVyvaEntry = useMemo(
    () => [...transcript].reverse().find((entry) => entry.from === "vyva") ?? null,
    [transcript],
  );
  const latestVyvaText = latestVyvaEntry?.text.trim() ?? "";
  const vyvaCaptionChunks = useMemo(() => splitTranscriptIntoCaptionChunks(latestVyvaText), [latestVyvaText]);
  const [captionChunkIndex, setCaptionChunkIndex] = useState(0);
  const [canvasTextValue, setCanvasTextValue] = useState(canvasViewModel?.textEntry?.value ?? "");
  const activeCaptionIndex = vyvaCaptionChunks.length > 0
    ? Math.min(captionChunkIndex, vyvaCaptionChunks.length - 1)
    : 0;
  const activeVyvaCaption = vyvaCaptionChunks[activeCaptionIndex] ?? "";

  useEffect(() => {
    setCaptionChunkIndex(0);
  }, [latestVyvaText]);

  useEffect(() => {
    setCanvasTextValue(canvasViewModel?.textEntry?.value ?? "");
  }, [canvasViewModel?.sceneId, canvasViewModel?.textEntry?.value]);

  useEffect(() => {
    if (vyvaCaptionChunks.length <= 1 || activeCaptionIndex >= vyvaCaptionChunks.length - 1) return;

    const timeout = window.setTimeout(() => {
      setCaptionChunkIndex((currentIndex) => Math.min(currentIndex + 1, vyvaCaptionChunks.length - 1));
    }, captionChunkDuration(vyvaCaptionChunks[activeCaptionIndex]));

    return () => window.clearTimeout(timeout);
  }, [activeCaptionIndex, vyvaCaptionChunks]);

  const fallbackStatusLabel = isConnecting
    ? t("voiceHero.connecting", "Connecting")
    : isSpeaking
    ? t("voiceHero.speakingStatus", "Speaking")
    : t("voiceHero.listening", "Listening");
  const hasConnectionError = Boolean(connectionError);
  const resolvedConnectionErrorCode = connectionErrorCode ?? inferConnectionErrorCode(connectionError);
  const hasMicrophoneError = isMicrophoneError(resolvedConnectionErrorCode);
  const hasVoiceSetupError = isSetupError(resolvedConnectionErrorCode);
  const hasSessionError = isSessionError(resolvedConnectionErrorCode);
  const hasAccessError = resolvedConnectionErrorCode === "VOICE_AUTH_REQUIRED" ||
    resolvedConnectionErrorCode === "VOICE_ENTITLEMENT_REQUIRED" ||
    isProfileAccessError(resolvedConnectionErrorCode) ||
    resolvedConnectionErrorCode === "VOICE_ACCESS_UNAVAILABLE";
  const safeErrorDetail = safeConnectionErrorDetail(connectionError);
  const statusLabel = hasConnectionError
    ? hasVoiceSetupError
      ? t("voiceHero.connectionSetupNeeded", "Setup needed")
      : hasAccessError
      ? t("voiceHero.connectionAccessNeeded", "Access needed")
      : t("voiceHero.connectionNeedsAttention", "Needs attention")
    : voiceSessionPhase
    ? voiceSessionPhaseLabel(voiceSessionPhase)
    : fallbackStatusLabel;
  const canToggleMic = Boolean(!hasConnectionError && onMicToggle && voiceSessionPhase !== "connecting" && voiceSessionPhase !== "transferring");
  const emptyTranscriptLabel = (() => {
    if (!hasConnectionError) {
      return isConnecting
        ? t("voiceHero.connecting", "Connecting")
        : t("voiceHero.listening", "Listening");
    }
    if (hasMicrophoneError) return t("voiceHero.microphoneError", "Microphone is blocked");
    if (hasVoiceSetupError) return t("voiceHero.voiceSetupError", "Voice setup needed");
    if (isProfileAccessError(resolvedConnectionErrorCode)) return t("voiceHero.voiceProfileAccessError", "Account access failed");
    if (resolvedConnectionErrorCode === "VOICE_ENTITLEMENT_REQUIRED") return t("voiceHero.voiceAccessError", "Voice plan needed");
    if (resolvedConnectionErrorCode === "VOICE_AUTH_REQUIRED") return t("voiceHero.voiceSignInError", "Sign in again");
    if (resolvedConnectionErrorCode === "VOICE_ACCESS_UNAVAILABLE") return t("voiceHero.voiceAccessUnavailableError", "Access check failed");
    if (hasSessionError) return t("voiceHero.voiceSessionError", "Voice session failed");
    return t("voiceHero.connectionError", "Voice couldn't connect");
  })();
  const errorDetailLabel = hasMicrophoneError
    ? t("voiceHero.microphoneErrorHelp", "Please allow microphone access for VYVA, then try again.")
    : resolvedConnectionErrorCode === "ELEVENLABS_API_KEY_MISSING"
    ? t("voiceHero.voiceApiKeyMissingHelp", "The ElevenLabs API key is missing on the server.")
    : resolvedConnectionErrorCode === "ELEVENLABS_AGENT_MISSING"
    ? t("voiceHero.voiceAgentMissingHelp", "No ElevenLabs agent is configured for this voice entry point.")
    : resolvedConnectionErrorCode === "ELEVENLABS_SIGNED_URL_ERROR"
    ? t("voiceHero.voiceSignedUrlErrorHelp", "ElevenLabs rejected the voice session. Check the API key and agent ID.")
    : resolvedConnectionErrorCode === "ELEVENLABS_TOKEN_ERROR"
    ? t("voiceHero.voiceTokenErrorHelp", "The server could not create a voice session.")
    : resolvedConnectionErrorCode === "VOICE_ENTITLEMENT_REQUIRED"
    ? t("voiceHero.voiceEntitlementErrorHelp", "This profile does not have voice access enabled.")
    : resolvedConnectionErrorCode === "VOICE_ACCOUNT_ACCESS_DISABLED"
    ? t(
        "voiceHero.voiceAccountDisabledHelp",
        safeErrorDetail ?? "The active care profile is disabled for app access.",
      )
    : resolvedConnectionErrorCode === "VOICE_ACTIVE_PROFILE_MISSING"
    ? t(
        "voiceHero.voiceActiveProfileMissingHelp",
        safeErrorDetail ?? "No active care profile is selected for this login.",
      )
    : resolvedConnectionErrorCode === "VOICE_ACTIVE_PROFILE_NOT_FOUND"
    ? t(
        "voiceHero.voiceActiveProfileNotFoundHelp",
        safeErrorDetail ?? "The selected care profile could not be found.",
      )
    : resolvedConnectionErrorCode === "VOICE_ACCESS_UNAVAILABLE"
    ? t("voiceHero.voiceAccessUnavailableHelp", "VYVA could not verify account access right now. Please try again.")
    : resolvedConnectionErrorCode === "VOICE_AUTH_REQUIRED"
    ? t("voiceHero.voiceAuthErrorHelp", "Please sign in again, then try voice.")
    : resolvedConnectionErrorCode === "VOICE_SESSION_START_FAILED"
    ? t(
        "voiceHero.voiceSessionStartErrorHelp",
        safeErrorDetail
          ? `ElevenLabs could not start: ${safeErrorDetail}`
          : "ElevenLabs could not start the browser voice session.",
      )
    : resolvedConnectionErrorCode === "VOICE_SESSION_ERROR"
    ? t(
        "voiceHero.voiceSessionRuntimeErrorHelp",
        safeErrorDetail
          ? `The voice session reported: ${safeErrorDetail}`
          : "The active voice session reported an error.",
      )
    : resolvedConnectionErrorCode === "VOICE_SESSION_CLOSED"
    ? t(
        "voiceHero.voiceSessionClosedHelp",
        safeErrorDetail
          ? `The voice session closed: ${safeErrorDetail}`
          : "The voice session closed before VYVA could continue.",
      )
    : t("voiceHero.connectionErrorHelp", "Something stopped the voice from starting. Try again in a moment.");
  const fallbackMainMessage = isConnecting
    ? t("voiceHero.connectingMain", "Getting ready")
    : isMicMuted
    ? t("voiceHero.micOffMain", "Mic is off")
    : isSpeaking
    ? t("voiceHero.speakingFallback", "One moment")
    : t("voiceHero.listeningMain", "I'm listening");
  const mainMessage = hasConnectionError
    ? emptyTranscriptLabel
    : activeVyvaCaption || fallbackMainMessage;
  const supportMessage = latestVyvaText || hasConnectionError
    ? null
    : isConnecting
    ? t("voiceHero.connectingSupport", "Opening voice with VYVA.")
    : isMicMuted
    ? t("voiceHero.micOffSupport", "Tap Talk when you are ready.")
    : t("voiceHero.listeningSupport", "Tell me what you need.");
  const transcriptPreview = latestEntry?.text && latestEntry.from !== "vyva"
    ? `${latestEntry.from === "user" ? t("voiceHero.you", "You") : "VYVA"}: ${latestEntry.text}`
    : null;
  const transcriptSpeaker = latestEntry?.from === "user" ? t("voiceHero.you", "You") : "VYVA";
  const currentOrbState = hasConnectionError || isMicMuted ? "idle" : orbState(isSpeaking, isConnecting);
  const visibleVoiceDiagnostics = (voiceDiagnostics ?? []).filter((step) => step.status !== "pending");
  const failedVoiceDiagnostic = visibleVoiceDiagnostics.find((step) => step.status === "failed");
  const canType = Boolean(onType || onMinimize);
  const controlColumnCount = hasConnectionError
    ? [Boolean(onRetry), Boolean(onMinimize), true].filter(Boolean).length
    : [canToggleMic, true, canType].filter(Boolean).length;
  const baseVisibleCanvasViewModel = canvasViewModel && !hasConnectionError
    ? {
        ...canvasViewModel,
        ...(canvasViewModel.textEntry
          ? { textEntry: { ...canvasViewModel.textEntry, value: canvasTextValue } }
          : {}),
      }
    : null;
  const visibleCanvasViewModel = useVoiceCanvasAgentPresence(baseVisibleCanvasViewModel);

  const handleSos = () => {
    emitSosSheetOpen();
    onMinimize?.();
  };

  const handleType = () => {
    if (onType) {
      onType();
      return;
    }
    onMinimize?.();
  };

  const overlay = (
    <div
      data-testid="voice-call-overlay"
      className="voice-call-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "radial-gradient(circle at 50% 40%, rgba(221,214,254,0.72) 0%, rgba(248,244,239,0.28) 36%, rgba(255,252,248,0) 58%), linear-gradient(180deg, #FFFCF8 0%, #FFFDFB 52%, #F8F4EF 100%)",
        boxSizing: "border-box",
        paddingLeft: 18,
        paddingRight: 18,
        paddingTop: "max(env(safe-area-inset-top, 0px), 18px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 18px)",
        overflow: "hidden",
      }}
    >
      <div
        data-testid="voice-call-header"
        style={{
          display: "grid",
          gridTemplateColumns: "56px minmax(0, 1fr) 56px",
          alignItems: "center",
          width: "min(100%, 520px)",
          gap: 8,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            fontWeight: 900,
            boxShadow: "0 10px 24px rgba(91,18,160,0.22)",
          }}
        >
          V
        </div>
        <span
          data-testid="text-call-status"
          className="font-body"
          style={{
            justifySelf: "center",
            minHeight: 32,
            maxWidth: "100%",
            borderRadius: 999,
            border: "1px solid #EADFD5",
            background: "rgba(255,255,255,0.84)",
            color: hasConnectionError ? "#8A1C1C" : "#5B12A0",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "0 13px",
            fontSize: 14,
            fontWeight: 900,
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            boxShadow: "0 10px 24px rgba(47,33,53,0.08)",
          }}
        >
          {!hasConnectionError && (
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: "#8B5CF6",
                boxShadow: "0 0 0 5px rgba(139,92,246,0.12)",
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{statusLabel}</span>
        </span>
        {onMinimize ? (
          <button
            type="button"
            data-testid="button-minimize-call"
            onClick={onMinimize}
            aria-label={hasConnectionError ? "Back to app" : "Minimize voice"}
            title={hasConnectionError ? "Back to app" : "Minimize"}
            className="font-body"
            style={{
              width: 48,
              height: 48,
              justifySelf: "end",
              borderRadius: 999,
              border: "1px solid #EADFD5",
              background: "#FFFFFF",
              color: "#5B12A0",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 14px 30px rgba(47,33,53,0.12)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <ChevronDown size={24} strokeWidth={2.6} />
          </button>
        ) : (
          <div />
        )}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          gap: 18,
          boxSizing: "border-box",
          paddingTop: visibleCanvasViewModel ? "clamp(18px, 4vh, 42px)" : "clamp(30px, 8vh, 86px)",
          paddingBottom: visibleCanvasViewModel ? "clamp(250px, 31vh, 310px)" : "clamp(310px, 39vh, 382px)",
          overflowY: "auto",
          scrollbarWidth: "none",
        }}
      >
        {visibleCanvasViewModel ? (
          <div data-testid="voice-canvas-surface" style={{ width: "min(100%, 760px)" }}>
            <VoiceCanvasScene
              viewModel={visibleCanvasViewModel}
              onChoice={onCanvasChoice}
              onPrimary={() => onCanvasPrimary?.(canvasTextValue)}
              onSecondary={onCanvasSecondary}
              onTextChange={setCanvasTextValue}
              onFileChange={onCanvasFile}
            />
          </div>
        ) : (
          <>
        <div
          data-testid="voice-mode-orb"
          aria-hidden="true"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "min(92vw, 424px)",
              height: "min(92vw, 424px)",
              borderRadius: 999,
              background: "radial-gradient(circle, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.10) 45%, rgba(255,255,255,0) 72%)",
              boxShadow: "inset 0 0 0 58px rgba(124,58,237,0.04), inset 0 0 0 112px rgba(124,58,237,0.035)",
            }}
          />
          <ZamoraVoiceOrb state={currentOrbState} size={300} testId="voice-mode-zamora-orb" />
        </div>

        <h1
          data-testid="text-call-transcript"
          className="font-body"
          style={{
            color: hasConnectionError ? "#8A1C1C" : "#5B12A0",
            fontSize: hasConnectionError
              ? "clamp(34px, 8vw, 48px)"
              : activeVyvaCaption
              ? "clamp(34px, 8.5vw, 58px)"
              : "clamp(42px, 11vw, 82px)",
            lineHeight: activeVyvaCaption ? 1.08 : 1.04,
            textAlign: "center",
            maxWidth: activeVyvaCaption ? "min(88vw, 560px)" : "min(92vw, 620px)",
            maxHeight: activeVyvaCaption ? "min(34vh, 260px)" : undefined,
            fontWeight: 850,
            overflow: activeVyvaCaption ? "hidden" : undefined,
            overflowWrap: "anywhere",
            margin: 0,
            letterSpacing: 0,
          }}
        >
          {mainMessage}
        </h1>

        {supportMessage && (
          <p
            data-testid="text-call-subtitle"
            className="font-body"
            style={{
              color: "#6E7280",
              fontSize: 22,
              lineHeight: 1.35,
              textAlign: "center",
              maxWidth: "min(88vw, 360px)",
              fontWeight: 500,
              margin: 0,
              overflowWrap: "anywhere",
            }}
          >
            {supportMessage}
          </p>
        )}

        {transcriptPreview && !hasConnectionError && (
          <div
            data-testid="text-call-transcript-preview"
            className="font-body"
            style={{
              width: "min(100%, 354px)",
              borderRadius: 999,
              border: "1px solid rgba(221,214,254,0.55)",
              background: "#F3EDFF",
              boxShadow: "0 14px 28px rgba(91,18,160,0.08)",
              minHeight: 52,
              padding: "0 14px 0 10px",
              color: "#2D2230",
              fontSize: 14,
              lineHeight: 1.35,
              fontWeight: 750,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 12,
              boxSizing: "border-box",
              textAlign: "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={transcriptPreview}
          >
            <span
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "rgba(255,255,255,0.65)",
                color: "#5B12A0",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <UserRound size={20} strokeWidth={2.5} />
            </span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong style={{ color: "#5B12A0", fontWeight: 900 }}>{transcriptSpeaker}: </strong>
              {latestEntry?.text}
            </span>
          </div>
        )}

        {hasConnectionError && (
          <p
            data-testid="text-call-error-detail"
            className="font-body"
            style={{
              maxWidth: "min(88vw, 460px)",
              margin: "0 auto",
              color: "#6E5F66",
              fontSize: 17,
              lineHeight: 1.45,
              fontWeight: 750,
              textAlign: "center",
              overflowWrap: "anywhere",
            }}
          >
            {errorDetailLabel}
          </p>
        )}

        {hasConnectionError && visibleVoiceDiagnostics.length > 0 && (
          <div
            data-testid="voice-call-diagnostics"
            className="font-body"
            style={{
              width: "min(88vw, 500px)",
              borderRadius: 18,
              border: "1px solid #EADFD5",
              background: "rgba(255,255,255,0.82)",
              padding: "12px 14px",
              color: "#3B2D36",
              boxShadow: "0 12px 28px rgba(47,33,53,0.08)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#5F4E57",
                fontSize: 13,
                lineHeight: 1.35,
                fontWeight: 800,
                overflowWrap: "anywhere",
              }}
            >
              {failedVoiceDiagnostic
                ? t("voiceHero.diagnosticsStoppedAt", `Stopped at ${failedVoiceDiagnostic.label}`)
                : t("voiceHero.diagnosticsChecking", "Voice checks")}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
            >
              {visibleVoiceDiagnostics.map((step) => {
                const tone = diagnosticTone(step);
                return (
                  <span
                    key={step.id}
                    title={step.detail}
                    style={{
                      display: "inline-flex",
                      minWidth: 0,
                      maxWidth: "100%",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 999,
                      border: `1px solid ${tone.border}`,
                      background: tone.background,
                      color: tone.color,
                      padding: "6px 9px",
                      fontSize: 12,
                      lineHeight: 1,
                      fontWeight: 800,
                    }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{step.label}</span>
                    <span style={{ flexShrink: 0, opacity: 0.78 }}>{diagnosticStatusLabel(step)}</span>
                  </span>
                );
              })}
            </div>
            {failedVoiceDiagnostic?.detail && (
              <p
                style={{
                  margin: "10px 0 0",
                  color: "#7D6B65",
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 600,
                  overflowWrap: "anywhere",
                }}
              >
                {failedVoiceDiagnostic.detail}
              </p>
            )}
          </div>
        )}

        {activeAction && (
          <div
            data-testid="voice-action-panel"
            className="font-body"
            style={{
              width: "min(100%, 420px)",
              borderRadius: 18,
              border: "1px solid #B7F0DB",
              background: "#F0FDF4",
              padding: "12px 14px",
              boxShadow: "0 12px 28px rgba(47,33,53,0.08)",
              color: "#064E3B",
              transition: "opacity 0.18s ease, transform 0.18s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "#10B981",
                  boxShadow: "0 0 0 6px rgba(16,185,129,0.12)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#047857",
                }}
              >
                {t("voiceHero.nextStep", "Next step")}
              </span>
            </div>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.22,
                fontWeight: 900,
                margin: 0,
                overflowWrap: "anywhere",
              }}
            >
              {activeAction.title}
            </p>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.45,
                margin: "6px 0 0",
                color: "#047857",
                overflowWrap: "anywhere",
              }}
            >
              {activeAction.summary}
            </p>
          </div>
        )}
          </>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "max(env(safe-area-inset-bottom, 0px), 18px)",
          left: 18,
          right: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          zIndex: 3,
        }}
      >
        {onMinimize && (
          <button
            type="button"
            data-testid="button-voice-sos"
            onClick={handleSos}
            className="font-body"
            style={{
              minHeight: 48,
              border: "1.5px solid #D71920",
              borderRadius: 999,
              background: "#D71920",
              color: "#FFFFFF",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 17,
              fontWeight: 900,
              cursor: "pointer",
              padding: "0 26px",
              boxShadow: "0 16px 34px rgba(215,25,32,0.22)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <Phone size={20} strokeWidth={2.4} />
            SOS
          </button>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, controlColumnCount))}, minmax(0, 1fr))`,
            gap: 12,
            width: "min(100%, 360px)",
            borderRadius: 44,
            border: "1px solid rgba(234,223,213,0.72)",
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 26px 64px rgba(47,33,53,0.15)",
            padding: "14px 16px 12px",
            backdropFilter: "blur(14px)",
          }}
        >
          {hasConnectionError && onRetry ? (
            <button
              type="button"
              data-testid="button-retry-call"
              onClick={onRetry}
              className="font-body"
              style={controlButtonStyle("primary")}
            >
              <span style={controlIconStyle("primary")}>
                <RotateCcw size={30} strokeWidth={2.2} />
              </span>
              <span>{t("voiceHero.retryCall", "Try again")}</span>
            </button>
          ) : null}

          {hasConnectionError && onMinimize && (
            <button
              type="button"
              data-testid="button-back-to-app"
              onClick={onMinimize}
              className="font-body"
              style={controlButtonStyle("soft")}
            >
              <span style={controlIconStyle("soft")}>
                <ChevronDown size={30} strokeWidth={2.2} />
              </span>
              <span>{t("voiceHero.backToApp", "Back to app")}</span>
            </button>
          )}

          {!hasConnectionError && canToggleMic && (
            <button
              type="button"
              data-testid="button-toggle-call-mic"
              onClick={() => onMicToggle?.(!isMicMuted)}
              className="font-body"
              style={controlButtonStyle(isMicMuted ? "primary" : "soft")}
            >
              <span style={controlIconStyle("soft")}>
                {isMicMuted ? <MicOff size={30} strokeWidth={2.2} /> : <Mic size={30} strokeWidth={2.2} />}
              </span>
              <span>{isMicMuted ? t("voiceHero.micOffShort", "Mic off") : t("voiceHero.micOnShort", "Mic on")}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="button-end-call"
            onClick={onEnd}
            className="font-body"
            style={controlButtonStyle("danger")}
          >
            <span style={controlIconStyle("danger")}>
              <X size={34} strokeWidth={2.8} />
            </span>
            <span>{t("voiceHero.endCallShort", "End")}</span>
          </button>

          {!hasConnectionError && canType && (
            <button
              type="button"
              data-testid="button-type-call"
              onClick={handleType}
              className="font-body"
              style={controlButtonStyle("soft")}
            >
              <span style={controlIconStyle("soft")}>
                <Hand size={30} strokeWidth={2.2} />
              </span>
              <span>{t("voiceHero.touchInsteadShort", "Touch")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

export default VoiceCallOverlay;
