import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, HeartPulse, Mic, Stethoscope, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useDoctorVoice } from "@/hooks/useDoctorVoice";
import { useHeroMessage } from "@/hooks/useHeroMessage";
import { useServiceGate } from "@/hooks/useServiceGate";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";

const DoctorChoiceScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { readiness } = useServiceGate();
  const {
    status,
    isSpeaking,
    isUserSpeaking,
    isConnecting,
    lastError,
    isVoiceLive,
    startDoctorVoice,
    stopDoctorVoice,
    startAttempted,
    userStopped,
  } = useDoctorVoice();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const autoStartRequested = Boolean((location.state as { autoStartVoice?: boolean } | null)?.autoStartVoice);
  const doctorRecommendations = readiness?.services.doctor.recommended ?? [];

  const heroMessage = useHeroMessage("doctor", {
    fallbackHeadline: t("health.doctorChoice.title", "Elige una opcion"),
    fallbackSourceText: t("health.doctorChoice.kicker", "Ayuda medica"),
    fallbackCtaLabel: t("health.doctorChoice.talkNow", "Hablar ahora"),
    fallbackContextHint: "doctor choice",
    safetyLevel: "medical",
  });

  const stopCallFallback = useMemo(() => {
    const language = i18n.language?.slice(0, 2);
    switch (language) {
      case "en":
        return "Pause listening";
      case "de":
        return "Zuhören pausieren";
      case "fr":
        return "Mettre en pause";
      case "it":
        return "Metti in pausa";
      case "pt":
        return "Pausar escuta";
      case "es":
      default:
        return "Pausar escucha";
    }
  }, [i18n.language]);

  const stopDoctorVoiceAndClearError = useCallback(() => {
    stopDoctorVoice();
    setVoiceError(null);
  }, [stopDoctorVoice]);

  const handleHeroVoiceAction = useCallback(() => {
    if (isVoiceLive) {
      stopDoctorVoiceAndClearError();
      return;
    }
    setVoiceError(null);
    void startDoctorVoice();
  }, [isVoiceLive, startDoctorVoice, stopDoctorVoiceAndClearError]);

  useEffect(() => {
    if (!lastError) return;
    const normalizedError = lastError.toLowerCase();
    const friendlyMessage = normalizedError.includes("missing elevenlabs api key")
      ? t(
          "health.doctorChoice.voiceSetupError",
          "La voz del medico no esta configurada todavia en este entorno.",
        )
      : normalizedError.includes("no elevenlabs agent configured")
        ? t(
            "health.doctorChoice.voiceAgentMissing",
            "El agente del medico no esta configurado todavia.",
          )
        : normalizedError.includes("voice session closed")
          ? t(
              "health.doctorChoice.voiceClosedDebug",
              "La sesion de voz se cerro: {{reason}}",
              { reason: lastError },
            )
        : t(
            "health.doctorChoice.voiceError",
            "La voz no se ha podido iniciar. Puede tocar una opcion.",
          );
    setVoiceError(
      friendlyMessage,
    );
  }, [lastError, t]);

  useEffect(() => {
    if (!startAttempted || userStopped || lastError) return;
    if (status === "idle" && !isConnecting && !isSpeaking && !isUserSpeaking) {
      setVoiceError(
        t(
          "health.doctorChoice.voiceDropped",
          "La conversacion se ha cortado. Toca otra vez para seguir.",
        ),
      );
    }
  }, [isConnecting, isSpeaking, isUserSpeaking, lastError, startAttempted, status, t, userStopped]);

  useEffect(() => {
    if (!autoStartRequested || startAttempted || isVoiceLive) return;
    void startDoctorVoice();
  }, [autoStartRequested, isVoiceLive, startAttempted, startDoctorVoice]);

  const handleDirect = () => {
    if (isVoiceLive) return;
    setVoiceError(null);
    void startDoctorVoice();
  };

  const handleTriage = () => {
    stopDoctorVoiceAndClearError();
    navigate("/health/symptom-check");
  };

  const heroVoiceLabel = isVoiceLive
    ? t("health.doctorChoice.stopCall", stopCallFallback)
    : heroMessage?.ctaLabel ?? t("health.doctorChoice.talkNow", "Hablar ahora");

  return (
    <div className="vyva-page pb-[120px]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stopDoctorVoiceAndClearError();
            navigate("/health");
          }}
          className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-5 py-3 font-body text-[16px] font-bold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={20} />
          {t("common.back", "Atras")}
        </button>

        <button
          type="button"
          onClick={() => {
            stopDoctorVoiceAndClearError();
            navigate("/health");
          }}
          className="vyva-tap inline-flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple shadow-sm"
          aria-label={t("common.close", "Cerrar")}
        >
          <X size={21} />
        </button>
      </div>

      <section className="relative overflow-hidden rounded-[30px] bg-[#3D0D82] p-5 text-white shadow-[0_16px_36px_rgba(91,18,160,0.24)]">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[24px] bg-white/15">
            <Stethoscope size={34} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-body text-[12px] font-bold uppercase tracking-[0.14em] text-white/65">
                {heroMessage?.sourceText ?? t("health.doctorChoice.kicker", "Ayuda medica")}
              </p>
              {isVoiceLive ? (
                <span className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 font-body text-[13px] font-extrabold text-[#0A7C4E]">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  {t("common.live", "En vivo")}
                </span>
              ) : null}
            </div>
            <h1
              className="mt-1 min-w-0 break-words font-display text-[34px] italic leading-[1.08] text-white"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {heroMessage?.headline ?? t("health.doctorChoice.title", "Elige una opcion")}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleHeroVoiceAction}
          aria-label={heroVoiceLabel}
          className={`vyva-tap relative mt-6 inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full border px-5 font-body text-[18px] font-extrabold shadow-sm transition ${
            isVoiceLive
              ? "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412]"
              : "border-white bg-white text-vyva-purple"
          }`}
        >
          {isVoiceLive ? <X size={24} /> : <Mic size={24} />}
          {heroVoiceLabel}
        </button>
      </section>

      {voiceError ? (
        <div className="mt-4 rounded-[24px] border border-[#FDBA74] bg-[#FFF7ED] px-5 py-4 font-body text-[16px] font-semibold text-[#9A3412]">
          {voiceError}
        </div>
      ) : null}

      <VoiceActionFulfillmentPanel
        domain="health"
        actionTypes={["health.doctor_support"]}
        title={t("health.doctorChoice.contextReady", "Health context ready")}
        description={t("health.doctorChoice.contextReadySub", "VYVA can use the health profile, recent symptoms, vitals, and GP context while helping here.")}
        className="mt-4"
      />

      {doctorRecommendations.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const firstRecommendation = doctorRecommendations[0];
            navigate(`${firstRecommendation.path}?returnTo=${encodeURIComponent("/health/doctor")}`);
          }}
          className="mt-4 w-full rounded-[24px] border border-[#E8DED4] bg-white px-5 py-4 text-left shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
        >
          <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.12em] text-vyva-purple">
            {t("health.doctorChoice.contextTipTitle", "Optional profile tip")}
          </p>
          <p className="mt-1 font-body text-[15px] font-semibold text-vyva-text-1">
            {doctorRecommendations[0].reason}
          </p>
        </button>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        <button
          type="button"
          onClick={handleDirect}
          className="vyva-tap flex min-h-[120px] items-center gap-4 rounded-[28px] border border-[#BBF7D0] bg-[#F0FDF4] p-5 text-left shadow-[0_10px_26px_rgba(10,124,78,0.10)]"
        >
          <span className="flex h-[62px] w-[62px] flex-shrink-0 items-center justify-center rounded-[20px] bg-white">
            <Stethoscope size={30} className="text-[#0A7C4E]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">
              {t("health.doctorChoice.directTitle", "Hablar con un medico")}
            </span>
            <span className="mt-2 block font-body text-[17px] leading-snug text-vyva-text-2">
              {t("health.doctorChoice.directSubtitle", "Llamada o videollamada")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-[#0A7C4E]" />
        </button>

        <button
          type="button"
          onClick={handleTriage}
          className="vyva-tap flex min-h-[120px] items-center gap-4 rounded-[28px] border border-[#E8DED4] bg-white p-5 text-left shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
        >
          <span className="flex h-[62px] w-[62px] flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF]">
            <HeartPulse size={30} className="text-vyva-purple" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">
              {t("health.doctorChoice.triageTitle", "Hacer triaje primero")}
            </span>
            <span className="mt-2 block font-body text-[17px] leading-snug text-vyva-text-2">
              {t("health.doctorChoice.triageSubtitle", "Preguntas rapidas")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-vyva-purple" />
        </button>
      </div>
    </div>
  );
};

export default DoctorChoiceScreen;
