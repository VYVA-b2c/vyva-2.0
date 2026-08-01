import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Mic } from "lucide-react";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import ZamoraVoiceOrb from "@/components/ZamoraVoiceOrb";
import {
  type VoiceConnectionErrorCode,
  type VoiceDiagnosticStep,
  type TranscriptEntry,
  useVyvaVoice,
} from "@/hooks/useVyvaVoice";
import { hasSeenVoiceOrbHint, rememberVoiceOrbHint } from "@/lib/voiceOrbHint";
import { emitVoiceOverlayPresence } from "@/lib/voiceOverlayFocus";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";

type VoiceStartVariables = Record<string, string | number | boolean>;

type VyvaSessionCtaProps = {
  label?: string;
  activeLabel?: string;
  connectingLabel?: string;
  preparingLabel?: string;
  errorLabel?: string;
  contextHint?: string;
  voiceAgentSlug?: string;
  voiceDynamicVariables?: VoiceStartVariables;
  autoStartListening?: boolean;
  canStartVoice?: () => boolean;
  hideWhenSessionActive?: boolean;
  disabled?: boolean;
  testId?: string;
  className?: string;
  iconClassName?: string;
  supportingLabel?: string;
  visual?: "default" | "voiceRail" | "voiceOrb";
  voiceOrbDark?: boolean;
  voiceOrbSize?: number;
  onFirstVoiceOrbActivation?: () => void;
};

type VoiceControls = {
  startVoice: ReturnType<typeof useVyvaVoice>["startVoice"];
  stopVoice: ReturnType<typeof useVyvaVoice>["stopVoice"];
  status: "idle" | "connecting" | "connected";
  isSpeaking: boolean;
  isPreparing: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
  voiceSessionPhase: VoiceSessionPhase;
  isMicMuted: boolean;
  setMicrophoneMuted: (muted: boolean) => void;
  lastError: string | null;
  lastErrorCode: VoiceConnectionErrorCode | null;
  voiceDiagnostics: VoiceDiagnosticStep[];
};

function useVoiceStartOptions(
  voiceAgentSlug: string | undefined,
  voiceDynamicVariables: VoiceStartVariables | undefined,
  autoStartListening: boolean | undefined,
) {
  return useMemo(
    () => voiceAgentSlug || voiceDynamicVariables || autoStartListening
      ? {
          ...(voiceAgentSlug ? { agentSlug: voiceAgentSlug } : {}),
          ...(voiceDynamicVariables ? { dynamicVariables: voiceDynamicVariables } : {}),
          ...(autoStartListening ? { autoStartListening: true } : {}),
        }
      : undefined,
    [autoStartListening, voiceAgentSlug, voiceDynamicVariables],
  );
}

function buttonLabel({
  activeLabel,
  connectingLabel,
  errorLabel,
  isActive,
  isConnecting,
  isPreparing,
  label,
  preparingLabel,
  voiceSessionPhase,
}: {
  activeLabel?: string;
  connectingLabel?: string;
  errorLabel?: string;
  isActive: boolean;
  isConnecting: boolean;
  isPreparing: boolean;
  label?: string;
  preparingLabel?: string;
  voiceSessionPhase: VoiceSessionPhase;
}) {
  if (isPreparing) return preparingLabel ?? "Checking voice...";
  if (isConnecting) return connectingLabel ?? "Connecting";
  if (isActive) return activeLabel ?? voiceSessionPhaseLabel(voiceSessionPhase);
  if (voiceSessionPhase === "error") return errorLabel ?? "Needs attention";
  return label ?? "Talk to VYVA";
}

