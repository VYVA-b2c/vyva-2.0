import React, { useEffect, useMemo, useRef } from "react";
import { Mic, MessageCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type TranscriptEntry, useVyvaVoice } from "@/hooks/useVyvaVoice";
import { type HeroSurface } from "@/lib/heroMessages";
import { type UseHeroMessageOptions, useHeroMessage } from "@/hooks/useHeroMessage";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import VyvaAvatar from "@/components/VyvaAvatar";

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
  voiceDynamicVariables?: Record<string, string | number | boolean>;
  talkLabel?: string;
  onTalkClick?: () => void;
  onChatClick?: () => void;
  weatherData?: WeatherData | null;
  autoStartVoice?: boolean | string;
  showVoiceOverlay?: boolean;
  activeLabel?: string;
  connectingLabel?: string;
  voiceControls?: {
    status: "idle" | "connecting" | "connected";
    isSpeaking: boolean;
    isConnecting: boolean;
    transcript?: TranscriptEntry[];
    onEnd: () => void;
    showOverlay?: boolean;
    activeLabel?: string;
    connectingLabel?: string;
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

const VoiceHero: React.FC<VoiceHeroProps> = ({
  heroSurface,
  heroContext,
  sourceText,
  headline,
  subtitle,
  children,
  contextHint,
  voiceDynamicVariables,
  talkLabel,
  onTalkClick,
  onChatClick,
  weatherData,
  autoStartVoice,
  showVoiceOverlay = true,
  activeLabel,
  connectingLabel,
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
  const shouldShowOverlay = voiceControls?.showOverlay ?? showVoiceOverlay;
  const autoStartKey = typeof autoStartVoice === "string"
    ? autoStartVoice
    : autoStartVoice
      ? "voice-hero-auto-start"
      : null;
  const autoStartedRef = useRef<string | null>(null);

  const isActive = voiceStatus === "connected";
  const showOverlay = shouldShowOverlay && (isActive || isConnecting);

  useEffect(() => {
    if (!autoStartKey || voiceControls) return;
    if (autoStartedRef.current === autoStartKey) return;
    if (internalStatus !== "idle" || internalIsConnecting) return;

    autoStartedRef.current = autoStartKey;
    void startVoice(
      resolvedContextHint,
      undefined,
      voiceDynamicVariables ? { dynamicVariables: voiceDynamicVariables } : undefined,
    );
  }, [
    autoStartKey,
    internalIsConnecting,
    internalStatus,
    resolvedContextHint,
    startVoice,
    voiceDynamicVariables,
    voiceControls,
  ]);

  const handleTalk = () => {
    if (isActive) {
      stopVoice();
    } else if (onTalkClick) {
      onTalkClick();
    } else {
      startVoice(
        resolvedContextHint,
        undefined,
        voiceDynamicVariables ? { dynamicVariables: voiceDynamicVariables } : undefined,
      );
    }
  };

  const statusLabel = isConnecting
    ? voiceControls?.connectingLabel ?? connectingLabel ?? t("voiceHero.connecting")
    : isActive
    ? voiceControls?.activeLabel ?? activeLabel ?? (isSpeaking
        ? t("voiceHero.speaking")
        : t("voiceHero.listening"))
    : resolvedTalkLabel ?? t("voiceHero.talkToVyva");

  const timeOfDay = useMemo((): "morning" | "afternoon" | "evening" => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 11) return "morning";
    if (hour >= 12 && hour <= 17) return "afternoon";
    return "evening";
  }, []);

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
            onEnd={stopVoice}
          />
        )}

        <div className="mt-[14px] rounded-[24px] relative overflow-visible hero-purple" style={{ paddingTop: "0" }}>
          {/* En Vivo badge — top right */}
          <div className="absolute top-[14px] right-[16px] flex items-center gap-1.5 px-[10px] py-[4px] rounded-full z-10" style={{ background: isActive ? "rgba(52,211,153,0.3)" : "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
            <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
            <span className="text-[11px] font-body" style={{ color: "#34D399" }}>{isActive ? t("voiceHero.active") : t("voiceHero.live")}</span>
          </div>

          {/* Avatar — anchored to card bottom-right */}
          <img
            src="/assets/vyva/avatar-calm.png"
            alt="VYVA"
            draggable={false}
            className="absolute pointer-events-none select-none vyva-avatar"
            style={{
              width: "auto",
              height: "220px",
              bottom: "18px",
              right: "-46px",
              filter: timeOfDay ? { morning: "brightness(1.06) saturate(1.08)", afternoon: "brightness(1.0) saturate(1.0)", evening: "brightness(0.92) saturate(0.9) sepia(0.08)" }[timeOfDay] : undefined,
            }}
          />

          <div className="flex min-h-[268px]">
            {/* Left column — text + CTA */}
            <div className="flex-[0_0_62%] flex flex-col gap-0 px-[22px] pt-[30px] pb-[20px] min-w-0">
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
                className={`mt-[24px] flex min-h-[74px] w-full items-center justify-center gap-3 rounded-full px-[24px] py-[18px] transition-all ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : ""}`}
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
                  className="min-w-0 max-w-full text-center font-body text-[20px] font-extrabold leading-tight"
                  style={{ color: isActive ? "#ffffff" : "#6B21A8" }}
                >
                  {statusLabel}
                </span>
              </button>
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
          onEnd={stopVoice}
        />
      )}

      <div className="relative mt-[14px] overflow-hidden rounded-[28px] p-[24px_22px] hero-purple shadow-vyva-hero">
        <div className="absolute -right-[30px] -top-[30px] w-[130px] h-[130px] rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Source row */}
        <div className="flex items-center justify-between mb-4">
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
            <div className="flex items-center gap-1.5 px-[10px] py-[3px] rounded-full" style={{ background: isActive ? "rgba(52,211,153,0.3)" : "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.28)" }}>
              <div className="w-[6px] h-[6px] rounded-full live-dot" style={{ background: "#34D399" }} />
              <span className="text-[11px] font-body" style={{ color: "#34D399" }}>{isActive ? t("voiceHero.active") : t("voiceHero.live")}</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1
          className="min-w-0 font-display text-[28px] font-normal italic leading-[1.22] text-white"
          style={headlineClampStyle}
        >
          {resolvedHeadline}
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
          className={`mt-4 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-full px-[20px] py-[14px] transition-all ${isActive ? (isSpeaking ? "mic-listening" : "mic-pulse-listening") : ""}`}
          style={{
            background: isActive ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.13)",
            border: isActive ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {isActive ? (
            <X size={18} style={{ color: "rgba(255,255,255,0.9)" }} />
          ) : (
            <Mic size={18} style={{ color: "rgba(255,255,255,0.7)" }} />
          )}
          <span className="min-w-0 max-w-full text-center font-body text-[17px] font-semibold leading-tight text-white">{statusLabel}</span>
        </button>
      </div>
    </>
  );
};

export default VoiceHero;
