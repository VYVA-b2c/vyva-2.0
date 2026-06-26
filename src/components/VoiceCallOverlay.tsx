import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { RotateCcw, Mic, MicOff, PhoneOff } from "lucide-react";
import { type TranscriptEntry, type VoiceConnectionErrorCode } from "@/hooks/useVyvaVoice";
import type { VoiceAppAction } from "@/lib/voiceNavigation";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";
import ZamoraVoiceOrb, { type ZamoraOrbState } from "@/components/ZamoraVoiceOrb";

interface VoiceCallOverlayProps {
  isSpeaking: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
  onEnd: () => void;
  activeAction?: VoiceAppAction | null;
  voiceSessionPhase?: VoiceSessionPhase;
  isMicMuted?: boolean;
  onMicToggle?: (muted: boolean) => void;
  connectionError?: string | null;
  connectionErrorCode?: VoiceConnectionErrorCode | null;
  onRetry?: () => void;
}

const WORD_DISPLAY_MS = 360;
const LONG_WORD_DISPLAY_MAX_MS = 560;
const WORD_FADE_MS = 90;

function transcriptWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function wordDisplayDurationMs(word: string) {
  return Math.min(
    LONG_WORD_DISPLAY_MAX_MS,
    WORD_DISPLAY_MS + Math.max(0, word.length - 10) * 20,
  );
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
  if (normalized.includes("current plan") || normalized.includes("entitlement")) return "VOICE_ENTITLEMENT_REQUIRED";
  if (normalized.includes("not authenticated")) return "VOICE_AUTH_REQUIRED";
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

const VoiceCallOverlay = ({
  isSpeaking,
  isConnecting,
  transcript,
  onEnd,
  activeAction,
  voiceSessionPhase,
  isMicMuted = false,
  onMicToggle,
  connectionError,
  connectionErrorCode,
  onRetry,
}: VoiceCallOverlayProps) => {
  const { t } = useTranslation();
  const [visibleWordIndex, setVisibleWordIndex] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);

  const latestEntry = transcript.length > 0 ? transcript[transcript.length - 1] : null;
  const latestVyvaEntry = latestEntry?.from === "vyva" ? latestEntry : null;
  const words = useMemo(
    () => transcriptWords(latestVyvaEntry?.text ?? ""),
    [latestVyvaEntry?.text],
  );
  const visibleWord = words[visibleWordIndex] ?? null;

  useEffect(() => {
    setVisibleWordIndex(0);
    setWordVisible(true);
  }, [latestVyvaEntry?.text, latestVyvaEntry?.timestamp]);

  useEffect(() => {
    if (!latestVyvaEntry || visibleWordIndex >= words.length - 1) return;

    let fadeTimer: number | undefined;
    const advanceTimer = window.setTimeout(() => {
      setWordVisible(false);
      fadeTimer = window.setTimeout(() => {
        setVisibleWordIndex(visibleWordIndex + 1);
        setWordVisible(true);
      }, WORD_FADE_MS);
    }, wordDisplayDurationMs(words[visibleWordIndex] ?? ""));

    return () => {
      window.clearTimeout(advanceTimer);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
    };
  }, [latestVyvaEntry, visibleWordIndex, words]);

  const fallbackStatusLabel = isConnecting
    ? t("voiceHero.connecting")
    : isSpeaking
    ? t("voiceHero.speaking")
    : t("voiceHero.listening");
  const hasConnectionError = Boolean(connectionError);
  const resolvedConnectionErrorCode = connectionErrorCode ?? inferConnectionErrorCode(connectionError);
  const hasMicrophoneError = isMicrophoneError(resolvedConnectionErrorCode);
  const hasVoiceSetupError = isSetupError(resolvedConnectionErrorCode);
  const hasAccessError = resolvedConnectionErrorCode === "VOICE_AUTH_REQUIRED" ||
    resolvedConnectionErrorCode === "VOICE_ENTITLEMENT_REQUIRED";
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
  const emptyTranscriptLabel = hasConnectionError
    ? hasMicrophoneError
      ? t("voiceHero.microphoneError", "Microphone is blocked")
      : hasVoiceSetupError
      ? t("voiceHero.voiceSetupError", "Voice setup needed")
      : resolvedConnectionErrorCode === "VOICE_ENTITLEMENT_REQUIRED"
      ? t("voiceHero.voiceAccessError", "Voice plan needed")
      : resolvedConnectionErrorCode === "VOICE_AUTH_REQUIRED"
      ? t("voiceHero.voiceSignInError", "Sign in again")
      : t("voiceHero.connectionError", "Voice couldn't connect")
    : isConnecting
    ? t("voiceHero.connecting")
    : t("voiceHero.listening");
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
    : resolvedConnectionErrorCode === "VOICE_AUTH_REQUIRED"
    ? t("voiceHero.voiceAuthErrorHelp", "Please sign in again, then try voice.")
    : t("voiceHero.connectionErrorHelp", "Something stopped the voice from starting. Try again in a moment.");
  const speakerLabel = visibleWord ? "VYVA" : null;
  const currentOrbState = hasConnectionError ? "idle" : orbState(isSpeaking, isConnecting);

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
        background: "linear-gradient(160deg, #1A0040 0%, #3D0D82 40%, #6B21A8 80%, #8B3FC8 100%)",
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: "max(env(safe-area-inset-top, 0px), 52px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)",
        overflow: "hidden",
      }}
    >
      {/* Central transcript + indicator area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          gap: 18,
          paddingBottom: 150,
        }}
      >
        <div
          data-testid="voice-mode-orb"
          aria-hidden="true"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <ZamoraVoiceOrb state={currentOrbState} size={220} testId="voice-mode-zamora-orb" />
        </div>

        {speakerLabel && (
          <span
            data-testid="text-call-speaker"
            className="font-body"
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 14,
              letterSpacing: "0.04em",
              fontWeight: 500,
              transition: "opacity 0.18s ease",
              opacity: wordVisible ? 1 : 0,
            }}
          >
            {speakerLabel}
          </span>
        )}

        <p
          data-testid="text-call-transcript"
          className="font-body"
          style={{
            color: visibleWord ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.86)",
            fontSize: visibleWord ? "clamp(56px, 16vw, 118px)" : hasConnectionError ? "clamp(34px, 9vw, 56px)" : 30,
            lineHeight: visibleWord ? 0.95 : 1.35,
            textAlign: "center",
            maxWidth: visibleWord ? "90vw" : hasConnectionError ? "min(86vw, 520px)" : 320,
            fontWeight: visibleWord ? 700 : hasConnectionError ? 700 : 500,
            fontStyle: "normal",
            overflowWrap: "anywhere",
            transition: "opacity 0.16s ease, transform 0.16s ease",
            opacity: wordVisible ? 1 : 0,
            transform: wordVisible ? "scale(1) translateY(0)" : "scale(0.94) translateY(10px)",
            minHeight: visibleWord ? "clamp(70px, 18vw, 130px)" : 48,
          }}
        >
          {visibleWord ?? emptyTranscriptLabel}
        </p>

        {hasConnectionError && (
          <p
            data-testid="text-call-error-detail"
            className="font-body"
            style={{
              maxWidth: "min(86vw, 460px)",
              margin: "0 auto",
              color: "rgba(255,255,255,0.68)",
              fontSize: 16,
              lineHeight: 1.45,
              textAlign: "center",
              overflowWrap: "anywhere",
            }}
          >
            {errorDetailLabel}
          </p>
        )}

        {activeAction && (
          <div
            data-testid="voice-action-panel"
            className="font-body"
            style={{
              width: "min(100%, 360px)",
              borderRadius: 20,
              border: "1px solid rgba(52,211,153,0.34)",
              background: "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(5,150,105,0.12))",
              padding: "14px 16px",
              boxShadow: "0 18px 44px rgba(0,0,0,0.16)",
              color: "rgba(255,255,255,0.92)",
              transition: "opacity 0.18s ease, transform 0.18s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "#34D399",
                  boxShadow: "0 0 0 6px rgba(52,211,153,0.12)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(209,250,229,0.9)",
                }}
              >
                App context
              </span>
            </div>
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.22,
                fontWeight: 700,
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
                color: "rgba(236,253,245,0.82)",
                overflowWrap: "anywhere",
              }}
            >
              {activeAction.summary}
            </p>
          </div>
        )}
      </div>

      {/* Bottom controls — absolutely anchored so they're always visible */}
      <div
        style={{
          position: "absolute",
          bottom: "max(env(safe-area-inset-bottom, 0px), 32px)",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          paddingBottom: 8,
        }}
      >
        {/* Voice indicator */}
        <div
          data-testid="voice-indicator"
          style={{ position: "relative", width: 92, height: 92 }}
        >
          <ZamoraVoiceOrb state={currentOrbState} size={92} testId="voice-indicator-zamora-orb" />
        </div>

        {/* Status label */}
        <span
          data-testid="text-call-status"
          className="font-body"
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            letterSpacing: "0.03em",
          }}
        >
          {statusLabel}
        </span>

        <div style={{ display: "flex", gap: 12, width: "min(100%, 360px)", justifyContent: "center" }}>
          {hasConnectionError && onRetry && (
            <button
              data-testid="button-retry-call"
              onClick={onRetry}
              className="font-body"
              style={{
                minHeight: 52,
                minWidth: 132,
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.26)",
                borderRadius: 100,
                color: "white",
                fontSize: 15,
                fontWeight: 700,
                padding: "12px 20px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <RotateCcw size={18} />
              {t("voiceHero.retryCall", "Try again")}
            </button>
          )}

          {canToggleMic && (
            <button
              data-testid="button-toggle-call-mic"
              onClick={() => onMicToggle?.(!isMicMuted)}
              className="font-body"
              style={{
                minHeight: 52,
                minWidth: 112,
                background: isMicMuted ? "rgba(52,211,153,0.22)" : "rgba(255,255,255,0.12)",
                border: isMicMuted ? "1px solid rgba(52,211,153,0.46)" : "1px solid rgba(255,255,255,0.2)",
                borderRadius: 100,
                color: "white",
                fontSize: 15,
                fontWeight: 700,
                padding: "12px 18px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {isMicMuted ? <Mic size={18} /> : <MicOff size={18} />}
              {isMicMuted ? "Talk" : "Mute"}
            </button>
          )}

          <button
            data-testid="button-end-call"
            onClick={onEnd}
            className="font-body"
            style={{
              minHeight: 52,
              minWidth: 132,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 100,
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              padding: "12px 22px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <PhoneOff size={18} />
            {t("voiceHero.endCall", "End chat")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

export default VoiceCallOverlay;
