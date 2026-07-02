import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Mic, MessageCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type TranscriptEntry, type VoiceConnectionErrorCode, type VoiceDiagnosticStep, useVyvaVoice } from "@/hooks/useVyvaVoice";
import { recordHeroEvent, type HeroSurface } from "@/lib/heroMessages";
import { type UseHeroMessageOptions, useHeroMessage } from "@/hooks/useHeroMessage";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";
import { emitVoiceOverlayPresence } from "@/lib/voiceOverlayFocus";

const WEATHER_EMOJI: Record<string, string> = {
  "weather.clear": "☀️",
  "weather.partlyCloudy": "⛅",
  "weather.overcast": "☁️",
  "weather.cloudy": "🌤️",
  "weather.fog": "🌫️",
  "weather.drizzle": "🌦️",
  "weather.rain": "🌧️",
  "weather.snow": "❄️",
  "weather.showers": "🌧️",
  "weather.snowShowers": "🌨️",
  "weather.thunderstorm": "⛈️",
};

interface WeatherData {
  city: string;
  temperature: number;
  description: string;
}

interface VoiceHeroProps {
  heroSurface?: HeroSurface;
  heroContext?: UseHeroMessageOptions;
  sourceText?: string;
  headline: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  contextHint?: string;
  voiceAgentSlug?: string;
  voiceDynamicVariables?: Record<string, string | number | boolean>;
  talkLabel?: string;
  chatLabel?: string;
  canStartVoice?: () => boolean;
  onTalkClick?: () => void;
  onChatClick?: () => void;
  weatherData?: WeatherData | null;
  autoStartVoice?: boolean | string;
  autoStartListening?: boolean;
  showVoiceOverlay?: boolean;
  activeLabel?: string;
  connectingLabel?: string;
  mobileTalkLabel?: string;
  compact?: boolean;
  voiceControls?: {
    status: "idle" | "connecting" | "connected";
    isSpeaking: boolean;
    isPreparing?: boolean;
    isConnecting: boolean;
    transcript?: TranscriptEntry[];
    onEnd: () => void;
    showOverlay?: boolean;
    activeLabel?: string;
    connectingLabel?: string;
    voiceSessionPhase?: VoiceSessionPhase;
    isMicMuted?: boolean;
    onMicToggle?: (muted: boolean) => void;
    lastError?: string | null;
    lastErrorCode?: VoiceConnectionErrorCode | null;
    voiceDiagnostics?: VoiceDiagnosticStep[];
  };
}

const headlineClampStyle: React.CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  overflowWrap: "anywhere",
};

const homeHeadlineClampStyle: React.CSSProperties = {
  ...headlineClampStyle,
  WebkitLineClamp: 3,
};

function readBrowserOnline() {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") return true;
  return navigator.onLine;
}

function voiceDiagnosticTone(step: VoiceDiagnosticStep) {
  if (step.status === "failed") return "bg-red-100 text-red-700";
  if (step.status === "passed") return "bg-emerald-100 text-emerald-700";
  if (step.status === "running") return "bg-white/22 text-white";
  if (step.status === "skipped") return "bg-white/12 text-white/64";
  return "bg-white/10 text-white/58";
}

function voiceDiagnosticStatusLabel(step: VoiceDiagnosticStep) {
  if (step.status === "failed") return "Stopped";
  if (step.status === "passed") return "OK";
  if (step.status === "running") return "Checking";
  if (step.status === "skipped") return "Skipped";
  return "Waiting";
}

