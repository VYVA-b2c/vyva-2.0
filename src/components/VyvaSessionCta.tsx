import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Mic, type LucideIcon } from "lucide-react";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import ZamoraVoiceOrb, { type ZamoraOrbState, useVoiceOrbAudioLevel } from "@/components/ZamoraVoiceOrb";
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

function HomeVoiceActivationOrb({
  Icon,
  audioLevel,
  iconClassName,
  isDark,
  isPreparing,
  state,
  size,
}: {
  Icon: LucideIcon;
  audioLevel: number;
  iconClassName?: string;
  isDark: boolean;
  isPreparing: boolean;
  state: ZamoraOrbState;
  size: number;
}) {
  const outerSize = Math.max(104, Math.min(190, size));
  const iconSize = Math.max(22, Math.min(32, Math.round(outerSize * 0.16)));
  const showIcon = isPreparing;

  return (
    <span
      aria-hidden="true"
      className="relative isolate grid shrink-0 place-items-center"
      data-testid="home-dormant-zamora-orb"
      style={{ height: outerSize, width: outerSize }}
    >
      <ZamoraVoiceOrb
        audioLevel={audioLevel}
        isDark={isDark}
        size={outerSize}
        state={state}
        testId="home-dormant-zamora-orb-visual"
      />
      {showIcon && (
        <span
          className="absolute z-[2] grid place-items-center rounded-full text-white"
          style={{
            background: isPreparing
              ? "linear-gradient(145deg, #0F8274 0%, #7C3AED 100%)"
              : "linear-gradient(145deg, rgba(124,45,218,0.96) 0%, rgba(91,22,168,0.98) 100%)",
            boxShadow: isDark
              ? "0 18px 44px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.18)"
              : "0 18px 40px rgba(107,33,168,0.24), inset 0 1px 0 rgba(255,255,255,0.32)",
            height: Math.round(outerSize * 0.34),
            width: Math.round(outerSize * 0.34),
          }}
        >
          <Icon
            size={iconSize}
            className={`${isPreparing ? "animate-spin" : ""} ${iconClassName ?? ""}`.trim()}
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
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
  const isVoiceRail = visual === "voiceRail";
  const isVoiceOrb = visual === "voiceOrb";
  const hasConnectionError = Boolean(lastError && !isActive && !isConnecting);
  const showOverlay = !isVoiceOrb && focusedOverlayRequested && (isActive || isConnecting || (hasConnectionError && focusedOverlayHasStarted));
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
      if (isVoiceOrb) return;
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
  const railSupportingLabel = isPreparing
    ? preparingLabel ?? "Checking voice"
    : isConnecting
      ? connectingLabel ?? "Opening voice"
      : voiceSessionPhase === "error"
        ? errorLabel ?? "Tap for help"
        : supportingLabel ?? "Speak anytime";
  const accessibleLabel = isVoiceRail ? railSupportingLabel : statusLabel;
  const hasVoiceOrbError = voiceSessionPhase === "error" || Boolean(lastErrorCode || (lastError && !isActive && !isConnecting));
  const voiceOrbState: ZamoraOrbState = hasVoiceOrbError
    ? "error"
    : isPreparing || isConnecting || voiceSessionPhase === "connecting" || voiceSessionPhase === "transferring"
      ? "connecting"
      : voiceSessionPhase === "ended"
        ? "idle"
        : isActive
          ? isSpeaking || voiceSessionPhase === "speaking"
            ? "speaking"
            : "listening"
          : "idle";
  const voiceOrbAudioLevel = useVoiceOrbAudioLevel({
    enabled: isVoiceOrb
      && !showOverlay
      && (voiceOrbState === "connecting" || voiceOrbState === "listening" || voiceOrbState === "speaking"),
    phase: voiceSessionPhase,
    isSpeaking,
    isMicMuted,
    isConnecting: isPreparing || isConnecting,
  });

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
            <HomeVoiceActivationOrb
              Icon={Icon}
              audioLevel={voiceOrbAudioLevel}
              iconClassName={iconClassName}
              isDark={voiceOrbDark}
              isPreparing={isPreparing}
              state={voiceOrbState}
              size={voiceOrbSize}
            />
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
