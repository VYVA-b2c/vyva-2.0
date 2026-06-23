import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { TranscriptEntry } from "@/hooks/useVyvaVoice";
import type { VoiceAppAction } from "@/lib/voiceNavigation";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";

interface VoiceCallOverlayProps {
  isSpeaking: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
  onEnd: () => void;
  activeAction?: VoiceAppAction | null;
  voiceSessionPhase?: VoiceSessionPhase;
  isMicMuted?: boolean;
  onMicToggle?: (muted: boolean) => void;
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
}: VoiceCallOverlayProps) => {
  const { t } = useTranslation();
  const [visibleEntry, setVisibleEntry] = useState<TranscriptEntry | null>(null);
  const [fade, setFade] = useState(true);

  const latestEntry = transcript.length > 0 ? transcript[transcript.length - 1] : null;

  useEffect(() => {
    if (!latestEntry) return;
    if (latestEntry === visibleEntry) return;

    setFade(false);
    const timer = setTimeout(() => {
      setVisibleEntry(latestEntry);
      setFade(true);
    }, 180);
    return () => clearTimeout(timer);
  }, [latestEntry, visibleEntry]);

  const fallbackStatusLabel = isConnecting
    ? t("voiceHero.connecting")
    : isSpeaking
    ? t("voiceHero.speaking")
    : t("voiceHero.listening");
  const statusLabel = voiceSessionPhase ? voiceSessionPhaseLabel(voiceSessionPhase) : fallbackStatusLabel;
  const canToggleMic = Boolean(onMicToggle && voiceSessionPhase !== "connecting" && voiceSessionPhase !== "transferring");
  const emptyTranscriptLabel = isConnecting ? t("voiceHero.connecting") : t("voiceHero.listening");

  const speakerLabel =
    visibleEntry?.from === "user"
      ? t("voiceHero.you")
      : visibleEntry?.from === "vyva"
      ? "VYVA"
      : null;

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
            width: 148,
            height: 148,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <span
            className={isSpeaking ? "vyva-ring-1-speak" : "vyva-ring-1-listen"}
            style={{
              position: "absolute",
              inset: -34,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.11)",
              background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 58%)",
            }}
          />
          <span
            className={isSpeaking ? "vyva-ring-2-speak" : "vyva-ring-2-listen"}
            style={{
              position: "absolute",
              inset: -16,
              borderRadius: "50%",
              border: "1px solid rgba(216,180,254,0.24)",
            }}
          />
          <div
            className={isSpeaking ? "vyva-dot-speak" : "vyva-dot-listen"}
            style={{
              position: "relative",
              width: 148,
              height: 148,
              borderRadius: "50%",
              background: isSpeaking
                ? "radial-gradient(circle at 38% 30%, rgba(255,255,255,0.42), rgba(216,180,254,0.2) 32%, rgba(124,58,237,0.34) 64%, rgba(45,10,94,0.72) 100%)"
                : "radial-gradient(circle at 38% 30%, rgba(255,255,255,0.34), rgba(196,181,253,0.22) 34%, rgba(107,33,168,0.42) 66%, rgba(26,0,64,0.76) 100%)",
              border: "1.5px solid rgba(255,255,255,0.26)",
              boxShadow: "0 0 44px rgba(168,85,247,0.42), 0 0 96px rgba(107,33,168,0.42), inset 0 0 36px rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              className="font-display"
              style={{ color: "rgba(255,255,255,0.9)", fontSize: 46, lineHeight: 1, fontStyle: "italic" }}
            >
              V
            </span>
          </div>
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
              opacity: fade ? 1 : 0,
            }}
          >
            {speakerLabel}
          </span>
        )}

        <p
          data-testid="text-call-transcript"
          className="font-display"
          style={{
            color: "rgba(255,255,255,0.95)",
            fontSize: 32,
            lineHeight: 1.35,
            textAlign: "center",
            maxWidth: 320,
            fontWeight: 400,
            fontStyle: "italic",
            transition: "opacity 0.18s ease, transform 0.18s ease",
            opacity: fade ? 1 : 0,
            transform: fade ? "translateY(0)" : "translateY(8px)",
          minHeight: 48,
          }}
        >
          {visibleEntry?.text ?? emptyTranscriptLabel}
        </p>

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
          style={{ position: "relative", width: 64, height: 64 }}
        >
          <span
            className={isSpeaking ? "vyva-ring-1-speak" : "vyva-ring-1-listen"}
            style={{
              position: "absolute",
              inset: -18,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          />
          <span
            className={isSpeaking ? "vyva-ring-2-speak" : "vyva-ring-2-listen"}
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          />
          <div
            className={isSpeaking ? "vyva-dot-speak" : "vyva-dot-listen"}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: isSpeaking
                ? "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.22), rgba(255,255,255,0.05))"
                : "radial-gradient(circle at 40% 35%, rgba(52,211,153,0.3), rgba(52,211,153,0.08))",
              border: isSpeaking
                ? "1.5px solid rgba(255,255,255,0.25)"
                : "1.5px solid rgba(52,211,153,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              className="font-display"
              style={{ color: "rgba(255,255,255,0.85)", fontSize: 22, fontStyle: "italic" }}
            >
              V
            </span>
          </div>
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