const VoiceHero: React.FC<VoiceHeroProps> = ({
  heroSurface,
  heroContext,
  sourceText,
  headline,
  subtitle,
  children,
  contextHint,
  voiceAgentSlug,
  voiceDynamicVariables,
  talkLabel,
  chatLabel,
  canStartVoice,
  onTalkClick,
  onChatClick,
  weatherData,
  autoStartVoice,
  autoStartListening = false,
  showVoiceOverlay = false,
  activeLabel,
  connectingLabel,
  mobileTalkLabel,
  compact = false,
  voiceControls,
}) => {
  const { t } = useTranslation();
  const internalVoice = useVyvaVoice();
  const {
    startVoice,
    stopVoice: internalStopVoice,
    status: internalStatus,
    isSpeaking: internalIsSpeaking,
    isPreparing: internalIsPreparing,
    isConnecting: internalIsConnecting,
    transcript: internalTranscript,
    voiceSessionPhase: internalVoiceSessionPhase,
    isMicMuted: internalIsMicMuted,
    setMicrophoneMuted: internalSetMicrophoneMuted,
    lastError: internalLastError,
    lastErrorCode: internalLastErrorCode,
    voiceDiagnostics: internalVoiceDiagnostics,
  } = internalVoice;
  const dynamicHero = useHeroMessage(heroSurface, {
    ...heroContext,
    fallbackHeadline: typeof headline === "string" ? headline : heroContext?.fallbackHeadline,
    fallbackSubtitle: typeof subtitle === "string" ? subtitle : heroContext?.fallbackSubtitle,
    fallbackSourceText: sourceText,
    fallbackCtaLabel: talkLabel,
    fallbackContextHint: contextHint,
  });

  const resolvedSourceText = dynamicHero?.sourceText ?? sourceText;
  const resolvedHeadline = dynamicHero?.headline ?? headline;
  const resolvedSubtitle = dynamicHero?.subtitle ?? subtitle;
  const resolvedContextHint = dynamicHero?.contextHint ?? contextHint;
  const resolvedTalkLabel = dynamicHero?.ctaLabel ?? talkLabel;

  const voiceStatus = voiceControls?.status ?? internalStatus;
  const isSpeaking = voiceControls?.isSpeaking ?? internalIsSpeaking;
  const isPreparing = voiceControls?.isPreparing ?? internalIsPreparing;
  const isConnecting = voiceControls?.isConnecting ?? internalIsConnecting;
  const transcript = voiceControls?.transcript ?? internalTranscript;
  const stopVoice = voiceControls?.onEnd ?? internalStopVoice;
  const voiceSessionPhase = voiceControls?.voiceSessionPhase ?? internalVoiceSessionPhase;
  const isMicMuted = voiceControls?.isMicMuted ?? internalIsMicMuted;
  const onMicToggle = voiceControls?.onMicToggle ?? internalSetMicrophoneMuted;
  const lastError = voiceControls?.lastError ?? internalLastError;
  const lastErrorCode = voiceControls?.lastErrorCode ?? internalLastErrorCode;
  const voiceDiagnostics = voiceControls?.voiceDiagnostics ?? internalVoiceDiagnostics;
  const shouldShowOverlay = voiceControls?.showOverlay ?? showVoiceOverlay;
  const autoStartKey = typeof autoStartVoice === "string"
    ? autoStartVoice
    : autoStartVoice
      ? "voice-hero-auto-start"
      : null;
  const [browserOnline, setBrowserOnline] = useState(readBrowserOnline);
  const [focusedVoiceOverlayRequested, setFocusedVoiceOverlayRequested] = useState(false);
  const [focusedOverlayHasStarted, setFocusedOverlayHasStarted] = useState(false);
  const autoStartedRef = useRef<string | null>(null);

  const isActive = voiceStatus === "connected";
  const isStarting = isPreparing || isConnecting;
  const hasConnectionError = Boolean(lastError && !isActive && !isConnecting);
  const showOverlay = (shouldShowOverlay || focusedVoiceOverlayRequested) &&
    (isActive || isConnecting || (hasConnectionError && focusedOverlayHasStarted));
  const showInlineVoiceError = Boolean(hasConnectionError && !showOverlay);

  const voiceStartOptions = useMemo(
    () => voiceAgentSlug || voiceDynamicVariables || autoStartListening
      ? {
          ...(voiceAgentSlug ? { agentSlug: voiceAgentSlug } : {}),
          ...(voiceDynamicVariables ? { dynamicVariables: voiceDynamicVariables } : {}),
          ...(autoStartListening ? { autoStartListening: true } : {}),
        }
      : undefined,
    [autoStartListening, voiceAgentSlug, voiceDynamicVariables],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    setBrowserOnline(readBrowserOnline());
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    emitVoiceOverlayPresence(showOverlay, "voice_hero");
    return () => {
      if (showOverlay) emitVoiceOverlayPresence(false, "voice_hero");
    };
  }, [showOverlay]);

  useEffect(() => {
    if (!autoStartKey || voiceControls) return;
    if (autoStartedRef.current === autoStartKey) return;
    if (internalStatus !== "idle" || internalIsConnecting) return;

    autoStartedRef.current = autoStartKey;
    void startVoice(
      resolvedContextHint,
      undefined,
      voiceStartOptions,
    );
  }, [
    autoStartKey,
    internalIsConnecting,
    internalStatus,
    resolvedContextHint,
    startVoice,
    voiceStartOptions,
    voiceControls,
  ]);

  useEffect(() => {
    if (!focusedVoiceOverlayRequested) return;

    if (isActive || isConnecting) {
      if (!focusedOverlayHasStarted) setFocusedOverlayHasStarted(true);
      return;
    }

    if (hasConnectionError) {
      if (!focusedOverlayHasStarted) setFocusedVoiceOverlayRequested(false);
      return;
    }

    if (focusedOverlayHasStarted) {
      setFocusedOverlayHasStarted(false);
      setFocusedVoiceOverlayRequested(false);
      return;
    }

    const clearPendingOverlay = window.setTimeout(() => {
      setFocusedVoiceOverlayRequested(false);
    }, 5000);

    return () => window.clearTimeout(clearPendingOverlay);
  }, [focusedOverlayHasStarted, focusedVoiceOverlayRequested, hasConnectionError, isActive, isConnecting]);

  const handleOverlayEnd = () => {
    setFocusedVoiceOverlayRequested(false);
    setFocusedOverlayHasStarted(false);
    stopVoice();
  };

  const handleOverlayMinimize = () => {
    setFocusedVoiceOverlayRequested(false);
    setFocusedOverlayHasStarted(false);
  };

  const handleOverlayType = () => {
    handleOverlayMinimize();
    if (onChatClick) {
      stopVoice();
      onChatClick();
    }
  };

  const handleRetryVoice = () => {
    if (isActive || isConnecting) return;
    setFocusedOverlayHasStarted(false);
    setFocusedVoiceOverlayRequested(true);
    void Promise.resolve(startVoice(resolvedContextHint, undefined, voiceStartOptions)).catch(() => {});
  };

  const handleTalk = () => {
    if (!isActive && canStartVoice && !canStartVoice()) return;

    if (!isActive && dynamicHero) {
      recordHeroEvent({
        messageId: dynamicHero.messageId,
        surface: dynamicHero.surface,
        language: dynamicHero.language,
        eventType: "cta_click",
        reason: dynamicHero.reason,
        source: dynamicHero.source,
      });
    }

    if (isActive) {
      setFocusedVoiceOverlayRequested(false);
      setFocusedOverlayHasStarted(false);
      stopVoice();
    } else if (onTalkClick) {
      setFocusedOverlayHasStarted(false);
      setFocusedVoiceOverlayRequested(true);
      onTalkClick();
    } else {
      setFocusedOverlayHasStarted(false);
      setFocusedVoiceOverlayRequested(true);
      void Promise.resolve(startVoice(
        resolvedContextHint,
        undefined,
        voiceStartOptions,
      )).catch(() => {});
    }
  };

  const statusLabel = isConnecting
    ? voiceControls?.connectingLabel ?? connectingLabel ?? t("voiceHero.connecting")
    : isPreparing
    ? t("voiceHero.preparing", "Checking voice...")
    : isActive
    ? voiceControls?.activeLabel ?? activeLabel ?? (voiceSessionPhase
        ? voiceSessionPhaseLabel(voiceSessionPhase)
        : isSpeaking
          ? t("voiceHero.speaking")
          : t("voiceHero.listening"))
    : resolvedTalkLabel ?? t("voiceHero.talkToVyva");
  const mobileStatusLabel = !isStarting && !isActive && mobileTalkLabel ? mobileTalkLabel : statusLabel;
  const connectionLabel = browserOnline ? t("statusVitals.online", "Online") : t("statusVitals.offline", "Offline");
  const connectionColor = browserOnline ? "#34D399" : "#EF4444";
  const connectionHalo = browserOnline ? "rgba(52,211,153,0.24)" : "rgba(239,68,68,0.20)";
  const connectionBorder = browserOnline ? "rgba(52,211,153,0.42)" : "rgba(239,68,68,0.36)";
  const isBrainHero = heroSurface === "brain";
  const isHealthHero = heroSurface === "health";
  const standardHeroHeadlineStyle = isHealthHero
    ? { ...headlineClampStyle, overflowWrap: "normal" as const, wordBreak: "normal" as const }
    : headlineClampStyle;
  const visibleVoiceDiagnostics = (voiceDiagnostics ?? []).filter((step) => step.status !== "pending");
  const failedVoiceDiagnostic = visibleVoiceDiagnostics.find((step) => step.status === "failed");
  const inlineErrorPanel = showInlineVoiceError ? (
    <div
      data-testid="voice-hero-inline-error"
      className="relative z-10 mt-3 rounded-[20px] border border-white/20 bg-white/14 p-3 font-body text-white"
      style={{ boxShadow: "0 12px 30px rgba(47,24,63,0.14)" }}
    >
      <p className="m-0 min-w-0 break-words text-[14px] font-bold leading-snug">
        {t("voiceHero.inlineErrorTitle", "Voice is not ready yet")}
      </p>
      <p className="m-0 mt-1 min-w-0 break-words text-[13px] font-medium leading-snug text-white/72">
        {lastError}
      </p>
      {visibleVoiceDiagnostics.length > 0 && (
        <div data-testid="voice-hero-diagnostics" className="mt-3 rounded-[16px] bg-black/10 p-2">
          <p className="m-0 text-[12px] font-extrabold leading-tight text-white/72">
            {failedVoiceDiagnostic
              ? t("voiceHero.diagnosticsStoppedAt", `Stopped at ${failedVoiceDiagnostic.label}`)
              : t("voiceHero.diagnosticsChecking", "Voice checks")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleVoiceDiagnostics.map((step) => (
              <span
                key={step.id}
                className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold leading-tight ${voiceDiagnosticTone(step)}`}
                title={step.detail}
              >
                <span className="min-w-0 break-words">{step.label}</span>
                <span className="shrink-0 opacity-80">{voiceDiagnosticStatusLabel(step)}</span>
              </span>
            ))}
          </div>
          {failedVoiceDiagnostic?.detail && (
            <p className="m-0 mt-2 min-w-0 break-words text-[12px] font-semibold leading-snug text-white/68">
              {failedVoiceDiagnostic.detail}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        data-testid="button-voice-hero-retry"
        onClick={handleRetryVoice}
        disabled={isStarting}
        className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-full bg-white px-4 py-2 text-[14px] font-extrabold text-[#6B21A8] transition active:scale-95 disabled:opacity-60"
      >
        {t("voiceHero.retryCall", "Try again")}
      </button>
    </div>
  ) : null;

  const weatherEmoji = weatherData?.description ? (WEATHER_EMOJI[weatherData.description] ?? "🌡️") : "🌡️";
  const weatherLabel = weatherData
    ? `${weatherEmoji} ${weatherData.city} · ${weatherData.temperature}°`
    : null;

  if (weatherData !== undefined) {
    return (
      <>
        {showOverlay && (
          <VoiceCallOverlay
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            transcript={transcript}
            onEnd={handleOverlayEnd}
            onMinimize={handleOverlayMinimize}
            voiceSessionPhase={voiceSessionPhase}
            isMicMuted={isMicMuted}
            onMicToggle={onMicToggle}
            connectionError={lastError}
            connectionErrorCode={lastErrorCode}
            voiceDiagnostics={voiceDiagnostics}
            onRetry={handleRetryVoice}
            onType={handleOverlayType}
          />
        )}

        <div className="mt-[14px] rounded-[24px] relative overflow-visible hero-purple" style={{ paddingTop: "0" }}>
          <div
            className="absolute right-[16px] top-[14px] z-10 flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: connectionHalo, border: `1px solid ${connectionBorder}` }}
            aria-label={connectionLabel}
            title={connectionLabel}
            data-testid="voice-hero-status-dot"
          >
            <span className="h-2.5 w-2.5 rounded-full live-dot" style={{ background: connectionColor }} />
          </div>
          <div className="flex min-h-[268px]">
            {/* Left column — text + CTA */}
            <div className="flex w-full min-w-0 flex-col gap-0 px-[22px] pb-[20px] pt-[30px]">
              {/* Headline */}
              <h1
                className="mb-auto max-w-[12ch] min-w-0 font-display text-[30px] font-normal italic leading-[1.08] text-white"
                style={homeHeadlineClampStyle}
              >
                {resolvedHeadline}
              </h1>

              {/* CTA button */}
              <button
                onClick={handleTalk}
                disabled={isStarting}
                data-testid="button-voice-hero-talk"
                className={`relative z-10 mt-[24px] flex min-h-[76px] w-full items-center justify-center gap-3 rounded-full px-[28px] py-[18px] text-center transition-all ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : ""}`}
                style={
                  isActive
                    ? {
                        background: "rgba(52,211,153,0.2)",
                        border: "1px solid rgba(52,211,153,0.4)",
                      }
                    : {
                        background: "#ffffff",
                        border: "none",
                      }
                }
              >
                {isActive ? (
                  <X size={23} style={{ color: "rgba(255,255,255,0.9)" }} />
                ) : (
                  <Mic size={23} style={{ color: "#6B21A8" }} />
                )}
                <span
                  className="min-w-0 max-w-full whitespace-nowrap font-body text-[clamp(20px,5.4vw,24px)] font-extrabold leading-tight"
                  style={{ color: isActive ? "#ffffff" : "#6B21A8" }}
                >
                  {statusLabel}
                </span>
              </button>
              {inlineErrorPanel}
              {onChatClick && (
                <button
                  type="button"
                  onClick={onChatClick}
                  data-testid="button-home-type-instead"
                  className="relative z-10 mt-3 inline-flex min-h-[44px] w-fit max-w-full items-center gap-2 rounded-full bg-white/14 px-4 py-2 font-body text-[15px] font-extrabold leading-tight text-white transition active:scale-95"
                  style={{ border: "1px solid rgba(255,255,255,0.22)" }}
                >
                  <Keyboard size={17} strokeWidth={2.5} />
                  <span className="min-w-0 break-words">{chatLabel ?? t("voiceHero.typeInstead", "Type instead")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Weather strip */}
          {weatherLabel && (
            <div
              className="flex items-center gap-2 px-[20px] py-[8px] rounded-b-[24px]"
              style={{ background: "rgba(0,0,0,0.12)", borderTop: "1px solid rgba(255,255,255,0.08)", opacity: 0.82 }}
            >
              <span className="font-body text-[12px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                {weatherLabel}
              </span>
            </div>
          )}

          {children}
        </div>
      </>
    );
  }

  return (
    <>
      {showOverlay && (
        <VoiceCallOverlay
          isSpeaking={isSpeaking}
          isConnecting={isConnecting}
          transcript={transcript}
          onEnd={handleOverlayEnd}
          onMinimize={handleOverlayMinimize}
          voiceSessionPhase={voiceSessionPhase}
          isMicMuted={isMicMuted}
          onMicToggle={onMicToggle}
          connectionError={lastError}
          connectionErrorCode={lastErrorCode}
          voiceDiagnostics={voiceDiagnostics}
          onRetry={handleRetryVoice}
          onType={handleOverlayType}
        />
      )}

      <div className={`relative mt-[14px] overflow-hidden rounded-[28px] hero-purple shadow-vyva-hero ${compact ? "p-[18px_22px] sm:p-[18px_22px]" : "p-[24px_22px]"} ${isHealthHero ? "max-sm:mt-3 max-sm:rounded-[26px] max-sm:p-[18px_18px]" : ""}`}>
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Source row */}
        <div className={`flex items-center justify-between ${compact ? "mb-2" : "mb-4"} ${isHealthHero ? "max-sm:mb-3" : ""}`}>
          {resolvedSourceText ? (
            <div className="flex min-w-0 items-center gap-2">
              <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
                <Mic size={16} className="text-white" />
              </div>
              <span className="min-w-0 break-words font-body text-[13px] font-medium leading-tight" style={{ color: "rgba(255,255,255,0.85)" }}>{resolvedSourceText}</span>
            </div>
          ) : <div />}
          <div className="flex items-center gap-2">
            {onChatClick && (
              <button
                type="button"
                onClick={onChatClick}
                aria-label="Jump to chat"
                data-testid="button-home-chat-jump"
                className="w-[34px] h-[34px] rounded-full flex items-center justify-center transition-opacity active:opacity-80"
                style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)" }}
              >
                <MessageCircle size={16} style={{ color: "rgba(255,255,255,0.92)" }} />
              </button>
            )}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: connectionHalo, border: `1px solid ${connectionBorder}` }}
              aria-label={connectionLabel}
              title={connectionLabel}
              data-testid="voice-hero-status-dot"
            >
              <span className="h-2.5 w-2.5 rounded-full live-dot" style={{ background: connectionColor }} />
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1
          className={`min-w-0 font-display font-normal italic leading-[1.22] text-white ${compact ? "text-[24px] sm:text-[25px]" : "text-[28px]"}`}
          style={standardHeroHeadlineStyle}
        >
          <span className={isHealthHero ? "max-sm:text-[24px] max-sm:leading-[1.12]" : ""}>{resolvedHeadline}</span>
        </h1>
        {resolvedSubtitle && (
          <p
            className="mt-2 min-w-0 break-words font-body text-[16px] leading-relaxed"
            style={{ ...headlineClampStyle, WebkitLineClamp: 2, color: "rgba(255,255,255,0.76)" }}
          >
            {resolvedSubtitle}
          </p>
        )}

        {/* Screen-specific content */}
        {children}

        {/* Talk / Active button */}
        <button
          onClick={handleTalk}
          disabled={isStarting}
          data-testid="button-voice-hero-talk"
          className={`${compact ? "mt-3 min-h-[50px] px-[18px] py-[11px]" : "mt-4 min-h-[60px] px-[20px] py-[14px]"} flex w-full items-center justify-center gap-2 rounded-full transition-all ${isHealthHero ? "max-sm:mt-3 max-sm:min-h-[52px] max-sm:px-4 max-sm:py-3" : ""} ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : ""}`}
          style={{
            background: isActive ? "rgba(52,211,153,0.2)" : isBrainHero ? "#FFFFFF" : "rgba(255,255,255,0.13)",
            border: isActive ? "1px solid rgba(52,211,153,0.4)" : isBrainHero ? "none" : "1px solid rgba(255,255,255,0.18)",
            boxShadow: !isActive && isBrainHero ? "0 12px 28px rgba(255,255,255,0.16)" : undefined,
          }}
        >
          {isActive ? (
            <X size={18} style={{ color: "rgba(255,255,255,0.9)" }} />
          ) : (
            <Mic size={18} style={{ color: isBrainHero ? "#6B21A8" : "rgba(255,255,255,0.7)" }} />
          )}
          <span
            className={`min-w-0 max-w-full text-center font-body text-[17px] font-semibold leading-tight ${isHealthHero ? "max-sm:text-[16px] max-sm:font-extrabold" : ""}`}
            style={{ color: isActive ? "#FFFFFF" : isBrainHero ? "#6B21A8" : "#FFFFFF" }}
          >
            {mobileTalkLabel ? (
              <>
                <span className="sm:hidden">{mobileStatusLabel}</span>
                <span className="hidden sm:inline">{statusLabel}</span>
              </>
            ) : statusLabel}
          </span>
        </button>
        {inlineErrorPanel}
      </div>
    </>
  );
};

export default VoiceHero;