export function VyvaSessionCta({
  label,
  activeLabel,
  connectingLabel,
  preparingLabel,
  errorLabel,
  contextHint,
  voiceAgentSlug,
  voiceDynamicVariables,
  autoStartListening = true,
  canStartVoice,
  hideWhenSessionActive = false,
  disabled,
  testId,
  className,
  iconClassName,
  supportingLabel,
  visual = "default",
  voiceOrbDark = false,
  voiceOrbSize = 144,
  onFirstVoiceOrbActivation,
}: VyvaSessionCtaProps) {
  const voice = useVyvaVoice() as VoiceControls;
  const {
    startVoice,
    stopVoice,
    status,
    isSpeaking,
    isPreparing,
    isConnecting,
    transcript,
    voiceSessionPhase,
    isMicMuted,
    setMicrophoneMuted,
    lastError,
    lastErrorCode,
    voiceDiagnostics,
  } = voice;
  const [focusedOverlayRequested, setFocusedOverlayRequested] = useState(false);
  const [focusedOverlayHasStarted, setFocusedOverlayHasStarted] = useState(false);
  const [showVoiceOrbHint, setShowVoiceOrbHint] = useState(() => !hasSeenVoiceOrbHint());
  const voiceStartOptions = useVoiceStartOptions(voiceAgentSlug, voiceDynamicVariables, autoStartListening);

  const isActive = status === "connected";
  const hasConnectionError = Boolean(lastError && !isActive && !isConnecting);
  const showOverlay = focusedOverlayRequested && (isActive || isConnecting || (hasConnectionError && focusedOverlayHasStarted));
  const isButtonDisabled = Boolean(disabled || isPreparing);
  const shouldHideButton = hideWhenSessionActive && (isActive || isConnecting);

  useEffect(() => {
    emitVoiceOverlayPresence(showOverlay, "session_cta");
    return () => {
      if (showOverlay) emitVoiceOverlayPresence(false, "session_cta");
    };
  }, [showOverlay]);

  useEffect(() => {
    if (!focusedOverlayRequested) return;

    if (isActive || isConnecting) {
      if (!focusedOverlayHasStarted) setFocusedOverlayHasStarted(true);
      return;
    }

    if (hasConnectionError) {
      if (!focusedOverlayHasStarted) setFocusedOverlayRequested(false);
      return;
    }

    if (focusedOverlayHasStarted) {
      setFocusedOverlayHasStarted(false);
      setFocusedOverlayRequested(false);
      return;
    }

    const clearPendingOverlay = window.setTimeout(() => {
      setFocusedOverlayRequested(false);
    }, 5000);

    return () => window.clearTimeout(clearPendingOverlay);
  }, [focusedOverlayHasStarted, focusedOverlayRequested, hasConnectionError, isActive, isConnecting]);

  const openFocusedOverlay = () => {
    setFocusedOverlayHasStarted(isActive || isConnecting);
    setFocusedOverlayRequested(true);
  };

  const handleClick = () => {
    if (isButtonDisabled) return;

    if (isActive || isConnecting) {
      openFocusedOverlay();
      return;
    }

    if (canStartVoice && !canStartVoice()) return;

    if (visual === "voiceOrb" && showVoiceOrbHint) {
      setShowVoiceOrbHint(false);
      rememberVoiceOrbHint();
      onFirstVoiceOrbActivation?.();
    }

    setFocusedOverlayHasStarted(false);
    setFocusedOverlayRequested(true);
    void Promise.resolve(startVoice(contextHint, undefined, voiceStartOptions)).catch(() => {});
  };

  const handleEnd = () => {
    setFocusedOverlayRequested(false);
    setFocusedOverlayHasStarted(false);
    stopVoice();
  };

  const handleMinimize = () => {
    setFocusedOverlayRequested(false);
    setFocusedOverlayHasStarted(false);
  };

  const handleRetry = () => {
    if (isActive || isConnecting) return;
    setFocusedOverlayHasStarted(false);
    setFocusedOverlayRequested(true);
    void Promise.resolve(startVoice(contextHint, undefined, voiceStartOptions)).catch(() => {});
  };

  const statusLabel = buttonLabel({
    activeLabel,
    connectingLabel,
    errorLabel,
    isActive,
    isConnecting,
    isPreparing,
    label,
    preparingLabel,
    voiceSessionPhase,
  });

  const Icon = isPreparing ? Loader2 : isActive || isConnecting ? MessageCircle : Mic;
  const isVoiceRail = visual === "voiceRail";
  const isVoiceOrb = visual === "voiceOrb";
  const railSupportingLabel = isPreparing
    ? preparingLabel ?? "Checking voice"
    : isConnecting
      ? connectingLabel ?? "Opening voice"
      : voiceSessionPhase === "error"
        ? errorLabel ?? "Tap for help"
        : supportingLabel ?? "Speak anytime";
  const accessibleLabel = isVoiceRail ? railSupportingLabel : statusLabel;

  return (
    <>
      {showOverlay ? (
        <VoiceCallOverlay
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          transcript={transcript}
          onEnd={handleEnd}
          onMinimize={handleMinimize}
          voiceSessionPhase={voiceSessionPhase}
          isMicMuted={isMicMuted}
          onMicToggle={setMicrophoneMuted}
          connectionError={lastError}
          connectionErrorCode={lastErrorCode}
          voiceDiagnostics={voiceDiagnostics}
          onRetry={handleRetry}
          onType={handleMinimize}
        />
      ) : null}

      {shouldHideButton ? null : (
        <button
          type="button"
          onClick={handleClick}
          disabled={isButtonDisabled}
          data-testid={testId}
          aria-label={accessibleLabel}
          className={className}
        >
          {isVoiceOrb ? (
            <>
              <ZamoraVoiceOrb
                state={isPreparing || isConnecting ? "listening" : isActive ? (isSpeaking ? "speaking" : "listening") : "idle"}
                size={voiceOrbSize}
                isDark={voiceOrbDark}
                testId="home-dormant-zamora-orb"
              />
            </>
          ) : isVoiceRail ? (
            <>
              <span className="absolute inset-[-7px] rounded-full bg-[#F3E8FF] opacity-50" aria-hidden="true" />
              <span className="absolute inset-[-2px] rounded-full bg-[radial-gradient(circle,#FFFFFF_0%,#F8F2FF_62%,#FFF9F2_100%)] shadow-[0_10px_22px_rgba(107,33,168,0.10)]" aria-hidden="true" />
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#6B21A8] text-white shadow-[0_7px_16px_rgba(107,33,168,0.20)]">
                <Icon
                  size={22}
                  className={`${isPreparing ? "animate-spin" : ""} ${iconClassName ?? ""}`.trim()}
                  aria-hidden="true"
                />
              </span>
            </>
          ) : (
            <>
              <Icon
                size={18}
                className={`${isPreparing ? "animate-spin" : ""} ${iconClassName ?? ""}`.trim()}
                aria-hidden="true"
              />
              {statusLabel}
            </>
          )}
        </button>
      )}
    </>
  );
}

export default VyvaSessionCta;
