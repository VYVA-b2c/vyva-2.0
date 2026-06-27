import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Mic, MessageCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type TranscriptEntry, type VoiceConnectionErrorCode, useVyvaVoice } from "@/hooks/useVyvaVoice";
import { recordHeroEvent, type HeroSurface } from "@/lib/heroMessages";
import { type UseHeroMessageOptions, useHeroMessage } from "@/hooks/useHeroMessage";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";

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
  onTalkClick?: () => void;
  onChatClick?: () => void;
  weatherData?: WeatherData | null;
  autoStartVoice?: boolean | string;
  autoStartListening?: boolean;
  showVoiceOverlay?: boolean;
  activeLabel?: string;
  connectingLabel?: string;
  mobileTalkLabel?: string;
  voiceControls?: {
    status: "idle" | "connecting" | "connected";
    isSpeaking: boolean;
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
  onTalkClick,
  onChatClick,
  weatherData,
  autoStartVoice,
  autoStartListening = false,
  showVoiceOverlay = false,
  activeLabel,
  connectingLabel,
  mobileTalkLabel,
  voiceControls,
}) => {
  const { t } = useTranslation();
  const internalVoice = useVyvaVoice();
  const {
    startVoice,
    stopVoice: internalStopVoice,
    status: internalStatus,
    isSpeaking: internalIsSpeaking,
    isConnecting: internalIsConnecting,
    transcript: internalTranscript,
    voiceSessionPhase: internalVoiceSessionPhase,
    isMicMuted: internalIsMicMuted,
    setMicrophoneMuted: internalSetMicrophoneMuted,
    lastError: internalLastError,
    lastErrorCode: internalLastErrorCode,
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
  const isConnecting = voiceControls?.isConnecting ?? internalIsConnecting;
  const transcript = voiceControls?.transcript ?? internalTranscript;
  const stopVoice = voiceControls?.onEnd ?? internalStopVoice;
  const voiceSessionPhase = voiceControls?.voiceSessionPhase ?? internalVoiceSessionPhase;
  const isMicMuted = voiceControls?.isMicMuted ?? internalIsMicMuted;
  const onMicToggle = voiceControls?.onMicToggle ?? internalSetMicrophoneMuted;
  const lastError = voiceControls?.lastError ?? internalLastError;
  const lastErrorCode = voiceControls?.lastErrorCode ?? internalLastErrorCode;
  const shouldShowOverlay = voiceControls?.showOverlay ?? showVoiceOverlay;
  const autoStartKey = typeof autoStartVoice === "string"
    ? autoStartVoice
    : autoStartVoice
      ? "voice-hero-auto-start"
      : null;
  const [browserOnline, setBrowserOnline] = useState(readBrowserOnline);
  const [focusedVoiceOverlayRequested, setFocusedVoiceOverlayRequested] = useState(false);
  const autoStartedRef = useRef<string | null>(null);
  const focusedOverlaySawLiveSessionRef = useRef(false);

  const isActive = voiceStatus === "connected";
  const hasConnectionError = Boolean(lastError && !isActive && !isConnecting);
  const showOverlay = (shouldShowOverlay || focusedVoiceOverlayRequested) && (isActive || isConnecting || hasConnectionError);

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

    if (isActive || isConnecting || hasConnectionError) {
      focusedOverlaySawLiveSessionRef.current = true;
      return;
    }

    if (focusedOverlaySawLiveSessionRef.current) {
      focusedOverlaySawLiveSessionRef.current = false;
      setFocusedVoiceOverlayRequested(false);
      return;
    }

    const clearPendingOverlay = window.setTimeout(() => {
      setFocusedVoiceOverlayRequested(false);
    }, 5000);

    return () => window.clearTimeout(clearPendingOverlay);
  }, [focusedVoiceOverlayRequested, hasConnectionError, isActive, isConnecting]);

  const handleOverlayEnd = () => {
    setFocusedVoiceOverlayRequested(false);
    stopVoice();
  };

  const handleRetryVoice = () => {
    if (isActive || isConnecting) return;
    setFocusedVoiceOverlayRequested(true);
    void Promise.resolve(startVoice(resolvedContextHint, undefined, voiceStartOptions)).catch(() => {});
  };

  const handleTalk = () => {
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
      stopVoice();
    } else if (onTalkClick) {
      setFocusedVoiceOverlayRequested(true);
      onTalkClick();
    } else {
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
    : isActive
    ? voiceControls?.activeLabel ?? activeLabel ?? (voiceSessionPhase
        ? voiceSessionPhaseLabel(voiceSessionPhase)
        : isSpeaking
          ? t("voiceHero.speaking")
          : t("voiceHero.listening"))
    : resolvedTalkLabel ?? t("voiceHero.talkToVyva");
  const mobileStatusLabel = !isConnecting && !isActive && mobileTalkLabel ? mobileTalkLabel : statusLabel;
  const connectionLabel = browserOnline ? t("statusVitals.online", "Online") : t("statusVitals.offline", "Offline");
  const connectionColor = browserOnline ? "#34D399" : "#EF4444";
  const connectionHalo = browserOnline ? "rgba(52,211,153,0.24)" : "rgba(239,68,68,0.20)";
  const connectionBorder = browserOnline ? "rgba(52,211,153,0.42)" : "rgba(239,68,68,0.36)";
  const isBrainHero = heroSurface === "brain";
  const isHealthHero = heroSurface === "health";
  const standardHeroHeadlineStyle = isHealthHero
    ? { ...headlineClampStyle, overflowWrap: "normal" as const, wordBreak: "normal" as const }
    : headlineClampStyle;

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
            voiceSessionPhase={voiceSessionPhase}
            isMicMuted={isMicMuted}
            onMicToggle={onMicToggle}
            connectionError={lastError}
            connectionErrorCode={lastErrorCode}
            onRetry={handleRetryVoice}
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
                disabled={isConnecting}
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
          voiceSessionPhase={voiceSessionPhase}
          isMicMuted={isMicMuted}
          onMicToggle={onMicToggle}
          connectionError={lastError}
          connectionErrorCode={lastErrorCode}
          onRetry={handleRetryVoice}
        />
      )}

      <div className={`relative mt-[14px] overflow-hidden rounded-[28px] p-[24px_22px] hero-purple shadow-vyva-hero ${isHealthHero ? "max-sm:mt-3 max-sm:rounded-[26px] max-sm:p-[18px_18px]" : ""}`}>
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Source row */}
        <div className={`flex items-center justify-between mb-4 ${isHealthHero ? "max-sm:mb-3" : ""}`}>
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
          className="min-w-0 font-display text-[28px] font-normal italic leading-[1.22] text-white"
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
          disabled={isConnecting}
          data-testid="button-voice-hero-talk"
          className={`mt-4 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-full px-[20px] py-[14px] transition-all ${isHealthHero ? "max-sm:mt-3 max-sm:min-h-[52px] max-sm:px-4 max-sm:py-3" : ""} ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : ""}`}
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
      </div>
    </>
  );
};

export default VoiceHero;
